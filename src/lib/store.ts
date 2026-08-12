"use client";

/**
 * Local persistence.
 *
 * Supabase is deliberately deferred (plan §6.1), so this is localStorage for now.
 * The shape is chosen so swapping in Postgres is a change of adapter, not of
 * model: cards / progress / log are three independent collections, and the log
 * is only ever appended to.
 *
 * Implemented as a module-level store read through useSyncExternalStore rather
 * than useState + a hydration effect. localStorage genuinely *is* an external
 * store, and this is the API React provides for one — it also keeps every page
 * that reads it in sync without a context provider.
 */

import { useSyncExternalStore } from "react";
import type { Card, Progress, ReviewLogEntry, TaskKind } from "./types";
import { SEED_CARDS } from "./seed";
import { newState } from "./scheduler";

const KEYS = {
  cards: "pikuniku.cards.v1",
  progress: "pikuniku.progress.v1",
  log: "pikuniku.log.v1",
};

export interface Snapshot {
  ready: boolean;
  cards: Card[];
  progress: Record<string, Progress>;
  log: ReviewLogEntry[];
}

const EMPTY: Snapshot = { ready: false, cards: [], progress: {}, log: [] };

let snapshot: Snapshot = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function seedCards(): Card[] {
  return SEED_CARDS.map((c) => ({ ...c, id: newId(), createdAt: Date.now() }));
}

function load() {
  if (snapshot.ready || typeof window === "undefined") return;
  let cards = read<Card[]>(KEYS.cards, []);
  if (cards.length === 0) {
    cards = seedCards();
    write(KEYS.cards, cards);
  }
  snapshot = {
    ready: true,
    cards,
    progress: read<Record<string, Progress>>(KEYS.progress, {}),
    log: read<ReviewLogEntry[]>(KEYS.log, []),
  };
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => EMPTY;

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  emit();
}

export function addCard(card: Omit<Card, "id" | "createdAt">) {
  const cards = [...snapshot.cards, { ...card, id: newId(), createdAt: Date.now() }];
  write(KEYS.cards, cards);
  set({ cards });
}

export function deleteCard(id: string) {
  const cards = snapshot.cards.filter((c) => c.id !== id);
  const progress = { ...snapshot.progress };
  delete progress[id];
  write(KEYS.cards, cards);
  write(KEYS.progress, progress);
  set({ cards, progress });
}

export function recordAnswer(
  cardId: string,
  task: TaskKind,
  input: string,
  outcome: ReviewLogEntry["outcome"],
  nextState: NonNullable<Progress["tasks"][TaskKind]>,
) {
  const existing = snapshot.progress[cardId] ?? { cardId, tasks: {} };
  const progress = {
    ...snapshot.progress,
    [cardId]: { ...existing, tasks: { ...existing.tasks, [task]: nextState } },
  };
  // Append-only: this is the collection that must merge cleanly once it syncs,
  // so it is never mutated or compacted in place.
  const log = [...snapshot.log, { id: newId(), cardId, task, input, outcome, at: Date.now() }];
  write(KEYS.progress, progress);
  write(KEYS.log, log);
  set({ progress, log });
}

export function resetAll() {
  const cards = seedCards();
  write(KEYS.cards, cards);
  write(KEYS.progress, {});
  write(KEYS.log, []);
  set({ cards, progress: {}, log: [] });
}

export interface Store extends Snapshot {
  addCard: typeof addCard;
  deleteCard: typeof deleteCard;
  recordAnswer: typeof recordAnswer;
  resetAll: typeof resetAll;
}

export function useStore(): Store {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...snap, addCard, deleteCard, recordAnswer, resetAll };
}

/** Tasks a card actually has: reading is skipped when the card has no readings. */
export function tasksFor(card: Card): TaskKind[] {
  return card.readings.length > 0 ? ["meaning", "reading"] : ["meaning"];
}

export function stateFor(
  progress: Record<string, Progress>,
  cardId: string,
  task: TaskKind,
) {
  return progress[cardId]?.tasks?.[task];
}

export { newState };
