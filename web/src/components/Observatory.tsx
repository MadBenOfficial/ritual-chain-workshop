"use client";

import { useState, type ReactNode } from "react";
import type { BountyPhase } from "@/lib/bounty";

/* ============================================================== Stage ====
   The central observatory stage. Its visual changes per phase:
     commit    → eclipse (answer hidden behind the moon, only the corona shows)
     reveal    → opening ring (the eclipse retreats; two coronas align)
     judging   → constellation scanned by the Ritual AI lens
     judged    → an illuminated star (cyan/violet halo) — the recommendation
     finalized → a star fixed in a golden orbit
*/

export function EclipseStage({ phase }: { phase: BountyPhase }) {
  return (
    <div
      className="relative grid place-items-center"
      aria-hidden
      role="presentation"
    >
      <svg viewBox="0 0 240 240" className="h-44 w-44 sm:h-52 sm:w-52">
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

        {phase === "commit" && <CommitGlyph />}
        {phase === "reveal" && <RevealGlyph />}
        {phase === "judging" && <ConstellationGlyph />}
        {phase === "judged" && <RecommendedStarGlyph />}
        {phase === "finalized" && <GoldenOrbitGlyph />}
      </svg>
    </div>
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
      <circle cx="150" cy="104" r="34" fill="#04050a" stroke="rgba(139,92,246,0.4)" strokeWidth="1" opacity="0.92" />
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
   A thin orbital ring whose arc depletes toward a deadline. `progress` is
   0..1 of the window remaining. */

export function CountdownRing({
  progress,
  tone = "cyan",
  label,
  sub,
}: {
  progress: number; // 0..1 remaining
  tone?: "cyan" | "violet" | "gold";
  label: string;
  sub?: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const r = 26;
  const c = 2 * Math.PI * r;
  const stroke =
    tone === "violet" ? "#8b5cf6" : tone === "gold" ? "#f5c451" : "#22d3ee";
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 64 64" className="h-14 w-14 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
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
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div>
        <div className="text-sm font-medium text-zinc-100">{label}</div>
        {sub ? <div className="text-xs text-zinc-500">{sub}</div> : null}
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
            <span
              className={[
                "grid h-3.5 w-3.5 place-items-center rounded-full ring-1 transition-all",
                n.status === "active"
                  ? "bg-cyan-400 ring-cyan-300/60 shadow-[0_0_12px_2px_rgba(34,211,238,0.7)]"
                  : n.status === "done"
                    ? "bg-violet-400/80 ring-violet-300/40"
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
