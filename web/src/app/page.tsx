"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";
import { CreateBountyForm } from "@/components/CreateBountyForm";
import { LoadBountyPanel } from "@/components/LoadBountyPanel";
import { BountyView } from "@/components/BountyView";
import { EclipseStage, StageFrame, type StageState } from "@/components/Observatory";
import { useRecentBounties } from "@/hooks/useRecentBounties";
import { isContractConfigured, contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { shortenAddress } from "@/lib/format";
import { Notice } from "@/components/ui";

export default function Home() {
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const { ids, add } = useRecentBounties();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== ritualChain.id;

  // Track any opened bounty in the recent list too. `add` is a no-op when the
  // id is already most-recent, so this won't loop.
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

  return (
    <div className="min-h-full">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-violet-400/15 bg-[#04050a]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <EclipseMark />
            <div>
              <h1 className="text-sm font-semibold leading-tight tracking-[0.16em] text-zinc-100">
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

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Hero / explanation */}
        <section className="mb-7">
          <h2 className="text-2xl font-light tracking-tight text-zinc-50 sm:text-4xl">
            Send your answer into{" "}
            <span className="bg-gradient-to-r from-violet-300 via-cyan-200 to-violet-300 bg-clip-text font-normal text-transparent">
              eclipse
            </span>
            .
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Only the commitment corona is public. When the eclipse retreats, revealed
            answers form a constellation the Ritual AI reads in one batch pass.
            <span className="text-cyan-200/80"> AI recommends. Human aligns.</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
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

        {!isContractConfigured && (
          <div className="mb-6">
            <Notice tone="amber">
              No observatory linked. Copy <code className="font-mono">.env.example</code>{" "}
              to <code className="font-mono">.env.local</code> and set{" "}
              <code className="font-mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code> to align the
              lens with a live deployment.
            </Notice>
          </div>
        )}

        {/* Dashboard: create + load */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CreateBountyForm onCreated={handleCreated} />
          <LoadBountyPanel selectedId={selectedId} onSelect={setSelectedId} recentIds={ids} />
        </section>

        {/* Central stage when no bounty is selected — Connect / no bounty state */}
        {selectedId === null && (
          <section className="mt-6">
            <StageFrame
              caption={
                wrongChain
                  ? `Wrong network — align your wallet with ${ritualChain.name} to power the eclipse.`
                  : !isConnected
                    ? "A dark, energy-less eclipse. Connect your wallet to send a light-line into the observatory and power it up."
                    : "Ritual Orbit connected. Open a new bounty star above or align the lens on an existing one to enter the eclipse."
              }
            >
              <div className={!isConnected || wrongChain ? undefined : "power-up"}>
                <EclipseStage
                  phase={
                    (wrongChain
                      ? "wrong-network"
                      : !isConnected
                        ? "disconnected"
                        : "commit") as StageState
                  }
                />
              </div>
              {isConnected && !wrongChain && (
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">
                  Awaiting a bounty star
                </span>
              )}
            </StageFrame>
          </section>
        )}

        {/* Selected bounty */}
        {selectedId !== null && (
          <section className="mt-6">
            <BountyView bountyId={selectedId} />
          </section>
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

/** Small animated eclipse logomark for the header. */
function EclipseMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9">
      <circle cx="20" cy="20" r="14" fill="none" stroke="rgba(34,211,238,0.4)" strokeWidth="1" className="orbit-spin" style={{ transformOrigin: "20px 20px" }} />
      <circle cx="20" cy="20" r="9" fill="#04050a" stroke="#8b5cf6" strokeWidth="1.4" />
      <circle cx="23" cy="17" r="8" fill="#04050a" stroke="rgba(34,211,238,0.6)" strokeWidth="0.8" className="corona-flicker" />
    </svg>
  );
}
