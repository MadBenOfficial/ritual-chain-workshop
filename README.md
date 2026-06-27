# Privacy-Preserving AI Bounty Judge

A commit-reveal bounty judge for Ritual Chain. Answers stay **hidden behind a
cryptographic hash** while submissions are open, so nobody can copy another
participant's idea. After the deadline, answers are revealed and verified, an AI
judges them all together in one batch, and a human owner pays the winner.

> **Required Track (Commit-Reveal) — fully implemented and tested (25 passing tests).**
> Built on top of the Ritual workshop starter. The contract lives in
> [`hardhat/contracts/AIJudge.sol`](hardhat/contracts/AIJudge.sol).

### Deliverables (assignment checklist)

| Deliverable | Where |
|-------------|-------|
| ✅ Updated Solidity contract | [`hardhat/contracts/AIJudge.sol`](hardhat/contracts/AIJudge.sol) |
| ✅ README explaining the lifecycle | **this file** |
| ✅ Test plan for reveal cases | [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) |
| ✅ Architecture note | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| ✅ Reflection (5–8 sentences) | [`docs/REFLECTION.md`](docs/REFLECTION.md) |

---

## 1. The problem we're fixing

In the original workshop version, an answer became **public the instant it was
submitted**. That created an unfair race:

> Alice submits *"use solar power"*. Bob reads it, submits *"use solar power **plus
> battery storage**"*, and wins. Bob never had a better idea — he just got to see
> Alice's first.

In a winner-takes-all bounty, letting people read each other's answers before the
deadline destroys fairness. **The goal: keep answers hidden until judging.**

---

## 2. The solution: commit-reveal

The trick is to never put the answer on-chain during the submission phase — only
an irreversible **fingerprint** (a hash) of it.

```
commitment = keccak256(answer, salt, msg.sender, bountyId)
```

- `answer` — your real submission
- `salt` — a random secret number you keep
- `msg.sender` — your address (binds the commitment to you)
- `bountyId` — which bounty it's for

You can't go from the hash back to the answer, so others see only noise. Later you
prove the answer was yours all along by re-supplying `answer + salt`; the contract
recomputes the hash and checks it matches.

**Why include `msg.sender` and `bountyId`?**
- `msg.sender` stops *reveal-theft*: Bob can't copy Alice's commitment hash and
  reveal it under his own address, because the hash is tied to Alice's address.
- `bountyId` stops *replay*: the same commitment can't be reused across bounties.

---

## 3. Lifecycle (the full flow)

```
  createBounty ─▶ submitCommitment ─▶ revealAnswer ─▶ judgeAll ─▶ finalizeWinner
   ─────────────   ──────────────────   ─────────────   ─────────   ──────────────
   owner funds      only the hash        prove answer    one batch   human owner
   reward + sets    goes on-chain        with salt;      LLM call    picks winner;
   two deadlines    (answer hidden)      hash verified   over all    reward paid
                                                          revealed
   [before submissionDeadline] [submission→reveal window] [after revealDeadline]
```

A worked example with the same characters:

1. **createBounty** — Owner opens *"Best startup idea"* with 5 RITUAL reward, a
   submission deadline (1h) and a reveal deadline (2h).
2. **submitCommitment** — Alice computes `keccak256("solar power", salt, alice, 1)`
   and submits only that hash. Bob sees the hash but **cannot read "solar power"**,
   so he can't copy it. Bob commits his own idea blind.
3. **revealAnswer** — After the submission deadline, Alice calls
   `revealAnswer(1, "solar power", salt)`. The contract recomputes the hash and
   confirms it matches → her answer is now public and **eligible**. (Wrong answer,
   wrong salt, or wrong sender → rejected.)
4. **judgeAll** — After the reveal deadline, the owner sends **all revealed answers
   in one batch** to the Ritual LLM precompile (`0x0802`). The AI returns a
   recommended ranking. (Never one LLM call per answer.)
5. **finalizeWinner** — The owner reviews the AI's recommendation and calls
   `finalizeWinner(1, winnerIndex)`. The reward is paid to that revealed entry.
   **The AI only recommends; a human makes the final call.**

---

## 4. Required functions (exact signatures)

```solidity
function submitCommitment(uint256 bountyId, bytes32 commitment) external;
function revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt) external;
function judgeAll(uint256 bountyId, bytes calldata llmInput) external;
function finalizeWinner(uint256 bountyId, uint256 winnerIndex) external;
```

(Plus `createBounty(...)` to open a bounty and helper views like `getBounty`,
`getSubmission`, and `computeCommitment`.)

---

## 5. Rules the contract enforces

