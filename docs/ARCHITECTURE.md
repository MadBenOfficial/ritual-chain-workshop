# Architecture Note — Commit-Reveal vs Ritual-Native Encrypted Submissions

## 1. Required track — Commit-Reveal (implemented)

### What is stored where

| Data | Location | Visible to |
|------|----------|------------|
| `keccak256(answer, salt, sender, bountyId)` | on-chain (`Submission.commitment`) | everyone — reveals nothing |
| plaintext answer (submission phase) | the participant's machine | only the participant |
| plaintext answer (after reveal) | on-chain (`Submission.answer`) | everyone |
| salt | off-chain until reveal, then on-chain | everyone after reveal |

### Privacy model

Privacy is **temporal**. During the submission window the only artifact on-chain
is a preimage-resistant hash, so no entrant can read another's answer before
committing their own. After the reveal deadline the answers are public, so judging
is fully auditable. Because the submission window has already closed by then, a
copier has nothing left to submit — the fairness property holds.

### Strengths / limits

- Runs on **any EVM chain**; trivially auditable (re-hash each reveal).
- Cheap: one hash per entrant.
- Limit: answers are public *before* the AI judges them. For confidentiality
  through judging, see the Ritual-native design below.

## 2. Advanced track — Ritual-native encrypted submissions (design)

Goal: answers stay encrypted and never appear in plaintext on-chain, yet the LLM
still batch-judges them inside a TEE.

### Flow

```
 participant                 contract (on-chain)          Ritual TEE executor
 ───────────                 ──────────────────           ───────────────────
 encrypt(answer) ──ECIES──▶  store ciphertext ref +        holds the matching
   to executor pubkey        digest (not plaintext)        private key
                             ───────────────────────────▶  judgeAll triggers LLM
                             ◀───────────────────────────  precompile w/ encrypted
 publish winner + bundle      store aiReview, verdictRef,   inputs; TEE decrypts
   ref + digest               verdictHash                   privately, batch-judges
```

1. **Each participant encrypts their answer** for a live Ritual TEE executor
   using ECIES against the executor `publicKey` from `TEEServiceRegistry`
   (`0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F`).
2. **The contract stores only ciphertext references** — or, to avoid expensive
   on-chain storage, a `verdictRef` (e.g. `ipfs://…`) plus a `verdictHash`
   committing to the bundle (see `setVerdictReference`).
3. **Before judging, no one can read plaintext** — only the TEE holds the key.
4. **`judgeAll` passes the encrypted answers to the LLM precompile** as
   `encryptedSecrets[]`. The TEE decrypts privately, assembles ONE batch prompt
   (all answers numbered), and returns a ranking. Plaintext never hits the chain.
5. **After judging**, the winner and a bundle reference + digest are published so
   the result is auditable without having leaked answers early.

### Where plaintext exists
- On the participant's machine (pre-encryption).
- Inside the TEE during judging (attested, not exposed to the public chain).
- Optionally in the published bundle after judging, if the bounty opts to reveal.

### On-chain vs off-chain
- **On-chain:** ciphertext refs, `verdictRef`, `verdictHash`, AI recommendation
  bytes, and all access-control / payout logic.
- **Off-chain:** large plaintext answers and the revealed-answers bundle (only a
  digest is committed on-chain).

### How the LLM receives all submissions together
One `judgeAll` builds a single `messagesJson` with every revealed/decrypted
answer numbered `[0..n]` plus the rubric. Model: `zai-org/GLM-4.7-FP8` (the live
text LLM on Ritual). This satisfies "batch judging, not one call per answer".

### Final reveal & commitment
`verdictHash = keccak256(bundle)`. Anyone can fetch `verdictRef`, re-hash, and
confirm it matches what was judged — binding the public result to the exact
answers evaluated.

## 3. Side-by-side

| | Commit-Reveal (required) | Ritual-native TEE (advanced) |
|---|---|---|
| Hidden during submission | yes | yes |
| Hidden *through* judging | no (public at reveal) | yes (only TEE sees plaintext) |
| Any EVM chain | yes | no (needs Ritual TEE) |
| On-chain cost | low (one hash each) | low (refs + digest) |
| Trust assumption | hash preimage resistance | TEE attestation + key custody |

## 4. Human-in-the-loop

In both tracks the AI only **recommends**. `judgeAll` stores the completion but
never moves funds; `finalizeWinner` is owner-only and must point to a revealed
entry. A human stays accountable for the payout, and a malformed or manipulated
AI response cannot drain the reward.
