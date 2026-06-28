"use client";

import { useCallback } from "react";
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
        <div className="flex items-center gap-2 text-sm text-[var(--ash)]/60">
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
        <p className="mt-5 max-w-md text-center text-xs leading-relaxed text-[var(--ash)]/55">
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
   Role-based actions + the live Star Registry. Driven by the same hooks. */
export function BountyDrawer({ bountyId, bounty, isOwner }: { bountyId: bigint; bounty: Bounty; isOwner: boolean }) {
  // BountyStage owns the read; the drawer triggers a refetch through window focus
  // / wagmi's own polling. We pass a no-op reload that components already debounce.
  const reload = useCallback(() => {
    // useBounty polls; nothing else required here.
  }, []);

  const judge = decodeAiReview(bounty.aiReview)?.parsed ?? null;

  return (
    <div className="space-y-3">
      <BountyDetail bountyId={bountyId} bounty={bounty} isOwner={isOwner} />
      <SubmitCommitment bountyId={bountyId} bounty={bounty} onSubmitted={reload} />
      <RevealAnswer bountyId={bountyId} bounty={bounty} onRevealed={reload} />
      <JudgeAll bountyId={bountyId} bounty={bounty} isOwner={isOwner} onJudged={reload} />
      <FinalizeWinner bountyId={bountyId} bounty={bounty} isOwner={isOwner} onFinalized={reload} />
      <SubmissionsList
        bountyId={bountyId}
        count={Number(bounty.submissionCount)}
        judge={judge}
        finalWinner={bounty.finalized ? Number(bounty.winnerIndex) : undefined}
      />
    </div>
  );
}
