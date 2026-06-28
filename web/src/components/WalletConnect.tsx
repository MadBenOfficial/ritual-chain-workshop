"use client";

import { useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { ritualChain } from "@/config/wagmi";
import { shortenAddress } from "@/lib/format";
import { Button } from "@/components/ui";

/** "Ritual Orbit Connected" network status pill. */
export function RitualNetworkStatus() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  if (!isConnected) return null;
  const wrong = chainId !== ritualChain.id;
  return (
    <span
      className="hidden items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] sm:inline-flex"
      style={
        wrong
          ? { borderColor: "rgba(255,77,61,0.4)", color: "var(--ember)", background: "rgba(255,77,61,0.06)" }
          : { borderColor: "rgba(67,217,163,0.35)", color: "var(--verdigris)", background: "rgba(67,217,163,0.06)" }
      }
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: wrong ? "var(--ember)" : "var(--verdigris)",
          boxShadow: `0 0 8px 1px ${wrong ? "var(--ember)" : "var(--verdigris)"}`,
        }}
      />
      {wrong ? "Off Ritual orbit" : "Ritual Orbit Connected"}
    </span>
  );
}

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);

  const wrongChain = isConnected && chainId !== ritualChain.id;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {wrongChain && (
          <Button
            variant="secondary"
            onClick={() => switchChain({ chainId: ritualChain.id })}
            className="eclipse-vibrate text-[var(--ember)]"
            style={{ borderColor: "rgba(255,77,61,0.5)" }}
          >
            Switch to {ritualChain.name}
          </Button>
        )}
        <Button variant="secondary" onClick={() => disconnect()} title={address}>
          <span className="font-mono">{shortenAddress(address)}</span>
        </Button>
      </div>
    );
  }

  const seen = new Set<string>();
  const list = connectors.filter((c) => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });

  return (
    <div className="relative">
      <Button onClick={() => setOpen((v) => !v)} disabled={isPending}>
        {isPending ? "Connecting…" : "Connect Wallet"}
      </Button>
      {open && (
        <div className="glass-strong absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl shadow-xl">
          {list.length === 0 && (
            <div className="px-3 py-2 text-xs text-[var(--ash)]/50">No wallet connectors found.</div>
          )}
          {list.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector });
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-[var(--ash)]/85 transition-colors hover:bg-[var(--amber)]/10 hover:text-[var(--amber)]"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
