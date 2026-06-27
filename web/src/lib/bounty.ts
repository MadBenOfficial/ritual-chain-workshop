import { encodePacked, keccak256, type Address } from "viem";

/** Parsed shape of the `getBounty` tuple return value (commit-reveal). */
export type Bounty = {
  owner: Address;
  title: string;
  rubric: string;
  reward: bigint;
  submissionDeadline: bigint;
  revealDeadline: bigint;
  judged: boolean;
  finalized: boolean;
  submissionCount: bigint;
  revealedCount: bigint;
  winnerIndex: bigint;
  aiReview: `0x${string}`;
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

export type BountyPhase =
  | "submission" // accepting commitments
  | "reveal" // accepting reveals
  | "judging" // reveal closed, awaiting judgeAll
  | "judged" // judged, awaiting finalize
  | "finalized";

export const PHASE_META: Record<
  BountyPhase,
  { label: string; tone: "green" | "amber" | "indigo" | "zinc" }
> = {
  submission: { label: "Act I · Commit", tone: "green" },
  reveal: { label: "Act II · Reveal", tone: "amber" },
  judging: { label: "Act III · Judging", tone: "amber" },
  judged: { label: "Judged", tone: "indigo" },
  finalized: { label: "Finalized", tone: "zinc" },
};

/**
 * Phase is driven by the two deadlines. UNITS: Ritual's block.timestamp is in
 * MILLISECONDS, so the contract stores millisecond deadlines and this UI compares
 * against Date.now() (also milliseconds). Everything is consistent in ms.
 */
export function getBountyPhase(b: Bounty, nowMs = Date.now()): BountyPhase {
  if (b.finalized) return "finalized";
  if (b.judged) return "judged";
  if (nowMs < Number(b.submissionDeadline)) return "submission";
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

// ----- commit-reveal crypto helpers (must match the contract) -----

/** keccak256(abi.encodePacked(answer, salt, sender, bountyId)) */
export function computeCommitment(
  answer: string,
  salt: `0x${string}`,
  sender: Address,
  bountyId: bigint,
): `0x${string}` {
  return keccak256(
    encodePacked(["string", "bytes32", "address", "uint256"], [answer, salt, sender, bountyId]),
  );
}

/** Random 32-byte salt. The participant must keep it to reveal later. */
export function randomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as `0x${string}`;
}

const SALT_KEY = "aijudge:commitments";
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
