# Test Plan — AIJudge (Commit-Reveal)

Run: `cd hardhat && npx hardhat test solidity` — **25 tests, all passing.**
Tests live in `hardhat/contracts/AIJudge.t.sol`.

## Reveal cases (the core of the assignment)

| Case | Test | Expected |
|------|------|----------|
| Valid reveal in window | `test_RevealValid` | submission lifted, answer stored, eligible |
| Answer hidden before reveal | `test_AnswerHiddenBeforeReveal` | stored answer is empty during submission phase |
| Wrong answer | `test_RevertReveal_WrongAnswer` | revert `commitment mismatch` |
| Wrong salt | `test_RevertReveal_WrongSalt` | revert `commitment mismatch` |
| Wrong sender (reveal another's answer) | `test_RevertReveal_WrongSender` | revert `commitment mismatch` (sender is in the hash) |
| Reveal before window | `test_RevertReveal_BeforeWindow` | revert `reveal not open` |
| Reveal after window | `test_RevertReveal_AfterWindow` | revert `reveal closed` |
| Reveal with no commitment | `test_RevertReveal_NoCommitment` | revert `no commitment` |
| Double reveal | `test_RevertReveal_Twice` | revert `already revealed` |

## Commit cases

| Case | Test | Expected |
|------|------|----------|
| Normal commit | `test_SubmitCommitment` | slot recorded |
| Commit twice | `test_RevertCommit_Twice` | revert `already committed` |
| Commit after submission deadline | `test_RevertCommit_AfterDeadline` | revert `submissions closed` |
| Empty commitment | `test_RevertCommit_Empty` | revert `empty commitment` |

## Create / judge / finalize

| Case | Test | Expected |
|------|------|----------|
| Create bounty | `test_CreateBounty` | funded, winner = max |
| Create with no reward | `test_RevertCreate_NoReward` | revert `reward required` |
| Create with reveal ≤ submission | `test_RevertCreate_BadDeadlines` | revert `reveal must follow submission` |
| Judge (empty llmInput / non-Ritual) | `test_JudgeAll_NonRitualChain` | judged = true |
| Judge by non-owner | `test_RevertJudge_NotOwner` | revert `not bounty owner` |
| Judge before reveal deadline | `test_RevertJudge_BeforeRevealDeadline` | revert `reveal not finished` |
| Judge with zero revealed | `test_RevertJudge_NoRevealed` | revert `no revealed answers` |
| Finalize pays winner | `test_Finalize_PaysWinner` | reward transferred, winner set |
| Finalize before judge | `test_RevertFinalize_BeforeJudge` | revert `not judged yet` |
| Finalize an unrevealed entry | `test_RevertFinalize_UnrevealedWinner` | revert `winner not revealed` |
| Full lifecycle | `test_FullLifecycle` | create→commit→reveal→judge→finalize OK |
| Commitment helper parity | `test_ComputeCommitmentMatches` | on-chain == off-chain hash |

## Manual / integration (Ritual L1)

1. Deploy: `npx hardhat ignition deploy ignition/modules/AIJudge.ts --network ritual`.
2. `createBounty` with millisecond deadlines (Ritual `block.timestamp` is in ms).
3. Commit from 2+ addresses; confirm `getSubmission` returns empty `answer`.
4. After the submission deadline, reveal; confirm a wrong salt reverts and a good one lifts.
5. After the reveal deadline, build a single batch LLM request off-chain and call `judgeAll`; read the recommendation from `getBounty`.
6. `finalizeWinner` and confirm the reward moves to the chosen revealed author.
