import { useSyncExternalStore } from "react";

/**
 * Which archive panels are folded.
 *
 * Kept per viewer, in the browser: an administrator who folds what they do not
 * read finds it folded next time. Storage can be missing or refuse writes
 * (private windows, blocked site data) — then panels simply start open.
 */

const KEY = "archive.panels.v1";
type State = Record<string, boolean>;

function read(): State {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

let state: State = read();
const subs = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Unavailable storage only costs the memory across visits.
  }
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export function setPanelCollapsed(id: string, collapsed: boolean) {
  commit({ ...state, [id]: collapsed });
}

export function setPanelsCollapsed(ids: readonly string[], collapsed: boolean) {
  commit({ ...state, ...Object.fromEntries(ids.map((i) => [i, collapsed])) });
}

export function usePanelCollapsed(id: string | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (id ? !!state[id] : false),
    () => false,
  );
}

export function useAllCollapsed(ids: readonly string[]) {
  return useSyncExternalStore(
    subscribe,
    () => ids.every((i) => !!state[i]),
    () => false,
  );
}
