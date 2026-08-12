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
import { isProducible } from "./cardinfer";
import { newState } from "./scheduler";

const KEYS = {
  cards: "pikuniku.cards.v1",
  progress: "pikuniku.progress.v1",
  log: "pikuniku.log.v1",
  settings: "pikuniku.settings.v1",
};

export interface Settings {
  /** Speak the reading automatically when an answer comes back correct. */
  autoplay: boolean;
  /**
   * Also quiz English → Japanese. Off by default: it adds a third question to
   * most cards, so turning it on meaningfully increases the daily load.
   */
  production: boolean;
}

const DEFAULT_SETTINGS: Settings = { autoplay: true, production: false };

export interface Snapshot {
  ready: boolean;
  cards: Card[];
  progress: Record<string, Progress>;
  log: ReviewLogEntry[];
  settings: Settings;
}

const EMPTY: Snapshot = {
  ready: false,
  cards: [],
  progress: {},
  log: [],
  settings: DEFAULT_SETTINGS,
};

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

/**
 * altReadings used to be a plain string[]; it now carries an optional reading
 * type. Widen anything stored under the old shape rather than making the user
 * rebuild their deck.
 */
function migrate(cards: Card[]): Card[] {
  return cards.map((c) => ({
    ...c,
    altReadings: (c.altReadings ?? []).map((a) =>
      typeof a === "string" ? { reading: a as string } : a,
    ),
  }));
}

function load() {
  if (snapshot.ready || typeof window === "undefined") return;
  let cards = migrate(read<Card[]>(KEYS.cards, []));
  if (cards.length === 0) {
    cards = seedCards();
    write(KEYS.cards, cards);
  }
  snapshot = {
    ready: true,
    cards,
    progress: read<Record<string, Progress>>(KEYS.progress, {}),
    log: read<ReviewLogEntry[]>(KEYS.log, []),
    // Spread over the defaults so a setting added later doesn't come back
    // undefined for anyone with existing storage.
    settings: { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.settings, {}) },
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

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const settings = { ...snapshot.settings, [key]: value };
  write(KEYS.settings, settings);
  set({ settings });
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
  setSetting: typeof setSetting;
  resetAll: typeof resetAll;
}

export function useStore(): Store {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...snap, addCard, deleteCard, recordAnswer, setSetting, resetAll };
}

/**
 * Tasks a card actually has. Reading is skipped when there are no readings;
 * production is opt-in and skipped when there's nothing typeable to produce.
 */
export function tasksFor(card: Card, production = false): TaskKind[] {
  const tasks: TaskKind[] = ["meaning"];
  if (card.readings.length > 0) tasks.push("reading");
  if (production && isProducible(card)) tasks.push("production");
  return tasks;
}

export function stateFor(
  progress: Record<string, Progress>,
  cardId: string,
  task: TaskKind,
) {
  return progress[cardId]?.tasks?.[task];
}

export { newState };
