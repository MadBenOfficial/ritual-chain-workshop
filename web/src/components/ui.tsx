"use client";

import { useEffect, type ReactNode, type ButtonHTMLAttributes } from "react";
import type { TxState } from "@/hooks/useWriteTx";

/* ------------------------------------------------------------------ Card */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--ash)]/10 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ash)]">
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[var(--ash)]/55">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

/* ----------------------------------------------------------------- Badge
   Tones mapped to the Eclipse palette. Legacy tone names kept as aliases so
   existing components compile without churn. */

export type Tone =
  | "amber"
  | "verdigris"
  | "copper"
  | "aurora"
  | "ember"
  | "eclipse"
  | "ash"
  // legacy aliases
  | "green"
  | "indigo"
  | "zinc"
  | "red"
  | "cyan"
  | "violet"
  | "gold";

const TONES: Record<Tone, string> = {
  amber: "bg-[var(--amber)]/12 text-[var(--amber)] ring-[var(--amber)]/30",
  verdigris: "bg-[var(--verdigris)]/12 text-[var(--verdigris)] ring-[var(--verdigris)]/30",
  copper: "bg-[var(--copper)]/15 text-[#e0a06f] ring-[var(--copper)]/30",
  aurora: "bg-[var(--aurora)]/10 text-[var(--aurora)] ring-[var(--aurora)]/30",
  ember: "bg-[var(--ember)]/12 text-[var(--ember)] ring-[var(--ember)]/35",
  eclipse: "bg-[var(--eclipse)] text-[var(--ash)]/70 ring-[var(--ash)]/15",
  ash: "bg-white/5 text-[var(--ash)]/75 ring-[var(--ash)]/15",
  // aliases → nearest palette tone
  green: "bg-[var(--verdigris)]/12 text-[var(--verdigris)] ring-[var(--verdigris)]/30",
  indigo: "bg-[var(--aurora)]/10 text-[var(--aurora)] ring-[var(--aurora)]/30",
  zinc: "bg-white/5 text-[var(--ash)]/75 ring-[var(--ash)]/15",
  red: "bg-[var(--ember)]/12 text-[var(--ember)] ring-[var(--ember)]/35",
  cyan: "bg-[var(--aurora)]/10 text-[var(--aurora)] ring-[var(--aurora)]/30",
  violet: "bg-[var(--eclipse)] text-[var(--ash)]/70 ring-[var(--ash)]/15",
  gold: "bg-[var(--amber)]/12 text-[var(--amber)] ring-[var(--amber)]/30",
};

export function Badge({ children, tone = "ash" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Button */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ variant = "primary", className = "", children, ...rest }: ButtonProps) {
  const styles: Record<string, string> = {
    primary:
      "text-[#070707] font-semibold bg-[linear-gradient(120deg,var(--amber),#ffd089)] shadow-[0_0_26px_-8px_var(--amber)] hover:brightness-110 disabled:opacity-40 disabled:shadow-none",
    secondary:
      "text-[var(--ash)] bg-white/[0.04] ring-1 ring-inset ring-[var(--ash)]/15 hover:bg-white/[0.08] disabled:opacity-50",
    ghost: "bg-transparent text-[var(--ash)]/80 hover:bg-white/5",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm transition-all disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------- Form fields */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--ash)]/60">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-[var(--ash)]/40">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-[var(--ash)]/12 bg-black/40 px-3 py-2 text-sm text-[var(--ash)] placeholder:text-[var(--ash)]/35 focus-glow transition-colors";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} resize-y ${props.className ?? ""}`} />;
}

/* ---------------------------------------------------------- Tx status UI */

const TX_LABEL: Record<TxState, string> = {
  idle: "",
  wallet: "Waiting for wallet…",
  pending: "Confirming on-chain…",
  confirmed: "Confirmed",
  failed: "Failed",
};

const TX_TONE: Record<TxState, Tone> = {
  idle: "ash",
  wallet: "amber",
  pending: "aurora",
  confirmed: "verdigris",
  failed: "ember",
};

export function TxStatus({
  state,
  error,
  hash,
  explorerBase,
}: {
  state: TxState;
  error?: string | null;
  hash?: `0x${string}`;
  explorerBase?: string;
}) {
  if (state === "idle" && !error) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <Badge tone={TX_TONE[state]}>
        {(state === "wallet" || state === "pending") && <Spinner />}
        {state === "failed" && error ? error : TX_LABEL[state]}
      </Badge>
      {hash && explorerBase ? (
        <a
          href={`${explorerBase}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--aurora)] underline underline-offset-2 hover:brightness-110"
        >
          View tx
        </a>
      ) : null}
    </div>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

export function Notice({ tone = "ash", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`rounded-xl px-3 py-2 text-xs ring-1 ring-inset ${TONES[tone]}`}>{children}</div>;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--ash)]/10 bg-black/30 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--ash)]/45">{label}</div>
      <div className="mt-0.5 break-words text-sm font-medium text-[var(--ash)]">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Modal
   Premium confirm/explain modal: blurred backdrop, luminous border, soft
   entrance. Optional safety checklist + a single clear primary action. */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div
        className="glass-strong relative w-full max-w-md rounded-2xl p-5 power-up"
        style={{ boxShadow: "0 0 0 1px rgba(255,184,77,0.18), 0 40px 90px -40px rgba(0,0,0,0.95)" }}
      >
        <h3 className="text-base font-semibold tracking-wide text-[var(--ash)]">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-[var(--ash)]/55">{subtitle}</p> : null}
        <div className="mt-4 space-y-3 text-sm text-[var(--ash)]/85">{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
