Eclipse Bounty Judge
====================

There is a moment, during a total eclipse, when the sky goes quiet and nothing
can be seen of the thing everyone came to watch. This bounty system borrows that
moment on purpose. While a bounty is open, every answer sits in shadow — present,
committed, but unreadable — until the deadline passes and the light comes back.
Only then are the answers revealed, judged together by Ritual's AI, and a winner
chosen by a human.

This is the **commit-reveal track** of the Ritual workshop, built on Ritual L1.
The contract is `EclipseBountyJudge`; the front-end is an "Eclipse Observatory"
that lets you run the whole thing from a browser.

Try it live: **https://madbenofficial.github.io/ritual-chain-workshop/**
(point a wallet at Ritual Chain, id 1979).


The race that ruined the old design
------------------------------------

Before the eclipse, the workshop's starter contract published each answer the
instant it arrived. Read that sentence again — it's the whole problem. If I can
see your answer before the deadline, I don't need a better idea, I just need to
arrive *after* you:

  - You submit "use solar power."
  - I read it, submit "use solar power **with battery storage**," and win.

Nothing about that is fair. In a winner-takes-all bounty, visible answers turn the
contest into a copying race decided by who clicks last. The fix is to make answers
invisible until it's too late to copy them.


How an answer hides
-------------------

The trick is that the answer never goes on-chain during submission. What goes
on-chain is a *corona* — a one-way hash that proves an answer exists without
revealing a thing about it:

    corona = keccak256(abi.encode(answer, salt, msg.sender, bountyId))

Four ingredients go into that hash, and each is there for a reason. The `answer`
is your real submission, which stays on your machine. The `salt` is a random
secret you generate and keep; it's the moon that will later slide aside and let
the answer be seen. Your address (`msg.sender`) is folded in so that nobody can
lift your corona and reveal it as their own — the hash simply wouldn't match for
them. And the `bountyId` is folded in so the same corona can't be replayed in a
different bounty.

A small but important detail: this contract hashes with `abi.encode`, not
`abi.encodePacked`. Packed encoding can blur the boundary between two dynamic
values; the ABI encoding length-prefixes the string and keeps everything
32-byte aligned, so there is exactly one answer that can ever match a given
corona. The front-end (`web/src/lib/bounty.ts`) hashes the same way, byte for
byte.


Walkthrough: one bounty, from first light to last
--------------------------------------------------

Follow a single bounty all the way through. The contract tracks exactly where it
is at any moment through `phaseOf(bountyId)`, which moves through
`Commit → Reveal → Judging → Judged → Finalized`.

**Opening it.** An owner calls `createBounty(...)`, sending the reward along with
the transaction and setting two deadlines — when submissions close, and when the
reveal window closes after that. The reward is now locked in the contract.

**The dark.** During the commit window, anyone calls
`submitCommitment(bountyId, corona)`. The chain stores the corona and nothing
else. Look at another entrant's submission and you see noise. One corona per
address — no flooding the field with attempts.

**First light.** Once the submission deadline passes, the reveal window opens and
entrants call `revealAnswer(bountyId, answer, salt)`. The contract recomputes the
corona from what you supplied and compares. Match, and your answer becomes public
and *eligible*. Miss — wrong text, wrong salt, wrong sender — and it's rejected.
Anyone who never reveals stays in shadow and cannot win.

**The judging.** After the reveal deadline, the owner calls `judgeAll`, which
sends **every revealed answer in a single batch** to Ritual's LLM precompile.
One call, the whole field at once — never one inference per answer. The model
returns a recommended ranking, stored on-chain as `aiVerdict`.

**The decision.** Finally the owner calls `finalizeWinner(bountyId, winnerIndex)`.
The reward goes to that revealed entry and the bounty closes. The AI advised; a
human signed off. That ordering is deliberate and the contract enforces it —
finalizing is owner-only and impossible before judging.

