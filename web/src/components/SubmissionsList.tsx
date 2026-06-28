"use client";

import { useReadContract } from "wagmi";
import eclipseAbi from "@/abi/EclipseBountyJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { shortenAddress } from "@/lib/format";
import type { JudgeResult } from "@/lib/aiReview";
import { Card, CardHeader, CardBody, Badge } from "@/components/ui";

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
    <Card>
      <CardHeader
        title="Constellation · Submissions"
        subtitle="Eclipsed during commit; revealed stars are read together."
        action={<Badge tone="zinc">{count}</Badge>}
      />
      <CardBody className="space-y-3">
        {count === 0 ? (
          <p className="text-sm text-zinc-500">No stars in this sky yet.</p>
        ) : (
          indices.map((i) => (
            <SubmissionRow
              key={i}
              bountyId={bountyId}
              index={i}
              ranking={judge?.ranking?.find((r) => r.index === i)}
              recommended={judge?.winnerIndex === i}
              isWinner={finalWinner === i}
            />
          ))
        )}
      </CardBody>
    </Card>
  );
}

function SubmissionRow({
  bountyId,
  index,
  ranking,
  recommended,
  isWinner,
}: {
  bountyId: bigint;
  index: number;
  ranking?: { index: number; score: number; reason: string };
  recommended?: boolean;
  isWinner?: boolean;
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
          ? "border-amber-300/40 bg-amber-400/5"
          : recommended
            ? "border-cyan-400/40 bg-cyan-500/5"
            : "border-violet-400/10 bg-black/25"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">★{index}</span>
          <span className="font-mono text-sm text-zinc-300">
            {submitter ? shortenAddress(submitter) : isLoading ? "loading…" : "-"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {ranking ? <Badge tone="zinc">score {ranking.score}</Badge> : null}
          {revealed ? <Badge tone="cyan">Revealed</Badge> : <Badge tone="violet">Eclipsed</Badge>}
          {isWinner ? (
            <Badge tone="gold">Golden orbit</Badge>
          ) : recommended ? (
            <Badge tone="cyan">AI recommends</Badge>
          ) : null}
        </div>
      </div>

      {revealed ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-200">
          {answer ?? (isLoading ? "" : "-")}
        </p>
      ) : (
        <p className="mt-2 text-sm italic text-zinc-500">
          In eclipse — only the commitment corona is public.
        </p>
      )}

      {ranking?.reason ? (
        <p className="mt-2 border-t border-white/5 pt-2 text-xs text-zinc-400">
          <span className="text-zinc-500">AI: </span>
          {ranking.reason}
        </p>
      ) : null}
    </div>
  );
}
