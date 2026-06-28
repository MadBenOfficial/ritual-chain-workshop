"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useNow } from "@/hooks/useNow";
import eclipseAbi from "@/abi/EclipseBountyJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import {
  canCommit,
  computeCommitment,
  randomSalt,
  rememberCommitment,
  recallCommitment,
  type Bounty,
} from "@/lib/bounty";
import { useWriteTx } from "@/hooks/useWriteTx";
import { Card, CardHeader, CardBody, Field, Textarea, Button, TxStatus, Notice } from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

/**
 * Act I — Commit. The answer is hashed locally with a random salt; only the
 * commitment hash goes on-chain. The salt is stored in this browser so you can
 * reveal later.
 */
export function SubmitCommitment({
  bountyId,
  bounty,
  onSubmitted,
}: {
  bountyId: bigint;
  bounty: Bounty;
  onSubmitted: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [answer, setAnswer] = useState("");
  const now = useNow();
  const tx = useWriteTx(() => {
    setAnswer("");
    onSubmitted();
  });

  if (!canCommit(bounty, now)) return null;

  const mine = address ? recallCommitment(bountyId, address) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !contractAddress || !address) return;

    const salt = randomSalt();
    const commitment = computeCommitment(answer.trim(), salt, address, bountyId);

    try {
      await tx.run({
        address: contractAddress,
        abi: eclipseAbi,
        functionName: "submitCommitment",
        args: [bountyId, commitment],
        chainId: ritualChain.id,
      });
      // Persist salt + answer locally for the reveal phase.
      rememberCommitment(bountyId, address, salt, answer.trim());
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Eclipse · Commit your answer"
        subtitle="Only the commitment corona is public. Nobody can read your answer until you reveal."
      />
      <CardBody>
        {mine ? (
          <Notice tone="cyan">
            You already entered the eclipse from this browser. Your salt — the moon that opens it
            — is saved locally. Return during the reveal window.
          </Notice>
        ) : null}
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <Field
            label="Your answer"
            hint="Hashed with a random salt + your address. Keep this browser to reveal later."
          >
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              placeholder="Write your submission…"
            />
          </Field>
          <Button type="submit" disabled={!isConnected || !answer.trim() || tx.isBusy} className="w-full">
            {tx.isBusy ? "Entering eclipse…" : "Send into eclipse (commit)"}
          </Button>
          {!isConnected && <p className="text-xs text-zinc-500">Connect your wallet to commit.</p>}
          <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />
        </form>
      </CardBody>
    </Card>
  );
}
