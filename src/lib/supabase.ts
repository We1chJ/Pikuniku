"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Null until the environment is configured, which is what lets the app keep
 * working off localStorage before Supabase exists — and keeps it usable if the
 * keys are ever missing, rather than crashing on a null client deep in a query.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isRemote = supabase !== null;