| Rule | Why it matters |
|------|----------------|
| Commit only **before** the submission deadline | the window must close before anyone reveals |
| One commitment per address per bounty | no spamming / no multiple shots |
| Reveal only in `[submissionDeadline, revealDeadline)` | reveals happen after submissions are locked |
| Reveal valid **only if the hash matches** | proves you didn't change your answer |
| Unrevealed submissions are **ineligible** | can't win without proving your entry |
| Judge only **after** the reveal deadline | the AI sees the full, final field |
| Finalize only **after** judging, owner-only | a human owns the payout decision |
| Only one winner is paid | winner-takes-all, reward zeroed after payout |

---

## 6. How to run it

```bash
cd hardhat
npm install
npx hardhat test solidity     # 25 tests: valid + invalid reveal cases
```

Deploy (Ritual L1 or any EVM chain):

```bash
npx hardhat ignition deploy ignition/modules/AIJudge.ts --network ritual
```

**Portability:** the contract works on **any EVM chain**. On a non-Ritual chain
the LLM precompile has no code, so you pass an empty `llmInput` to `judgeAll` and
record the verdict reference off-chain via `setVerdictReference`. On Ritual, you
build the batch LLM request off-chain and pass it as `llmInput`.

> ⚠️ **Ritual note:** Ritual's `block.timestamp` is in **milliseconds** (not
> seconds like a standard EVM chain). Choose your deadlines accordingly when
> interacting with a live Ritual node.

---

## 7. A note on privacy (commit-reveal vs Ritual-native)

Commit-reveal keeps answers hidden **during submission**, but they become public
**at reveal time** (before the AI judges). That's enough to stop copying, because
the submission window is already closed. If you need answers to stay secret *even
through judging*, the **Advanced Track** uses Ritual's TEE to decrypt and batch-judge
encrypted answers privately — designed in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 8. Live deployment & on-chain proof (Ritual Chain, id 1979)

The contract was deployed and a full bounty lifecycle was executed on the live
Ritual network. Every phase ran in its correct time window.

**Contract:** [`0x0fBC37b2472d45b9465BB1741CA7aDCDD81707D4`](https://explorer.ritualfoundation.org/address/0x0fBC37b2472d45b9465BB1741CA7aDCDD81707D4)

The bounty used two deadlines (Ritual `block.timestamp` is in **milliseconds**):
- submission deadline = `1782599461645`
- reveal deadline = `1782599491645`

| # | Phase | What the tx does | Tx hash | Timestamp (ms) | Window check |
|---|-------|------------------|---------|----------------|--------------|
| 1 | `createBounty` | Opens bounty #1, funds the reward, sets both deadlines | [`0xa5e5d5f2…d4846f`](https://explorer.ritualfoundation.org/tx/0xa5e5d5f2155653a81c872ab9acbbd9f4aebb9b53e499df07ccdbac4cc0d4846f) | 1782599434089 | — |
| 2 | `submitCommitment` | Posts only the commitment hash (answer stays hidden) | [`0x75af3ee2…f6f85`](https://explorer.ritualfoundation.org/tx/0x75af3ee2c0b1f0956840a6c4521244908e5c10da989b29c10dbcb88e317f6f85) | 1782599439537 | **< submission deadline** ✓ |
| 3 | `revealAnswer` | Reveals answer + salt; contract verifies the hash | [`0xf6ef0a50…91d7d48`](https://explorer.ritualfoundation.org/tx/0xf6ef0a50d72801e04b80360ed60f90154230790d521893fa4d7ffefa691d7d48) | 1782599478116 | **in [submission, reveal)** ✓ |
| 4 | `judgeAll` | Marks the bounty judged (batch step) | [`0x7fd8ec70…a4b02`](https://explorer.ritualfoundation.org/tx/0x7fd8ec70d93fa04d666aa5c79d3710d5a72ca54b8da8a34f60de148ccb3a4b02) | 1782599510933 | **> reveal deadline** ✓ |
| 5 | `finalizeWinner` | Picks winner #0, pays the reward | [`0xbdbb8e9e…3365b4`](https://explorer.ritualfoundation.org/tx/0xbdbb8e9e68a2571ee247114a91f2b94974a4b5c9272e573c4e04900fa13365b4) | 1782599512979 | **after judging** ✓ |

**Deadline rules were respected end-to-end:** the commitment landed before the
submission deadline, the reveal happened strictly inside the reveal window, and
judging + finalization only happened after the reveal deadline. Verified on-chain:
during the submission phase `getSubmission` returned an empty `answer`; it only
became `"use solar power with battery storage"` after a valid reveal — proving the
answer stayed hidden until reveal.

> The deploy + full cycle cost ~0.0006 RITUAL in gas. `judgeAll` was run with an
> empty `llmInput` here (the LLM precompile's worst-case escrow is ~0.31 RITUAL,
> refundable); on a live Ritual judging run you pass the ABI-encoded batch request.

## Repo layout

```
/hardhat   -> Solidity contract (AIJudge.sol), tests (AIJudge.t.sol), deploy module
/web       -> frontend starter (unchanged)
/docs      -> test plan, architecture note, reflection
```
