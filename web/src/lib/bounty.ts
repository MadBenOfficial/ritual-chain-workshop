import { encodeAbiParameters, keccak256, type Address } from "viem";

/** Parsed shape of the `getBounty` tuple return value (commit-reveal). */
export type Bounty = {
  owner: Address;
  title: string;
  rubric: string;
  reward: bigint;
  submissionDeadline: bigint; // commitClose (ms)
  revealDeadline: bigint; // revealClose (ms)
  judged: boolean;
  finalized: boolean;
  submissionCount: bigint; // entryCount
  revealedCount: bigint;
  winnerIndex: bigint;
  aiReview: `0x${string}`; // aiVerdict
};

/** getBounty returns a positional tuple — map it to a named object. */
export function parseBounty(
  raw: readonly [
    Address,
    string,
    string,
    bigint,
    bigint,
    bigint,
    boolean,
    boolean,
    bigint,
    bigint,
    bigint,
    `0x${string}`,
  ],
): Bounty {
  const [
    owner,
    title,
    rubric,
    reward,
    submissionDeadline,
    revealDeadline,
    judged,
    finalized,
    submissionCount,
    revealedCount,
    winnerIndex,
    aiReview,
  ] = raw;
  return {
    owner,
    title,
    rubric,
    reward,
    submissionDeadline,
    revealDeadline,
    judged,
    finalized,
    submissionCount,
    revealedCount,
    winnerIndex,
    aiReview,
  };
}

/** The five on-chain phases of an Eclipse bounty. */
export type BountyPhase = "commit" | "reveal" | "judging" | "judged" | "finalized";

export const PHASE_META: Record<
  BountyPhase,
  { label: string; short: string; tone: "cyan" | "violet" | "amber" | "gold" | "zinc" }
> = {
  commit: { label: "Eclipse · Commit", short: "Commit", tone: "violet" },
  reveal: { label: "Break the Eclipse · Reveal", short: "Reveal", tone: "cyan" },
  judging: { label: "Constellation · Judging", short: "Judging", tone: "amber" },
  judged: { label: "Predicted Alignment · Judged", short: "Judged", tone: "cyan" },
  finalized: { label: "Golden Orbit · Finalized", short: "Finalized", tone: "gold" },
};

/**
 * Phase derived from the two deadlines. UNITS: Ritual's block.timestamp is in
 * MILLISECONDS, so the contract stores millisecond deadlines and this UI compares
 * against Date.now() (also ms). The contract also exposes `phaseOf` directly.
 */
export function getBountyPhase(b: Bounty, nowMs = Date.now()): BountyPhase {
  if (b.finalized) return "finalized";
  if (b.judged) return "judged";
  if (nowMs < Number(b.submissionDeadline)) return "commit";
  if (nowMs < Number(b.revealDeadline)) return "reveal";
  return "judging";
}

/** Can a participant still submit a commitment? */
export function canCommit(b: Bounty, nowMs = Date.now()): boolean {
  return !b.judged && !b.finalized && nowMs < Number(b.submissionDeadline);
}

/** Can a participant reveal right now? */
export function canReveal(b: Bounty, nowMs = Date.now()): boolean {
  return (
    !b.judged &&
    !b.finalized &&
    nowMs >= Number(b.submissionDeadline) &&
    nowMs < Number(b.revealDeadline)
  );
}

/** Can the owner run judgeAll? (reveal window over, not judged yet) */
export function canJudge(b: Bounty, nowMs = Date.now()): boolean {
  return !b.judged && !b.finalized && nowMs >= Number(b.revealDeadline);
}

// ----- commit-reveal crypto helpers (MUST match the contract) -----

/**
 * keccak256(abi.encode(answer, salt, sender, bountyId)).
 * NOTE: EclipseBountyJudge uses abi.encode (not encodePacked) — the dynamic
 * `string` is length-prefixed and 32-byte aligned, removing boundary ambiguity.
 */
export function computeCommitment(
  answer: string,
  salt: `0x${string}`,
  sender: Address,
  bountyId: bigint,
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "bytes32" }, { type: "address" }, { type: "uint256" }],
      [answer, salt, sender, bountyId],
    ),
  );
}

/** Random 32-byte salt (the "salt moon" that opens the eclipse at reveal). */
export function randomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as `0x${string}`;
}

const SALT_KEY = "eclipse:reveal-kit";
type SaltStore = Record<string, { salt: `0x${string}`; answer: string }>;

export function rememberCommitment(
  bountyId: bigint,
  sender: Address,
  salt: `0x${string}`,
  answer: string,
) {
  if (typeof window === "undefined") return;
  const store: SaltStore = JSON.parse(localStorage.getItem(SALT_KEY) ?? "{}");
  store[`${bountyId}:${sender.toLowerCase()}`] = { salt, answer };
  localStorage.setItem(SALT_KEY, JSON.stringify(store));
}

export function recallCommitment(
  bountyId: bigint,
  sender: Address,
): { salt: `0x${string}`; answer: string } | null {
  if (typeof window === "undefined") return null;
  const store: SaltStore = JSON.parse(localStorage.getItem(SALT_KEY) ?? "{}");
  return store[`${bountyId}:${sender.toLowerCase()}`] ?? null;
}
