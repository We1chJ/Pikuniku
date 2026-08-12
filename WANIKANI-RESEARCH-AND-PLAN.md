# WaniKani: Research & Clone Plan

**Goal:** build an app that uses WaniKani's *learning machinery* — its SRS schedule, its gated
unlock model, its two-part (meaning + reading) review loop, and its forgiving-but-strict answer
grading — but where **the user authors all the content themselves** as flashcards, instead of
consuming a fixed 60-level Japanese curriculum.

**Status:** Research complete; research loop cancelled. WaniKani is fully mapped.
**Decided:** stack = Next.js + Supabase, cloud-hosted with a local dev loop (§6.1); scheduler =
FSRS via `ts-fsrs` (§6.2); UI mirrors WaniKani + landing page (§6.5).
**Still open:** §6.3 question types and §6.4 Japanese-first vs. generic — neither blocks scaffolding.
**Next step:** build. Every mechanic needed to build the
app is documented and sourced, including the one non-obvious trap (EN→JP reversal is not
symmetric, §1.7.1). The remaining blocker is the four decisions in
[§6](#6-open-decisions--need-your-call), not more research. Nothing has been built yet.

---

## 1. What WaniKani actually is

WaniKani is Tofugu's kanji-learning app. The important thing about it is that it is **not a
flashcard app with a scheduler bolted on** — it is a *curriculum* with a scheduler, and almost
all of its perceived effectiveness comes from four design decisions that are usually described
as "the SRS" but are really separate systems:

| System | What it does | Transfers to user content? |
|---|---|---|
| **Fixed-ladder SRS** | 9 stages, fixed intervals, no per-card difficulty modelling | ✅ Directly |
| **Dependency gating** | You cannot see kanji X until you Guru'd every radical inside it | ⚠️ Needs a user-authored dependency graph |
| **Two-part review** | Each item is quizzed for *meaning* AND *reading*, separately, both required | ✅ Generalises to N "tasks" per card |
| **Answer judging** | Fuzzy match on English, exact match on Japanese, with typo tolerance and a whitelist/blacklist | ✅ Directly, this is the highest-value thing to copy |

The pedagogy layered on top — mnemonics, radicals-as-building-blocks, "you always half-recognise
the next thing" — is content, not software. In our app **the user supplies that**, so we should
give them a place to put it rather than trying to generate it.

### 1.1 Philosophy in one paragraph

WaniKani front-loads *atoms* (radicals), then composes them into *characters* (kanji), then
immediately puts those characters into *use* (vocabulary). Each item ships with a mnemonic story
that hooks meaning and reading into memory. You never meet a component you haven't already
learned, so every new item feels 70% familiar. The SRS then just prevents forgetting; it isn't
doing the teaching. Sources: [Tofugu's radical/mnemonic
guide](https://www.tofugu.com/japanese/kanji-radicals-mnemonic-method/),
[WaniKani Knowledge](https://knowledge.wanikani.com/).

### 1.2 The item hierarchy and gating rules

- Three subject types: **radical → kanji → vocabulary**. (A fourth, `kana_vocabulary`, exists in
  the API for vocabulary with no kanji.)
- A kanji unlocks when **(a)** you reach its level **and (b)** every radical it is composed of has
  reached **Guru** (stage 5). ([Unlocking Kanji
  Lessons](https://knowledge.wanikani.com/getting-started/unlocking-kanji/))
- Vocabulary unlocks when its constituent kanji reach Guru.
- **You level up when ≥90% of the current level's kanji are at Guru or above.** Radicals and
  vocabulary do not gate level-up. ([How Do I Level
  Up?](https://knowledge.wanikani.com/wanikani/getting-started/level-up/))
- 60 levels total.

The 90% threshold matters: it means **one stubborn item cannot stall you forever**. Any clone
that requires 100% mastery to advance will feel punishing.

### 1.3 The SRS ladder

Nine stages in five named groups. Stage 0 = unlocked-but-not-yet-learned (a "lesson").

| Stage | Group | Interval to next |
|---:|---|---|
| 1 | Apprentice 1 | 4 hours |
| 2 | Apprentice 2 | 8 hours |
| 3 | Apprentice 3 | 1 day |
| 4 | Apprentice 4 | 2 days |
| 5 | **Guru 1** (= "passed") | 1 week |
| 6 | Guru 2 | 2 weeks |
| 7 | Master | 1 month |
| 8 | Enlightened | 4 months |
| 9 | **Burned** | — (leaves the queue) |

Levels 1–2 use an accelerated Apprentice ladder (2h / 4h / 8h / 1d) so new users get momentum.
Total lesson → burned on the default ladder: **~5 months 24 days**.
([SRS Stages](https://knowledge.wanikani.com/wanikani/srs-stages/))

> ⚠️ *Reported:* community write-ups state the real intervals are 4h, 8h, **23h**, **47h** — i.e.
> day-intervals are shaved by an hour so a daily user's review time doesn't drift later each day.
> ([wanilog](https://wanilog.com/guides/wanikani-srs-explained))
>
> **Iteration 4 — likely explanation found.** KanjiSchool computes the next due time as
> `dayjs(createdAt).add(duration, 'second').startOf('hour')` — i.e. **the interval is added, then
> truncated down to the top of the hour.** That single rule reproduces the observed 23h/47h
> behaviour without any special-casing: finish a review at 09:45, add 24h → 09:45 tomorrow,
> truncate → 09:00, an effective 23h15m. It also means reviews always arrive *on the hour*, which
> batches them into predictable clumps instead of dribbling in minute by minute.
> *(Strong inference — the truncation is verified in KanjiSchool's source; that WaniKani's server
> does exactly this is deduced from matching observable behaviour, not documented.)*
> **Recommendation: copy it.** It is one line and it fixes schedule drift and clumping at once.

**Design note:** WaniKani's ladder is *fixed and global*. There is no per-card ease factor, no
difficulty estimate, no response-time weighting. It is closer to a Leitner box than to SM-2. This
is a deliberate simplicity/predictability trade — and it is criticised for it (see
[§6.2](#62-scheduling-model)).

### 1.4 The wrong-answer penalty

WaniKani does not just drop you one stage. The documented formula:

```
new_stage = current_stage − (incorrect_adjustment_count × srs_penalty_factor)

incorrect_adjustment_count = ceil(total_incorrect_answers_this_review / 2)
srs_penalty_factor         = 2 if current_stage >= 5 else 1
new_stage                  = max(new_stage, 1)
```

Consequences worth internalising:

- Getting an item wrong **once or twice in the same review is identical** (both → adjustment 1).
  So blowing both the meaning *and* the reading costs the same as blowing one. Confirmed by the
  community ([thread](https://community.wanikani.com/t/does-failing-both-reading-and-meaning-affect-srs/55316)).
- Above Guru, each adjustment costs **two** stages. Failing a Master (7) item once → stage 5.
  Failing an Enlightened (8) item badly (5 wrong answers → adjustment 3) → stage 2. Falling far is
  possible and intentional.
- Floor is stage 1, never 0 — you don't have to re-learn from a lesson.

### 1.5 The review session loop

- An item in the queue has **two independent questions**: *meaning* and *reading* (radicals only
  have meaning; some vocabulary is meaning-only). They are presented separately and often not
  back-to-back.
- The item's SRS stage is **not** committed until *both* questions have been answered correctly.
  Wrong answers re-queue the question later in the same session; the item stays in the session
  until fully cleared.
- Errors are tallied as `incorrect_meaning_answers` + `incorrect_reading_answers`, then fed into
  the formula in §1.4 once at commit time.
- **The re-queue distance is undocumented and, in practice, often zero** — a missed question can
  come back almost immediately, right after the correct answer was shown to you. This is a
  long-standing complaint with a dedicated
  [userscript](https://greasyfork.org/en/scripts/26216-wanikani-wrong-answer-delay) to force a
  delay, and it materially undermines the SRS: you're re-testing working memory, not recall.
  **We should enforce a minimum gap (see §3.7).**
- Lessons are batched: **3–10 items (default 5)**, taught then immediately quizzed.
- **Lesson ordering is fixed, not shuffled:** ascending level, then by subject type
  (radical → kanji → vocabulary) within a level. This is what makes the "you always already know
  the components" effect work — it is a dependency-topological order, not a preference.
  ([announcement thread](https://community.wanikani.com/t/lessons-are-now-ordered/18849))
- Review ordering *is* user-configurable: *Shuffled*, *Apprentice First*, *Lower SRS Stages First*,
  *Lower Levels First*. ([App Settings](https://knowledge.wanikani.com/wanikani/app-settings/))
- **Extra Study** is a separate, SRS-free practice mode over *Recent Lessons*, *Recent Mistakes*
  (last 24h), and *Burned Items*. Mistakes there cost nothing.
  ([Extra Study](https://knowledge.wanikani.com/widgets/extra-study/))

### 1.6 How answers are judged — the most copyable part

**Reading answers (Japanese):**
- The input box runs an inline IME: romaji is transliterated to kana as you type, using
  **[WanaKana](https://github.com/WaniKani/WanaKana)** — WaniKani's own open-source JS library
  (`wanakana.bind(el, {IMEMode: true})`). MIT-licensed, on npm, with ports to Python/Rust/Go/etc.
- Matching is **exact** against the accepted readings. No typo tolerance — ぎゅ vs ぎゆ is a real
  error, not a slip.
- Multiple readings may exist (on'yomi/kun'yomi/nanori); each is flagged `accepted_answer`
  true/false, and **any one** accepted reading suffices.

**Meaning answers (English):**
1. Check the **blacklist** (`auxiliary_meanings` with `type: "blacklist"`) → instant reject, even
   if it's a near-match to something valid. This exists to block *plausible but wrong* answers.
2. Otherwise compute **Optimal String Alignment distance** (a restricted Damerau–Levenshtein that
   allows adjacent transpositions) against every accepted meaning, whitelisted auxiliary meaning,
   and **user-defined synonym**.
3. Accept if distance ≤ threshold, where threshold scales with the length `L` of the target:

   | Target length `L` | Max edit distance |
   |---|---|
   | ≤ 3 | 0 (exact) |
   | 4–5 | 1 |
   | 6–7 | 2 |
   | ≥ 8 | 2 + ⌊L/7⌋ |

   ([community reverse-engineering thread](https://community.wanikani.com/t/how-to-check-if-answer-is-correct-or-not/47194))

> **Independently confirmed (iteration 2).** [Tsurukame](https://github.com/davidsansome/tsurukame)
> (the long-running open-source iOS client) implements exactly these constants in
> `ios/AnswerChecker.swift`:
> ```swift
> if answer.count <= 3 { return 0 }
> if answer.count <= 5 { return 1 }
> if answer.count <= 7 { return 2 }
> return 2 + 1 * floor(Double(answer.count) / 7)
> ```
> Note the threshold is computed from the length of the **expected answer**, not the user's input.
> One discrepancy: the WaniKani community thread describes **Optimal String Alignment**
> (Damerau–Levenshtein restricted to adjacent transpositions), while Tsurukame uses plain
> **Levenshtein**. They differ only on transpositions ("teh" → "the" costs 1 under OSA, 2 under
> plain Levenshtein). Since transposition is one of the four dominant typo classes, **use OSA** —
> it is strictly more forgiving in exactly the way users need.

**Normalisation, before any comparison** (from Tsurukame's implementation):

- *Both*: trim whitespace, lowercase, strip `-`, `.`, `'`, `/`.
- *Readings only*: strip all spaces; convert a trailing standalone `n` to `ん`/`ン` depending on the
  target alphabet; normalise katakana → hiragana before comparing.

**The "shake" — the third answer state.** Some inputs are neither right nor wrong; the box shakes
and warns instead of grading. Documented cases
([Common Mistakes](https://knowledge.wanikani.com/wanikani/common-mistakes/)):
- You typed English where a reading was expected (or kana where a meaning was expected).
- You typed a *valid but non-accepted* reading (e.g. the kun'yomi when the on'yomi is being taught).
- You typed a bare verb meaning ("enter") when the item is a verb requiring "to enter".
- You used a full-size や/ゆ/よ where a small ゃ/ゅ/ょ is required — this one *is* marked wrong,
  with a hint, because the distinction is phonemically real.

**The full result taxonomy** is richer than three states. Tsurukame's checker returns these
distinct outcomes, which is the best available map of what WaniKani itself distinguishes:

| Result | Meaning | Treated as |
|---|---|---|
| `Precise` | Exact match after normalisation | ✅ correct |
| `Imprecise` | Fuzzy match inside the distance tolerance | ✅ correct (optionally warn: "you typed *X*, we mean *Y*") |
| `OtherKanjiReading` | You gave a real reading of the character, just not the accepted one — or, for vocabulary, the reading of its component kanji instead of the word | 🟡 shake / retry |
| `MismatchingOkurigana` | Vocabulary reading whose kana suffix/prefix doesn't line up with the word's okurigana | 🟡 shake / retry |
| `ContainsInvalidCharacters` | Non-kana in a reading field, or Japanese characters in a meaning field | 🟡 shake / retry |
| `Blacklisted` / no match | Explicit blacklist hit, or distance over tolerance | ❌ incorrect |

**The verb rule is curation, not logic.** WaniKani doesn't derive "to ___" at grade time; the
grammar is baked into the curated answer strings. Transitive verbs are stored as *"to raise
something"*, intransitives as *"to rise"* — so transitivity is taught **through the accepted
answer itself**, which is a quietly brilliant trick: you can't answer correctly without having
internalised the distinction. `parts_of_speech` is then only used to trigger the "verbs need 'to'"
*hint*. ([transitivity pairs guide](https://community.wanikani.com/t/the-definitive-guide-to-wanikanis-transitivity-pairs/64600))
This matters for us: **the expressiveness lives in the answer field, not the engine.** Our
authoring UI should make it easy and natural for users to encode that kind of nuance.

The distinction that matters: **`Imprecise` and `OtherKanjiReading` look similar to a user but are
opposite decisions.** Imprecise means *you knew it and mistyped* → credit. OtherKanjiReading means
*you knew something adjacent but not this* → no credit, no penalty, ask again.

This three-state grading (**correct / shake-and-retry / incorrect**) is, in my view, the single
most underrated part of WaniKani's UX. It prevents the SRS from being poisoned by input-mode
mistakes while refusing to be lenient about actual knowledge gaps.

### 1.7 Prompt directions WaniKani does and does not use

| Direction | Used? | Notes |
|---|---|---|
| Character → meaning (JP→EN) | ✅ | Free-text recall, fuzzy-graded |
| Character → reading (JP→kana) | ✅ | Free-text recall, exact-graded, IME input |
| Meaning → character (EN→JP production) | ❌ | **Never tested.** WaniKani is recognition-only |
| Audio → meaning/reading | ❌ | **Confirmed:** audio exists on **vocabulary only** (no radicals, no kanji — "hearing a reading alone without context doesn't mean much") and plays *after you answer correctly*, never as the prompt. Two Tokyo-accent voice actors, Kyoko (f) and Kenichi (m), optionally randomised. ([Audio](https://knowledge.wanikani.com/wanikani/audio/)) |
| Context sentences | 📖 | Vocabulary ships with `context_sentences[]` (`en`/`ja` pairs) but they are **read, not quizzed** |
| Cloze / fill-in-the-blank | ❌ | Not present |
| Multiple choice | ❌ | Deliberately avoided — recall, not recognition |

The absence of EN→JP production is a real pedagogical limitation, widely noted by users, and one
of the clearest places where our clone can improve — see [§6.3](#63-question-types). But it is
**not free**, and iteration 4 turned up exactly why:

### 1.7.1 Why reversing a card is not symmetric — the KaniWani problem

[KaniWani](https://community.wanikani.com/t/kaniwani-and-synonyms/28932) is WaniKani's reverse:
it shows the English meaning and asks for the Japanese. It is well-loved and *notoriously
frustrating*, for a reason that is structural, not a bug:

> **JP→EN is many-to-one; EN→JP is one-to-many.** 少女 / 女の子 / 女子 all legitimately mean
> "girl". Going forward, "girl" is a fine answer for any of them. Going backward, the prompt
> "girl" has three correct answers and KaniWani wants one specific one.

So a naively reversed card set generates prompts that are **unanswerable by construction**. Users
report large accuracy drops that reflect ambiguity, not ignorance.

**[KameSame](https://community.wanikani.com/t/kamesame-a-fast-feature-rich-japanese-memorization-webapp/31319)
solves it with "Smart Alternate Matches":** if your answer is a *different item* that also
satisfies the prompt, you are not penalised — it tells you that 袋 also means "bag" but it was
looking for 鞄, and asks again. This is precisely the `OtherKanjiReading` idea from §1.6,
generalised to the production direction: **knew-something-adjacent → retry, not wrong.**

**Design consequence for us.** If we ship EN→JP production (§6.3), the grader must be able to
answer "does this response match *any other card in the deck*?" — which means the reverse index is
a **deck-level** structure, not a card-level one. That is a real architectural requirement and it
should be decided before, not after, the schema is built. Options: (a) build the reverse index and
do KameSame-style alternate matching; (b) require a disambiguating hint on any card the user marks
for reverse review; (c) prompt from a context sentence with the target blanked, which disambiguates
naturally. **(c) is the strongest pedagogically and the cheapest to implement** — but it requires
the user to have written a sentence.

### 1.8 Software architecture (as far as is public)

- **Backend:** Ruby on Rails. **Frontend:** progressively migrated to React (previously
  server-rendered ERB + Stimulus-ish JS; the migration broke many userscripts, which is how it's
  publicly known). Small team — ~4 engineers.
  ([hiring thread](https://community.wanikani.com/t/were-hiring-a-full-stack-developer/38607))
- **Public REST API v2** (`docs.api.wanikani.com`), token-auth, ETag/`If-Modified-Since` caching,
  cursor pagination. Its resource model is a genuinely good schema and worth stealing wholesale:

  | Resource | Role | Key fields |
  |---|---|---|
  | `subject` | The *content* (immutable, shared by all users) | `characters`, `meanings[]{meaning,primary,accepted_answer}`, `auxiliary_meanings[]{meaning,type}`, `readings[]{reading,type,accepted_answer}`, `component_subject_ids[]`, `amalgamation_subject_ids[]`, `context_sentences[]`, `meaning_mnemonic`, `reading_mnemonic`, `level` |
  | `assignment` | The *user's progress* on one subject | `srs_stage` (0–9), `unlocked_at`, `started_at`, `passed_at`, `burned_at`, `available_at`, `resurrected_at` |
  | `review` | An immutable *event log* row | `starting_srs_stage`, `ending_srs_stage`, `incorrect_meaning_answers`, `incorrect_reading_answers` |
  | `review_statistic` | Rolled-up per-subject accuracy | `meaning_correct/incorrect/max_streak/current_streak`, same for reading, `percentage_correct` |
  | `study_material` | User's own additions to shared content | `meaning_note`, `reading_note`, `meaning_synonyms[]` |
  | `spaced_repetition_system` | The ladder itself, **as data** | `stages[]{position, interval, interval_unit}`, `unlocking_stage_position`, `starting_stage_position`, `passing_stage_position`, `burning_stage_position` |

**The most important structural lesson:** WaniKani separates *content* (`subject`) from
*progress* (`assignment`) from *history* (`review`), and — critically — **the SRS ladder is a
first-class data row, not hardcoded logic**. That last choice is exactly what our app needs,
because a user-authored deck may want a different ladder per deck.

### 1.9 Where grading happens (client) vs. where scheduling happens (server)

The API is write-capable in a very specific, narrow way:

- `PUT /assignments/{id}/start` — moves an item out of lessons and into the review queue (stage 0 → 1).
- `POST /reviews` — submits a completed review. The payload carries **`incorrect_meaning_answers`
  and `incorrect_reading_answers` — counts, not answers.** The server returns the resulting
  `starting_srs_stage` / `ending_srs_stage`.
- There is **no answer-validation endpoint** and **no resurrect endpoint**; resurrecting a burned
  item is web-UI-only, though `assignment.resurrected_at` exists to record it.

The architectural implication is the whole design in one sentence: **the client decides whether an
answer was right; the server decides when you see the item next.** That is why every third-party
client (Tsurukame, KanjiSchool, Juken) has to reimplement the grader, and why they all converge on
the same constants. *(Inference from the endpoint shapes — WaniKani doesn't state it outright.)*

For our app this is a genuinely good boundary to copy: it makes the review loop work offline and
keeps the scheduler authoritative and cheap to reason about.

**Vacation mode** is a user-level flag (`user.current_vacation_started_at` in the API). Turning it
on freezes the queue; turning it off shifts every pending `available_at` forward by the elapsed
vacation duration, so you return to the same-sized backlog rather than a catastrophic one. It does
not affect stages, level-up, or burned items. *(Field confirmed in the API; the shift behaviour is
consistent with user reports but not in official docs — medium confidence.)*

**Resurrect / retire:** a burned item can be resurrected back into the SRS (it re-enters at an
Apprentice stage), or retired permanently. Both are bulk-manageable only via
[userscripts](https://community.wanikani.com/t/userscript-burn-manager-review-resurrect-retire/13001),
which is a UX gap worth not reproducing.

---

## 2. What breaks when the content is user-authored

This is the crux of the project. Four of WaniKani's mechanics depend on a curated curriculum:

1. **Dependency gating.** WaniKani knows 一 is inside 三. A user typing in flashcards does not
   supply a decomposition graph. → *We must either let users declare dependencies, infer them, or
   drop gating.*
2. **Levels.** 60 hand-balanced levels with ~35 items each. A user's deck has no levels. → *We
   need a synthetic pacing mechanism (see §3.5).*
3. **Accepted-answer curation.** WaniKani's fuzzy matching works because a human wrote 1–3
   canonical meanings plus whitelist/blacklist entries per item. A user writing "back" as the
   answer for a card will get false-accepts on "back " / "bank"(dist 1, L=4). → *We need
   authoring-time affordances: alternate answers, blacklist, and a "strict" toggle.*
4. **Mnemonics.** These are the actual teaching. → *We give the user a mnemonic field and,
   optionally, LLM-assisted drafting. Not required for v1.*

Everything else — the ladder, the penalty formula, the two-part review, the three-state grading,
Extra Study, the schema separation — transfers unchanged.

---

## 3. Proposed design

### 3.1 Core model

```
Deck            user-owned collection; owns an SRS ladder + grading defaults
 └─ Card        the content unit (WaniKani "subject")
     ├─ front            e.g. 猫  (or any prompt text; not Japanese-specific)
     ├─ fields[]         named, typed values: meaning, reading, notes, sentence…
     ├─ tasks[]          the questions generated from this card  ← key abstraction
     ├─ mnemonics{}      free text per task
     ├─ media            optional audio/image
     └─ depends_on[]     other Card ids that must be "passed" first (optional)

Progress        one row per (user, card): srs_stage, available_at, timestamps
TaskStat        per (user, card, task): correct/incorrect/streaks
ReviewLog       immutable event rows — never mutate, always append
```

A **Task** is the generalisation of WaniKani's meaning/reading split:

```
Task = { id, kind, prompt_from, answer_field, grader, required_to_advance }
```

so a Japanese card yields `{JP→meaning, JP→reading}` exactly like WaniKani, but a user could add
`{EN→JP production}` or `{cloze from sentence}` on the same card, and each is independently
tracked while the **card** holds the single SRS stage. This preserves WaniKani's "both must be
right before the stage moves" rule while allowing more than two questions.

### 3.2 Scheduler

Ladder stored as data, per deck, defaulting to WaniKani's:

```json
{ "stages": [
  {"pos":1,"interval":"4h"},  {"pos":2,"interval":"8h"},
  {"pos":3,"interval":"23h"}, {"pos":4,"interval":"47h"},
  {"pos":5,"interval":"7d"},  {"pos":6,"interval":"14d"},
  {"pos":7,"interval":"30d"}, {"pos":8,"interval":"120d"},
  {"pos":9,"interval":null}],
  "passing_stage": 5, "burning_stage": 9 }
```

Commit logic, run once per card at the end of a review session:

```
incorrect = Σ incorrect answers across all tasks of this card in this session
if incorrect == 0:  stage += 1
else:               stage = max(1, stage − ceil(incorrect/2) × (stage >= passing ? 2 : 1))
available_at = floor_to_hour(now + ladder[stage].interval)   # see §1.3 — truncate, don't round
if stage == burning_stage: available_at = null   # burned
```

The `floor_to_hour` is not cosmetic: it prevents each day's review time from drifting later and
clumps due items into hourly batches. One line, disproportionate payoff.

Same formula as §1.4, generalised over N tasks instead of 2.

### 3.3 Grading engine

Three states — `correct` / `retry` (shake) / `incorrect` — with per-field graders:

- **`text_fuzzy`** (English-ish): normalise (lowercase, trim, collapse whitespace, strip
  articles?) → blacklist check → OSA distance vs {primary, alternates, user synonyms} with the
  length-scaled threshold from §1.6.
- **`text_exact`** (readings/kana/code/anything precise): exact match after normalisation, with
  optional romaji→kana transliteration via **WanaKana** on input.
- **`shake` triggers** (deck-configurable), mirroring the taxonomy in §1.6: script mismatch (Latin
  where kana expected or vice-versa, via `wanakana.isJapanese`/`isRomaji`); answer matches a
  *different task's* answer on the same card (the generalisation of `OtherKanjiReading`); answer
  matches a user-declared "close but not this" alternate; answer is empty.
- **`alternate_match`** (only for production-direction tasks): the response is a *valid answer to a
  different card in the deck*. Requires a deck-level reverse index (answer → card ids). Treated as
  `retry`, never as `wrong` — see §1.7.1.
- **Grader returns a result enum, not a boolean** — `precise | imprecise | retry(reason) | wrong` —
  so the UI can show *why*. Only `wrong` increments the incorrect tally that feeds §3.2. This is
  the single highest-leverage thing to get right; a boolean grader will feel hostile.
- **Undo:** a first-class "that was a typo" button, available only on the *immediately previous*
  answer, that reverts the tally. WaniKani lacks this natively — the most-installed userscripts
  add it — so we should ship it.

### 3.4 Dependency gating (optional per deck)

Users declare `depends_on` edges between their own cards. A card becomes available for a lesson
only when all its prerequisites are at ≥ passing stage. If a deck declares no edges, gating is
off and the deck behaves like a flat Anki-style deck. This keeps WaniKani's best structural idea
available without forcing every user to build a graph.

### 3.5 Pacing without levels

WaniKani's levels are really a *throttle*: they cap how much new material can be in flight.
Replace with two knobs that produce the same effect on any deck:

- **Apprentice cap** (default ~10): no new lessons while ≥ N cards sit at stage 1–4. This is the
  well-known community technique for controlling WaniKani workload, and it generalises perfectly.
- **Daily lesson cap** (default 5–15), mirroring "Maximum Recommended Daily Lessons".

Optionally, a **synthetic level** = a user-defined ordered group of cards, with the same ≥90%-
passed rule to advance. Good for users who *want* the WaniKani ceremony.

### 3.6 Extra Study, ported

SRS-free practice over: *Recent Lessons*, *Recent Mistakes (24h)*, *Burned*, and — new —
*Leeches* (cards whose `percentage_correct` is below a threshold with ≥ N attempts).

### 3.7 The in-session question queue

WaniKani's own queue behaviour is undocumented and has the immediate-re-queue flaw noted in §1.5.
[KanjiSchool](https://github.com/Lemmmy/KanjiSchool)'s `src/session/chooseQuestion.ts` is a better
reference implementation and the design below follows it:

- The session holds every unfinished **question** (task), not card. A card leaves the session only
  when *all* its tasks are correct.
- Each question carries a **`choiceDelay`** counter. Answering wrong sets it; the picker filters
  out any question with `choiceDelay > 0` **as long as a non-delayed candidate exists**, so the
  gap is enforced when possible and gracefully degrades at the end of a session when only the
  missed items remain.
- **`maxStarted`** (default 10): once N cards are half-answered, the picker only draws from
  already-started cards. This bounds working-memory load and stops a long session from leaving a
  trail of half-finished items.
- Candidates are bucketed (by SRS stage / level / type depending on the chosen ordering), and the
  pick is **random within the current bucket only** — so ordering preferences are respected at the
  coarse level while remaining unpredictable at the fine level. Unpredictability matters: strictly
  ordered queues let you answer from position rather than recall.
- Options worth exposing: **`meaningReadingBackToBack`** (finish both tasks of a card together vs.
  scatter them) and **`readingFirst`**. Scattering is pedagogically stronger; back-to-back is
  faster and less fatiguing. Default to scattered, let the user switch.

**Our addition:** a hard floor on re-queue distance — *N* other questions **and** *T* seconds,
whichever is later — so a wrong answer can never be immediately parroted back.

### 3.8 Leech handling — the gap WaniKani never fills

WaniKani has **no leech mechanism at all**. An item you have failed twenty times keeps cycling
between Apprentice and Guru forever, silently eating your review budget. The SRS ladder cannot fix
this because it has no memory beyond the current stage.

Anki's model is the reference and it is simple enough to copy wholesale
([Anki manual — Leeches](https://docs.ankiweb.net/leeches.html)):

- Count **lapses** — failures of an item that had already reached the review phase. Failures during
  initial learning don't count (in our terms: only count failures at stage ≥ passing).
- At **8 lapses** (configurable), tag the item a *leech* and optionally **suspend** it.
- Keep warning at **half the threshold** thereafter — every 4 further lapses.

Two deliberate deviations for us:

- **Don't suspend by default; surface instead.** Silent suspension makes items vanish, which is
  disorienting in a deck you authored yourself. Default to tagging + a visible "Leeches" list, with
  suspend as an opt-in.
- **Leeches are usually an authoring problem, not a memory problem.** In a user-authored deck a
  leech very often means the card is ambiguous, has a bad answer string, or duplicates another
  card. So the leech UI should open straight into *edit this card*, offering "add a synonym",
  "blacklist an answer", or "merge with…". This is a capability WaniKani structurally cannot have,
  because its users don't own the content. **It's our best differentiator.**

---

## 4. Suggested MVP scope

1. Deck + card authoring (front, meaning, reading, alternates, blacklist, mnemonic, notes).
2. Task generation for the two WaniKani directions; EN→JP production as an opt-in third.
3. WaniKani ladder as seeded data + the §3.2 commit logic.
4. Review session UI: queue, three-state grading, re-queue on wrong, undo, batch lessons.
5. Grading engine (§3.3) including WanaKana IME binding.
6. Dashboard: due counts by group, upcoming-reviews timeline, level/pacing throttle.
7. **WaniKani-style visual system** (§6.5): palette, full-bleed review screen, SRS-stage tiles.
8. **Landing page** (§6.5.3) with an interactive demo review card.

**Explicitly out of MVP:** dependency graph UI, synthetic levels, Extra Study, audio, sharing,
mobile apps, LLM mnemonics.

---

## 5. Things WaniKani gets wrong that we should not copy

- **No undo.** A typo permanently damages an item's schedule. Ship undo.
- **Missed items can reappear seconds later**, right after the answer was revealed — testing
  working memory, not recall, and inflating apparent accuracy. Enforce a re-queue floor (§3.7).
- **Fixed ladder is inflexible.** No leech detection whatsoever, no per-card difficulty — a
  chronically-failed item cycles forever, unflagged. See [§3.8](#38-leech-handling--the-gap-wanikani-never-fills);
  optionally offer FSRS as an alternate scheduler ([§6.2](#62-scheduling-model)).
- **Recognition only.** No EN→JP production means users can read but not produce.
- **Reviews can't be paused mid-session** without loss; sessions should be resumable and every
  answer persisted immediately.
- **No "I got this wrong on purpose / mark correct"** for legitimately ambiguous answers.

---

## 6. Open decisions — need your call

I've deliberately not picked these. Each changes the shape of the build substantially.

### 6.1 Platform / stack — ✅ **DECIDED: Next.js + Supabase, cloud-hosted, local dev loop**

> **Decision (2026-08-12).** Develop locally, run in the cloud, Postgres via **Supabase**.
> Option C (CLI/TUI) is ruled out by the UI requirement in §6.5.

**Why Supabase over the alternatives**, for this app specifically:

- **The data is relational and the review log is the point.** Decks → cards → tasks → progress →
  an append-only log of every answer. Postgres is correct; a document store would fight us. And
  FSRS parameter optimisation later consumes exactly that full review history, so the log is not
  incidental — it's the most valuable table in the schema.
- **Auth comes with it.** The moment this is cloud-hosted and multi-device, you need accounts.
  Neon is a superb *database* but gives you no auth — you'd bolt on Auth.js or Clerk. Supabase
  bundles it.
- **RLS removes the API layer.** With row-level security the client can talk to Postgres directly
  and still be safe, so there's no CRUD backend to write and maintain. For a solo project that is
  the single biggest time saving on offer.
- **The local-dev story is exactly what you asked for.** `supabase start` runs the whole stack
  (Postgres, auth, studio) in Docker locally; schema changes are versioned as migrations in
  `supabase/migrations/` and pushed to the cloud project with `supabase db push`. Test locally,
  ship the same schema up. ([Local development](https://supabase.com/docs/guides/local-development))

**Neon** would be the better pick if we wanted pure serverless Postgres with branching and no BaaS
coupling, or many separate projects (its free tier allows 100, vs Supabase's 2). Neither applies to
one app that needs auth.

**Two caveats worth designing around:**

1. **Free-tier projects pause after ~7 days of inactivity.** Mildly ironic for an SRS app — the
   exact scenario WaniKani's vacation mode exists for is the one that puts the database to sleep.
   Not data loss, but the app appears broken until you unpause. Budget for the Pro tier, or accept
   a manual unpause after breaks.
2. **Supabase has no built-in offline sync**, and a review loop genuinely wants to work on a train.
   Mitigation is cheap *if designed in now*: keep the session queue and answers in **IndexedDB**,
   and treat `ReviewLog` as **append-only** — appends from multiple devices merge without conflict
   resolution, because there is nothing to conflict over. Derived state (`stability`, `difficulty`,
   `due`) is then recomputed from the log rather than synced as mutable rows. **This is the reason
   §3.1 keeps `ReviewLog` immutable, and it should not be compromised.**

**Where FSRS runs:** client-side via `ts-fsrs`, which means the client computes `due`. With RLS a
client could in principle write any schedule it likes. For a personal tool that is fine and worth
the simplicity; if this ever becomes multi-user or competitive, move scheduling into a Postgres
function or an edge function and make `due` server-authoritative.

**Proposed concrete stack:** Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres +
Auth + RLS), `ts-fsrs` for scheduling, `wanakana` for kana input, deployed on Vercel. Local dev
against `supabase start`.

### 6.2 Scheduling model — ✅ **DECIDED: FSRS via `ts-fsrs`**

> **Decision (2026-08-12): option B — FSRS.** We do *not* implement WaniKani's fixed ladder as the
> scheduler. Concrete consequences, which override the ladder-based text in §3.2:
>
> - Per-card state is `stability`, `difficulty`, `due`, `last_review` — **not** `srs_stage`.
> - The §1.4 penalty formula becomes **research background only**; FSRS handles lapses natively.
> - `Progress` (§3.1) stores the FSRS card state; `ReviewLog` still records raw correct/incorrect
>   per task, which is what FSRS's optimiser needs later.
> - The grader-result → FSRS-rating mapping in the table below is now **load-bearing**, not a
>   footnote — it is the only thing standing between a typed-recall UI and a 4-button algorithm.
> - **Keep the stage ceremony as a display layer:** derive Apprentice/Guru/Master/Enlightened/Burned
>   labels from `stability` thresholds so the motivational structure survives. "Burned" ≈ stability
>   past some months-long threshold.
> - Still copy from WaniKani: hourly due-time truncation (§1.3), the two-part review and both-must-
>   pass rule (§1.5), the whole grading engine (§1.6/§3.3), the session queue (§3.7), and the leech
>   surfacing in §3.8 — FSRS reduces leech *frequency* but doesn't flag them for authoring fixes.

| Option | Pros | Cons |
|---|---|---|
| **A. WaniKani's fixed 9-stage ladder** (faithful clone) | Predictable, transparent, satisfying "Burned" milestone, simple to implement | Not adaptive; wastes reviews on easy cards |
| **B. FSRS** (difficulty/stability/retrievability, ~20–30% fewer reviews for equal retention) | Measurably better scheduling | Loses the stage ceremony; opaque; more implementation work |
| **C. Ladder by default, FSRS as a per-deck option** | Best of both | Two code paths to maintain |

**Iteration 5 — what choosing FSRS actually costs.** There is a maintained TypeScript
implementation, [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) (FSRS-6, ESM/CJS/UMD,
browser + Node), so we would not write the algorithm. But there is a real impedance mismatch:

- **FSRS expects a 4-button self-rating** — `Again / Hard / Good / Easy`. Our app, like WaniKani,
  is a *typed-answer recall* app, which is inherently binary. Self-rating is exactly the friction
  WaniKani's design removes, and I would not want to add it back.
- **Our grader's result enum solves this cleanly**, which is a nice accident of §3.3's design:

  | Grader result | FSRS rating |
  |---|---|
  | `precise`, answered fast | `Easy` |
  | `precise` | `Good` |
  | `imprecise` (fuzzy/typo match) | `Hard` |
  | `wrong` | `Again` |
  | `retry` | *no rating — not an attempt* |

  So we can drive FSRS from objective signals rather than asking the user to introspect. This is,
  I think, a genuinely better setup than either WaniKani or stock Anki.
- **Per-card state changes:** FSRS stores `stability`, `difficulty`, `due`, `last_review` instead
  of a single `srs_stage`. Config is `request_retention`, `maximum_interval`, `enable_fuzz`,
  `learning_steps`. Parameter *optimisation* from review history needs a separate Rust-backed
  package — skippable at first, since the default weights are fine until there's history.
- **What's lost:** the stage ceremony. "Burned" is a real motivator and `stability = 47.3 days`
  is not. If we go FSRS, we should keep displaying synthetic stage names derived from stability.

### 6.3 Question types in v1

Pick any: JP→meaning • JP→reading • **EN→JP production** • cloze from a user sentence •
audio→meaning. WaniKani ships only the first two.

**Revised recommendation after §1.7.1.** EN→JP production is the highest-value addition *and* the
one with a real cost: it needs a deck-level reverse index and alternate-match grading, or it will
punish users for ambiguity rather than ignorance. Three ways to sequence this:

| Option | What ships | Cost |
|---|---|---|
| **A. Recognition-only v1** (faithful) | JP→meaning, JP→reading | Lowest; defers the hard problem entirely |
| **B. Production with alternate matching** | + EN→JP, deck-level reverse index, `alternate_match` retry state | Schema must support it from day one — retrofitting is painful |
| **C. Production via cloze** | + sentence-cloze prompts, which disambiguate by context | Cheap to grade, but only works for cards where the user wrote a sentence |

I lean **A for v1 with the schema shaped for B** — ship recognition, but make `Task` and the answer
index deck-scoped now so production can be added without a migration. Audio→meaning I'd drop:
WaniKani deliberately doesn't do it (§1.7), and user-recorded audio is a big authoring burden.

### 6.4 Is this Japanese-specific?

If yes, we lean on WanaKana, furigana rendering, and on/kun distinctions throughout. If it should
work for *any* subject (medical terms, law, another language), the "reading" field becomes just
"a second answer field with an exact grader" and the app gets more generic but less magical.
**I'd recommend Japanese-first with the schema kept general** — but it's your call.

---

## 6.5 UI direction — ✅ **DECIDED: mirror WaniKani's interface, plus a landing page**

*(Added on request, 2026-08-12.)* The app should look and feel like WaniKani, not like a generic
flashcard tool. What that concretely means:

### 6.5.1 The colour system

WaniKani's identity is carried almost entirely by a five-hue palette built from the same three
channel values (`00`, `AA`, `FF`), which is why it feels coherent:

| Role | Colour | Hex |
|---|---|---|
| Radical *(→ our "component" card type)* | Blue | `#00AAFF` |
| Kanji *(→ our primary card type)* | Magenta/pink | `#FF00AA` |
| Vocabulary *(→ our "compound" card type)* | Purple | `#AA00FF` |
| *(palette siblings, used for accents)* | Orange / lime | `#FFAA00` / `#AAFF00` |

> ⚠️ **Community-sourced, not official.** These hexes recur consistently across community palettes
> and userscripts, but WaniKani publishes no brand guide. Verify against the live site before
> locking them in.

SRS stages have their **own** colour scale: Apprentice pink → Guru purple → Master blue →
Enlightened light blue → Burned dark/grey.

**A trap to avoid.** WaniKani reuses the *same* hues for two different axes — pink means both
"kanji" and "Apprentice"; purple means both "vocabulary" and "Guru" — and this is a
[long-standing, repeatedly-filed user complaint](https://community.wanikani.com/t/color-coding-why-does-pink-mean-both-kanji-and-apprentice/46196).
**Copy the palette, not the collision:** keep the saturated hues for card *type*, and give SRS
*stage* a distinct visual channel (a neutral-to-warm ramp, or a filled-progress treatment) so the
two axes never compete.

### 6.5.2 Screens to mirror

- **Dashboard.** Two oversized primary buttons — *Lessons (n)* and *Reviews (n)* — in the subject
  colours, above a level/pacing progress bar, a row of SRS-stage tiles with counts
  (Apprentice / Guru / Master / Enlightened / Burned), and a **review forecast** timeline of
  upcoming hourly batches. The hourly truncation from §1.3 is what makes that forecast read as
  clean bars instead of noise.
- **Review screen.** Full-bleed background in the card-type colour, one very large centred prompt,
  a single input directly beneath it, and nothing else on screen. Feedback paints the whole input
  bar green (correct) or red (incorrect); the *retry/shake* states from §1.6 shake the bar with a
  one-line hint and **do not** paint it red — that distinction is the whole point.
- **Lesson screen.** Tabbed *Meaning / Reading / Context*, with mnemonic text rendered with inline
  coloured spans. WaniKani's API returns mnemonics containing markup tags for exactly this, so our
  authoring format should support the same: a small inline markup for highlighting a component,
  a reading, or Japanese text inside the user's own mnemonic.
- **Item page.** Character, meanings, readings, mnemonics, user synonyms and notes, plus the
  component/compound links — the dependency graph made browsable.
- **Voice.** WaniKani's copy is playful and a bit absurd (the Crabigator). Ours should have *a*
  personality rather than a borrowed one — no mascot lifted from them.

### 6.5.3 Landing page

A public marketing page at `/`, with the review UI behind it. Content: what it is in one line
(*"WaniKani's method, your flashcards"*), the SRS ladder visualised, an interactive demo review
card, the core differentiator (§3.8 — leeches route back into editing your own content), and a
single call to action. Design should use the same palette so the product doesn't feel like a
different app once you sign in.

> **Note on §6.1:** the UI requirement effectively rules out the CLI/TUI option. The remaining
> choice is local-first web vs. web + backend — **still unanswered, and now the only blocker.**

---

## 7. Sources

- [WaniKani Knowledge — SRS Stages](https://knowledge.wanikani.com/wanikani/srs-stages/)
- [WaniKani Knowledge — SRS](https://knowledge.wanikani.com/wanikani/srs/)
- [WaniKani Knowledge — Why isn't my answer accepted?](https://knowledge.wanikani.com/wanikani/common-mistakes/)
- [WaniKani Knowledge — How Do I Level Up?](https://knowledge.wanikani.com/wanikani/getting-started/level-up/)
- [WaniKani Knowledge — Unlocking Kanji Lessons](https://knowledge.wanikani.com/getting-started/unlocking-kanji/)
- [WaniKani Knowledge — App Settings](https://knowledge.wanikani.com/wanikani/app-settings/)
- [WaniKani Knowledge — Extra Study](https://knowledge.wanikani.com/widgets/extra-study/)
- [WaniKani API v2 Reference](https://docs.api.wanikani.com/20170710/)
- [WanaKana (WaniKani's kana/romaji library)](https://github.com/WaniKani/WanaKana)
- [Community — How to check if answer is correct or not](https://community.wanikani.com/t/how-to-check-if-answer-is-correct-or-not/47194)
- [Community — Does failing both reading and meaning affect SRS?](https://community.wanikani.com/t/does-failing-both-reading-and-meaning-affect-srs/55316)
- [Community — We're Hiring a Full-Stack Developer (stack details)](https://community.wanikani.com/t/were-hiring-a-full-stack-developer/38607)
- [Community — Lessons are now ordered (lesson ordering announcement)](https://community.wanikani.com/t/lessons-are-now-ordered/18849)
- [Community — Burn Manager userscript (resurrect / retire)](https://community.wanikani.com/t/userscript-burn-manager-review-resurrect-retire/13001)
- [Tsurukame — open-source iOS client, `ios/AnswerChecker.swift`](https://github.com/davidsansome/tsurukame) *(independent confirmation of grading constants)*
- [KanjiSchool — open-source web client, `src/session/chooseQuestion.ts`](https://github.com/Lemmmy/KanjiSchool) *(reference implementation for the in-session queue; default branch is `master`, not `main`)*
- [WaniKani Knowledge — Audio](https://knowledge.wanikani.com/wanikani/audio/)
- [Community — The Definitive Guide to WaniKani's Transitivity Pairs](https://community.wanikani.com/t/the-definitive-guide-to-wanikanis-transitivity-pairs/64600)
- [Greasy Fork — WaniKani Wrong Answer Delay userscript](https://greasyfork.org/en/scripts/26216-wanikani-wrong-answer-delay)
- [Community — KaniWani and synonyms (the EN→JP ambiguity problem)](https://community.wanikani.com/t/kaniwani-and-synonyms/28932)
- [Community — KameSame thread ("Smart Alternate Matches")](https://community.wanikani.com/t/kamesame-a-fast-feature-rich-japanese-memorization-webapp/31319)
- KanjiSchool `src/session/submission/fakeAssignmentUpdate.ts` — `startOf('hour')` due-time truncation
- [Anki Manual — Leeches](https://docs.ankiweb.net/leeches.html)
- [ts-fsrs — TypeScript FSRS-6 implementation](https://github.com/open-spaced-repetition/ts-fsrs)
- [Community — Color Coding: why does pink mean both "Kanji" and "Apprentice"?](https://community.wanikani.com/t/color-coding-why-does-pink-mean-both-kanji-and-apprentice/46196)
- [Supabase — Local development & CLI workflows](https://supabase.com/docs/guides/local-development)
- [CSSColors — the `aa00ff / ff00aa / 00aaff / ffaa00 / aaff00` palette](https://csscolors.com/palette/aa00ff-ff00aa-00aaff-ffaa00-aaff00/) *(community-sourced; WaniKani publishes no brand guide)*
- [Tofugu — Learn Kanji with Radicals and Mnemonics](https://www.tofugu.com/japanese/kanji-radicals-mnemonic-method/)
- [Wanilog — How WaniKani SRS works](https://wanilog.com/guides/wanikani-srs-explained) *(community, unverified interval detail)*
- [Domenic Denicola — Spaced Repetition Systems Have Gotten Way Better (FSRS)](https://domenic.me/fsrs/)

---

## 8. Confidence notes

- **High confidence:** SRS stage table, penalty formula, level-up rule, unlock rule, API data
  model, WanaKana usage, Extra Study behaviour, lesson ordering, the write endpoints in §1.9 — all
  from WaniKani's own docs or announcements.
- **High confidence (upgraded in iteration 2):** the edit-distance thresholds. Two independent
  sources — the community reverse-engineering thread and Tsurukame's shipping source — give
  identical constants. The remaining ambiguity is only OSA vs. plain Levenshtein; we should pick
  OSA regardless.
- **Medium confidence:** vacation-mode timestamp-shifting behaviour; the client-grades /
  server-schedules split (inferred from endpoint shapes, not stated); resurrect re-entry stage.
- **Upgraded in iteration 4:** the 23h/47h interval shaving now has a mechanism — hourly
  truncation of the due time, verified in KanjiSchool's source and consistent with observed
  WaniKani behaviour. Still an inference about WaniKani's server, but a well-founded one.
- **High confidence:** the EN→JP asymmetry problem (§1.7.1) — widely reported by KaniWani users,
  and KameSame's "Smart Alternate Matches" exists specifically to solve it.
- **Lower confidence:** current frontend stack details (React migration is public, but its
  completeness is not).
- **Settled in iteration 3:** audio is vocabulary-only, post-answer, never a prompt (official
  docs). The "to ___" verb rule is **curation, not logic** — encoded in the answer strings
  themselves. The in-session re-queue is undocumented at WaniKani but has a solid open-source
  reference in KanjiSchool.
- **Still open (low value — research is at diminishing returns):** KanjiSchool's grader module
  (searched `src/api`, `src/utils`, `src/session/submission` — not found; `submitAnswer.ts`
  receives an already-computed `correct` boolean, so the checker lives further up); how
  `kana_vocabulary` behaves at review time; whether the post-lesson quiz feeds the SRS; sync /
  rate-limit semantics for offline clients.

**Research assessment (unchanged since iteration 4):** every mechanic needed to build this is
documented — ladder, penalty formula, due-time truncation, unlock rules, session queue, grading
algorithm and its constants, result taxonomy, and the one genuine trap (EN→JP asymmetry).
Iteration 5 added the two things WaniKani *lacks* rather than anything it does: leech handling
(§3.8) and the concrete cost of an FSRS option (§6.2). **The blocker is the §6 decisions, not
research** — iteration 5 confirmed this by having to look outside WaniKani entirely to find
anything new worth writing down.
