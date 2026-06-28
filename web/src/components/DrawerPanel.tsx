"use client";

import { type ReactNode } from "react";

/* A single observatory "console panel" used in the Action Drawer. It is
   deliberately NOT the generic Card: a thin amber/aurora accent rail on the
   left, an etched header with a small phase glyph, and a smoked-glass body.
   This is what makes the right column read as instrument panels, not stacked
   cards. */
export function DrawerPanel({
  glyph,
  step,
  title,
  hint,
  accent = "ash",
  children,
}: {
  glyph?: ReactNode;
  step?: string;
  title: string;
  hint?: string;
  accent?: "amber" | "aurora" | "verdigris" | "copper" | "ember" | "eclipse" | "ash";
  children: ReactNode;
}) {
  const accentVar =
    accent === "amber"
      ? "var(--amber)"
      : accent === "aurora"
        ? "var(--aurora)"
        : accent === "verdigris"
          ? "var(--verdigris)"
          : accent === "copper"
            ? "var(--copper)"
            : accent === "ember"
              ? "var(--ember)"
              : accent === "eclipse"
                ? "var(--eclipse)"
                : "rgba(216,209,197,0.4)";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--ash)]/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] backdrop-blur-xl">
      {/* left accent rail */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `linear-gradient(${accentVar}, transparent)`, boxShadow: `0 0 12px 0 ${accentVar}` }}
      />
      <header className="flex items-center gap-2.5 px-4 pt-3.5">
        {glyph ? (
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", boxShadow: `inset 0 0 0 1px ${accentVar}55` }}
          >
            {glyph}
          </span>
        ) : null}
        <div className="min-w-0">
          {step ? (
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: accentVar }}>
              {step}
            </div>
          ) : null}
          <h3 className="text-[14px] font-semibold tracking-wide text-[var(--ash)]">{title}</h3>
        </div>
      </header>
      {hint ? <p className="px-4 pt-1.5 text-[12px] leading-relaxed text-[var(--ash)]/70">{hint}</p> : null}
      <div className="px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}

/* small phase glyphs */
export function MiniGlyph({ kind }: { kind: "eclipse" | "reveal" | "lens" | "star" | "orbit" }) {
  const c = "var(--ash)";
  if (kind === "eclipse")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <circle cx="8" cy="8" r="5" fill="none" stroke={c} strokeWidth="1.2" />
        <circle cx="9.5" cy="6.5" r="4" fill="#070707" stroke={c} strokeWidth="0.8" />
      </svg>
    );
  if (kind === "reveal")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <circle cx="8" cy="8" r="5" fill="none" stroke={c} strokeWidth="1.2" />
        <path d="M8 3v10" stroke={c} strokeWidth="1" />
      </svg>
    );
  if (kind === "lens")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <circle cx="8" cy="8" r="5" fill="none" stroke={c} strokeWidth="1.2" />
        <circle cx="8" cy="8" r="1.8" fill={c} />
      </svg>
    );
  if (kind === "star")
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <path d="M8 1l1.8 4.4L14 6l-3.4 3 1 4.6L8 11.4 4.4 13.6l1-4.6L2 6l4.2-.6z" fill={c} />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
      <ellipse cx="8" cy="8" rx="6" ry="2.6" fill="none" stroke={c} strokeWidth="1" />
      <circle cx="14" cy="8" r="1.2" fill={c} />
    </svg>
  );
}
