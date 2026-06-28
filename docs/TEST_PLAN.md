# Test Plan — EclipseBountyJudge (Commit-Reveal)

Run: `cd hardhat && npx hardhat test solidity` — **32 tests, all passing.**
Tests live in `hardhat/contracts/EclipseBountyJudge.t.sol`. The contract uses
custom errors, so tests assert with `vm.expectRevert(EclipseBountyJudge.X.selector)`.

## Reveal cases (the core of the assignment)

| Case | Test | Expected |
|------|------|----------|
| Valid reveal in window | `test_RevealValid` | entry revealed, answer stored, phase = Reveal |
| Answer hidden before reveal | `test_AnswerHiddenBeforeReveal` | stored answer empty during commit phase |
| Wrong answer | `test_RevertReveal_WrongAnswer` | revert `CoronaMismatch` |
| Wrong salt | `test_RevertReveal_WrongSalt` | revert `CoronaMismatch` |
| Stolen corona (reveal another's answer) | `test_StolenCommitmentCannotBeRevealed` | revert `CoronaMismatch` (sender bound in hash) |
| Reveal before window | `test_RevertReveal_BeforeWindow` | revert `RevealNotOpen` |
| Reveal after window | `test_RevertReveal_AfterWindow` | revert `RevealClosed` |
| Reveal with no entry | `test_RevertReveal_NoEntry` | revert `NoEntry` |
| Double reveal | `test_RevertReveal_Twice` | revert `AlreadyRevealed` |
| Empty answer | `test_RevertReveal_EmptyAnswer` | revert `BadAnswerLength` |

## Commit cases

| Case | Test | Expected |
|------|------|----------|
| Normal commit | `test_SubmitCommitment` | entry recorded |
| Commit twice | `test_RevertCommit_Twice` | revert `AlreadyEntered` |
| Commit after deadline | `test_RevertCommit_AfterDeadline` | revert `CommitsClosed` |
| Empty commitment | `test_RevertCommit_Empty` | revert `EmptyCorona` |
| Commit on unknown bounty | `test_RevertCommit_UnknownBounty` | revert `UnknownBounty` |

## Create / judge / finalize / reclaim

| Case | Test | Expected |
|------|------|----------|
| Create bounty | `test_CreateBounty` | funded, winner = NO_WINNER, phase = Commit |
| Create with no reward | `test_RevertCreate_NoReward` | revert `RewardRequired` |
| Create with reveal ≤ submission | `test_RevertCreate_BadWindow` | revert `BadWindow` |
| Create with past deadline | `test_RevertCreate_DeadlineInPast` | revert `BadWindow` |
| Judge (empty llmInput / non-Ritual) | `test_JudgeAll_NonRitualChain` | judged = true, phase = Judged |
| Judge by non-owner | `test_RevertJudge_NotOwner` | revert `NotOwner` |
| Judge before reveal deadline | `test_RevertJudge_BeforeRevealDeadline` | revert `RevealNotFinished` |
| Judge with zero revealed | `test_RevertJudge_NoRevealed` | revert `NoRevealedAnswers` |
| Judge twice | `test_RevertJudge_Twice` | revert `AlreadyJudged` |
| Finalize pays winner | `test_Finalize_PaysWinner` | reward transferred, phase = Finalized |
| Finalize before judge | `test_RevertFinalize_BeforeJudge` | revert `NotJudged` |
| Finalize an unrevealed entry | `test_RevertFinalize_UnrevealedWinner` | revert `WinnerNotRevealed` |
| Reclaim when nobody revealed | `test_ReclaimReward_WhenNoReveals` | owner refunded, finalized |
| Reclaim when someone revealed | `test_RevertReclaim_WhenSomeoneRevealed` | revert `CannotReclaim` |
| Reclaim before reveal close | `test_RevertReclaim_BeforeRevealClose` | revert `CannotReclaim` |
| Full lifecycle | `test_FullLifecycle` | create→commit→reveal→judge→finalize OK |
| Commitment helper parity | `test_ComputeCommitmentMatches` | on-chain == off-chain (abi.encode) |

## Manual / integration (Ritual L1)

1. Deploy: `npx hardhat ignition deploy ignition/modules/EclipseBountyJudge.ts --network ritual`.
2. `createBounty` with **millisecond** deadlines (Ritual `block.timestamp` is in ms).
3. Commit from 2+ addresses; confirm `getSubmission` returns empty `answer`.
4. After the submission deadline, reveal; confirm a wrong salt reverts and a good one lifts.
5. After the reveal deadline, build a single batch LLM request off-chain and call
   `judgeAll` **with `gas: 6_000_000`** (the async LLM settlement needs ~1.09M gas);
   read the recommendation from `getBounty`.
6. `finalizeWinner` and confirm the reward moves to the chosen revealed author.
7. Edge case: let a bounty's reveal window pass with zero reveals, then call
   `reclaimReward` and confirm the owner is refunded.
