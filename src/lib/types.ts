/**
 * Core domain types.
 *
 * Deliberately mirrors WaniKani's separation of *content* (Card) from *progress*
 * (Progress) from *history* (ReviewLogEntry) — see §1.8 / §3.1 of the plan.
 * ReviewLogEntry is append-only: it is the only thing that must sync cleanly
 * across devices, and FSRS parameter optimisation consumes it later.
 */

/** Which of WaniKani's three tiers this card plays the role of. Drives colour only. */
export type CardType = "component" | "primary" | "compound";

/** The two question directions we ship in v1. Both are recognition (§6.3). */
export type TaskKind = "meaning" | "reading";

export interface Card {
  id: string;
  /** The prompt shown in the review screen, e.g. 猫 */
  front: string;
  type: CardType;
  /** Accepted meanings. [0] is primary and is what we show as "the" answer. */
  meanings: string[];
  /** Answers that are explicitly wrong even if they fuzzy-match. Instant reject. */
  blacklist: string[];
  /** Accepted readings, in kana. Empty means this card has no reading task. */
  readings: string[];
  /** Real readings that aren't the one being taught → retry, not wrong (§1.6). */
  altReadings: string[];
  mnemonic?: string;
  notes?: string;
  createdAt: number;
}

/** FSRS card state, stored per (card, task). Shape matches ts-fsrs's Card. */
export interface FsrsState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

export interface Progress {
  cardId: string;
  /** One FSRS state per task — a card is due when *either* task is due. */
  tasks: Partial<Record<TaskKind, FsrsState>>;
}

export interface ReviewLogEntry {
  id: string;
  cardId: string;
  task: TaskKind;
  /** What the user actually typed, kept for debugging bad answer strings. */
  input: string;
  outcome: "precise" | "imprecise" | "wrong";
  at: number;
}

/** A single question in an active session. */
export interface SessionQuestion {
  cardId: string;
  task: TaskKind;
  /** Set on a wrong answer; blocks re-selection while other candidates exist (§3.7). */
  choiceDelay: number;
  answered: boolean;
  /** Incorrect answers so far, this session, for this question. */
  incorrect: number;
}
