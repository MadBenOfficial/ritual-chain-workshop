"use client";

import { useCallback } from "react";
import { useAccount } from "wagmi";
import { useBounty } from "@/hooks/useBounty";
import { useNow } from "@/hooks/useNow";
import { isAddressEqual } from "@/lib/format";
import { decodeAiReview } from "@/lib/aiReview";
import {
  getBountyPhase,
  PHASE_META,
  type BountyPhase,
} from "@/lib/bounty";
import { BountyDetail } from "@/components/BountyDetail";
import { SubmitCommitment } from "@/components/SubmitCommitment";
import { RevealAnswer } from "@/components/RevealAnswer";
import { JudgeAll } from "@/components/JudgeAll";
import { FinalizeWinner } from "@/components/FinalizeWinner";
import { AIReviewDisplay } from "@/components/AIReviewDisplay";
import { SubmissionsList } from "@/components/SubmissionsList";
import {
  EclipseStage,
  PhaseRail,
  type RailStatus,
} from "@/components/Observatory";
import { Card, CardBody, Notice, Spinner } from "@/components/ui";

const STAGE_CAPTION: Record<BountyPhase, string> = {
  commit: "Send your answer into eclipse. Only the commitment corona is public.",
  reveal:
    "The eclipse retreats. Reveal aligns answer, salt, sender, and bounty — two coronas meet.",
  judging:
    "Revealed answers form a constellation. The AI reads the constellation in one batch. Unrevealed stars are excluded.",
  judged: "AI recommends. Human aligns. The recommended star is illuminated.",
  finalized: "Winner fixed in golden orbit. Finalized — reward paid.",
};

// Rail order maps to observatory bodies. We derive each node's status from
// the live phase so the active body glows and earlier ones become luminous.
const PHASE_ORDER: BountyPhase[] = [
  "commit",
  "reveal",
  "judging",
  "judged",
  "finalized",
];

export function BountyView({ bountyId }: { bountyId: bigint }) {
  const { address } = useAccount();
  const now = useNow();
  const { bounty, isLoading, isError, refetch } = useBounty(bountyId);

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Spinner /> Aligning the lens on bounty #{bountyId.toString()}…
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isError || !bounty) {
    return (
      <Notice tone="red">
        Couldn&apos;t reach bounty #{bountyId.toString()}. Check the id and that the
        observatory address / RPC are configured correctly.
      </Notice>
    );
  }

  // An owner of address(0) means the bounty doesn't exist yet.
  if (/^0x0+$/.test(bounty.owner)) {
    return (
      <Notice tone="amber">
        Bounty #{bountyId.toString()} has no orbit yet — it doesn&apos;t exist.
      </Notice>
    );
  }

  const isOwner = isAddressEqual(address, bounty.owner);
  const judge = decodeAiReview(bounty.aiReview)?.parsed ?? null;
  const phase = getBountyPhase(bounty, now || undefined);
  const activeIdx = PHASE_ORDER.indexOf(phase);

  const railNodes = PHASE_ORDER.map((p, i) => ({
    key: p,
    label: PHASE_META[p].short,
    status: (i < activeIdx
      ? "done"
      : i === activeIdx
        ? "active"
        : "locked") as RailStatus,
  }));

  return (
    <div className="space-y-5">
      {/* Orbital phase navigator */}
      <PhaseRail nodes={railNodes} />

      {/* ZONE 1 — Central observatory: the live eclipse stage is the hero */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl glass-panel px-6 py-8">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_35%,rgba(139,92,246,0.14),transparent_60%)]" />
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-cyan-200/70">
          <span className="font-mono text-zinc-500">#{bountyId.toString()}</span>
          {bounty.title || "Untitled star"}
        </div>
        <EclipseStage phase={phase} size="lg" />
        <p className="mt-5 max-w-md text-center text-xs leading-relaxed text-zinc-400">
          {STAGE_CAPTION[phase]}
        </p>
      </section>

      {/* ZONES 2 & 3 — Signal Drawer (role actions) + Star Registry */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_2px_rgba(34,211,238,0.7)]" />
            Signal Drawer
            <span className="normal-case tracking-normal text-zinc-600">
              · {isOwner ? "owner controls" : "participant controls"}
            </span>
          </div>

          <BountyDetail bountyId={bountyId} bounty={bounty} isOwner={isOwner} />
          <SubmitCommitment bountyId={bountyId} bounty={bounty} onSubmitted={reload} />
          <RevealAnswer bountyId={bountyId} bounty={bounty} onRevealed={reload} />
          <JudgeAll bountyId={bountyId} bounty={bounty} isOwner={isOwner} onJudged={reload} />
          <FinalizeWinner bountyId={bountyId} bounty={bounty} isOwner={isOwner} onFinalized={reload} />
        </div>

        <div className="space-y-4">
          {bounty.judged && <AIReviewDisplay aiReview={bounty.aiReview} />}
          <SubmissionsList
            bountyId={bountyId}
            count={Number(bounty.submissionCount)}
            judge={judge}
            finalWinner={bounty.finalized ? Number(bounty.winnerIndex) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
