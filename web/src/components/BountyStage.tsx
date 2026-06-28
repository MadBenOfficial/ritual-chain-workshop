"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useBounty } from "@/hooks/useBounty";
import { useNow } from "@/hooks/useNow";
import { decodeAiReview } from "@/lib/aiReview";
import { getBountyPhase, PHASE_META, type Bounty, type BountyPhase } from "@/lib/bounty";
import { EclipseStage } from "@/components/Observatory";
import { BountyDetail } from "@/components/BountyDetail";
import { SubmitCommitment } from "@/components/SubmitCommitment";
import { RevealAnswer } from "@/components/RevealAnswer";
import { JudgeAll } from "@/components/JudgeAll";
import { FinalizeWinner } from "@/components/FinalizeWinner";
import { AIReviewDisplay } from "@/components/AIReviewDisplay";
import { SubmissionsList } from "@/components/SubmissionsList";
import { Notice, Spinner } from "@/components/ui";

const STAGE_CAPTION: Record<BountyPhase, string> = {
  commit: "Send your answer into eclipse. Only the commitment corona is public.",
  reveal: "The eclipse retreats. Reveal aligns answer, salt, sender, and bounty.",
  judging: "Revealed answers form a constellation. The AI reads it in one batch. Unrevealed stars are excluded.",
  judged: "AI recommends. Human aligns. The recommended star is illuminated.",
  finalized: "Winner fixed in golden orbit. Finalized — reward paid.",
};

/* ============================================ Main Stage (center column) ==
   The active observatory scene for the open bounty: a large eclipse stage
   that morphs per phase, with the live caption + key facts. */
export function BountyStage({ bountyId, onBack }: { bountyId: bigint; onBack: () => void }) {
  const now = useNow();
  const { bounty, isLoading, isError } = useBounty(bountyId);

  if (isLoading) {
    return (
      <Scene>
        <div className="flex items-center gap-2 text-sm text-[var(--ash)]/82">
          <Spinner /> Aligning the lens on bounty #{bountyId.toString()}…
        </div>
      </Scene>
    );
  }
  if (isError || !bounty || /^0x0+$/.test(bounty.owner)) {
    return (
      <Scene>
        <Notice tone="ember">
          Bounty #{bountyId.toString()} has no orbit — check the id, contract and RPC.
        </Notice>
        <button onClick={onBack} className="mt-4 text-xs text-[var(--aurora)] hover:brightness-110">
          ← back to the observatory
        </button>
      </Scene>
    );
  }

  const phase = getBountyPhase(bounty, now || undefined);
  const meta = PHASE_META[phase];

  return (
    <section className="glass relative flex min-h-[520px] flex-col items-center overflow-hidden rounded-3xl px-6 py-8">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_50%_34%,rgba(255,184,77,0.08),transparent_60%)]" />

      <div className="flex w-full items-center justify-between">
        <button onClick={onBack} className="text-xs text-[var(--aurora)] hover:brightness-110">
          ← observatory
        </button>
        <span
          className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em]"
          style={{ background: "rgba(255,255,255,0.04)", color: "var(--ash)" }}
        >
          {meta.label}
        </span>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--aurora)]/70">
          <span className="font-mono text-[var(--ash)]/50">#{bountyId.toString()}</span>
          {bounty.title || "Untitled star"}
        </div>
        <EclipseStage phase={phase} size="lg" />
        <p className="mt-5 max-w-md text-center text-xs leading-relaxed text-[var(--ash)]/78">
          {STAGE_CAPTION[phase]}
        </p>
      </div>

      {/* AI verdict shown in the stage once judged (the constellation result) */}
      {bounty.judged && (
        <div className="mt-6 w-full max-w-lg">
          <AIReviewDisplay aiReview={bounty.aiReview} />
        </div>
      )}
    </section>
  );
}

function Scene({ children }: { children: React.ReactNode }) {
  return (
    <section className="glass relative flex min-h-[520px] flex-col items-center justify-center rounded-3xl px-6 py-10">
      {children}
    </section>
  );
}

/* ===================================== Action / Submissions Drawer (right) ==
   Role-based actions + the live Star Registry. Only the ACTIVE phase's action
   panel is shown at a time, with a fade/slide transition between phases. */
export function BountyDrawer({ bountyId, bounty, isOwner }: { bountyId: bigint; bounty: Bounty; isOwner: boolean }) {
  const now = useNow();
  const [showRegistry, setShowRegistry] = useState(true);
  const reload = useCallback(() => {}, []);

  const judge = decodeAiReview(bounty.aiReview)?.parsed ?? null;
  const phase = getBountyPhase(bounty, now || undefined);

  // The single action panel for the current phase. Each component already
  // self-hides outside its window, so this just selects which to mount.
  const action =
    phase === "commit" ? (
      <SubmitCommitment key="commit" bountyId={bountyId} bounty={bounty} onSubmitted={reload} />
    ) : phase === "reveal" ? (
      <RevealAnswer key="reveal" bountyId={bountyId} bounty={bounty} onRevealed={reload} />
    ) : phase === "judging" ? (
      <JudgeAll key="judge" bountyId={bountyId} bounty={bounty} isOwner={isOwner} onJudged={reload} />
    ) : phase === "judged" ? (
      <FinalizeWinner key="finalize" bountyId={bountyId} bounty={bounty} isOwner={isOwner} onFinalized={reload} />
    ) : null; // finalized → no action

  return (
    <div className="space-y-3">
      <BountyDetail bountyId={bountyId} bounty={bounty} isOwner={isOwner} />

      <AnimatePresence mode="wait">
        {action ? (
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {action}
          </motion.div>
        ) : (
          <motion.div
            key="finalized-note"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-[var(--amber)]/25 bg-[var(--amber)]/[0.06] px-4 py-3 text-[12px] text-[var(--amber)]/90"
          >
            Finalized — reward paid. The winning star is fixed in golden orbit.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Star Registry — collapsible, so it doesn't compete with the action */}
      <div>
        <button
          onClick={() => setShowRegistry((v) => !v)}
          className="mb-2 flex w-full items-center justify-between rounded-xl border border-[var(--ash)]/10 bg-white/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-[var(--ash)]/75 transition-colors hover:text-[var(--ash)]"
        >
          <span>Star Registry · {Number(bounty.submissionCount)}</span>
          <span>{showRegistry ? "▾" : "▸"}</span>
        </button>
        <AnimatePresence initial={false}>
          {showRegistry && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <SubmissionsList
                bountyId={bountyId}
                count={Number(bounty.submissionCount)}
                judge={judge}
                finalWinner={bounty.finalized ? Number(bounty.winnerIndex) : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
