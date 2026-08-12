"use client";

/**
 * Mapping between the domain types and Supabase rows.
 *
 * Kept in one place so the rest of the app never sees a database row, and the
 * column naming (snake_case, FSRS state flattened into columns) stays a storage
 * detail rather than leaking into the scheduler or the UI.
 */

import { supabase } from "./supabase";
import type {
  AltReading,
  Card,
  FsrsState,
  Progress,
  ReadingType,
  ReviewLogEntry,
  TaskKind,
} from "./types";

interface CardRow {
  id: string;
  front: string;
  type: string;
  meanings: string[];
  blacklist: string[];
  readings: string[];
  reading_type: string | null;
  alt_readings: AltReading[];
  mnemonic: string | null;
  notes: string | null;
  created_at: string;
}

interface ProgressRow {
  card_id: string;
  task: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

interface LogRow {
  id: number;
  card_id: string;
  task: string;
  input: string;
  outcome: string;
  at: string;
}

function toCard(r: CardRow): Card {
  return {
    id: r.id,
    front: r.front,
    type: r.type as Card["type"],
    meanings: r.meanings,
    blacklist: r.blacklist,
    readings: r.readings,
    readingType: (r.reading_type as ReadingType) ?? undefined,
    altReadings: r.alt_readings ?? [],
    mnemonic: r.mnemonic ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function toState(r: ProgressRow): FsrsState {
  return {
    due: r.due,
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    last_review: r.last_review ?? undefined,
  };
}

export async function fetchAll(): Promise<{
  cards: Card[];
  progress: Record<string, Progress>;
  log: ReviewLogEntry[];
}> {
  if (!supabase) throw new Error("Supabase is not configured");

  const [cardsRes, progressRes, logRes] = await Promise.all([
    supabase.from("cards").select("*").order("created_at"),
    supabase.from("progress").select("*"),
    // The log only feeds an accuracy figure, so the whole history isn't needed
    // on every load. Newest first, bounded.
    supabase.from("review_log").select("*").order("at", { ascending: false }).limit(1000),
  ]);

  if (cardsRes.error) throw cardsRes.error;
  if (progressRes.error) throw progressRes.error;
  if (logRes.error) throw logRes.error;

  const progress: Record<string, Progress> = {};
  for (const row of (progressRes.data ?? []) as ProgressRow[]) {
    const entry = (progress[row.card_id] ??= { cardId: row.card_id, tasks: {} });
    entry.tasks[row.task as TaskKind] = toState(row);
  }

  return {
    cards: ((cardsRes.data ?? []) as CardRow[]).map(toCard),
    progress,
    log: ((logRes.data ?? []) as LogRow[]).map((r) => ({
      id: String(r.id),
      cardId: r.card_id,
      task: r.task as TaskKind,
      input: r.input,
      outcome: r.outcome as ReviewLogEntry["outcome"],
      at: new Date(r.at).getTime(),
    })),
  };
}

/** Returns the created card, because the id is assigned by the database. */
export async function insertCard(card: Omit<Card, "id" | "createdAt">): Promise<Card> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("cards")
    .insert({
      front: card.front,
      type: card.type,
      meanings: card.meanings,
      blacklist: card.blacklist,
      readings: card.readings,
      reading_type: card.readingType ?? null,
      alt_readings: card.altReadings,
      mnemonic: card.mnemonic ?? null,
      notes: card.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toCard(data as CardRow);
}

export async function removeCard(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured");
  // progress and review_log cascade from the foreign key.
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw error;
}

export async function saveAnswer(
  cardId: string,
  task: TaskKind,
  input: string,
  outcome: ReviewLogEntry["outcome"],
  state: FsrsState,
): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured");

  const [up, ins] = await Promise.all([
    supabase.from("progress").upsert(
      {
        card_id: cardId,
        task,
        due: state.due,
        stability: state.stability,
        difficulty: state.difficulty,
        elapsed_days: state.elapsed_days,
        scheduled_days: state.scheduled_days,
        learning_steps: state.learning_steps,
        reps: state.reps,
        lapses: state.lapses,
        state: state.state,
        last_review: state.last_review ?? null,
      },
      { onConflict: "card_id,task" },
    ),
    supabase.from("review_log").insert({ card_id: cardId, task, input, outcome }),
  ]);

  if (up.error) throw up.error;
  if (ins.error) throw ins.error;
}
