"use client";

import type { ReactNode, ButtonHTMLAttributes } from "react";
import type { TxState } from "@/hooks/useWriteTx";

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl glass-panel ${className}`}
    >
      {children}
    </div>
  );
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
    <div className="flex items-start justify-between gap-3 border-b border-violet-400/15 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-200">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-zinc-400/80">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

/* ----------------------------------------------------------------- Badge */

type Tone = "green" | "amber" | "indigo" | "zinc" | "red" | "cyan" | "violet" | "gold";

const TONES: Record<Tone, string> = {
  green: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  indigo: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  zinc: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  red: "bg-red-500/15 text-red-300 ring-red-500/30",
  cyan: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  gold: "bg-amber-400/15 text-amber-200 ring-amber-300/40",
};

export function Badge({
  children,
  tone = "zinc",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
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

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const styles: Record<string, string> = {
    primary:
      "bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-[0_0_22px_-6px_rgba(139,92,246,0.7)] hover:from-violet-400 hover:to-cyan-400 disabled:from-violet-500/30 disabled:to-cyan-500/30 disabled:shadow-none",
    secondary:
      "bg-white/5 text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10 disabled:bg-white/5",
    ghost: "bg-transparent text-zinc-300 hover:bg-white/5",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:text-zinc-400 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------- Form fields */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-400">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-zinc-600">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-violet-400/15 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-glow transition-colors";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`${inputBase} resize-y ${props.className ?? ""}`}
    />
  );
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
  idle: "zinc",
  wallet: "amber",
  pending: "indigo",
  confirmed: "green",
  failed: "red",
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
          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
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

export function Notice({
  tone = "zinc",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl px-3 py-2 text-xs ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-violet-400/10 bg-black/30 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-zinc-100 break-words">
        {value}
      </div>
    </div>
  );
}
