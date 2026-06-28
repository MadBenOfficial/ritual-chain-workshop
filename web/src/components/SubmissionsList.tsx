"use client";

import { useReadContract } from "wagmi";
import eclipseAbi from "@/abi/EclipseBountyJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { shortenAddress } from "@/lib/format";
import type { JudgeResult } from "@/lib/aiReview";
import { Badge } from "@/components/ui";
import { DrawerPanel, MiniGlyph } from "@/components/DrawerPanel";

export function SubmissionsList({
  bountyId,
  count,
  judge,
  finalWinner,
}: {
  bountyId: bigint;
  count: number;
  judge?: JudgeResult | null;
  finalWinner?: number;
}) {
  const indices = Array.from({ length: count }, (_, i) => i);

  return (
    <DrawerPanel
      glyph={<MiniGlyph kind="star" />}
      step="STAR REGISTRY"
      title="Submissions"
      hint="Eclipsed during commit; revealed stars are read together."
      accent="ash"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <Badge tone="ash">{count}</Badge>
        </div>
        {count === 0 ? (
          <p className="text-sm text-[var(--ash)]/45">No stars in this sky yet.</p>
        ) : (
          indices.map((i) => (
            <SubmissionRow
              key={i}
              bountyId={bountyId}
              index={i}
              ranking={judge?.ranking?.find((r) => r.index === i)}
              recommended={judge?.winnerIndex === i}
              isWinner={finalWinner === i}
              humanOverride={
                finalWinner === i &&
                judge?.winnerIndex !== undefined &&
                judge.winnerIndex !== i
              }
            />
          ))
        )}
      </div>
    </DrawerPanel>
  );
}

function SubmissionRow({
  bountyId,
  index,
  ranking,
  recommended,
  isWinner,
  humanOverride,
}: {
  bountyId: bigint;
  index: number;
  ranking?: { index: number; score: number; reason: string };
  recommended?: boolean;
  isWinner?: boolean;
  humanOverride?: boolean;
}) {
  const { data, isLoading } = useReadContract({
    address: contractAddress,
    abi: eclipseAbi,
    functionName: "getSubmission",
    args: [bountyId, BigInt(index)],
    chainId: ritualChain.id,
    query: { enabled: !!contractAddress },
  });

  const submitter = data?.[0];
  const revealed = data?.[2];
  const answer = data?.[3];

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        isWinner
          ? "border-[var(--amber)]/45 bg-[var(--amber)]/[0.06] shadow-[inset_0_0_30px_-8px_rgba(245,196,81,0.6)]"
          : recommended
            ? "border-[var(--aurora)]/45 bg-[var(--aurora)]/[0.06] shadow-[inset_0_0_24px_-8px_rgba(185,242,255,0.5)]"
            : revealed
              ? "border-[var(--ash)]/10 bg-black/25"
              : "border-white/5 bg-black/40 opacity-80"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs ${isWinner ? "text-[var(--amber)] corona-flicker" : recommended ? "text-[var(--verdigris)]" : "text-[var(--ash)]/45"}`}>
            ★{index}
          </span>
          <span className="font-mono text-sm text-[var(--ash)]/80">
            {submitter ? shortenAddress(submitter) : isLoading ? "loading…" : "-"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {ranking ? <Badge tone="ash">score {ranking.score}</Badge> : null}
          {revealed ? <Badge tone="verdigris">Revealed</Badge> : <Badge tone="eclipse">Eclipsed · Sealed</Badge>}
          {isWinner ? (
            <Badge tone="amber">Golden orbit</Badge>
          ) : recommended ? (
            <Badge tone="aurora">AI recommends</Badge>
          ) : null}
          {humanOverride ? <Badge tone="amber">Human override</Badge> : null}
        </div>
      </div>

      {revealed ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--ash)]/90">
          {answer ?? (isLoading ? "" : "-")}
        </p>
      ) : (
        <p className="mt-2 text-sm italic text-[var(--ash)]/45">
          In eclipse — only the commitment corona is public.
        </p>
      )}

      {ranking?.reason ? (
        <p className="mt-2 border-t border-white/5 pt-2 text-xs text-[var(--ash)]/60">
          <span className="text-[var(--ash)]/45">AI: </span>
          {ranking.reason}
        </p>
      ) : null}
    </div>
  );
}
