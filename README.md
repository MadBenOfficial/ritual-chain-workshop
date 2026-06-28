# Eclipse Bounty Judge

A privacy-preserving, AI-judged bounty system on **Ritual L1**. While submissions
are open, every answer is hidden inside an **eclipse** — only a cryptographic
*commitment corona* (a hash) is visible on-chain, so nobody can copy a rival's
idea. After the submission window closes, participants break the eclipse by
revealing `answer + salt`; the contract verifies the corona, the Ritual AI judges
all revealed answers **in a single batch pass** (a constellation), and a human
owner aligns the winning star and releases the reward.

> **Live demo:** https://madbenofficial.github.io/ritual-chain-workshop/
> (connect a wallet on Ritual Chain, id 1979)

> **Required Track (Commit-Reveal) — implemented and tested (32 passing tests).**
> Contract: [`hardhat/contracts/EclipseBountyJudge.sol`](hardhat/contracts/EclipseBountyJudge.sol).

### Deliverables (assignment checklist)

| Deliverable | Where |
|-------------|-------|
| ✅ Updated Solidity contract | [`hardhat/contracts/EclipseBountyJudge.sol`](hardhat/contracts/EclipseBountyJudge.sol) |
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
deadline destroys fairness. **The goal: keep answers eclipsed until judging.**

---

## 2. The solution: commit-reveal (the eclipse)

During submission, the answer never touches the chain — only an irreversible
*corona* (a hash) of it:

```
corona = keccak256(abi.encode(answer, salt, msg.sender, bountyId))
```

- `answer` — your real submission (stays on your device)
- `salt` — a random secret you keep (the "moon" that opens the eclipse later)
- `msg.sender` — your address (binds the corona to you)
- `bountyId` — which bounty it's for

You can't invert the hash, so observers see only noise. Later you prove the answer
was yours by re-supplying `answer + salt`; the contract recomputes the corona and
checks it matches.

> This implementation uses `abi.encode` (not `abi.encodePacked`). The dynamic
> `string answer` is length-prefixed and 32-byte aligned, which removes any
> hash-boundary ambiguity between adjacent dynamic fields. The front-end uses the
> identical encoding — see [`web/src/lib/bounty.ts`](web/src/lib/bounty.ts).

**Why bind `msg.sender` and `bountyId`?**
- `msg.sender` stops *reveal-theft*: a thief can't copy your corona and reveal it
  under their own address — the recomputed hash would never match.
- `bountyId` stops *replay*: the same corona can't be reused across bounties.

---

## 3. Lifecycle (the full flow)

```
  createBounty ─▶ submitCommitment ─▶ revealAnswer ─▶ judgeAll ─▶ finalizeWinner
   ─────────────   ──────────────────   ─────────────   ─────────   ──────────────
   owner funds      only the corona      break eclipse:  one batch   human aligns
   reward + sets    goes on-chain        answer + salt   LLM call    the winning
   two deadlines    (answer eclipsed)    hash verified   over all    star; reward
                                                          revealed    paid
   [before commitClose] [commit→reveal window] [after revealClose]
```

The contract exposes the phase directly via `phaseOf(bountyId)`:
`Commit → Reveal → Judging → Judged → Finalized`.

---

## 4. Required functions (exact signatures)

```solidity
function submitCommitment(uint256 bountyId, bytes32 commitment) external;
function revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt) external;
function judgeAll(uint256 bountyId, bytes calldata llmInput) external;
function finalizeWinner(uint256 bountyId, uint256 winnerIndex) external;
```

Plus `createBounty(...)` to open a bounty, `reclaimReward(bountyId)` as an escape
hatch (recover the reward if nobody ever reveals), and views `getBounty`,
`getSubmission`, `phaseOf`, and `computeCommitment`.

---

## 5. Rules the contract enforces

| Rule | Why it matters |
|------|----------------|
| Commit only **before** the submission deadline | the window must close before anyone reveals |
| One commitment per address per bounty | no spamming / no multiple shots |
| Reveal only in `[commitClose, revealClose)` | reveals happen after submissions are locked |
| Reveal valid **only if the corona matches** | proves you didn't change your answer |
| Unrevealed entries are **ineligible** | can't win without proving your entry |
| Judge only **after** the reveal deadline | the AI sees the full, final field |
| Finalize only **after** judging, owner-only | a human owns the payout decision |
| Only one winner is paid | winner-takes-all, reward zeroed after payout |
| `reclaimReward` if nobody revealed | the reward never locks forever |

Design choices that differ from the workshop starter: an explicit `Phase` enum,
**custom errors** instead of string requires, `abi.encode` commitments, the
`reclaimReward` escape hatch, and a `judgeAll` that **never reverts on an LLM-side
error** (reverting would roll back the whole async replay and wedge the bounty —
instead the completion is stored only when clean and the human still finalizes).

---

## 6. How to run it

```bash
cd hardhat
npm install
npx hardhat test solidity     # 32 tests: valid + invalid reveal cases, reclaim, phases

# deploy (Ritual L1 or any EVM chain)
npx hardhat ignition deploy ignition/modules/EclipseBountyJudge.ts --network ritual
```

```bash
cd web
npm install
cp .env.example .env.local    # set NEXT_PUBLIC_CONTRACT_ADDRESS
npm run dev
```

**Portability:** the contract works on **any EVM chain**. On a non-Ritual chain
the LLM precompile has no code, so you pass an empty `llmInput` to `judgeAll` and
the flow still completes. On Ritual, you build the batch LLM request off-chain and
pass it as `llmInput`.

> ⚠️ **Ritual note:** Ritual's `block.timestamp` is in **milliseconds** (not
> seconds like a standard EVM chain). The front-end sends deadlines in ms.

> ⚠️ **Gas note:** `judgeAll` on Ritual pins a **6,000,000 gas limit**. The async
> settlement that decodes the LLM response and writes it to storage uses ~1.09M
> gas; an auto-estimated tx only covers the cheap first pass and runs out of gas
> mid-replay.

---

## 7. A note on privacy (commit-reveal vs Ritual-native)

Commit-reveal keeps answers eclipsed **during submission**, but they become public
**at reveal time** (before the AI judges). That's enough to stop copying, since the
submission window is already closed. To keep answers secret *even through judging*,
the Ritual-native (TEE) approach is described in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 8. Live deployment (Ritual Chain, id 1979)

**Contract (EclipseBountyJudge):** [`0x69676ae552787DFcd4bC0D84D23510A88BccB820`](https://explorer.ritualfoundation.org/address/0x69676ae552787DFcd4bC0D84D23510A88BccB820)
**Deploy tx:** [`0xcdbc814c…9119aad6`](https://explorer.ritualfoundation.org/tx/0xcdbc814c36eafafc7973158399b9fb670eb330f4c468f46d9e86f4679119aad6)

`judgeAll` runs one batched Ritual LLM call (precompile `0x0802`, model
GLM-4.7-FP8) over every revealed answer and stores the model's verdict on-chain as
`aiVerdict`. The AI only recommends — a human owner finalizes and pays.

> Funding note: `judgeAll` with a live LLM call requires prepaid RITUAL locked in
> the `RitualWallet` (`0x532F0dF0…`). The precompile's worst-case escrow is ~0.311
> RITUAL (refundable); the front-end deposits a margin above that before judging.

## Repo layout

```
/hardhat   -> Solidity contract (EclipseBountyJudge.sol), tests, Ignition module
/web       -> Next.js + wagmi frontend ("Eclipse Observatory" UI)
/docs      -> test plan, architecture note, reflection
```