There is one more door, rarely used: if the reveal window closes and *nobody*
revealed, the reward would otherwise be trapped. `reclaimReward(bountyId)` lets
the owner pull it back out.


The exact surface
-----------------

The four required entry points, verbatim:

    function submitCommitment(uint256 bountyId, bytes32 commitment) external;
    function revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt) external;
    function judgeAll(uint256 bountyId, bytes calldata llmInput) external;
    function finalizeWinner(uint256 bountyId, uint256 winnerIndex) external;

Around them sit `createBounty(...)`, the `reclaimReward(...)` escape hatch, and
read-only helpers: `getBounty`, `getSubmission`, `phaseOf`, and
`computeCommitment` (so a client can build a corona identically to the contract).

A few things separate this from the starter worth calling out: the phase is an
explicit `enum`, failures use **custom errors** rather than string reverts, and
`judgeAll` is written so it *never* reverts on an LLM-side error. That last one is
subtle — on Ritual the judging call is replayed asynchronously after the model
runs, and a revert there would unwind the whole replay (including `judged = true`)
and strand the bounty. So the verdict is written only when the model answers
cleanly, and the human can always finalize regardless.


Two things Ritual does differently
-----------------------------------

If you deploy this on Ritual, two surprises will bite you if you don't know them.

The first is **time**. Ritual's `block.timestamp` is in *milliseconds*, not
seconds. Every deadline in the contract and every countdown in the front-end is
computed in milliseconds; mixing the two off by a factor of a thousand is the most
common way to make `createBounty` reject a perfectly reasonable deadline.

The second is **gas**. `judgeAll` pins a 6,000,000 gas limit by hand. The async
settlement that decodes the LLM's response and writes it to storage costs around
1.09M gas, but an auto-estimated transaction only budgets for the cheap first pass
and then dies halfway through the replay. Pin the gas and it goes through.

Funding, while we're here: a live judging call spends prepaid RITUAL locked in the
`RitualWallet` (`0x532F0dF0…`). The worst-case escrow is about 0.311 RITUAL,
refundable, and the lock has to outlive the async callback — the front-end deposits
a little over that before letting you judge.


Running it
----------

    cd hardhat
    npm install
    npx hardhat test solidity      # 32 tests — valid and invalid reveals, reclaim, phases
    npx hardhat ignition deploy ignition/modules/EclipseBountyJudge.ts --network ritual

    cd web
    npm install
    cp .env.example .env.local     # set NEXT_PUBLIC_CONTRACT_ADDRESS
    npm run dev

The contract runs on any EVM chain. Off Ritual, the LLM precompile has no code, so
you pass an empty `llmInput` to `judgeAll` and the lifecycle still completes — handy
for local testing. On Ritual you build the batch request off-chain and pass it in.


Where it lives on-chain
-----------------------

Deployed and exercised end-to-end on Ritual Chain (id 1979), including a real
GLM-4.7 judging call whose verdict is stored on-chain as `aiVerdict`.

  Contract   0x69676ae552787DFcd4bC0D84D23510A88BccB820
  Deploy tx  0xcdbc814c36eafafc7973158399b9fb670eb330f4c468f46d9e86f4679119aad6

  https://explorer.ritualfoundation.org/address/0x69676ae552787DFcd4bC0D84D23510A88BccB820


One honest caveat
-----------------

Commit-reveal hides answers *during submission*, but they become public *at reveal
time*, before the AI judges. That is enough to kill the copying race, because the
window is already shut by then. If you need answers to stay secret even through
judging, that's the Ritual-native TEE route — sketched in
`docs/ARCHITECTURE.md`, alongside the reveal-case test plan
(`docs/TEST_PLAN.md`) and a short reflection (`docs/REFLECTION.md`).


Layout
------

    hardhat/   EclipseBountyJudge.sol, its tests, the Ignition deploy module
    web/       Next.js + wagmi front-end — the "Eclipse Observatory"
    docs/      architecture note, test plan, reflection
