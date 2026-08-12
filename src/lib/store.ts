"use client";

/**
 * The app's data layer.
 *
 * Two backends behind one interface: Supabase when the environment is
 * configured, localStorage otherwise. That isn't hedging — it keeps the app
 * usable before the keys exist, and means a missing env var degrades to "local
 * only" rather than a blank screen.
 *
 * Read through useSyncExternalStore rather than useState + an effect, because
 * both backends genuinely are external stores and this keeps every page in sync
 * without a context provider.
 *
 * Settings stay local in both modes: autoplay and the production toggle are
 * preferences about *this device*, not part of the deck.
 */

import { useSyncExternalStore } from "react";
import type { Card, Progress, ReviewLogEntry, TaskKind } from "./types";
import { SEED_CARDS } from "./seed";
import { isProducible } from "./cardinfer";
import { newState } from "./scheduler";
import { supabase, isRemote } from "./supabase";
import * as remote from "./remote";

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
  /** True when backed by Supabase; false when running off localStorage. */
  remote: boolean;
  /** Null when signed out, or when running locally (where there is no sign-in). */
  email: string | null;
  signedIn: boolean;
  cards: Card[];
  progress: Record<string, Progress>;
  log: ReviewLogEntry[];
  settings: Settings;
  error: string | null;
}

const EMPTY: Snapshot = {
  ready: false,
  remote: isRemote,
  email: null,
  signedIn: !isRemote, // local mode has no sign-in, so it is always "in"
  cards: [],
  progress: {},
  log: [],
  settings: DEFAULT_SETTINGS,
  error: null,
};

let snapshot: Snapshot = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  emit();
}

/* ------------------------------------------------------------------ *
 * localStorage helpers (also used for settings in remote mode)
 * ------------------------------------------------------------------ */

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

/** altReadings used to be string[]; widen anything stored under the old shape. */
function migrate(cards: Card[]): Card[] {
  return cards.map((c) => ({
    ...c,
    altReadings: (c.altReadings ?? []).map((a) =>
      typeof a === "string" ? { reading: a as string } : a,
    ),
  }));
}

function readSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.settings, {}) };
}

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

let loading = false;

function loadLocal() {
  let cards = migrate(read<Card[]>(KEYS.cards, []));
  if (cards.length === 0) {
    cards = seedCards();
    write(KEYS.cards, cards);
  }
  set({
    ready: true,
    signedIn: true,
    cards,
    progress: read<Record<string, Progress>>(KEYS.progress, {}),
    log: read<ReviewLogEntry[]>(KEYS.log, []),
    settings: readSettings(),
  });
}

async function loadRemote() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email ?? null;

  if (!email) {
    set({ ready: true, signedIn: false, email: null, settings: readSettings() });
    return;
  }

  try {
    const { cards, progress, log } = await remote.fetchAll();
    set({ ready: true, signedIn: true, email, cards, progress, log, settings: readSettings(), error: null });
  } catch (e) {
    set({ ready: true, signedIn: true, email, error: message(e), settings: readSettings() });
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function load() {
  if (loading || typeof window === "undefined") return;
  loading = true;
  if (isRemote) {
    void loadRemote();
    supabase?.auth.onAuthStateChange(() => {
      void loadRemote();
    });
  } else {
    loadLocal();
  }
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

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return "Supabase is not configured.";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // On success the auth listener reloads the data, so there's nothing to report.
  return error ? error.message : null;
}

export async function signUp(email: string, password: string): Promise<string | null> {
  if (!supabase) return "Supabase is not configured.";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.href },
  });
  if (error) return error.message;
  // With email confirmation enabled, signUp returns a user but no session —
  // the account exists but can't be used until the link is clicked.
  if (!data.session) return `Account created. Confirm it via the link sent to ${email}.`;
  return null;
}

export async function signOut() {
  await supabase?.auth.signOut();
  set({ signedIn: false, email: null, cards: [], progress: {}, log: [] });
}

/* ------------------------------------------------------------------ *
 * Mutations
 *
 * Each updates the snapshot first so the UI never waits on a round trip, then
 * persists. A failed write surfaces in `error` rather than silently diverging.
 * ------------------------------------------------------------------ */

export function addCard(card: Omit<Card, "id" | "createdAt">) {
  if (isRemote) {
    void remote
      .insertCard(card)
      .then((created) => set({ cards: [...snapshot.cards, created], error: null }))
      .catch((e) => set({ error: message(e) }));
    return;
  }
  const cards = [...snapshot.cards, { ...card, id: newId(), createdAt: Date.now() }];
  write(KEYS.cards, cards);
  set({ cards });
}

export function deleteCard(id: string) {
  const cards = snapshot.cards.filter((c) => c.id !== id);
  const progress = { ...snapshot.progress };
  delete progress[id];
  set({ cards, progress });

  if (isRemote) {
    void remote.removeCard(id).catch((e) => set({ error: message(e) }));
    return;
  }
  write(KEYS.cards, cards);
  write(KEYS.progress, progress);
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
  // Append-only: this is the collection that must merge cleanly across devices,
  // so it is never mutated or compacted in place.
  const log = [...snapshot.log, { id: newId(), cardId, task, input, outcome, at: Date.now() }];
  set({ progress, log });

  if (isRemote) {
    void remote
      .saveAnswer(cardId, task, input, outcome, nextState)
      .catch((e) => set({ error: message(e) }));
    return;
  }
  write(KEYS.progress, progress);
  write(KEYS.log, log);
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const settings = { ...snapshot.settings, [key]: value };
  write(KEYS.settings, settings);
  set({ settings });
}

export function resetAll() {
  if (isRemote) {
    // Deleting every card cascades progress and the log with it.
    const ids = snapshot.cards.map((c) => c.id);
    set({ cards: [], progress: {}, log: [] });
    void Promise.all(ids.map((id) => remote.removeCard(id))).catch((e) =>
      set({ error: message(e) }),
    );
    return;
  }
  const cards = seedCards();
  write(KEYS.cards, cards);
  write(KEYS.progress, {});
  write(KEYS.log, []);
  set({ cards, progress: {}, log: [] });
}

/* ------------------------------------------------------------------ */

export interface Store extends Snapshot {
  addCard: typeof addCard;
  deleteCard: typeof deleteCard;
  recordAnswer: typeof recordAnswer;
  setSetting: typeof setSetting;
  resetAll: typeof resetAll;
  signOut: typeof signOut;
}

export function useStore(): Store {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...snap, addCard, deleteCard, recordAnswer, setSetting, resetAll, signOut };
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
