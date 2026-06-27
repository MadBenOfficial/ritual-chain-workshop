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
 * @title AIJudge (Commit-Reveal Bounty)
 * @notice Privacy-preserving AI bounty judge.
 *
 *         The original workshop version made answers public the instant they
 *         were submitted, so later entrants could copy and improve on earlier
 *         ideas. This version fixes that with a COMMIT-REVEAL flow:
 *
 *           1. Submission phase: participants post only a commitment hash
 *              keccak256(answer, salt, msg.sender, bountyId). Nobody can read
 *              an answer they cannot see.
 *           2. Reveal phase (after the submission deadline): participants reveal
 *              (answer, salt); the contract recomputes the hash and verifies it.
 *              Only valid reveals are eligible for judging.
 *           3. judgeAll: after the reveal deadline, the owner sends ALL revealed
 *              answers to the Ritual LLM precompile in a SINGLE batch request.
 *           4. finalizeWinner: a human owner picks the winner (the AI only
 *              recommends) and the reward is paid.
 *
 *         Works on any EVM chain: on a non-Ritual chain the LLM precompile has
 *         no code and returns empty bytes, so judging still records the owner's
 *         off-chain verdict reference and the flow completes.
 */
contract AIJudge is PrecompileConsumer {
    uint256 public constant MAX_SUBMISSIONS = 10;
    uint256 public constant MAX_ANSWER_LENGTH = 2_000;

    uint256 public nextBountyId = 1;

    IRitualWallet wallet =
        IRitualWallet(0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948);

    struct Submission {
        address submitter;
        bytes32 commitment; // keccak256(answer, salt, submitter, bountyId)
        string answer; // empty until a valid reveal
        bool revealed;
    }

    struct Bounty {
        address owner;
        string title;
        string rubric;
        uint256 reward;
        uint256 submissionDeadline; // commitments accepted strictly before this
        uint256 revealDeadline; // reveals accepted in [submissionDeadline, revealDeadline)
        bool judged;
        bool finalized;
        bytes aiReview; // raw LLM completion (recommendation only)
        string verdictRef; // off-chain verdict/answers bundle reference
        bytes32 verdictHash; // commitment to that bundle
        uint256 winnerIndex;
        uint256 revealedCount;
        Submission[] submissions;
    }

    struct ConvoHistory {
        string storageType;
        string path;
        string secretsName;
    }

    mapping(uint256 => Bounty) public bounties;
    // bountyId => participant => 1-based submission index (0 = none)
    mapping(uint256 => mapping(address => uint256)) public commitmentSlot;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed owner,
        string title,
        uint256 reward,
        uint256 submissionDeadline,
        uint256 revealDeadline
    );

    event CommitmentSubmitted(
        uint256 indexed bountyId,
        uint256 indexed submissionIndex,
        address indexed submitter,
        bytes32 commitment
    );

    event AnswerRevealed(
        uint256 indexed bountyId,
        uint256 indexed submissionIndex,
        address indexed submitter
    );

    event AllAnswersJudged(uint256 indexed bountyId, bytes aiReview);

    event WinnerFinalized(
        uint256 indexed bountyId,
        uint256 indexed winnerIndex,
        address indexed winner,
        uint256 reward
    );

    modifier onlyOwner(uint256 bountyId) {
        require(msg.sender == bounties[bountyId].owner, "not bounty owner");
        _;
    }

    modifier bountyExists(uint256 bountyId) {
        require(bounties[bountyId].owner != address(0), "bounty not found");
        _;
    }

    // ---------------------------------------------------------------- create

    function createBounty(
        string calldata title,
        string calldata rubric,
        uint256 submissionDeadline,
        uint256 revealDeadline
    ) external payable returns (uint256 bountyId) {
        require(msg.value > 0, "reward required");
        require(submissionDeadline > block.timestamp, "submission deadline in past");
        require(revealDeadline > submissionDeadline, "reveal must follow submission");

        bountyId = nextBountyId++;

        Bounty storage bounty = bounties[bountyId];

        bounty.owner = msg.sender;
        bounty.title = title;
        bounty.rubric = rubric;
        bounty.reward = msg.value;
        bounty.submissionDeadline = submissionDeadline;
        bounty.revealDeadline = revealDeadline;
        bounty.winnerIndex = type(uint256).max;

        emit BountyCreated(bountyId, msg.sender, title, msg.value, submissionDeadline, revealDeadline);
    }

    // ----------------------------------------------------- required functions

    /// @notice Submit only a commitment hash during the submission phase.
    function submitCommitment(uint256 bountyId, bytes32 commitment)
        external
        bountyExists(bountyId)
    {
        Bounty storage bounty = bounties[bountyId];

        require(block.timestamp < bounty.submissionDeadline, "submissions closed");
        require(commitment != bytes32(0), "empty commitment");
        require(commitmentSlot[bountyId][msg.sender] == 0, "already committed");
        require(bounty.submissions.length < MAX_SUBMISSIONS, "too many submissions");

        bounty.submissions.push(
            Submission({
                submitter: msg.sender,
                commitment: commitment,
                answer: "",
                revealed: false
            })
        );

        uint256 index = bounty.submissions.length - 1;
        commitmentSlot[bountyId][msg.sender] = index + 1; // 1-based

        emit CommitmentSubmitted(bountyId, index, msg.sender, commitment);
    }

    /// @notice Reveal (answer, salt); verified against the stored commitment.
    function revealAnswer(
        uint256 bountyId,
        string calldata answer,
        bytes32 salt
    ) external bountyExists(bountyId) {
        Bounty storage bounty = bounties[bountyId];

        require(block.timestamp >= bounty.submissionDeadline, "reveal not open");
        require(block.timestamp < bounty.revealDeadline, "reveal closed");
        require(bytes(answer).length > 0 && bytes(answer).length <= MAX_ANSWER_LENGTH, "bad answer length");

        uint256 slot = commitmentSlot[bountyId][msg.sender];
        require(slot != 0, "no commitment");

        Submission storage submission = bounty.submissions[slot - 1];
        require(!submission.revealed, "already revealed");

        bytes32 expected = keccak256(abi.encodePacked(answer, salt, msg.sender, bountyId));
        require(expected == submission.commitment, "commitment mismatch");

        submission.answer = answer;
        submission.revealed = true;
        bounty.revealedCount += 1;

        emit AnswerRevealed(bountyId, slot - 1, msg.sender);
    }

    /// @notice Batch-judge all revealed answers via the Ritual LLM precompile.
    /// @param llmInput ABI-encoded LLM request built off-chain that contains ALL
    ///                 revealed answers in ONE request (not one call per answer).
    function judgeAll(uint256 bountyId, bytes calldata llmInput)
        external
        bountyExists(bountyId)
        onlyOwner(bountyId)
    {
        Bounty storage bounty = bounties[bountyId];

        require(block.timestamp >= bounty.revealDeadline, "reveal not finished");
        require(!bounty.judged, "already judged");
        require(!bounty.finalized, "already finalized");
        require(bounty.revealedCount > 0, "no revealed answers");

        // On Ritual, llmInput is the ABI-encoded batch request for precompile
        // 0x0802. On a non-Ritual chain (or in unit tests) the precompile has no
        // code: callers pass empty llmInput, and we skip the call so the flow
        // still completes and the off-chain verdict reference can be recorded.
        if (llmInput.length > 0) {
            bytes memory output = _executePrecompile(LLM_INFERENCE_PRECOMPILE, llmInput);
            if (output.length > 0) {
                (
                    bool hasError,
                    bytes memory completionData,
                    ,
                    string memory errorMessage,

                ) = abi.decode(output, (bool, bytes, bytes, string, ConvoHistory));

                require(!hasError, errorMessage);
                bounty.aiReview = completionData;
            }
        }

        bounty.judged = true;

        emit AllAnswersJudged(bountyId, bounty.aiReview);
    }

    /// @notice Record an off-chain verdict bundle reference + hash (advanced
    ///         track reveal pattern). Optional; callable by the owner after judging.
    function setVerdictReference(uint256 bountyId, string calldata verdictRef, bytes32 verdictHash)
        external
        bountyExists(bountyId)
        onlyOwner(bountyId)
    {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.judged, "not judged yet");
        bounty.verdictRef = verdictRef;
        bounty.verdictHash = verdictHash;
    }

    /// @notice A human owner finalizes one winner; the reward is paid.
    function finalizeWinner(uint256 bountyId, uint256 winnerIndex)
        external
        bountyExists(bountyId)
        onlyOwner(bountyId)
    {
        Bounty storage bounty = bounties[bountyId];

        require(bounty.judged, "not judged yet");
        require(!bounty.finalized, "already finalized");
        require(winnerIndex < bounty.submissions.length, "invalid index");

        Submission storage winnerSubmission = bounty.submissions[winnerIndex];
        require(winnerSubmission.revealed, "winner not revealed"); // unrevealed are ineligible

        bounty.finalized = true;
        bounty.winnerIndex = winnerIndex;

        address winner = winnerSubmission.submitter;
        uint256 reward = bounty.reward;
        bounty.reward = 0;

        (bool ok, ) = payable(winner).call{value: reward}("");
        require(ok, "payment failed");

        emit WinnerFinalized(bountyId, winnerIndex, winner, reward);
    }

    // ------------------------------------------------------------------ views

    function getBounty(uint256 bountyId)
        external
        view
        bountyExists(bountyId)
        returns (
            address owner,
            string memory title,
            string memory rubric,
            uint256 reward,
            uint256 submissionDeadline,
            uint256 revealDeadline,
            bool judged,
            bool finalized,
            uint256 submissionCount,
            uint256 revealedCount,
            uint256 winnerIndex,
            bytes memory aiReview
        )
    {
        Bounty storage bounty = bounties[bountyId];

        return (
            bounty.owner,
            bounty.title,
            bounty.rubric,
            bounty.reward,
            bounty.submissionDeadline,
            bounty.revealDeadline,
            bounty.judged,
            bounty.finalized,
            bounty.submissions.length,
            bounty.revealedCount,
            bounty.winnerIndex,
            bounty.aiReview
        );
    }

    function getVerdictReference(uint256 bountyId)
        external
        view
        bountyExists(bountyId)
        returns (string memory verdictRef, bytes32 verdictHash)
    {
        Bounty storage bounty = bounties[bountyId];
        return (bounty.verdictRef, bounty.verdictHash);
    }

    /// @notice During the submission phase `answer` is "" for everyone; it is
    ///         only populated after a valid reveal. This is what keeps answers
    ///         hidden until the reveal phase.
    function getSubmission(uint256 bountyId, uint256 index)
        external
        view
        bountyExists(bountyId)
        returns (address submitter, bytes32 commitment, bool revealed, string memory answer)
    {
        Bounty storage bounty = bounties[bountyId];
        require(index < bounty.submissions.length, "invalid index");

        Submission storage submission = bounty.submissions[index];
        return (submission.submitter, submission.commitment, submission.revealed, submission.answer);
    }

    function submissionCount(uint256 bountyId)
        external
        view
        bountyExists(bountyId)
        returns (uint256)
    {
        return bounties[bountyId].submissions.length;
    }

    /// @notice Helper so clients/tests build commitments exactly like the contract.
    function computeCommitment(
        string calldata answer,
        bytes32 salt,
        address submitter,
        uint256 bountyId
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(answer, salt, submitter, bountyId));
    }
}
