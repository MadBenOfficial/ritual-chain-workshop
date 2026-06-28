"use client";

import { useCallback, useSyncExternalStore } from "react";

/** A recent-activity signal shown in the Bottom Event Strip. */
export type ObsEvent = {
  id: string;
  kind:
    | "wallet"
    | "create"
    | "commit"
    | "reveal"
    | "fund"
    | "judge-start"
    | "verdict"
    | "finalize"
    | "error";
  label: string;
  detail?: string;
  ts: number;
};

// Tiny module-level store so any component can push an event and the strip
// re-renders. No external dep; survives re-mounts within the session.
let events: ObsEvent[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function pushEvent(e: Omit<ObsEvent, "id" | "ts">) {
  const ev: ObsEvent = { ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now() };
  events = [ev, ...events].slice(0, 24);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return events;
}

export function useEventStrip() {
  const list = useSyncExternalStore(subscribe, getSnapshot, () => events);
  const push = useCallback((e: Omit<ObsEvent, "id" | "ts">) => pushEvent(e), []);
  return { events: list, push };
}
