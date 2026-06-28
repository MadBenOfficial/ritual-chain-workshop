"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount, useChainId } from "wagmi";
import { AppShell, TopCommandBar } from "@/components/AppShell";
import { OrbitalPhaseRail, PHASES, type PhaseNode } from "@/components/OrbitalPhaseRail";
import { WalletConnect, RitualNetworkStatus } from "@/components/WalletConnect";
import { CreateBountyForm } from "@/components/CreateBountyForm";
import { LoadBountyPanel } from "@/components/LoadBountyPanel";
import { BountyStage, BountyDrawer } from "@/components/BountyStage";
import { EclipseStage } from "@/components/Observatory";
import { HelpModal } from "@/components/HelpModal";
import { useRecentBounties } from "@/hooks/useRecentBounties";
import { useBounty } from "@/hooks/useBounty";
import { useNow } from "@/hooks/useNow";
import { getBountyPhase, type BountyPhase } from "@/lib/bounty";
import { isContractConfigured } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { isAddressEqual } from "@/lib/format";
import { Notice } from "@/components/ui";
import { pushEvent } from "@/hooks/useEventStrip";

// Map the live bounty phase to a rail stage key so the rail tracks reality.
const PHASE_TO_KEY: Record<BountyPhase, string> = {
  commit: "commit",
  reveal: "reveal",
  judging: "judge",
  judged: "verdict",
  finalized: "finalize",
};

export default function Home() {
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const { ids, add } = useRecentBounties();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const now = useNow();
  const wrongNetwork = isConnected && chainId !== ritualChain.id;

  const { bounty } = useBounty(selectedId ?? undefined);

  useEffect(() => {
    if (selectedId !== null) add(selectedId);
  }, [selectedId, add]);

  // Signal the strip when a wallet comes online.
  useEffect(() => {
    if (isConnected && address) {
      pushEvent({ kind: "wallet", label: "Wallet connected", detail: address });
    }
  }, [isConnected, address]);

  const handleCreated = useCallback(
    (id: bigint) => {
      add(id);
      setSelectedId(id);
    },
    [add],
  );

  // ---- derive rail status ----
  const livePhase = bounty ? getBountyPhase(bounty, now || undefined) : null;
  const activeKey = !isConnected
    ? "connect"
    : selectedId === null
      ? "create"
      : livePhase
        ? PHASE_TO_KEY[livePhase]
        : "status";
  const activeIdx = Math.max(0, PHASES.findIndex((p) => p.key === activeKey));

  const railNodes: PhaseNode[] = PHASES.map((p, i) => ({
    key: p.key,
    index: i,
    label: p.label,
    status: i < activeIdx ? "done" : i === activeIdx ? "active" : "locked",
  }));

  // ---- countdowns for the rail ----
  const nowMs = now || Date.now();
  let submissionCountdown = null;
  let revealCountdown = null;
  if (bounty) {
    const sub = Number(bounty.submissionDeadline);
    const rev = Number(bounty.revealDeadline);
    const span = rev - sub || 1;
    submissionCountdown = {
      label: "Submission",
      remainingMs: sub - nowMs,
      totalMs: span,
      ended: nowMs >= sub,
    };
    revealCountdown = {
      label: "Reveal",
      remainingMs: rev - nowMs,
      totalMs: span,
      ended: nowMs >= rev,
    };
  }

  const isOwner = bounty ? isAddressEqual(address, bounty.owner) : false;

  // ---- stage state when no bounty open ----
  const idleStage: "disconnected" | "wrong-network" | "commit" = wrongNetwork
    ? "wrong-network"
    : !isConnected
      ? "disconnected"
      : "commit";

  return (
    <>
      <AppShell
        topBar={
          <TopCommandBar
            network={<RitualNetworkStatus />}
            wallet={<WalletConnect />}
            bountyId={selectedId}
            onHelp={() => setHelpOpen(true)}
          />
        }
        phaseRail={
          <OrbitalPhaseRail
            nodes={railNodes}
            submissionCountdown={submissionCountdown}
            revealCountdown={revealCountdown}
          />
        }
        stage={
          selectedId !== null ? (
            <BountyStage bountyId={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <IdleStage state={idleStage} connected={isConnected} wrongNetwork={wrongNetwork} />
          )
        }
        drawer={
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ash)]/65">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)] shadow-[0_0_8px_2px_var(--amber)]" />
              {selectedId !== null ? (isOwner ? "Owner actions" : "Participant actions") : "Open / load"}
            </div>

            {!isContractConfigured && (
              <Notice tone="amber">
                No observatory linked. Set{" "}
                <code className="font-mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code>.
              </Notice>
            )}

            {selectedId !== null && bounty ? (
              <BountyDrawer
                bountyId={selectedId}
                bounty={bounty}
                isOwner={isOwner}
              />
            ) : (
              <IdleDrawer
                onCreated={handleCreated}
                selectedId={selectedId}
                onSelect={setSelectedId}
                recentIds={ids}
              />
            )}
          </div>
        }
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

/* The central stage when no bounty is open: the observatory core, dark until
   a wallet powers it on. */
function IdleStage({
  state,
  connected,
  wrongNetwork,
}: {
  state: "disconnected" | "wrong-network" | "commit";
  connected: boolean;
  wrongNetwork: boolean;
}) {
  return (
    <section className="glass relative flex min-h-[520px] flex-col items-center justify-center overflow-hidden rounded-3xl px-6 py-12">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_50%_38%,rgba(255,184,77,0.1),transparent_60%)]" />
      <EclipseStage phase={state} size="lg" />
      <h2 className="mt-7 text-center text-3xl font-light tracking-tight text-[var(--ash)] sm:text-5xl">
        Send your answer into{" "}
        <span
          className="bg-clip-text font-normal text-transparent"
          style={{ backgroundImage: "linear-gradient(90deg, var(--amber), var(--aurora), var(--amber))" }}
        >
          eclipse
        </span>
        .
      </h2>
      <p className="mt-3 max-w-xl text-center text-sm leading-relaxed text-[var(--ash)]/82">
        {wrongNetwork
          ? "The orbit is misaligned — switch to Ritual to power the observatory."
          : !connected
            ? "The observatory is dark. Connect a wallet to bring it online."
            : "Open a bounty star, or align the lens to an existing one."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-[var(--ash)]/50">
        {[
          "Only the commitment corona is public.",
          "The AI reads the constellation in one batch.",
          "Winner fixed in golden orbit.",
        ].map((t) => (
          <span key={t} className="rounded-full border border-[var(--ash)]/12 bg-white/[0.03] px-3 py-1">
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

/* Idle drawer: one console at a time — Create OR Load — with a small switch. */
function IdleDrawer({
  onCreated,
  selectedId,
  onSelect,
  recentIds,
}: {
  onCreated: (id: bigint) => void;
  selectedId: bigint | null;
  onSelect: (id: bigint | null) => void;
  recentIds: string[];
}) {
  const [tab, setTab] = useState<"create" | "load">("create");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--ash)]/10 bg-white/[0.03] p-1">
        {(["create", "load"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-lg px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] transition-colors"
            style={
              tab === t
                ? { background: "var(--amber)", color: "#070707", fontWeight: 600 }
                : { color: "var(--ash)" }
            }
          >
            {t === "create" ? "Open a star" : "Load a bounty"}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {tab === "create" ? (
            <CreateBountyForm onCreated={onCreated} />
          ) : (
            <LoadBountyPanel selectedId={selectedId} onSelect={onSelect} recentIds={recentIds} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
