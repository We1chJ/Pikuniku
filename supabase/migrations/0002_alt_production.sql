-- Answers accepted for the English → Japanese question only.
--
-- Kept out of `readings` deliberately. A word that satisfies the prompt "fall"
-- is not thereby a reading of 秋, and on a kana-only card — where `readings` is
-- empty and its emptiness is what suppresses the reading question — writing one
-- there would conjure a reading quiz out of nothing.
--
-- Additive and defaulted, so existing rows and any client that predates this
-- column keep working unchanged.

alter table public.cards
  add column if not exists alt_production text[] not null default '{}';
