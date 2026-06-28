// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PrecompileConsumer} from "./utils/PrecompileConsumer.sol";

interface IRitualWallet {
    function deposit(uint256 lockDuration) external payable;
    function depositFor(address user, uint256 lockDuration) external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address) external view returns (uint256);
    function lockUntil(address) external view returns (uint256);
}

/**
 * @title EclipseBountyJudge
 * @notice Privacy-preserving, AI-judged bounties on Ritual L1.
 *
 *         An "eclipse" hides every answer while submissions are open: a
 *         participant publishes only a commitment corona
 *         `keccak256(abi.encode(answer, salt, sender, bountyId))`. Once the
 *         submission window closes the eclipse breaks — participants reveal
 *         (answer, salt) and the contract verifies the corona. After the reveal
 *         window, the owner sends every revealed answer to Ritual's LLM in ONE
 *         batch call (`judgeAll`); the model recommends, and a human owner
 *         finalizes the winner and releases the reward.
 *
 *         Design notes that differ from the workshop starter:
 *         - Phase is an explicit enum (`phaseOf`) rather than implied by flags.
 *         - Commitments use `abi.encode` (not `encodePacked`) to remove any
 *           dynamic-string boundary ambiguity.
 *         - Custom errors instead of string requires.
 *         - `reclaimReward` frees a reward that would otherwise lock forever if
 *           nobody ever reveals.
 *         - judging never reverts on an LLM-side error (that would roll back the
 *           whole async replay and wedge the bounty); the completion is stored
 *           only when clean, and the human still finalizes.
 */
