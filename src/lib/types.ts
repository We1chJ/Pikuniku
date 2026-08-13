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

/**
 * The question directions.
 *
 * `meaning` and `reading` are recognition — you're shown the Japanese. `production`
 * is the reverse: shown the English, produce the Japanese. Production is harder and
 * genuinely ambiguous in a way recognition isn't, so it's opt-in (see §1.7.1 of the
 * plan and the alternate-match handling in the grader).
 */
export type TaskKind = "meaning" | "reading" | "production";

export type ReadingType = "onyomi" | "kunyomi" | "nanori";

export const READING_TYPE_LABEL: Record<ReadingType, string> = {
  onyomi: "on'yomi",
  kunyomi: "kun'yomi",
  nanori: "nanori",
};

/**
 * A reading that's real but isn't the one this card is testing.
 *
 * Typed, so a wrong-type answer can be told *why* it's wrong ("that's the
 * kun'yomi — we want the on'yomi") instead of just being rebuffed.
 */
export interface AltReading {
  reading: string;
  type?: ReadingType;
}

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
  /**
   * Which kind of reading `readings` holds, when that's a meaningful question.
   * Shown in the prompt so you're never left guessing whether we want じん or
   * ひと. Undefined for compounds, where the word has exactly one reading and
   * there is nothing to disambiguate.
   */
  readingType?: ReadingType;
  /** Real readings that aren't the one being taught → retry, not wrong (§1.6). */
  altReadings: AltReading[];
  /**
   * Extra Japanese accepted for the English → Japanese question only.
   *
   * Deliberately not folded into `readings`: a word that satisfies "fall" is not
   * thereby a reading of 秋, and on a kana-only card adding one to `readings`
   * would conjure a reading question out of nothing.
   */
  altProduction?: string[];
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
