"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount, usePublicClient } from "wagmi";
import eclipseAbi from "@/abi/EclipseBountyJudge";
import { contractAddress, executorAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { canJudge, type Bounty } from "@/lib/bounty";
import { buildJudgeAllLlmInput, type JudgeSubmission } from "@/lib/ritualLlm";
import { useWriteTx } from "@/hooks/useWriteTx";
import { useRitualWalletStatus } from "@/hooks/useRitualWalletStatus";
import { RitualWalletPanel } from "@/components/RitualWalletPanel";
import { pushEvent } from "@/hooks/useEventStrip";
import { Card, CardHeader, CardBody, Button, TxStatus, Notice, Spinner } from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

// Sequential loading narrative shown while gathering submissions and the
// judging tx settles. Purely visual — the on-chain call is a single batch pass.
const JUDGE_STEPS = [
  "Collecting revealed answers",
  "Excluding unrevealed commitments",
  "Building batch judging input",
  "Applying rubric",
  "Generating AI recommendation",
  "Writing verdict",
] as const;

export function JudgeAll({
  bountyId,
  bounty,
  isOwner,
  onJudged,
}: {
  bountyId: bigint;
  bounty: Bounty;
  isOwner: boolean;
  onJudged: () => void;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ritualChain.id });
  const [gathering, setGathering] = useState(false);
  const [gatherError, setGatherError] = useState<string | null>(null);
  const tx = useWriteTx(() => {
    pushEvent({ kind: "verdict", label: "Constellation judged", detail: `bounty #${bountyId.toString()}` });
    onJudged();
  });
  const reclaimTx = useWriteTx(() => onJudged());

  // Preflight the *connected* wallet's RitualWallet funding (not the bounty
  // contract) — judgeAll spends prepaid+locked RITUAL via the LLM precompile.
  const walletStatus = useRitualWalletStatus(address);

  const count = Number(bounty.submissionCount);
  const revealedCount = Number(bounty.revealedCount);
  const judgeWindowOpen = canJudge(bounty);

  // Owner-only stage, not already judged/finalized.
  if (!isOwner || bounty.judged || bounty.finalized) {
    return null;
  }

  // Reveal window closed with zero revealed stars: nothing to judge — the
  // owner can pull the reward back out of orbit instead.
  if (judgeWindowOpen && revealedCount === 0) {
    const handleReclaim = async () => {
      if (!contractAddress) return;
      try {
        await reclaimTx.run({
          address: contractAddress,
          abi: eclipseAbi,
          functionName: "reclaimReward",
          args: [bountyId],
          chainId: ritualChain.id,
        });
      } catch {
        /* surfaced via reclaimTx.state */
      }
    };

    return (
      <Card>
        <CardHeader
          title="Constellation · Empty sky"
          subtitle="The reveal window closed with no revealed stars."
        />
        <CardBody className="space-y-3">
          <Notice tone="amber">
            Unrevealed stars are excluded — and nothing was revealed. There is no constellation to
            read. You can release the reward locked in orbit back to yourself.
          </Notice>
          <Button onClick={handleReclaim} disabled={reclaimTx.isBusy} className="w-full">
            {reclaimTx.isBusy ? "Reclaiming…" : "Reclaim reward"}
          </Button>
          <TxStatus
            state={reclaimTx.state}
            error={reclaimTx.error}
            hash={reclaimTx.hash}
            explorerBase={explorerBase}
          />
        </CardBody>
      </Card>
    );
  }

  // Otherwise judging requires at least one revealed answer.
  if (revealedCount === 0) {
    return null;
  }

  async function handleJudge() {
    if (!publicClient || !contractAddress || !walletStatus.ready) return;
    setGatherError(null);
    setGathering(true);
    try {
      // 1–2. Load every submission; only REVEALED ones are eligible for judging.
      const submissions: JudgeSubmission[] = [];
      for (let i = 0; i < count; i++) {
        const [submitter, , revealed, answer] = await publicClient.readContract({
          address: contractAddress,
          abi: eclipseAbi,
          functionName: "getSubmission",
          args: [bountyId, BigInt(i)],
        });
        if (revealed) {
          submissions.push({ index: i, submitter, answer });
        }
      }

      // 3–4. Build the batch judging prompt and encode the Ritual LLM request.
      const llmInput = buildJudgeAllLlmInput({
        executorAddress,
        title: bounty.title,
        rubric: bounty.rubric,
        submissions,
      });

      setGathering(false);

      // 5. Submit it on-chain. We pin an explicit high gas limit: on Ritual the
      // automatic estimate only covers the first (cheap commitment) pass of the
      // async precompile, not the replay that decodes the LLM result and writes
      // it to storage — so an estimated tx runs out of gas mid-settlement.
      await tx.run({
        address: contractAddress,
        abi: eclipseAbi,
        functionName: "judgeAll",
        args: [bountyId, llmInput],
        chainId: ritualChain.id,
        gas: 6_000_000n,
      });
    } catch (e) {
      setGathering(false);
      setGatherError(
        (e as { shortMessage?: string; message?: string }).shortMessage ||
          (e as Error).message ||
          "Failed to gather submissions.",
      );
    }
  }

  const busy = gathering || tx.isBusy;
  const fundingReady = walletStatus.ready === true;

  return (
    <Card>
      <CardHeader
        title="Constellation Judgement · Judge all revealed"
        subtitle="The AI reads the constellation in one batch. Unrevealed stars are excluded."
      />
      <CardBody className="space-y-3">
        <Notice tone="violet">AI recommends. Human aligns. The owner finalizes the winner.</Notice>

        {/* Constellation preview: revealed stars are bright + linked; unrevealed
            are dim eclipses outside the constellation. */}
        <ConstellationPreview total={count} revealed={revealedCount} scanning={busy} />

        <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.04] px-3 py-2 text-xs text-cyan-200/90">
          Batch judging only. No one-by-one AI calls.
        </div>

        <RitualWalletPanel status={walletStatus} onDeposited={walletStatus.refetch} />

        {busy ? <JudgeSteps active={busy} /> : null}

        <Button onClick={handleJudge} disabled={busy || !fundingReady} className="w-full">
          {gathering ? (
            <>
              <Spinner /> Mapping {revealedCount} revealed stars…
            </>
          ) : tx.isBusy ? (
            "Reading the constellation…"
          ) : !fundingReady ? (
            "Fund the lens to judge"
          ) : (
            `Read constellation (${revealedCount})`
          )}
        </Button>
        {gatherError && <Notice tone="red">{gatherError}</Notice>}
        <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />
      </CardBody>
    </Card>
  );
}

