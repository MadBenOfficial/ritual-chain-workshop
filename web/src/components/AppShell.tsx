"use client";

import { type ReactNode } from "react";
import { useEventStrip, type ObsEvent } from "@/hooks/useEventStrip";

/* ============================================================ AppShell ====
   The fixed observatory skeleton:
     ┌─────────────── Top Command Bar ───────────────┐
     │ Phase Rail (260) │  Main Stage  │ Drawer (340) │
     └─────────────── Bottom Event Strip ─────────────┘
   On mobile the rail becomes a horizontal scroller and the drawer drops
   below the stage. */

export function AppShell({
  topBar,
  phaseRail,
  stage,
  drawer,
}: {
  topBar: ReactNode;
  phaseRail: ReactNode;
  stage: ReactNode;
  drawer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-30 px-3 pt-3 sm:px-4">{topBar}</div>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-3 px-3 py-3 sm:px-4 lg:grid-cols-[260px_minmax(0,1fr)_410px]">
        {/* Left — Orbital Phase Rail (own scroll on desktop) */}
        <div className="order-2 lg:order-1 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto thin-scroll">
          {phaseRail}
        </div>
        {/* Center — Main Stage */}
        <div className="order-1 lg:order-2">{stage}</div>
        {/* Right — Action / Submissions Drawer (own scroll on desktop) */}
        <div className="order-3 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto thin-scroll">
          {drawer}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 px-3 pb-3 sm:px-4">
        <BottomEventStrip />
      </div>
    </div>
  );
}

/* ===================================================== Top Command Bar ====
   Low, premium, floating control bar — not a navbar. */

export function TopCommandBar({
  network,
  wallet,
  bountyId,
  onHelp,
}: {
  network: ReactNode;
  wallet: ReactNode;
  bountyId?: bigint | null;
  onHelp?: () => void;
}) {
  return (
    <div className="glass-strong mx-auto flex max-w-[1500px] items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
      <div className="flex items-center gap-3">
        <EclipseMark />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-[0.16em] text-[var(--ash)]">
            ECLIPSE BOUNTY JUDGE
          </div>
          <div className="text-[10px] tracking-wide text-[var(--aurora)]/70">
            cryptographic observatory · privacy-preserving AI judging
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {bountyId !== null && bountyId !== undefined && (
          <span className="hidden rounded-lg border border-[var(--amber)]/25 bg-[var(--amber)]/5 px-2 py-1 font-mono text-[11px] text-[var(--amber)] sm:inline">
            bounty #{bountyId.toString()}
          </span>
        )}
        {network}
        {wallet}
        <button
          onClick={onHelp}
          aria-label="Help"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--ash)]/15 text-[var(--ash)]/70 transition-colors hover:border-[var(--aurora)]/40 hover:text-[var(--aurora)]"
        >
          ?
        </button>
      </div>
    </div>
  );
}

function EclipseMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8">
      <circle cx="20" cy="20" r="14" fill="none" stroke="rgba(185,242,255,0.35)" strokeWidth="1" className="orbit-spin" style={{ transformOrigin: "20px 20px" }} />
      <circle cx="20" cy="20" r="9" fill="#070707" stroke="var(--amber)" strokeWidth="1.4" />
      <circle cx="23" cy="17" r="8" fill="#070707" stroke="rgba(185,242,255,0.55)" strokeWidth="0.8" className="corona-flicker" />
    </svg>
  );
}

/* ===================================================== Bottom Event Strip ==
   Horizontal timeline of recent signals. Click a signal to expand its detail. */

const EVENT_META: Record<ObsEvent["kind"], { dot: string; label: string }> = {
  wallet: { dot: "var(--aurora)", label: "Wallet" },
  create: { dot: "var(--amber)", label: "Bounty" },
  commit: { dot: "var(--eclipse)", label: "Commit" },
  reveal: { dot: "var(--verdigris)", label: "Reveal" },
  fund: { dot: "var(--amber)", label: "Fund" },
  "judge-start": { dot: "var(--aurora)", label: "Judging" },
  verdict: { dot: "var(--aurora)", label: "Verdict" },
  finalize: { dot: "var(--amber)", label: "Finalize" },
  error: { dot: "var(--ember)", label: "Error" },
};

export function BottomEventStrip() {
  const { events } = useEventStrip();

  return (
    <div className="glass mx-auto flex max-w-[1500px] items-center gap-3 overflow-x-auto rounded-2xl px-3 py-2 thin-scroll">
      <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-[var(--ash)]/65">
        Signal log
      </span>
      {events.length === 0 ? (
        <span className="text-[11px] text-[var(--ash)]/65">
          No signals yet — connect a wallet to bring the observatory online.
        </span>
      ) : (
        <div className="flex items-center gap-2">
          {events.map((e) => {
            const meta = EVENT_META[e.kind];
            return (
              <div
                key={e.id}
                title={e.detail ? `${e.label} — ${e.detail}` : e.label}
                className="group flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--ash)]/10 bg-black/30 px-2 py-1"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: meta.dot, boxShadow: `0 0 8px 1px ${meta.dot}` }}
                />
                <span className="whitespace-nowrap text-[11px] text-[var(--ash)]/80">
                  {e.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
