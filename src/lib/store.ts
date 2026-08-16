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
 * Settings stay local in both modes: autoplay and the daily pace are preferences
 * about *this device*, not part of the deck.
 */

import { useSyncExternalStore } from "react";
import type { Card, Progress, ReviewLogEntry, TaskKind } from "./types";
import { SEED_CARDS } from "./seed";
import { isProducible } from "./cardinfer";
import { newState } from "./scheduler";
import { dayKey } from "./stats";
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
   * How many new items may be started per day. Reviews are never capped —
   * they're work already owed, and deferring them defeats the scheduling.
   * 0 means no new lessons at all; useful for clearing a backlog.
   */
  dailyLessons: number;
  /**
   * Extra lessons granted for one specific day by pressing "learn more".
   * Stamped with the day so it expires on its own at midnight.
   */
  bonusDay: string;
  bonusCount: number;
}

const DEFAULT_SETTINGS: Settings = {
  autoplay: true,
  dailyLessons: 10,
  bonusDay: "",
  bonusCount: 0,
};

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

/**
 * Read-modify-write against what is *in storage*, not against this tab's copy.
 *
 * Every one of these keys holds a whole collection, so a tab that writes its own
 * in-memory copy back discards anything another tab wrote since this one loaded.
 * Re-reading first makes the write a merge, and the storage event below brings
 * this tab's snapshot up to date straight after.
 */
function mutate<T>(key: string, fallback: T, fn: (current: T) => T): T {
  const next = fn(read<T>(key, fallback));
  write(key, next);
  return next;
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

let lastFetch = 0;

async function loadRemote() {
  if (!supabase) return;
  lastFetch = Date.now();
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

/** Alt-tabbing back and forth shouldn't fire a refetch each way. */
const REFETCH_INTERVAL_MS = 5000;

/**
 * Another tab's answers go to Supabase, not to this tab, so a tab left open on
 * the dashboard shows the counts it loaded with. Refetching when it comes back
 * to the front is enough to keep them honest without holding a socket open.
 */
function refetchIfStale() {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - lastFetch < REFETCH_INTERVAL_MS) return;
  void loadRemote();
}

/**
 * Settings are localStorage in both modes, so both modes have to listen: the
 * event fires in every *other* tab the moment one of them writes. Without it a
 * tab keeps the copy it loaded with — which is how one tab ends up counting a
 * pile of production reviews while another insists nothing is due.
 */
function onStorage(e: StorageEvent) {
  // A null key means the whole store was cleared; anything else isn't ours.
  if (e.key !== null && !Object.values(KEYS).includes(e.key)) return;
  // In remote mode settings are the only thing here; locally, re-read the lot.
  if (isRemote) set({ settings: readSettings() });
  else loadLocal();
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
    // visibilitychange covers switching tabs; focus covers switching windows,
    // where both tabs stay visible and visibilitychange never fires.
    document.addEventListener("visibilitychange", refetchIfStale);
    window.addEventListener("focus", refetchIfStale);
  } else {
    loadLocal();
  }
  window.addEventListener("storage", onStorage);
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

/** `ok` separates "something went wrong" from "here's what happens next". */
export type AuthResult = { ok: boolean; message: string | null };

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: "Supabase is not configured." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // On success the auth listener reloads the data, so there's nothing to report.
  return error ? { ok: false, message: error.message } : { ok: true, message: null };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: "Supabase is not configured." };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.href },
  });
  if (error) return { ok: false, message: error.message };
  // With email confirmation enabled, signUp returns a user but no session —
  // the account exists but can't be used until the link is clicked.
  if (!data.session) {
    return { ok: true, message: `Account created. Check ${email} for a confirmation link.` };
  }
  return { ok: true, message: null };
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
  const created = { ...card, id: newId(), createdAt: Date.now() };
  set({ cards: mutate<Card[]>(KEYS.cards, [], (stored) => [...migrate(stored), created]) });
}

/**
 * Fold a change into one card. Written for the accept-my-answer shortcut, which
 * has to land before the next question is graded — so the snapshot moves first
 * and the write follows.
 */
