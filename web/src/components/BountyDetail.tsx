"use client";

import type { Bounty } from "@/lib/bounty";
import { getBountyPhase, PHASE_META, canCommit, canReveal } from "@/lib/bounty";
import { useNow } from "@/hooks/useNow";
import { shortenAddress, formatReward, formatTimestamp, formatRelative } from "@/lib/format";
import { CountdownRing } from "@/components/Observatory";
import { Badge } from "@/components/ui";
import { DrawerPanel, MiniGlyph } from "@/components/DrawerPanel";

export function BountyDetail({
  bountyId,
  bounty,
  isOwner,
}: {
  bountyId: bigint;
  bounty: Bounty;
  isOwner: boolean;
}) {
  const now = useNow();
  const nowMs = now || Date.now();
  const phase = getBountyPhase(bounty, now || undefined);
  const meta = PHASE_META[phase];

  // Two orbital rings — submission + reveal — each a moon orbiting the bounty.
  // The commit window length isn't stored on-chain, so approximate its span
  // from the reveal window as a stable fallback for the ring fraction.
  const revWindow = Number(bounty.revealDeadline) - Number(bounty.submissionDeadline) || 1;
  const subRemaining = Number(bounty.submissionDeadline) - nowMs;
  const subSpan = revWindow;
  const subProgress = Math.max(0, Math.min(1, subRemaining / subSpan));

  const revRemaining = Number(bounty.revealDeadline) - nowMs;
  const revProgress = Math.max(0, Math.min(1, revRemaining / revWindow));

  const commitOpen = canCommit(bounty, nowMs);
  const revealOpen = canReveal(bounty, nowMs);

  return (
    <DrawerPanel
      glyph={<MiniGlyph kind="orbit" />}
      step="STATUS · BOUNTY ORBIT"
      title={`#${bountyId.toString()} ${bounty.title || "Untitled"}`}
      accent="copper"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {isOwner && <Badge tone="indigo">You own this</Badge>}
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>

        {/* Two orbital countdown rings: submission + reveal moons. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--ash)]/10 bg-black/30 px-3 py-2">
            <CountdownRing
              progress={commitOpen ? subProgress : 0}
              tone="violet"
              label="Submission orbit"
              sub={commitOpen ? `commit ${formatRelative(bounty.submissionDeadline)}` : "eclipse sealed"}
            />
          </div>
          <div className="rounded-xl border border-[var(--ash)]/10 bg-black/30 px-3 py-2">
            <CountdownRing
              progress={revealOpen ? revProgress : phase === "commit" ? 1 : 0}
              tone="cyan"
              label="Reveal orbit"
              sub={
                revealOpen
                  ? `reveal ${formatRelative(bounty.revealDeadline)}`
                  : phase === "commit"
                    ? "opens after commit"
                    : "reveal closed"
              }
            />
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--ash)]/45">Rubric</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--ash)]/90">
            {bounty.rubric || "-"}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--ash)]/10 bg-black/30">
          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--ash)]/8">
            <Readout label="Reward" value={formatReward(bounty.reward)} />
            <Readout label="Owner" value={shortenAddress(bounty.owner)} />
            <Readout
              label="Eclipsed / Revealed"
              value={`${bounty.submissionCount.toString()} / ${bounty.revealedCount.toString()}`}
            />
            <Readout label="Winner" value={bounty.finalized ? `#${bounty.winnerIndex.toString()}` : "-"} />
            <Readout
              label="Submission deadline"
              value={
                <span>
                  {formatTimestamp(bounty.submissionDeadline)}
                  <span className="ml-1 text-xs text-[var(--ash)]/45">
                    ({formatRelative(bounty.submissionDeadline)})
                  </span>
                </span>
              }
            />
            <Readout
              label="Reveal deadline"
              value={
                <span>
                  {formatTimestamp(bounty.revealDeadline)}
                  <span className="ml-1 text-xs text-[var(--ash)]/45">
                    ({formatRelative(bounty.revealDeadline)})
                  </span>
                </span>
              }
            />
          </div>
        </div>

        {bounty.finalized && (
          <div className="rounded-xl bg-[var(--amber)]/10 px-3 py-2 text-sm text-[var(--amber)] ring-1 ring-inset ring-amber-300/30">
            Winner fixed in golden orbit — submission{" "}
            <span className="font-mono font-semibold">#{bounty.winnerIndex.toString()}</span>.
            Finalized — reward paid.
          </div>
        )}
      </div>
    </DrawerPanel>
  );
}

/* Instrument-readout cell: a small etched label over a precise value, laid out
   in a divided grid so the block reads like a console gauge cluster rather than
   a set of stacked cards. */
function Readout({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ash)]/40">{label}</div>
      <div className="mt-0.5 break-words text-sm font-medium text-[var(--ash)]">{value}</div>
    </div>
  );
}