/* Sequential loading steps shown while judging is in flight. */
function JudgeSteps({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, JUDGE_STEPS.length - 1));
    }, 1400);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div className="space-y-1.5 rounded-xl border border-violet-400/15 bg-black/30 px-3 py-3">
      {JUDGE_STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span
              className={[
                "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[8px] ring-1 transition-all",
                current
                  ? "bg-cyan-400 text-black ring-cyan-300/60 shadow-[0_0_10px_2px_rgba(34,211,238,0.7)]"
                  : done
                    ? "bg-violet-400/80 text-black ring-violet-300/40"
                    : "bg-white/10 ring-white/10",
              ].join(" ")}
            >
              {current ? <Spinner /> : done ? "✓" : ""}
            </span>
            <span
              className={
                current ? "text-cyan-200" : done ? "text-violet-200/80" : "text-zinc-600"
              }
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* Constellation preview: revealed stars form the constellation; unrevealed
   ones float outside it as dim eclipses. The lens sweeps during judging. */
function ConstellationPreview({
  total,
  revealed,
  scanning,
}: {
  total: number;
  revealed: number;
  scanning: boolean;
}) {
  const dim = Math.max(0, total - revealed);
  const pts: [number, number][] = Array.from({ length: revealed }, (_, i) => {
    const a = (i / Math.max(revealed, 1)) * Math.PI * 2 - Math.PI / 2;
    return [100 + 42 * Math.cos(a), 60 + 30 * Math.sin(a)];
  });
  return (
    <div className="grid place-items-center rounded-xl border border-violet-400/10 bg-black/30 py-3">
      <svg viewBox="0 0 200 120" className="h-28 w-full max-w-[260px]" aria-hidden>
        {revealed > 1 && (
          <polygon
            points={pts.map((p) => p.join(",")).join(" ")}
            fill="rgba(34,211,238,0.05)"
            stroke="rgba(34,211,238,0.5)"
            strokeWidth="1"
            className="constellation-line"
          />
        )}
        {pts.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill="#22d3ee"
            className="twinkle"
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}
        {/* unrevealed dim eclipses outside the constellation */}
        {Array.from({ length: dim }, (_, i) => (
          <circle
            key={`d${i}`}
            cx={18 + (i % 6) * 8}
            cy={108}
            r="3"
            fill="#04050a"
            stroke="rgba(120,130,160,0.35)"
            strokeWidth="1"
          />
        ))}
        {scanning && (
          <g className="orbit-spin" style={{ transformOrigin: "100px 60px" }}>
            <line x1="100" y1="60" x2="100" y2="14" stroke="rgba(139,92,246,0.5)" strokeWidth="1" />
            <circle cx="100" cy="14" r="5" fill="none" stroke="rgba(139,92,246,0.85)" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      <span className="text-[11px] text-zinc-500">
        {revealed} revealed in the constellation · {dim} excluded
      </span>
    </div>
  );
}
