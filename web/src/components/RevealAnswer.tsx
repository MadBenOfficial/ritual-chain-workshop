"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useNow } from "@/hooks/useNow";
import aiJudgeAbi from "@/abi/AIJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { canReveal, computeCommitment, recallCommitment, type Bounty } from "@/lib/bounty";
import { useWriteTx } from "@/hooks/useWriteTx";
import { Card, CardHeader, CardBody, Field, Textarea, Input, Button, TxStatus, Notice } from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

/**
 * Act II — Reveal. Provide answer + salt; the contract recomputes the hash and
 * verifies it matches your commitment. A live preview shows whether they match.
 */
export function RevealAnswer({
  bountyId,
  bounty,
  onRevealed,
}: {
  bountyId: bigint;
  bounty: Bounty;
  onRevealed: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [answer, setAnswer] = useState("");
  const [salt, setSalt] = useState("");
  const now = useNow();
  const tx = useWriteTx(() => onRevealed());

  // Prefill from the locally-stored commitment, if any.
  useEffect(() => {
    if (address) {
      const mine = recallCommitment(bountyId, address);
      if (mine) {
        setAnswer((a) => a || mine.answer);
        setSalt((s) => s || mine.salt);
      }
    }
  }, [address, bountyId]);

  if (!canReveal(bounty, now)) return null;

  const validSalt = /^0x[0-9a-fA-F]{64}$/.test(salt);
  const preview =
    address && answer && validSalt
      ? computeCommitment(answer.trim(), salt as `0x${string}`, address, bountyId)
      : null;

  async function handleReveal(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !validSalt || !contractAddress) return;
    try {
      await tx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "revealAnswer",
        args: [bountyId, answer.trim(), salt as `0x${string}`],
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Act II · Reveal your answer"
        subtitle="The contract verifies keccak256(answer, salt, you, bountyId) against your commitment."
      />
      <CardBody>
        <form onSubmit={handleReveal} className="space-y-3">
          <Field label="Answer">
            <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} />
          </Field>
          <Field label="Salt" hint="Auto-filled if you committed in this browser.">
            <Input value={salt} onChange={(e) => setSalt(e.target.value)} placeholder="0x…" />
          </Field>

          {preview ? (
            <Notice tone="zinc">
              <div className="font-mono text-[11px] break-all">
                computed: {preview}
              </div>
            </Notice>
          ) : null}

          <Button type="submit" disabled={!isConnected || !answer.trim() || !validSalt || tx.isBusy} className="w-full">
            {tx.isBusy ? "Revealing…" : "Open the mask (reveal)"}
          </Button>
          {!isConnected && <p className="text-xs text-zinc-500">Connect your wallet to reveal.</p>}
          {!validSalt && salt ? (
            <p className="text-xs text-amber-300">Salt must be a 32-byte hex value (0x + 64 chars).</p>
          ) : null}
          <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />
        </form>
      </CardBody>
    </Card>
  );
}
