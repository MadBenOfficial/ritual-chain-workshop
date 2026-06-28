"use client";

import { formatEther } from "viem";
import { RITUAL_WALLET, ritualWalletAbi } from "@/abi/RitualWallet";
import { DEPOSIT_AMOUNT, LOCK_DURATION, type RitualWalletStatus } from "@/lib/ritualWallet";
import { ritualChain } from "@/config/wagmi";
import { useWriteTx } from "@/hooks/useWriteTx";
import { pushEvent } from "@/hooks/useEventStrip";
import { RitualAILens } from "@/components/Observatory";
import { Badge, Button, Notice, Spinner, TxStatus } from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

type Status = Partial<RitualWalletStatus> & { isLoading: boolean; hasData: boolean };

/**
 * RitualWallet funding preflight shown above "Read constellation". Surfaces the
 * current balance / lock vs. the live block, and lets the owner deposit + lock
 * LLM fees without touching the bounty reward (that stays locked in orbit in the
 * EclipseBountyJudge contract).
 */
export function RitualWalletPanel({
  status,
  onDeposited,
}: {
  status: Status;
  onDeposited: () => void;
}) {
  const tx = useWriteTx(() => {
    pushEvent({ kind: "fund", label: "AI judgement funded", detail: "lens charged" });
    onDeposited();
  });

  async function handleDeposit() {
    try {
      await tx.run({
        address: RITUAL_WALLET,
        abi: ritualWalletAbi,
        functionName: "deposit",
        args: [LOCK_DURATION],
        value: DEPOSIT_AMOUNT,
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  // Loading the three reads — show a neutral placeholder, don't block.
  if (!status.hasData) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--ash)]/72">
        <Spinner /> Checking RitualWallet funding…
      </div>
    );
  }

  const { ready, lockExpired, balance, lockUntil, currentBlock } = status;

  // Badge: green ready / red lock expired / yellow deposit required.
  const badge = ready ? (
    <Badge tone="green">RitualWallet ready</Badge>
  ) : lockExpired ? (
    <Badge tone="red">Lock expired</Badge>
  ) : (
    <Badge tone="amber">Deposit required</Badge>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--ash)]/72">Fuel the Oracle · LLM fees</span>
        {badge}
      </div>

      {/* The AI oracle lens: charges with golden energy when funded, flickers
          weakly when not. */}
      <div className="grid place-items-center rounded-xl border border-[var(--ash)]/10 bg-black/30 py-3">
        <RitualAILens funded={ready === true} size={108} />
        <span
          className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${
            ready ? "text-[var(--amber)]/90" : "text-[var(--ash)]/72"
          }`}
        >
          {ready ? "Oracle funded" : "Lens flickering — fuel required"}
        </span>
      </div>

      {!ready && (
        <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber)]/[0.06] p-3 text-xs text-[var(--amber)]/90">
          <p className="font-semibold text-[var(--amber)]">RitualWallet funding required</p>
          <p className="mt-1 text-[var(--amber)]/80">
            To run AI judging, your wallet needs prepaid RITUAL locked in RitualWallet.
          </p>
          <dl className="mt-2 space-y-0.5 font-mono text-[11px] text-[var(--amber)]/90">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--amber)]/70">Current RitualWallet balance</dt>
              <dd>{formatEther(balance ?? 0n)} RITUAL</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--amber)]/70">Locked until block</dt>
              <dd>{(lockUntil ?? 0n).toString()}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--amber)]/70">Current block</dt>
              <dd>{(currentBlock ?? 0n).toString()}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[var(--amber)]/80">
            Deposit {formatEther(DEPOSIT_AMOUNT)} RITUAL and lock for{" "}
            {LOCK_DURATION.toLocaleString()} blocks.
          </p>
          <Button onClick={handleDeposit} disabled={tx.isBusy} className="mt-3 w-full">
            {tx.isBusy ? "Depositing…" : `Deposit LLM Fees (${formatEther(DEPOSIT_AMOUNT)} RITUAL)`}
          </Button>
          <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />
        </div>
      )}

      {ready && (
        <Notice tone="green">
          RitualWallet funded ({formatEther(balance ?? 0n)} RITUAL, locked until block{" "}
          {(lockUntil ?? 0n).toString()}). You can run AI judging.
        </Notice>
      )}
    </div>
  );
}
