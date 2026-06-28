"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";
import { CreateBountyForm } from "@/components/CreateBountyForm";
import { LoadBountyPanel } from "@/components/LoadBountyPanel";
import { BountyView } from "@/components/BountyView";
import { EclipseStage, PhaseRail, type RailStatus, type StageState } from "@/components/Observatory";
import { useRecentBounties } from "@/hooks/useRecentBounties";
import { isContractConfigured, contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { shortenAddress } from "@/lib/format";
import { Notice } from "@/components/ui";

// The fixed observatory phase rail (per the design brief). When no bounty is
// selected we sit at Connect/Create; once a bounty is loaded BountyView drives
// its own live rail. This top-level rail is the journey map.
const JOURNEY = [
  "Connect",
  "Create",
  "Status",
  "Commit",
  "Reveal",
  "Fund AI",
  "Judge",
  "Verdict",
  "Finalize",
] as const;

export default function Home() {
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const { ids, add } = useRecentBounties();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const wrongNetwork = isConnected && chainId !== ritualChain.id;

  useEffect(() => {
    if (selectedId !== null) add(selectedId);
  }, [selectedId, add]);

  const handleCreated = useCallback(
    (id: bigint) => {
      add(id);
      setSelectedId(id);
    },
    [add],
  );

  // Central stage state when no bounty is open: dark eclipse / wrong-network /
  // powered observatory waiting for a bounty.
  const stageState: StageState = wrongNetwork
    ? "wrong-network"
    : !isConnected
      ? "disconnected"
      : "commit"; // powered, awaiting a bounty star

  // Journey rail status: Connect done once connected; Create active.
  const activeJourney = !isConnected ? 0 : selectedId !== null ? 2 : 1;
  const railNodes = JOURNEY.map((label, i) => ({
    key: label,
    label,
    status: (i < activeJourney ? "done" : i === activeJourney ? "active" : "locked") as RailStatus,
  }));

  return (
    <div className="min-h-full">
      {/* Observatory top bar */}
      <header className="sticky top-0 z-20 border-b border-violet-400/15 bg-[#04050a]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <EclipseMark />
            <div>
              <h1 className="text-sm font-semibold leading-tight tracking-[0.18em] text-zinc-100">
                ECLIPSE OBSERVATORY
              </h1>
              <p className="text-[11px] leading-tight text-cyan-200/70">
                privacy-preserving AI bounty judge · {ritualChain.name}
              </p>
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {selectedId === null ? (
          <>
            {/* Orbital phase rail — the journey, not a navbar */}
            <PhaseRail nodes={railNodes} />

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
              {/* ZONE 1 — Central Observatory (the eclipse stage is the hero) */}
              <section className="relative flex min-h-[460px] flex-col items-center justify-center overflow-hidden rounded-3xl glass-panel px-6 py-10">
                <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_40%,rgba(139,92,246,0.12),transparent_60%)]" />
                <EclipseStage phase={stageState} size="lg" />
                <h2 className="mt-6 text-center text-3xl font-light tracking-tight text-zinc-50 sm:text-5xl">
                  Send your answer into{" "}
                  <span className="bg-gradient-to-r from-violet-300 via-cyan-200 to-violet-300 bg-clip-text font-normal text-transparent">
                    eclipse
                  </span>
                  .
                </h2>
                <p className="mt-3 max-w-xl text-center text-sm leading-relaxed text-zinc-400">
                  {wrongNetwork
                    ? "The orbit is misaligned — switch to Ritual to power the observatory."
                    : !isConnected
                      ? "The observatory is dark. Connect a wallet to bring it online."
                      : "Open a bounty star on the right, or align the lens to an existing one."}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-zinc-400">
                  {[
                    "Only the commitment corona is public.",
                    "The AI reads the constellation in one batch.",
                    "Winner fixed in golden orbit.",
                  ].map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-violet-400/15 bg-white/[0.03] px-3 py-1"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </section>

              {/* ZONE 3 — Signal Drawer (create / load when idle) */}
              <aside className="space-y-5">
                <div className="flex items-center gap-2 px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_2px_rgba(34,211,238,0.7)]" />
                  Signal Drawer
                </div>

                {!isContractConfigured && (
                  <Notice tone="amber">
                    No observatory linked. Set{" "}
                    <code className="font-mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in{" "}
                    <code className="font-mono">.env.local</code>.
                  </Notice>
                )}

                <CreateBountyForm onCreated={handleCreated} />
                <LoadBountyPanel selectedId={selectedId} onSelect={setSelectedId} recentIds={ids} />
              </aside>
            </div>
          </>
        ) : (
          // A bounty is open: the whole observatory is its live stage + drawer.
          <div className="space-y-4">
            <button
              onClick={() => setSelectedId(null)}
              className="text-xs text-cyan-300/80 transition-colors hover:text-cyan-200"
            >
              ← back to the observatory
            </button>
            <BountyView bountyId={selectedId} />
          </div>
        )}

        <footer className="mt-10 border-t border-violet-400/15 pt-4 text-xs text-zinc-600">
          {contractAddress ? (
            <>
              Observatory <span className="font-mono">{shortenAddress(contractAddress, 6)}</span> ·
              Chain {ritualChain.id}
            </>
          ) : (
            <>Eclipse Observatory · {ritualChain.name}</>
          )}
        </footer>
      </main>
    </div>
  );
}

function EclipseMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9">
      <circle cx="20" cy="20" r="14" fill="none" stroke="rgba(34,211,238,0.4)" strokeWidth="1" className="orbit-spin" style={{ transformOrigin: "20px 20px" }} />
      <circle cx="20" cy="20" r="9" fill="#04050a" stroke="#8b5cf6" strokeWidth="1.4" />
      <circle cx="23" cy="17" r="8" fill="#04050a" stroke="rgba(34,211,238,0.6)" strokeWidth="0.8" className="corona-flicker" />
    </svg>
  );
}
