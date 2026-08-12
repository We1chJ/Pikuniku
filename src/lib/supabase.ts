"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Supabase renamed the browser-safe key from "anon" (a JWT) to "publishable"
// (sb_publishable_…). Both are public by design and rely on RLS for safety, so
// accept whichever the project issued. These must be referenced by their full
// literal names — Next inlines NEXT_PUBLIC_* at build time by textual match, so
// a computed lookup would come back undefined.
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Null until the environment is configured, which is what lets the app keep
 * working off localStorage before Supabase exists — and keeps it usable if the
 * keys are ever missing, rather than crashing on a null client deep in a query.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isRemote = supabase !== null;
