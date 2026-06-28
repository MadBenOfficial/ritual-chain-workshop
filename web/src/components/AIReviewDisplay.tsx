"use client";

import { decodeAiReview } from "@/lib/aiReview";
import { Card, CardHeader, CardBody, Badge, Notice } from "@/components/ui";

export function AIReviewDisplay({ aiReview }: { aiReview: `0x${string}` }) {
  const decoded = decodeAiReview(aiReview);
  if (!decoded) return null;

  const { raw, parsed } = decoded;

  return (
    <Card>
      <CardHeader
        title="Predicted Alignment · AI verdict"
        subtitle="AI recommends. Human aligns. Read from the whole constellation in one pass."
        action={
          parsed ? (
            <Badge tone="cyan">Recommends ★{parsed.winnerIndex}</Badge>
          ) : (
            <Badge tone="amber">Unparsed</Badge>
          )
        }
      />
      <CardBody className="space-y-3">
        {parsed ? (
          <>
            {parsed.ranking.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...parsed.ranking]
                      .sort((a, b) => b.score - a.score)
                      .map((r) => (
                        <tr
                          key={r.index}
                          className={`border-t border-white/5 transition-colors ${
                            r.index === parsed.winnerIndex
                              ? "bg-cyan-500/10 shadow-[inset_0_0_24px_-6px_rgba(34,211,238,0.6)]"
                              : "opacity-70"
                          }`}
                        >
                          <td className="px-3 py-2 font-mono">
                            {r.index}
                            {r.index === parsed.winnerIndex && (
                              <span className="ml-1 text-cyan-300 corona-flicker">★</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">{r.score}</td>
                          <td className="px-3 py-2 text-zinc-300">{r.reason}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {parsed.summary && (
              <div className="rounded-xl bg-black/20 px-3 py-2 text-sm text-zinc-200">
                <span className="text-zinc-500">Summary: </span>
                {parsed.summary}
              </div>
            )}

            <p className="text-center text-[11px] uppercase tracking-[0.16em] text-cyan-200/70">
              AI recommends. Human aligns.
            </p>
          </>
        ) : (
          <>
            <Notice tone="amber">
              Couldn&apos;t parse the AI review as JSON. Showing the raw response.
            </Notice>
            <pre className="max-h-72 overflow-auto rounded-xl bg-black/40 p-3 font-mono text-xs text-zinc-300 whitespace-pre-wrap break-words">
              {raw}
            </pre>
          </>
        )}
      </CardBody>
    </Card>
  );
}
