"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BountyPhase } from "@/lib/bounty";

/* ============================================================== Stage ====
   The central observatory stage. Its visual changes per phase:
     commit    → eclipse (answer hidden behind the moon, only the corona shows)
     reveal    → opening ring (the eclipse retreats; two coronas align)
     judging   → constellation scanned by the Ritual AI lens
     judged    → an illuminated star (cyan/violet halo) — the recommendation
     finalized → a star fixed in a golden orbit

   Two extra non-bounty states power the Connect stage:
     disconnected → a dark, energy-less eclipse
     wrong-network → the eclipse vibrates with a red border
*/

export type StageState = BountyPhase | "disconnected" | "wrong-network";

export function EclipseStage({ phase, size = "md" }: { phase: StageState; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-60 w-60 sm:h-80 sm:w-80" : "h-44 w-44 sm:h-52 sm:w-52";
  return (
    <div
      className="relative grid place-items-center"
      aria-hidden
      role="presentation"
    >
      <svg viewBox="0 0 240 240" className={cls}>
        <defs>
          <radialGradient id="coronaV" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="78%" stopColor="#8b5cf6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="coronaC" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="80%" stopColor="#22d3ee" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="solar" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde9b8" />
            <stop offset="45%" stopColor="#f5c451" />
            <stop offset="100%" stopColor="#b8862a" />
          </radialGradient>
          <radialGradient id="coronaRed" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#f87171" stopOpacity="0" />
            <stop offset="82%" stopColor="#f87171" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* outer thin orbits, always present */}
        <g className="orbit-spin" style={{ transformOrigin: "120px 120px" }}>
          <circle cx="120" cy="120" r="104" fill="none" stroke="rgba(139,92,246,0.18)" strokeWidth="1" />
          <circle cx="224" cy="120" r="2.5" fill="#8b5cf6" />
        </g>
        <g className="orbit-spin-rev" style={{ transformOrigin: "120px 120px" }}>
          <circle cx="120" cy="120" r="86" fill="none" stroke="rgba(34,211,238,0.16)" strokeWidth="1" />
          <circle cx="34" cy="120" r="2" fill="#22d3ee" />
        </g>

        <AnimatePresence mode="wait">
          <motion.g
            key={phase}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {phase === "disconnected" && <DisconnectedGlyph />}
            {phase === "wrong-network" && <WrongNetworkGlyph />}
            {phase === "commit" && <CommitGlyph />}
            {phase === "reveal" && <RevealGlyph />}
            {phase === "judging" && <ConstellationGlyph />}
            {phase === "judged" && <RecommendedStarGlyph />}
            {phase === "finalized" && <GoldenOrbitGlyph />}
          </motion.g>
        </AnimatePresence>
      </svg>
    </div>
  );
}

function DisconnectedGlyph() {
  // A dark, energy-less eclipse — no corona, just a cold silhouette.
  return (
    <g>
      <circle cx="120" cy="120" r="40" fill="#04050a" stroke="rgba(120,130,160,0.3)" strokeWidth="1.2" />
      <circle cx="120" cy="120" r="40" fill="none" stroke="rgba(120,130,160,0.12)" strokeWidth="0.5" />
    </g>
  );
}

function WrongNetworkGlyph() {
  // The eclipse vibrates with a red border.
  return (
    <g className="eclipse-vibrate" style={{ transformOrigin: "120px 120px" }}>
      <circle cx="120" cy="120" r="56" fill="url(#coronaRed)" className="corona-flicker" />
      <circle cx="120" cy="120" r="40" fill="#04050a" stroke="rgba(248,113,113,0.85)" strokeWidth="2" />
    </g>
  );
}

function CommitGlyph() {
  // The moon fully covers the answer-sun; only the corona escapes.
  return (
    <g className="eclipse-pulse" style={{ transformOrigin: "120px 120px" }}>
      <circle cx="120" cy="120" r="62" fill="url(#coronaV)" />
      <circle cx="120" cy="120" r="40" fill="#04050a" stroke="rgba(139,92,246,0.5)" strokeWidth="1.5" />
      <circle cx="120" cy="120" r="40" fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="0.5" className="corona-flicker" />
    </g>
  );
}

