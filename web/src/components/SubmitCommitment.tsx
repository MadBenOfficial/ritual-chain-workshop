"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount } from "wagmi";
import { useNow } from "@/hooks/useNow";
import eclipseAbi from "@/abi/EclipseBountyJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import {
  canCommit,
  computeCommitment,
  randomSalt,
  rememberCommitment,
  recallCommitment,
  type Bounty,
} from "@/lib/bounty";
import { useWriteTx } from "@/hooks/useWriteTx";
import { CopyHash, SaltMoon, CommitmentCorona } from "@/components/Observatory";
import { pushEvent } from "@/hooks/useEventStrip";
import { Card, CardHeader, CardBody, Field, Textarea, Button, TxStatus, Notice } from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

/**
 * Act I — Commit. The answer is hashed locally with a random salt; only the
 * commitment hash goes on-chain. The salt is stored in this browser so you can
 * reveal later.
 */
export function SubmitCommitment({
  bountyId,
  bounty,
  onSubmitted,
}: {
  bountyId: bigint;
  bounty: Bounty;
  onSubmitted: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [answer, setAnswer] = useState("");
  // The salt "moon" is generated up-front so the user can preview the
  // commitment hash before sending. It is NOT persisted until the tx succeeds.
  const [salt, setSalt] = useState<`0x${string}` | null>(null);
  const now = useNow();
  const tx = useWriteTx(() => {
    setAnswer("");
    setSalt(null);
    pushEvent({ kind: "commit", label: "Commitment sealed", detail: `bounty #${bountyId.toString()}` });
    onSubmitted();
  });

  if (!canCommit(bounty, now)) {
    // commit closed
    return (
      <Card>
        <CardHeader
          title="Eclipse · Commit your answer"
          subtitle="Only the commitment corona is public."
        />
        <CardBody>
          <Notice tone="zinc">
            The eclipse has sealed — the commit window for this bounty is closed.
          </Notice>
        </CardBody>
      </Card>
    );
  }

  const mine = address ? recallCommitment(bountyId, address) : null;

  // Live commitment preview: keccak256(answer, salt, msg.sender, bountyId).
  const trimmed = answer.trim();
  const preview =
    address && trimmed && salt
      ? computeCommitment(trimmed, salt, address, bountyId)
      : null;

  // commit state machine for the visual + copy
  const state: "already" | "empty" | "salt" | "ready" = mine
    ? "already"
    : !trimmed
      ? "empty"
      : !salt
        ? "salt"
        : "ready";

  function handleGenerateSalt() {
    setSalt(randomSalt());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !contractAddress || !address) return;

    const useSalt = salt ?? randomSalt();
    const commitment = computeCommitment(answer.trim(), useSalt, address, bountyId);

    try {
      await tx.run({
        address: contractAddress,
        abi: eclipseAbi,
        functionName: "submitCommitment",
        args: [bountyId, commitment],
        chainId: ritualChain.id,
      });
      // Persist salt + answer locally for the reveal phase.
      rememberCommitment(bountyId, address, useSalt, answer.trim());
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Send Into Eclipse · Commit your answer"
        subtitle="Send your answer into eclipse. Only the commitment corona is public."
      />
      <CardBody>
        {/* Eclipse animation: star (answer) → salt moon covers it → corona */}
        <div className="mb-4 grid place-items-center rounded-xl border border-[var(--ash)]/10 bg-black/30 py-5">
          <CommitEclipseAnim state={state} />
        </div>

        {mine ? (
          <Notice tone="cyan">
            You already entered the eclipse from this browser. Your salt — the moon that opens it
            — is saved locally in your reveal kit. Return during the reveal window.
          </Notice>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <Field
            label="Your answer"
            hint="Hashed with a random salt + your address. Keep this browser to reveal later."
          >
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              placeholder="Write your submission…"
            />
          </Field>

          {/* Commitment formula helper */}
          <div className="rounded-xl border border-[var(--ash)]/10 bg-black/30 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--ash)]/45">
              Commitment formula
            </div>
            <code className="mt-1 block break-words font-mono text-[11px] text-[var(--aurora)]/90">
              keccak256(answer, salt, msg.sender, bountyId)
            </code>
          </div>

          {/* Salt moon control + live hash preview */}
          <div className="space-y-2 rounded-xl border border-[var(--ash)]/10 bg-black/30 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--ash)]/45">
                Salt moon
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={handleGenerateSalt}
                disabled={!trimmed}
                className="px-3 py-1 text-xs"
              >
                {salt ? "Regenerate salt" : "Generate salt"}
              </Button>
            </div>
            {salt ? (
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] text-[var(--ash)]/60">salt</span>
                <CopyHash value={salt} />
              </div>
            ) : (
              <p className="text-xs text-[var(--ash)]/45">
                Your salt is the moon that opens the eclipse. Generate it to preview the corona hash.
              </p>
            )}
            {preview ? (
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] text-[var(--ash)]/60">corona</span>
                <CopyHash value={preview} />
              </div>
            ) : null}
          </div>

          {/* local reveal kit warning */}
          <Notice tone="amber">
            Local reveal kit — your salt and answer are saved only in this browser once you commit.
            Lose them and you lose the moon that opens your eclipse. There is no recovery.
          </Notice>

          <Button type="submit" disabled={!isConnected || !answer.trim() || tx.isBusy} className="w-full">
            {tx.isBusy ? "Entering eclipse…" : "Send into eclipse (commit)"}
          </Button>
          {!isConnected && <p className="text-xs text-[var(--ash)]/45">Connect your wallet to commit.</p>}
          <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />
        </form>
      </CardBody>
    </Card>
  );
}

/* The commit animation: the answer is a visible-text star; a salt moon drifts
   in and covers it; the text disappears; only a luminous corona remains. */
function CommitEclipseAnim({
  state,
}: {
  state: "already" | "empty" | "salt" | "ready";
}) {
  const eclipsed = state === "ready" || state === "already";
  return (
    <div className="relative h-24 w-full max-w-xs">
      <div className="relative grid h-full place-items-center">
        <AnimatePresence mode="wait">
          {state === "empty" && (
            <motion.div
              key="star"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--ash)]/45">
                Your answer · a bright star
              </span>
              <div className="twinkle text-3xl">✦</div>
            </motion.div>
          )}

          {state === "salt" && (
            <motion.div
              key="approach"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative flex items-center justify-center"
            >
              <div className="twinkle text-3xl">✦</div>
              <motion.div
                className="absolute"
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 22, opacity: 1 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              >
                <SaltMoon size={30} generated />
              </motion.div>
            </motion.div>
          )}

          {eclipsed && (
            <motion.div
              key="eclipse"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="relative flex items-center justify-center"
            >
              <motion.div
                initial={{ x: 22 }}
                animate={{ x: 0 }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
              >
                <CommitmentCorona size={64} active />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
