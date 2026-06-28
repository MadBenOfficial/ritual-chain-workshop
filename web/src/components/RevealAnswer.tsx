"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useNow } from "@/hooks/useNow";
import eclipseAbi from "@/abi/EclipseBountyJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { canReveal, computeCommitment, recallCommitment, type Bounty } from "@/lib/bounty";
import { useWriteTx } from "@/hooks/useWriteTx";
import { CopyHash } from "@/components/Observatory";
import { pushEvent } from "@/hooks/useEventStrip";
import { motion } from "framer-motion";
import { Field, Textarea, Input, Button, TxStatus, Notice } from "@/components/ui";
import { DrawerPanel, MiniGlyph } from "@/components/DrawerPanel";

const explorerBase = ritualChain.blockExplorers?.default.url;

/**
 * Act II — Reveal. Provide answer + salt; the contract recomputes the hash and
 * verifies it matches your commitment. A live preview shows whether they match.
 */
export function RevealAnswer({
  bountyId,
  bounty,
  onRevealed,
}: {
  bountyId: bigint;
  bounty: Bounty;
  onRevealed: () => void;
}) {
  const { address, isConnected } = useAccount();
  // Track whether the user has manually edited each field. Until they do, the
  // field shows the locally-stored commitment value. This is robust to mount
  // ordering / wallet hydration: as soon as `address` is available the stored
  // value is reflected, without relying on a one-shot effect.
  const [answerEdit, setAnswerEdit] = useState<string | null>(null);
  const [saltEdit, setSaltEdit] = useState<string | null>(null);
  const now = useNow();
  const tx = useWriteTx(() => {
    pushEvent({ kind: "reveal", label: "Answer revealed", detail: `bounty #${bountyId.toString()}` });
    onRevealed();
  });

  const stored = address ? recallCommitment(bountyId, address) : null;
  const answer = answerEdit ?? stored?.answer ?? "";
  const salt = saltEdit ?? stored?.salt ?? "";

  // Read this participant's on-chain commitment so we can warn BEFORE spending
  // gas on a reveal that would revert with "commitment mismatch".
  const slotQ = useReadContract({
    address: contractAddress,
    abi: eclipseAbi,
    functionName: "entrySlot",
    args: address ? [bountyId, address] : undefined,
    chainId: ritualChain.id,
    query: { enabled: Boolean(address) },
  });
  const slot = slotQ.data as bigint | undefined;
  const subQ = useReadContract({
    address: contractAddress,
    abi: eclipseAbi,
    functionName: "getSubmission",
    args: slot && slot > 0n ? [bountyId, slot - 1n] : undefined,
    chainId: ritualChain.id,
    query: { enabled: Boolean(slot && slot > 0n) },
  });

  if (!canReveal(bounty, now)) return null;

  const validSalt = /^0x[0-9a-fA-F]{64}$/.test(salt);
  const preview =
    address && answer && validSalt
      ? computeCommitment(answer.trim(), salt as `0x${string}`, address, bountyId)
      : null;

  const onChainCommitment = subQ.data ? ((subQ.data as readonly unknown[])[1] as `0x${string}`) : undefined;
  const matches =
    preview && onChainCommitment ? preview.toLowerCase() === onChainCommitment.toLowerCase() : null;

  async function handleReveal(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !validSalt || !contractAddress) return;
    try {
      await tx.run({
        address: contractAddress,
        abi: eclipseAbi,
        functionName: "revealAnswer",
        args: [bountyId, answer.trim(), salt as `0x${string}`],
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <DrawerPanel
      glyph={<MiniGlyph kind="reveal" />}
      step="STEP 4 · REVEAL"
      title="Break the eclipse"
      hint="Your salt is the moon that opens the eclipse. Reveal aligns answer, salt, sender, and bounty."
      accent="verdigris"
    >
      <form onSubmit={handleReveal} className="space-y-3">
          {stored ? (
            <Notice tone="cyan">
              Found your saved corona for this bounty in this browser — answer and salt are
              filled in below.
            </Notice>
          ) : (
            <Notice tone="amber">
              Lost reveal coordinates — no saved corona found in this browser for the connected
              wallet. If you entered the eclipse elsewhere, paste your answer and salt manually.
            </Notice>
          )}
          <Field label="Answer">
            <Textarea value={answer} onChange={(e) => setAnswerEdit(e.target.value)} rows={4} />
          </Field>
          <Field label="Salt (the moon)" hint="Auto-filled if you committed in this browser.">
            <Input value={salt} onChange={(e) => setSaltEdit(e.target.value)} placeholder="0x…" />
          </Field>

          {preview ? (
            <Notice tone={matches === false ? "amber" : matches === true ? "cyan" : "zinc"}>
              <div className="mb-1 text-[11px] uppercase tracking-[0.14em] opacity-70">
                Two coronas
              </div>
              {/* Visual alignment of the two coronas, driven by `matches`. */}
              <TwoCoronas matches={matches} />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[11px] text-[var(--ash)]/82">recomputed</span>
                  <CopyHash value={preview} />
                </div>
                {onChainCommitment ? (
                  <div className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-[11px] text-[var(--ash)]/82">on-chain</span>
                    <CopyHash value={onChainCommitment} />
                  </div>
                ) : null}
              </div>
              {matches === false ? (
                <div className="mt-2 text-[var(--amber)]">
                  These coronas don&apos;t align — this answer + salt does NOT match your on-chain
                  commitment. Revealing now would revert (CoronaMismatch). Use the exact answer and
                  salt you committed with.
                </div>
              ) : null}
              {matches === true ? (
                <div className="mt-2 text-[var(--verdigris)]">Coronas aligned — matches your commitment ✓</div>
              ) : null}
            </Notice>
          ) : null}

          <Button
            type="submit"
            disabled={!isConnected || !answer.trim() || !validSalt || matches === false || tx.isBusy}
            className="w-full"
          >
            {tx.isBusy ? "Opening the eclipse…" : "Open the eclipse (reveal)"}
          </Button>
          {!isConnected && <p className="text-xs text-[var(--ash)]/72">Connect your wallet to reveal.</p>}
          {!validSalt && salt ? (
            <p className="text-xs text-[var(--amber)]">Salt must be a 32-byte hex value (0x + 64 chars).</p>
          ) : null}
          <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />
        </form>
    </DrawerPanel>
  );
}

/* Two coronas (recomputed vs on-chain). When they match they slide together
   and the eclipse opens; when they don't, the orbits misalign with a red
   glitch. Driven entirely by the existing `matches` boolean. */
function TwoCoronas({ matches }: { matches: boolean | null }) {
  const aligned = matches === true;
  const broken = matches === false;
  return (
    <div className="my-2 grid place-items-center">
      <svg viewBox="0 0 200 80" className="h-16 w-full max-w-[220px]" aria-hidden>
        <defs>
          <radialGradient id="revC" cx="50%" cy="50%" r="50%">
            <stop offset="50%" stopColor="#43D9A3" stopOpacity="0" />
            <stop offset="82%" stopColor="#43D9A3" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#43D9A3" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="revV" cx="50%" cy="50%" r="50%">
            <stop offset="50%" stopColor="#B9F2FF" stopOpacity="0" />
            <stop offset="82%" stopColor="#B9F2FF" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#B9F2FF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="revR" cx="50%" cy="50%" r="50%">
            <stop offset="50%" stopColor="#f87171" stopOpacity="0" />
            <stop offset="82%" stopColor="#f87171" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* recomputed corona (left) */}
        <motion.g
          className={broken ? "glitch-shift" : undefined}
          animate={{ x: aligned ? 38 : 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <circle cx="62" cy="40" r="26" fill={broken ? "url(#revR)" : "url(#revV)"} />
          <circle
            cx="62"
            cy="40"
            r="15"
            fill="#04050a"
            stroke={broken ? "rgba(248,113,113,0.8)" : "rgba(185,242,255,0.7)"}
            strokeWidth="1.4"
          />
        </motion.g>

        {/* on-chain corona (right) */}
        <motion.g
          className={broken ? "glitch-shift" : undefined}
          animate={{ x: aligned ? -38 : 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <circle cx="138" cy="40" r="26" fill={broken ? "url(#revR)" : "url(#revC)"} />
          <circle
            cx="138"
            cy="40"
            r="15"
            fill="#04050a"
            stroke={broken ? "rgba(248,113,113,0.8)" : "rgba(67,217,163,0.7)"}
            strokeWidth="1.4"
          />
        </motion.g>

        {/* aligned flash — the eclipse opens */}
        {aligned && (
          <motion.circle
            cx="100"
            cy="40"
            r="20"
            fill="url(#revC)"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          />
        )}
      </svg>
      <p
        className={`text-[11px] ${
          aligned ? "text-[var(--verdigris)]" : broken ? "text-[var(--amber)]" : "text-[var(--ash)]/72"
        }`}
      >
        {aligned
          ? "Coronas aligned — the eclipse opens."
          : broken
            ? "Orbits misaligned — coronas do not meet."
            : "Awaiting alignment…"}
      </p>
    </div>
  );
}