function RevealGlyph() {
  // Eclipse retreats: the moon slides off, a cyan corona rises (alignment).
  return (
    <g>
      <circle cx="120" cy="120" r="58" fill="url(#coronaC)" className="corona-flicker" />
      <circle cx="120" cy="120" r="34" fill="#070b16" stroke="rgba(34,211,238,0.55)" strokeWidth="1.5" />
      {/* retreating moon */}
      <motion.circle
        cx="150"
        cy="104"
        r="34"
        fill="#04050a"
        stroke="rgba(139,92,246,0.4)"
        strokeWidth="1"
        opacity="0.92"
        initial={{ cx: 120, cy: 120 }}
        animate={{ cx: 150, cy: 104 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
    </g>
  );
}

function ConstellationGlyph() {
  // Revealed answers form a constellation; the lens sweeps across it.
  const stars = [
    [86, 96],
    [120, 78],
    [156, 104],
    [104, 140],
    [150, 150],
  ] as const;
  return (
    <g>
      <polyline
        points={stars.map((s) => s.join(",")).join(" ")}
        fill="none"
        stroke="rgba(34,211,238,0.55)"
        strokeWidth="1"
        className="constellation-line"
      />
      {stars.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === 1 ? 3.2 : 2.4}
          fill={i === 1 ? "#f5c451" : "#22d3ee"}
          className="twinkle"
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}
      {/* scanning lens */}
      <g className="orbit-spin" style={{ transformOrigin: "120px 120px" }}>
        <circle cx="120" cy="44" r="10" fill="none" stroke="rgba(139,92,246,0.8)" strokeWidth="1.5" />
        <circle cx="120" cy="44" r="3" fill="rgba(139,92,246,0.8)" />
      </g>
    </g>
  );
}

function RecommendedStarGlyph() {
  return (
    <g style={{ transformOrigin: "120px 120px" }}>
      <circle cx="120" cy="120" r="52" fill="url(#coronaC)" className="eclipse-pulse" />
      <circle cx="120" cy="120" r="46" fill="url(#coronaV)" className="corona-flicker" />
      <StarShape cx={120} cy={120} r={16} fill="#e7ecff" />
    </g>
  );
}

function GoldenOrbitGlyph() {
  return (
    <g>
      <circle
        cx="120"
        cy="120"
        r="70"
        fill="none"
        stroke="rgba(245,196,81,0.55)"
        strokeWidth="1.5"
      />
      <g className="orbit-spin" style={{ transformOrigin: "120px 120px" }}>
        <circle cx="190" cy="120" r="3" fill="#f5c451" />
      </g>
      <circle cx="120" cy="120" r="46" fill="url(#solar)" opacity="0.18" className="eclipse-pulse" />
      <StarShape cx={120} cy={120} r={20} fill="url(#solar)" />
    </g>
  );
}

function StarShape({
  cx,
  cy,
  r,
  fill,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
}) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${cx + rr * Math.cos(rad)},${cy + rr * Math.sin(rad)}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} />;
}

/* ====================================================== Countdown ring ===
   A thin orbital ring whose arc depletes toward a deadline, with a moon that
   orbits the bounty: its angular position tracks how much of the window is
   gone, so as the deadline nears the moon swings toward the eclipse. Colour
   shifts with urgency: plenty = cyan/violet, low = amber, critical = soft red
   / pulsing gold. `progress` is 0..1 of the window remaining. */

type RingTone = "cyan" | "violet" | "gold";

function urgencyStroke(progress: number, tone: RingTone): { stroke: string; critical: boolean; low: boolean } {
  const low = progress <= 0.33 && progress > 0.12;
  const critical = progress <= 0.12;
  if (critical) return { stroke: "#f5c451", critical, low };
  if (low) return { stroke: "#fbbf24", critical, low };
  const stroke = tone === "violet" ? "#8b5cf6" : tone === "gold" ? "#f5c451" : "#22d3ee";
  return { stroke, critical, low };
}

