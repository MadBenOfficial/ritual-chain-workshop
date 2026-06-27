# Privacy-Preserving AI Bounty Judge

Required Track (Commit-Reveal) implemented on top of the Ritual workshop starter.
The updated contract is [`hardhat/contracts/AIJudge.sol`](hardhat/contracts/AIJudge.sol);
tests are in [`hardhat/contracts/AIJudge.t.sol`](hardhat/contracts/AIJudge.t.sol).

Deliverables:
- **README explaining the lifecycle** — this file
- **Test plan for reveal cases** — [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md)
- **Architecture note** — [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Reflection** — [`docs/REFLECTION.md`](docs/REFLECTION.md)

## The problem

The workshop version made answers public the moment they were submitted, so later
participants could copy earlier ideas and submit improved versions. This version
hides answers behind a commitment hash until judging, removing that information
advantage.

## Lifecycle

```
 createBounty ──▶ submitCommitment* ──▶ revealAnswer* ──▶ judgeAll ──▶ finalizeWinner
 (owner funds   (only a hash on-chain,  (after submit     (one batch    (human owner
  + 2 deadlines)  before submitEnds)     deadline; hash    LLM call,     picks winner,
                                         verified)         after reveal  reward paid)
                                                           deadline)
```

1. **createBounty(title, rubric, submissionDeadline, revealDeadline)** — owner funds the reward (msg.value) and sets both deadlines.
2. **submitCommitment(bountyId, commitment)** — participants post only `keccak256(answer, salt, msg.sender, bountyId)` before the submission deadline. Answers are not on-chain yet.
3. **revealAnswer(bountyId, answer, salt)** — between the submission and reveal deadlines; the contract recomputes the hash and verifies it. Only matches become eligible.
4. **judgeAll(bountyId, llmInput)** — after the reveal deadline, owner-only. Sends ALL revealed answers to the Ritual LLM precompile (`0x0802`) in ONE batch request and stores the recommendation.
5. **finalizeWinner(bountyId, winnerIndex)** — owner-only; pays the reward to a revealed entry. The AI only recommends; a human decides.

### Commitment formula

```solidity
bytes32 commitment = keccak256(abi.encodePacked(answer, salt, msg.sender, bountyId));
```

Binding `msg.sender` and `bountyId` stops reveal-theft (revealing someone else's
answer under your address) and cross-bounty replay.

## Required functions (exact signatures)

```solidity
function submitCommitment(uint256 bountyId, bytes32 commitment) external;
function revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt) external;
function judgeAll(uint256 bountyId, bytes calldata llmInput) external;
function finalizeWinner(uint256 bountyId, uint256 winnerIndex) external;
```

## Enforced rules

- Commit only before the submission deadline; one commitment per address per bounty.
- Reveal only in `[submissionDeadline, revealDeadline)`, and only if the hash matches.
- Unrevealed submissions are ineligible and can never win.
- Owner can judge only after the reveal deadline; finalize only after judging.
- Only one winner is paid.

## Build & test

```bash
cd hardhat
npm install
npx hardhat test solidity   # 25 tests, valid + invalid reveal cases
```

## Deploy (Ritual L1 or any EVM chain)

```bash
cd hardhat
npx hardhat ignition deploy ignition/modules/AIJudge.ts --network ritual
```

On a non-Ritual chain the LLM precompile has no code; pass empty `llmInput` to
`judgeAll` and record the verdict via `setVerdictReference`. On Ritual, build the
batch LLM request off-chain and pass it as `llmInput`.

> Note: Ritual's `block.timestamp` is in milliseconds. Choose deadlines accordingly
> when interacting with a live Ritual node.

---

## Repo layout

```
/hardhat   -> Solidity contract (AIJudge.sol), tests (AIJudge.t.sol), deploy module
/web       -> frontend starter (unchanged)
/docs      -> test plan, architecture note, reflection
```

*Built on the Ritual workshop starter. Required Track (commit-reveal) is fully
implemented and tested; the Advanced Track (Ritual-native encrypted submissions)
is covered as a design in the architecture note.*
