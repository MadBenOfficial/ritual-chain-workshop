"use client";

import { motion } from "framer-motion";

export type RailStatus = "done" | "active" | "locked";

export type PhaseNode = {
  key: string;
  index: number;
  label: string;
  status: RailStatus;
};

/** The 9-stage flow, fixed order per the design brief. */
export const PHASES: { key: string; label: string }[] = [
  { key: "connect", label: "Connect Wallet" },
  { key: "create", label: "Create Bounty" },
  { key: "status", label: "Bounty Status" },
  { key: "commit", label: "Commit Answer" },
  { key: "reveal", label: "Reveal Answer" },
  { key: "fund", label: "Fund AI Judgement" },
  { key: "judge", label: "Judge with Ritual AI" },
  { key: "verdict", label: "AI Verdict" },
  { key: "finalize", label: "Finalize & Pay" },
  { key: "submissions", label: "Submissions" },
];

/* ============================================== Orbital Phase Rail (260) ===
   Left column. Each stage is an orbital body: number, name, status dot.
   Active = lit amber; done = soft verdigris glow; locked = dim.
   Hosts the two primary countdowns. */

export function OrbitalPhaseRail({
  nodes,
  onSelect,
  submissionCountdown,
  revealCountdown,
}: {
  nodes: PhaseNode[];
  onSelect?: (key: string) => void;
  submissionCountdown?: CountdownProps | null;
  revealCountdown?: CountdownProps | null;
}) {
  return (
    <nav
      aria-label="Observatory phases"
      className="glass flex h-full flex-col gap-1 rounded-2xl p-3 lg:sticky lg:top-24"
    >
      <div className="mb-1 px-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ash)]/65">
        Phase orbit
      </div>

      {/* Mobile: horizontal scroller. Desktop: vertical list. */}
      <ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0 thin-scroll">
        {nodes.map((n, i) => {
          const tone =
            n.status === "active"
              ? "var(--amber)"
              : n.status === "done"
                ? "var(--verdigris)"
                : "rgba(216,209,197,0.25)";
          return (
            <li key={n.key} className="relative shrink-0">
              {/* connecting orbit line (desktop) */}
              {i < nodes.length - 1 && (
                <span
                  className="absolute left-[18px] top-7 hidden h-[calc(100%-12px)] w-px lg:block"
                  style={{
                    background:
                      n.status === "done"
                        ? "linear-gradient(var(--verdigris), transparent)"
                        : "rgba(216,209,197,0.08)",
                  }}
                />
              )}
              <button
                onClick={() => onSelect?.(n.key)}
                className={[
                  "group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors",
                  n.status === "active" ? "bg-[var(--amber)]/[0.06]" : "hover:bg-white/[0.03]",
                ].join(" ")}
              >
                <motion.span
                  layout
                  animate={n.status === "active" ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                  transition={
                    n.status === "active"
                      ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.3 }
                  }
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-xs"
                  style={{
                    color: n.status === "locked" ? "rgba(216,209,197,0.4)" : "#070707",
                    background:
                      n.status === "locked" ? "rgba(255,255,255,0.05)" : tone,
                    boxShadow:
                      n.status === "active"
                        ? `0 0 16px 3px ${tone}`
                        : n.status === "done"
                          ? `0 0 8px 1px ${tone}`
                          : "none",
                    border: n.status === "locked" ? "1px solid rgba(216,209,197,0.12)" : "none",
                  }}
                >
                  {n.index}
                </motion.span>
                <span
                  className="whitespace-nowrap text-[12px] tracking-wide lg:whitespace-normal"
                  style={{
                    color:
                      n.status === "active"
                        ? "var(--amber)"
                        : n.status === "done"
                          ? "rgba(216,209,197,0.85)"
                          : "rgba(216,209,197,0.4)",
                  }}
                >
                  {n.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Two primary countdowns */}
      {(submissionCountdown || revealCountdown) && (
        <div className="mt-2 space-y-2 border-t border-[var(--ash)]/10 pt-3">
          {submissionCountdown && <CountdownRow {...submissionCountdown} />}
          {revealCountdown && <CountdownRow {...revealCountdown} />}
        </div>
      )}
    </nav>
  );
}

/* ============================================================ Countdown ===
   A thin orbital ring with a moon swinging toward the eclipse. Color shifts:
   plenty = aurora, low = copper, critical = pulsing amber, ended = ember. */

export type CountdownProps = {
  label: string;
  remainingMs: number;
  totalMs: number;
  ended?: boolean;
};

export function CountdownRow({ label, remainingMs, totalMs, ended }: CountdownProps) {
  const p = Math.max(0, Math.min(1, totalMs > 0 ? remainingMs / totalMs : 0));
  const minutes = Math.max(0, Math.floor(remainingMs / 60000));
  const secs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

  // urgency color
  const tone = ended
    ? "var(--ember)"
    : p > 0.4
      ? "var(--aurora)"
      : p > 0.15
        ? "var(--copper)"
        : "var(--amber)";
  const critical = !ended && p <= 0.15;

  const r = 15;
  const c = 2 * Math.PI * r;
  // moon angle: swings around as the window drains
  const angle = (1 - p) * 300 - 60;
  const mx = 20 + r * Math.cos((angle * Math.PI) / 180);
  const my = 20 + r * Math.sin((angle * Math.PI) / 180);

  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" className={`h-11 w-11 ${critical ? "eclipse-pulse" : ""}`}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(216,209,197,0.1)" strokeWidth="2.5" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform="rotate(-90 20 20)"
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.6s" }}
        />
        {/* the moon */}
        {!ended && <circle cx={mx} cy={my} r="2.4" fill={tone} style={{ filter: `drop-shadow(0 0 4px ${tone})` }} />}
        {/* eclipse core */}
        <circle cx="20" cy="20" r="6" fill="#070707" stroke={tone} strokeWidth="0.6" />
      </svg>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ash)]/72">{label}</div>
        <div className="font-mono text-sm" style={{ color: tone }}>
          {ended ? "window closed" : `${minutes}m ${secs.toString().padStart(2, "0")}s`}
        </div>
      </div>
    </div>
  );
}