export function CountdownRing({
  progress,
  tone = "cyan",
  label,
  sub,
}: {
  progress: number; // 0..1 remaining
  tone?: RingTone;
  label: string;
  sub?: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const r = 26;
  const c = 2 * Math.PI * r;
  const { stroke, critical, low } = urgencyStroke(p, tone);

  // The moon orbits from the top (full window) clockwise as time elapses; at
  // p=0 it has crossed to the eclipse point. Angle in the un-rotated circle.
  const elapsed = 1 - p;
  const angle = -90 + elapsed * 360;
  const rad = (angle * Math.PI) / 180;
  const cx = 32 + r * Math.cos(rad);
  const cy = 32 + r * Math.sin(rad);

  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 64 64" className="h-14 w-14">
        {/* base track */}
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        {/* depleting arc (rotated so it starts at the top) */}
        <g transform="rotate(-90 32 32)">
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - p)}
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease" }}
            className={critical ? "eclipse-pulse" : undefined}
          />
        </g>
        {/* central eclipse */}
        <circle cx="32" cy="32" r="6" fill="#04050a" stroke={stroke} strokeWidth="1" opacity="0.7" />
        {/* orbiting moon — the deadline */}
        <circle
          cx={cx}
          cy={cy}
          r={critical ? 3.6 : 3}
          fill={stroke}
          className={critical ? "eclipse-pulse" : low ? "corona-flicker" : undefined}
          style={{ transition: "cx 0.6s ease, cy 0.6s ease, fill 0.6s ease" }}
        />
      </svg>
      <div>
        <div className="text-sm font-medium text-zinc-100">{label}</div>
        {sub ? (
          <div className={`text-xs ${critical ? "text-amber-300" : low ? "text-amber-200/80" : "text-zinc-500"}`}>
            {sub}
            {critical ? " · critical" : low ? " · low" : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ===================================================== Phase rail/orbits ==
   Orbital navigator. Each body is a node: active glows, completed is a
   luminous point, locked is dim. Horizontal scroll on small screens. */

export type RailStatus = "done" | "active" | "locked";

export function PhaseRail({
  nodes,
}: {
  nodes: { key: string; label: string; status: RailStatus }[];
}) {
  return (
    <nav
      aria-label="Observatory phases"
      className="flex items-center gap-1 overflow-x-auto rounded-2xl glass-panel px-3 py-2"
    >
      {nodes.map((n, i) => (
        <div key={n.key} className="flex shrink-0 items-center">
          <div className="flex flex-col items-center gap-1 px-2">
            <motion.span
              layout
              animate={
                n.status === "active"
                  ? { scale: [1, 1.25, 1] }
                  : { scale: 1 }
              }
              transition={
                n.status === "active"
                  ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.3 }
              }
              className={[
                "grid h-3.5 w-3.5 place-items-center rounded-full ring-1 transition-all",
                n.status === "active"
                  ? "bg-cyan-400 ring-cyan-300/60 shadow-[0_0_14px_3px_rgba(34,211,238,0.8)]"
                  : n.status === "done"
                    ? "bg-violet-400/80 ring-violet-300/40 shadow-[0_0_8px_1px_rgba(139,92,246,0.5)]"
                    : "bg-white/10 ring-white/10",
              ].join(" ")}
            />
            <span
              className={[
                "whitespace-nowrap text-[10px] uppercase tracking-[0.12em]",
                n.status === "active"
                  ? "text-cyan-200"
                  : n.status === "done"
                    ? "text-violet-200/80"
                    : "text-zinc-600",
              ].join(" ")}
            >
              {n.label}
            </span>
          </div>
          {i < nodes.length - 1 && (
            <span
              className={[
                "h-px w-5",
                n.status === "done" ? "bg-violet-400/40" : "bg-white/10",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </nav>
  );
}

/* ======================================================== Copy hash ======
   Monospace hash chip with an animated copy confirmation. */

export function CopyHash({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={`group inline-flex items-center gap-1.5 rounded-lg border border-violet-400/15 bg-black/30 px-2 py-1 font-mono text-[11px] text-zinc-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200 ${className}`}
      title="Copy"
    >
      <span className="break-all">{value}</span>
      <span
        className={`transition-all ${copied ? "text-cyan-300" : "text-zinc-500 group-hover:text-cyan-300"}`}
      >
        {copied ? "copied ✓" : "copy"}
      </span>
    </button>
  );
}

/* ============================================================ Section ====
   A labelled stage wrapper used in the central column. */

export function StageFrame({
  children,
  caption,
}: {
  children: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center gap-3 rounded-2xl glass-panel px-5 py-6">
      {children}
      {caption ? (
        <p className="max-w-md text-center text-xs leading-relaxed text-zinc-400">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/* ============================================== Salt moon + corona =======
   Reusable glyphs for the commit "send into eclipse" animation. SaltMoon is
   the salt that opens/closes the eclipse; CommitmentCorona is the luminous
   ring that remains once the answer-star is sealed. */

export function SaltMoon({ size = 28, generated = false }: { size?: number; generated?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <circle
        cx="24"
        cy="24"
        r="14"
        fill="#0a0f1f"
        stroke={generated ? "rgba(139,92,246,0.85)" : "rgba(120,130,160,0.35)"}
        strokeWidth="1.5"
        className={generated ? "corona-flicker" : undefined}
      />
      {/* craters */}
      <circle cx="20" cy="20" r="2" fill="rgba(139,92,246,0.25)" />
      <circle cx="28" cy="27" r="3" fill="rgba(34,211,238,0.18)" />
      <circle cx="26" cy="18" r="1.4" fill="rgba(238,241,251,0.2)" />
    </svg>
  );
}

export function CommitmentCorona({ size = 36, active = true }: { size?: number; active?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id="ccGrad" cx="50%" cy="50%" r="50%">
          <stop offset="52%" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="80%" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#ccGrad)" className={active ? "corona-flicker" : undefined} />
      <circle cx="32" cy="32" r="16" fill="#04050a" stroke="rgba(34,211,238,0.6)" strokeWidth="1.4" />
    </svg>
  );
}

/* ============================================== Ritual AI lens / oracle ===
   The funding "lens" used by the Fund stage. When `funded`, a charging sweep
   runs around the rim and the core glows gold; when not, it flickers weakly. */

export function RitualAILens({
  funded,
  size = 120,
}: {
  funded: boolean;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} aria-hidden role="presentation">
      <defs>
        <radialGradient id="lensCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde9b8" />
          <stop offset="45%" stopColor="#f5c451" />
          <stop offset="100%" stopColor="#b8862a" />
        </radialGradient>
        <radialGradient id="lensCold" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a2238" />
          <stop offset="100%" stopColor="#070b16" />
        </radialGradient>
      </defs>

      {/* orbit rim */}
      <circle cx="80" cy="80" r="64" fill="none" stroke="rgba(245,196,81,0.18)" strokeWidth="1" />
      {/* charging sweep when funded */}
      <circle
        cx="80"
        cy="80"
        r="52"
        fill="none"
        stroke={funded ? "rgba(245,196,81,0.85)" : "rgba(120,130,160,0.35)"}
        strokeWidth="2"
        className={funded ? "lens-charge" : undefined}
      />
      {/* lens body */}
      <circle
        cx="80"
        cy="80"
        r="40"
        fill={funded ? "url(#lensCore)" : "url(#lensCold)"}
        opacity={funded ? 0.95 : 0.85}
        className={funded ? "reward-charge" : "lens-flicker"}
      />
      {/* aperture */}
      <ellipse
        cx="80"
        cy="80"
        rx="16"
        ry="40"
        fill="#04050a"
        opacity={funded ? 0.35 : 0.6}
      />
      <circle cx="80" cy="80" r="6" fill={funded ? "#fde9b8" : "rgba(120,130,160,0.4)"} />
    </svg>
  );
}

/* ============================================== Reward core (golden) ======
   A small golden core showing reward energy locked in a star/orbit. Used by
   the Create + Finalize stages. */

export function RewardCore({ size = 64, charging = true }: { size?: number; charging?: boolean }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id="rcGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde9b8" />
          <stop offset="45%" stopColor="#f5c451" />
          <stop offset="100%" stopColor="#b8862a" />
        </radialGradient>
      </defs>
      <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(245,196,81,0.4)" strokeWidth="1" />
      <circle
        cx="48"
        cy="48"
        r="30"
        fill="url(#rcGrad)"
        opacity="0.22"
        className={charging ? "reward-charge" : undefined}
      />
      <circle cx="48" cy="48" r="12" fill="url(#rcGrad)" className={charging ? "reward-charge" : undefined} />
    </svg>
  );
}
