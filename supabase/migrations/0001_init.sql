-- Pikuniku schema.
--
-- Three tables, split by how often they change and whether they may be rewritten:
--   cards      — content. Edited rarely, by hand.
--   progress   — one row per (card, task). Rewritten on every answer.
--   review_log — append-only. Never updated or deleted; it is the record that
--                FSRS parameter tuning consumes later, and the accuracy stat now.
--
-- Every table carries user_id and is protected by RLS, because the anon key is
-- public by design — it ships in the browser. Without these policies, anyone
-- with the site URL could read or delete the whole deck.

create table if not exists public.cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  front        text not null,
  type         text not null default 'compound',
  meanings     text[] not null default '{}',
  blacklist    text[] not null default '{}',
  readings     text[] not null default '{}',
  reading_type text,
  alt_readings jsonb not null default '[]'::jsonb,
  mnemonic     text,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.progress (
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  card_id         uuid not null references public.cards on delete cascade,
  task            text not null,
  -- FSRS state. Stored as columns rather than a blob so the scheduler's view of
  -- a card is legible in the table editor when something looks wrong.
  due             timestamptz not null,
  stability       double precision not null,
  difficulty      double precision not null,
  elapsed_days    double precision not null default 0,
  scheduled_days  double precision not null default 0,
  learning_steps  integer not null default 0,
  reps            integer not null default 0,
  lapses          integer not null default 0,
  state           integer not null default 0,
  last_review     timestamptz,
  primary key (card_id, task)
);

create table if not exists public.review_log (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  card_id  uuid not null references public.cards on delete cascade,
  task     text not null,
  input    text not null,
  outcome  text not null,
  at       timestamptz not null default now()
);

create index if not exists progress_due_idx on public.progress (user_id, due);
create index if not exists review_log_at_idx on public.review_log (user_id, at desc);
create index if not exists cards_user_idx on public.cards (user_id, created_at);

alter table public.cards      enable row level security;
alter table public.progress   enable row level security;
alter table public.review_log enable row level security;

drop policy if exists "own cards" on public.cards;
drop policy if exists "own progress" on public.progress;
drop policy if exists "own log" on public.review_log;

create policy "own cards" on public.cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own progress" on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No update or delete policy by design: the log is append-only.
create policy "own log" on public.review_log
  for select using (auth.uid() = user_id);

create policy "insert own log" on public.review_log
  for insert with check (auth.uid() = user_id);
