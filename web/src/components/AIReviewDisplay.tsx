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
                  <thead className="bg-white/5 text-xs uppercase tracking-wide text-[var(--ash)]/82">
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
                              ? "bg-[var(--aurora)]/10 shadow-[inset_0_0_24px_-6px_rgba(185,242,255,0.6)]"
                              : "opacity-70"
                          }`}
                        >
                          <td className="px-3 py-2 font-mono">
                            {r.index}
                            {r.index === parsed.winnerIndex && (
                              <span className="ml-1 text-[var(--verdigris)] corona-flicker">★</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">{r.score}</td>
                          <td className="px-3 py-2 text-[var(--ash)]/80">{r.reason}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {parsed.summary && (
              <div className="rounded-xl bg-black/20 px-3 py-2 text-sm text-[var(--ash)]/90">
                <span className="text-[var(--ash)]/72">Summary: </span>
                {parsed.summary}
              </div>
            )}

            <p className="text-center text-[11px] uppercase tracking-[0.16em] text-[var(--aurora)]/70">
              AI recommends. Human aligns.
            </p>
          </>
        ) : (
          <>
            <Notice tone="amber">
              Couldn&apos;t parse the AI review as JSON. Showing the raw response.
            </Notice>
            <pre className="max-h-72 overflow-auto rounded-xl bg-black/40 p-3 font-mono text-xs text-[var(--ash)]/80 whitespace-pre-wrap break-words">
              {raw}
            </pre>
          </>
        )}
      </CardBody>
    </Card>
  );
}
