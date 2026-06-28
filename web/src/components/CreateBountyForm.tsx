"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { parseEther, parseEventLogs } from "viem";
import { contractAddress, isContractConfigured } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import eclipseAbi from "@/abi/EclipseBountyJudge";
import { pushEvent } from "@/hooks/useEventStrip";
import { useWriteTx } from "@/hooks/useWriteTx";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Textarea,
  Button,
  TxStatus,
  Notice,
} from "@/components/ui";
import { RewardCore } from "@/components/Observatory";

const explorerBase = ritualChain.blockExplorers?.default.url;

/** datetime-local string for `now + minutes`, in the input's expected format. */
function deadlineIn(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function CreateBountyForm({ onCreated }: { onCreated?: (bountyId: bigint) => void }) {
  const { isConnected } = useAccount();
  const [title, setTitle] = useState("");
  const [rubric, setRubric] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState(deadlineIn(60));
  const [revealDeadline, setRevealDeadline] = useState(deadlineIn(120));
  const [reward, setReward] = useState("");
  const [createdId, setCreatedId] = useState<bigint | null>(null);

  const tx = useWriteTx((receipt) => {
    try {
      const logs = parseEventLogs({
        abi: eclipseAbi,
        eventName: "BountyOpened",
        logs: receipt.logs,
      });
      const id = logs[0]?.args?.bountyId;
      if (id !== undefined) {
        setCreatedId(id);
        pushEvent({ kind: "create", label: "Bounty star opened", detail: `#${id.toString()}` });
        onCreated?.(id);
      }
    } catch {
      /* couldn't decode — not fatal */
    }
  });

  const validation = useMemo(() => {
    if (!title.trim()) return "Title is required.";
    if (!rubric.trim()) return "Rubric is required.";
    if (!submissionDeadline) return "Pick a submission deadline.";
    if (!revealDeadline) return "Pick a reveal deadline.";
    const sub = new Date(submissionDeadline).getTime();
    const rev = new Date(revealDeadline).getTime();
    if (!Number.isFinite(sub) || !Number.isFinite(rev)) return "Invalid deadline.";
    if (rev <= sub) return "Reveal deadline must be after the submission deadline.";
    if (reward !== "") {
      try {
        parseEther(reward);
      } catch {
        return "Reward must be a valid number.";
      }
    }
    return null;
  }, [title, rubric, submissionDeadline, revealDeadline, reward]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validation || !contractAddress) return;

    const subMs = new Date(submissionDeadline).getTime();
    const revMs = new Date(revealDeadline).getTime();
    if (subMs <= Date.now()) {
      window.alert("Submission deadline must be in the future.");
      return;
    }

    // Ritual's block.timestamp is in MILLISECONDS, so deadlines must be ms too.
    const subTs = BigInt(subMs);
    const revTs = BigInt(revMs);
    const value = reward.trim() === "" ? 0n : parseEther(reward.trim());
    setCreatedId(null);

    try {
      await tx.run({
        address: contractAddress,
        abi: eclipseAbi,
        functionName: "createBounty",
        args: [title.trim(), rubric.trim(), subTs, revTs],
        value,
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Open a bounty · New orbit"
        subtitle="Lock a reward in orbit, set the eclipse (commit) and reveal windows."
      />
      <CardBody>
        {!isContractConfigured && (
          <Notice tone="amber">
            Set <code className="font-mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in your{" "}
            <code className="font-mono">.env.local</code> to enable transactions.
          </Notice>
        )}

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Best gas-optimization writeup"
              maxLength={200}
            />
          </Field>

          <Field label="Rubric" hint="How submissions are scored. The AI judges only against this.">
            <Textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              rows={4}
              placeholder="Correctness 50%, clarity 30%, novelty 20%…"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Eclipse (commit) deadline" hint="Commitments accepted until here.">
              <Input
                type="datetime-local"
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
              />
            </Field>
            <Field label="Reveal deadline" hint="Reveals accepted between the two deadlines.">
              <Input
                type="datetime-local"
                value={revealDeadline}
                onChange={(e) => setRevealDeadline(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Reward (RITUAL)" hint="Locked in orbit on open.">
            <Input
              type="number"
              min="0"
              step="any"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="1.0"
            />
          </Field>

          {validation && (title || rubric || reward) ? (
            <p className="text-xs text-amber-300">{validation}</p>
          ) : null}

          <Button
            type="submit"
            disabled={!isConnected || !isContractConfigured || !!validation || tx.isBusy}
            className="w-full"
          >
            {tx.isBusy ? "Opening orbit…" : "Open bounty"}
          </Button>

          {!isConnected && (
            <p className="text-xs text-zinc-500">Connect your wallet to open a bounty.</p>
          )}

          <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />

          {createdId !== null && (
            <div className="rise-in space-y-2 rounded-xl border border-amber-300/30 bg-amber-400/5 p-3">
              <div className="flex items-center gap-3">
                <div className="star-birth shrink-0">
                  <RewardCore size={56} charging />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-amber-100">
                    A new bounty star is born. Reward locked in orbit as golden energy in its core.
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    Stellar coordinate{" "}
                    <span className="font-mono font-semibold text-amber-100">
                      #{createdId.toString()}
                    </span>{" "}
                    · loaded below.
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