contract EclipseBountyJudge is PrecompileConsumer {
    // ----------------------------------------------------------- constants
    uint256 public constant MAX_ENTRIES = 12;
    uint256 public constant MAX_ANSWER_BYTES = 2_000;
    uint256 public constant NO_WINNER = type(uint256).max;

    IRitualWallet public constant RITUAL_WALLET =
        IRitualWallet(0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948);

    // ----------------------------------------------------------- types
    enum Phase {
        Commit, // accepting eclipsed commitments
        Reveal, // accepting reveals
        Judging, // reveal window closed, awaiting judgeAll
        Judged, // AI verdict recorded, awaiting finalize
        Finalized // winner fixed, reward paid (or reclaimed)
    }

    struct Entry {
        address author;
        bytes32 corona; // commitment hash
        bool revealed;
        string answer; // empty until revealed
    }

    struct Bounty {
        address owner;
        string title;
        string rubric;
        uint256 reward;
        uint64 commitClose; // commitments accepted strictly before this (ms)
        uint64 revealClose; // reveals accepted in [commitClose, revealClose) (ms)
        bool judged;
        bool finalized;
        bool reclaimed;
        uint256 winner; // NO_WINNER until finalized
        uint256 revealedCount;
        bytes aiVerdict; // raw LLM completion (advisory only)
        Entry[] entries;
    }

    // The conversation-history tuple the LLM precompile appends to its response.
    struct ConvoHistory {
        string storageType;
        string path;
        string secretsName;
    }

    // ----------------------------------------------------------- storage
    uint256 public nextBountyId = 1;
    mapping(uint256 => Bounty) private _bounties;
    // bountyId => author => 1-based entry index (0 = none)
    mapping(uint256 => mapping(address => uint256)) private _entrySlot;

    // ----------------------------------------------------------- events
    event BountyOpened(
        uint256 indexed bountyId,
        address indexed owner,
        string title,
        uint256 reward,
        uint64 commitClose,
        uint64 revealClose
    );
    event Eclipsed(uint256 indexed bountyId, uint256 indexed entryIndex, address indexed author, bytes32 corona);
    event Revealed(uint256 indexed bountyId, uint256 indexed entryIndex, address indexed author);
    event ConstellationJudged(uint256 indexed bountyId, uint256 revealedCount, bytes aiVerdict);
    event WinnerAligned(uint256 indexed bountyId, uint256 indexed winner, address indexed author, uint256 reward);
    event RewardReclaimed(uint256 indexed bountyId, address indexed owner, uint256 reward);

    // ----------------------------------------------------------- errors
    error NotOwner();
    error UnknownBounty();
    error RewardRequired();
    error BadWindow();
    error CommitsClosed();
    error EmptyCorona();
    error AlreadyEntered();
    error TooManyEntries();
    error RevealNotOpen();
    error RevealClosed();
    error BadAnswerLength();
    error NoEntry();
    error AlreadyRevealed();
    error CoronaMismatch();
    error RevealNotFinished();
    error AlreadyJudged();
    error AlreadyFinalized();
    error NoRevealedAnswers();
    error NotJudged();
    error BadIndex();
    error WinnerNotRevealed();
    error PayoutFailed();
    error CannotReclaim();

    // ----------------------------------------------------------- modifiers
    modifier onlyOwner(uint256 bountyId) {
        if (msg.sender != _bounties[bountyId].owner) revert NotOwner();
        _;
    }

    modifier exists(uint256 bountyId) {
        if (_bounties[bountyId].owner == address(0)) revert UnknownBounty();
        _;
    }

    // ----------------------------------------------------------- create
    function createBounty(
        string calldata title,
        string calldata rubric,
        uint256 submissionDeadline,
        uint256 revealDeadline
    ) external payable returns (uint256 bountyId) {
        if (msg.value == 0) revert RewardRequired();
        if (submissionDeadline <= block.timestamp) revert BadWindow();
        if (revealDeadline <= submissionDeadline) revert BadWindow();

        bountyId = nextBountyId++;
        Bounty storage b = _bounties[bountyId];
        b.owner = msg.sender;
        b.title = title;
        b.rubric = rubric;
        b.reward = msg.value;
        b.commitClose = uint64(submissionDeadline);
        b.revealClose = uint64(revealDeadline);
        b.winner = NO_WINNER;

        emit BountyOpened(bountyId, msg.sender, title, msg.value, b.commitClose, b.revealClose);
    }

    // --------------------------------------------------- required: commit
    function submitCommitment(uint256 bountyId, bytes32 commitment) external exists(bountyId) {
        Bounty storage b = _bounties[bountyId];
        if (block.timestamp >= b.commitClose) revert CommitsClosed();
        if (commitment == bytes32(0)) revert EmptyCorona();
        if (_entrySlot[bountyId][msg.sender] != 0) revert AlreadyEntered();
        if (b.entries.length >= MAX_ENTRIES) revert TooManyEntries();

        b.entries.push(Entry({author: msg.sender, corona: commitment, revealed: false, answer: ""}));
        uint256 index = b.entries.length - 1;
        _entrySlot[bountyId][msg.sender] = index + 1; // 1-based

        emit Eclipsed(bountyId, index, msg.sender, commitment);
    }

    // --------------------------------------------------- required: reveal
    function revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt) external exists(bountyId) {
        Bounty storage b = _bounties[bountyId];
        if (block.timestamp < b.commitClose) revert RevealNotOpen();
        if (block.timestamp >= b.revealClose) revert RevealClosed();

        uint256 len = bytes(answer).length;
        if (len == 0 || len > MAX_ANSWER_BYTES) revert BadAnswerLength();

        uint256 slot = _entrySlot[bountyId][msg.sender];
        if (slot == 0) revert NoEntry();

        Entry storage e = b.entries[slot - 1];
        if (e.revealed) revert AlreadyRevealed();

        // NOTE: abi.encode (not encodePacked) — the client must match exactly.
        if (keccak256(abi.encode(answer, salt, msg.sender, bountyId)) != e.corona) revert CoronaMismatch();

        e.answer = answer;
        e.revealed = true;
        b.revealedCount += 1;

        emit Revealed(bountyId, slot - 1, msg.sender);
    }

    // --------------------------------------------------- required: judge
    /// @param llmInput ABI-encoded Ritual LLM request carrying ALL revealed
    ///        answers in ONE batch (built off-chain). Empty on non-Ritual chains.
    function judgeAll(uint256 bountyId, bytes calldata llmInput) external exists(bountyId) onlyOwner(bountyId) {
        Bounty storage b = _bounties[bountyId];
        if (block.timestamp < b.revealClose) revert RevealNotFinished();
        if (b.judged) revert AlreadyJudged();
        if (b.finalized) revert AlreadyFinalized();
        if (b.revealedCount == 0) revert NoRevealedAnswers();

        if (llmInput.length > 0) {
            bytes memory output = _executePrecompile(LLM_INFERENCE_PRECOMPILE, llmInput);
            if (output.length > 0) {
                // Decode the Ritual LLM envelope. We deliberately do NOT revert
                // on hasError: reverting here would roll back the entire async
                // replay (including judged=true) and wedge the bounty forever.
                (bool hasError, bytes memory completion,,,) =
                    abi.decode(output, (bool, bytes, bytes, string, ConvoHistory));
                if (!hasError) {
                    b.aiVerdict = completion;
                }
            }
        }

        b.judged = true;
        emit ConstellationJudged(bountyId, b.revealedCount, b.aiVerdict);
    }

    // --------------------------------------------------- required: finalize
    function finalizeWinner(uint256 bountyId, uint256 winnerIndex) external exists(bountyId) onlyOwner(bountyId) {
        Bounty storage b = _bounties[bountyId];
        if (!b.judged) revert NotJudged();
        if (b.finalized) revert AlreadyFinalized();
        if (winnerIndex >= b.entries.length) revert BadIndex();

        Entry storage win = b.entries[winnerIndex];
        if (!win.revealed) revert WinnerNotRevealed();

        b.finalized = true;
        b.winner = winnerIndex;

        uint256 reward = b.reward;
        b.reward = 0;
        (bool ok, ) = payable(win.author).call{value: reward}("");
        if (!ok) revert PayoutFailed();

        emit WinnerAligned(bountyId, winnerIndex, win.author, reward);
    }

    // --------------------------------------------------- escape hatch
    /// @notice If the reveal window passed with zero revealed answers, the owner
    ///         can recover the locked reward instead of it being stuck forever.
    function reclaimReward(uint256 bountyId) external exists(bountyId) onlyOwner(bountyId) {
        Bounty storage b = _bounties[bountyId];
        if (b.finalized || b.reclaimed) revert AlreadyFinalized();
        // only once the reveal window is over and nobody revealed
        if (block.timestamp < b.revealClose) revert CannotReclaim();
        if (b.revealedCount != 0) revert CannotReclaim();

        b.reclaimed = true;
        b.finalized = true;
        uint256 reward = b.reward;
        b.reward = 0;
        (bool ok, ) = payable(b.owner).call{value: reward}("");
        if (!ok) revert PayoutFailed();

        emit RewardReclaimed(bountyId, b.owner, reward);
    }

    // ----------------------------------------------------------- views
    function phaseOf(uint256 bountyId) public view exists(bountyId) returns (Phase) {
        Bounty storage b = _bounties[bountyId];
        if (b.finalized) return Phase.Finalized;
        if (b.judged) return Phase.Judged;
        if (block.timestamp < b.commitClose) return Phase.Commit;
        if (block.timestamp < b.revealClose) return Phase.Reveal;
        return Phase.Judging;
    }

    function getBounty(uint256 bountyId)
        external
        view
        exists(bountyId)
        returns (
            address owner,
            string memory title,
            string memory rubric,
            uint256 reward,
            uint256 submissionDeadline,
            uint256 revealDeadline,
            bool judged,
            bool finalized,
            uint256 entryCount,
            uint256 revealedCount,
            uint256 winnerIndex,
            bytes memory aiVerdict
        )
    {
        Bounty storage b = _bounties[bountyId];
        return (
            b.owner,
            b.title,
            b.rubric,
            b.reward,
            b.commitClose,
            b.revealClose,
            b.judged,
            b.finalized,
            b.entries.length,
            b.revealedCount,
            b.winner,
            b.aiVerdict
        );
    }

    function getSubmission(uint256 bountyId, uint256 index)
        external
        view
        exists(bountyId)
        returns (address author, bytes32 commitment, bool revealed, string memory answer)
    {
        Bounty storage b = _bounties[bountyId];
        if (index >= b.entries.length) revert BadIndex();
        Entry storage e = b.entries[index];
        return (e.author, e.corona, e.revealed, e.answer);
    }

    function entrySlot(uint256 bountyId, address author) external view returns (uint256) {
        return _entrySlot[bountyId][author];
    }

    function entryCount(uint256 bountyId) external view exists(bountyId) returns (uint256) {
        return _bounties[bountyId].entries.length;
    }

    /// @notice Build a commitment exactly like the contract does (abi.encode).
    function computeCommitment(
        string calldata answer,
        bytes32 salt,
        address author,
        uint256 bountyId
    ) external pure returns (bytes32) {
        return keccak256(abi.encode(answer, salt, author, bountyId));
    }
}