export function updateCard(id: string, patch: Partial<Card>) {
  const apply = (list: Card[]) => list.map((c) => (c.id === id ? { ...c, ...patch } : c));

  if (isRemote) {
    set({ cards: apply(snapshot.cards) });
    void remote.updateCard(id, patch).catch((e) => set({ error: message(e) }));
    return;
  }
  // Locally the merge is synchronous, so the snapshot can take the merged list
  // directly and skip the optimistic step entirely.
  set({ cards: mutate<Card[]>(KEYS.cards, [], (stored) => apply(migrate(stored))) });
}

export function deleteCard(id: string) {
  const without = (map: Record<string, Progress>) => {
    const next = { ...map };
    delete next[id];
    return next;
  };

  if (isRemote) {
    set({ cards: snapshot.cards.filter((c) => c.id !== id), progress: without(snapshot.progress) });
    void remote.removeCard(id).catch((e) => set({ error: message(e) }));
    return;
  }
  set({
    cards: mutate<Card[]>(KEYS.cards, [], (stored) => migrate(stored).filter((c) => c.id !== id)),
    progress: mutate<Record<string, Progress>>(KEYS.progress, {}, without),
  });
}

export function recordAnswer(
  cardId: string,
  task: TaskKind,
  input: string,
  outcome: ReviewLogEntry["outcome"],
  nextState: NonNullable<Progress["tasks"][TaskKind]>,
) {
  // Append-only: this is the collection that must merge cleanly across devices,
  // so it is never mutated or compacted in place.
  const entry = { id: newId(), cardId, task, input, outcome, at: Date.now() };
  const fold = (into: Record<string, Progress>) => {
    const existing = into[cardId] ?? { cardId, tasks: {} };
    return { ...into, [cardId]: { ...existing, tasks: { ...existing.tasks, [task]: nextState } } };
  };

  if (isRemote) {
    set({ progress: fold(snapshot.progress), log: [...snapshot.log, entry] });
    void remote
      .saveAnswer(cardId, task, input, outcome, nextState)
      .catch((e) => set({ error: message(e) }));
    return;
  }
  // Folded into what's stored rather than into what this tab holds: a session
  // running in a second tab must not lose the answers given in the first.
  set({
    progress: mutate<Record<string, Progress>>(KEYS.progress, {}, fold),
    log: mutate<ReviewLogEntry[]>(KEYS.log, [], (stored) => [...stored, entry]),
  });
}

/** Raise today's ceiling without touching the standing daily limit. */
export function grantExtraLessons(n: number) {
  const today = dayKey(new Date());
  // Read back rather than trusting the snapshot: a bonus granted in another tab
  // has already been spent, and adding to a stale count would grant it twice.
  const current = readSettings();
  const settings = {
    ...current,
    bonusDay: today,
    bonusCount: (current.bonusDay === today ? current.bonusCount : 0) + n,
  };
  write(KEYS.settings, settings);
  set({ settings });
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  // Only the one key changes. Writing this tab's whole copy back would undo any
  // other setting another tab has changed since this one loaded.
  const settings = { ...readSettings(), [key]: value };
  write(KEYS.settings, settings);
  set({ settings });
}

/* ------------------------------------------------------------------ */

export interface Store extends Snapshot {
  addCard: typeof addCard;
  updateCard: typeof updateCard;
  deleteCard: typeof deleteCard;
  recordAnswer: typeof recordAnswer;
  setSetting: typeof setSetting;
  grantExtraLessons: typeof grantExtraLessons;
  signOut: typeof signOut;
}

export function useStore(): Store {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    ...snap,
    addCard,
    updateCard,
    deleteCard,
    recordAnswer,
    setSetting,
    grantExtraLessons,
    signOut,
  };
}

/**
 * Tasks a card actually has. Reading is skipped when there are no readings, and
 * production when there's nothing typeable to produce — otherwise every card is
 * tested both ways round. Recognition alone is the easier half of knowing a
 * word, so producing it is not something to opt into.
 */
export function tasksFor(card: Card): TaskKind[] {
  const tasks: TaskKind[] = ["meaning"];
  if (card.readings.length > 0) tasks.push("reading");
  if (isProducible(card)) tasks.push("production");
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
