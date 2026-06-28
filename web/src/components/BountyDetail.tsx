"use client";

import type { Bounty } from "@/lib/bounty";
import { getBountyPhase, PHASE_META, canCommit, canReveal } from "@/lib/bounty";
import { useNow } from "@/hooks/useNow";
import { shortenAddress, formatReward, formatTimestamp, formatRelative } from "@/lib/format";
import { CountdownRing } from "@/components/Observatory";
import { Card, CardHeader, CardBody, Badge, Stat } from "@/components/ui";

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

  // Countdown ring: fraction of the live window still remaining.
  let ring:
    | { progress: number; tone: "cyan" | "violet" | "gold"; label: string; sub: string }
    | null = null;
  if (canCommit(bounty, nowMs)) {
    const remaining = Number(bounty.submissionDeadline) - nowMs;
    // Approximate the commit window length from the reveal span as a fallback.
    const span =
      Number(bounty.revealDeadline) - Number(bounty.submissionDeadline) || remaining || 1;
    ring = {
      progress: Math.max(0, Math.min(1, remaining / span)),
      tone: "violet",
      label: "Eclipse closing",
      sub: `commit ${formatRelative(bounty.submissionDeadline)}`,
    };
  } else if (canReveal(bounty, nowMs)) {
    const remaining = Number(bounty.revealDeadline) - nowMs;
    const span = Number(bounty.revealDeadline) - Number(bounty.submissionDeadline) || 1;
    ring = {
      progress: Math.max(0, Math.min(1, remaining / span)),
      tone: "cyan",
      label: "Eclipse retreating",
      sub: `reveal ${formatRelative(bounty.revealDeadline)}`,
    };
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-zinc-500">#{bountyId.toString()}</span>
            <span className="normal-case text-base text-zinc-100">
              {bounty.title || "Untitled"}
            </span>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            {isOwner && <Badge tone="indigo">You own this</Badge>}
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        }
      />
      <CardBody className="space-y-4">
        {ring ? (
          <div className="rounded-xl border border-violet-400/10 bg-black/30 px-3 py-2">
            <CountdownRing
              progress={ring.progress}
              tone={ring.tone}
              label={ring.label}
              sub={ring.sub}
            />
          </div>
        ) : null}

        <div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Rubric</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-200">
            {bounty.rubric || "-"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Reward" value={formatReward(bounty.reward)} />
          <Stat label="Owner" value={shortenAddress(bounty.owner)} />
          <Stat
            label="Eclipsed / Revealed"
            value={`${bounty.submissionCount.toString()} / ${bounty.revealedCount.toString()}`}
          />
          <Stat label="Winner" value={bounty.finalized ? `#${bounty.winnerIndex.toString()}` : "-"} />
          <Stat
            label="Submission deadline"
            value={
              <span>
                {formatTimestamp(bounty.submissionDeadline)}
                <span className="ml-1 text-xs text-zinc-500">
                  ({formatRelative(bounty.submissionDeadline)})
                </span>
              </span>
            }
          />
          <Stat
            label="Reveal deadline"
            value={
              <span>
                {formatTimestamp(bounty.revealDeadline)}
                <span className="ml-1 text-xs text-zinc-500">
                  ({formatRelative(bounty.revealDeadline)})
                </span>
              </span>
            }
          />
        </div>

        {bounty.finalized && (
          <div className="rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-inset ring-amber-300/30">
            Winner fixed in golden orbit — submission{" "}
            <span className="font-mono font-semibold">#{bounty.winnerIndex.toString()}</span>.
            Finalized — reward paid.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
