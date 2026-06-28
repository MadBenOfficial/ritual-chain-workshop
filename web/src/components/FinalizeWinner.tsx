"use client";

import { useState } from "react";
import eclipseAbi from "@/abi/EclipseBountyJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import type { Bounty } from "@/lib/bounty";
import { decodeAiReview } from "@/lib/aiReview";
import { formatReward } from "@/lib/format";
import { useWriteTx } from "@/hooks/useWriteTx";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Button,
  TxStatus,
  Notice,
} from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

export function FinalizeWinner({
  bountyId,
  bounty,
  isOwner,
  onFinalized,
}: {
  bountyId: bigint;
  bounty: Bounty;
  isOwner: boolean;
  onFinalized: () => void;
}) {
  const count = Number(bounty.submissionCount);
  const recommended = decodeAiReview(bounty.aiReview)?.parsed?.winnerIndex;

  // The input is prefilled with the AI recommendation until the owner edits it.
  // `override === null` means "untouched, show the recommendation".
  const [override, setOverride] = useState<string | null>(null);
  const winnerIndex =
    override ?? (recommended !== undefined ? String(recommended) : "");

  const tx = useWriteTx(() => onFinalized());

  // Gate per spec: owner only, judged, not finalized.
  if (!isOwner || !bounty.judged || bounty.finalized) return null;

  const idxNum = Number(winnerIndex);
  const valid =
    winnerIndex !== "" &&
    Number.isInteger(idxNum) &&
    idxNum >= 0 &&
    idxNum < count;

  async function handleFinalize() {
    if (!valid || !contractAddress) return;
    try {
      await tx.run({
        address: contractAddress,
        abi: eclipseAbi,
        functionName: "finalizeWinner",
        args: [bountyId, BigInt(idxNum)],
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Golden Orbit · Finalize winner"
        subtitle="Fix the winning star in a golden orbit and release the reward."
      />
      <CardBody className="space-y-3">
        <Notice tone="gold">
          Reward locked in orbit ({formatReward(bounty.reward)}) — released to a single winner.
        </Notice>

        <Field
          label="Winning star (index)"
          hint={
            recommended !== undefined
              ? `AI recommends #${recommended}. AI recommends. Human aligns.`
              : `Choose a submission index (0–${Math.max(count - 1, 0)}).`
          }
        >
          <Input
            type="number"
            min={0}
            max={Math.max(count - 1, 0)}
            value={winnerIndex}
            onChange={(e) => setOverride(e.target.value)}
          />
        </Field>

        {winnerIndex !== "" && !valid && (
          <p className="text-xs text-amber-300">
            Index must be between 0 and {Math.max(count - 1, 0)}.
          </p>
        )}

        <Button
          onClick={handleFinalize}
          disabled={!valid || tx.isBusy}
          className="w-full"
        >
          {tx.isBusy ? "Fixing orbit…" : "Fix in golden orbit (finalize)"}
        </Button>

        <TxStatus
          state={tx.state}
          error={tx.error}
          hash={tx.hash}
          explorerBase={explorerBase}
        />
      </CardBody>
    </Card>
  );
}
