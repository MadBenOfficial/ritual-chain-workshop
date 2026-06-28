"use client";

import { useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import eclipseAbi from "@/abi/EclipseBountyJudge";
import { contractAddress, executorAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { canJudge, type Bounty } from "@/lib/bounty";
import { buildJudgeAllLlmInput, type JudgeSubmission } from "@/lib/ritualLlm";
import { useWriteTx } from "@/hooks/useWriteTx";
import { useRitualWalletStatus } from "@/hooks/useRitualWalletStatus";
import { RitualWalletPanel } from "@/components/RitualWalletPanel";
import { Card, CardHeader, CardBody, Button, TxStatus, Notice, Spinner } from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

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
  const tx = useWriteTx(() => onJudged());
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
        title="Constellation · Judge all revealed"
        subtitle="The AI reads the constellation in one batch. Unrevealed stars are excluded."
      />
      <CardBody className="space-y-3">
        <Notice tone="violet">AI recommends. Human aligns. The owner finalizes the winner.</Notice>

        <RitualWalletPanel status={walletStatus} onDeposited={walletStatus.refetch} />

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
