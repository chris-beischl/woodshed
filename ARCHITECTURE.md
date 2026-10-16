# woodshed — Architecture

This document defines *what* the system is and the semantics that must be implemented
exactly. `CLAUDE.md` defines *how* to work in the repo.

---

## 1. Overview

```
┌──────────────────────────── Browser ────────────────────────────┐
│                                                                  │
│  InputSource (Web MIDI | virtual keyboard | replay | [audio])    │
│        │ NoteEvent stream                                        │
│        ▼                                                         │
│  evaluation/  ── chord capture → ChordSpec matching → grading    │
│        ▲                                   │                     │
│  theory/ (pure)                            │ grade + details     │
│        ▲                                   ▼                     │
│  exercises/ (type registry)  ◄── manifest.json (from content/)   │
│  lessons/ (MDX)                            │                     │
│                                            │ HTTP (JSON)         │
└────────────────────────────────────────────┼─────────────────────┘
                                             ▼
┌──────────────────────────── FastAPI ────────────────────────────┐
│  content/ (loads same manifest.json)                             │
│  scheduling/ (py-fsrs)   planner/ (daily plan)                   │
│  SQLite: cards, review_logs, lesson_progress, settings           │
└──────────────────────────────────────────────────────────────────┘
```

Single user. Auth is a static bearer token from an env var (`WOODSHED_TOKEN`); good
enough for a personal deployment, revisit if that changes.

---

## 2. Input layer

```ts
type NoteEvent =
  | { type: "noteOn";  midi: number; velocity: number; t: number } // t in ms, monotonic
  | { type: "noteOff"; midi: number; t: number }
  | { type: "sustain"; on: boolean; t: number };                    // CC64

interface InputSource {
  id: string;
  label: string;
  subscribe(handler: (e: NoteEvent) => void): () => void;
}
```

Implementations:
- `WebMidiInputSource` — uses `navigator.requestMIDIAccess()`, device picker,
  remembers last device in localStorage, uses `MIDIMessageEvent.timeStamp` for `t`.
  Note-on with velocity 0 is a note-off.
- `VirtualKeyboardInputSource` — on-screen keyboard + computer keyboard mapping
  (for development and for testing without the piano).
- `ReplayInputSource` — replays a recorded JSON array of `NoteEvent`s. Include a
  small recorder in dev mode so real sessions can be captured as test fixtures.
- (later) `AudioInputSource` — Basic Pitch in the browser. Must emit the same events.
  Do not build in M1–M3, but do not make design choices that prevent it.

**Sustain pedal:** evaluation uses *physically held keys* by default, not sounding
notes. Pedal state is recorded in logs but does not affect matching unless an exercise
explicitly opts in.

---

## 3. Theory core (`src/theory/`, pure)

### 3.1 Representations

| Concept | Representation |
|---|---|
| Physical note | MIDI number `0–127` |
| Pitch class | `0–11` (C = 0) |
| Spelled note | `{ letter: "A"–"G", accidental: -2..2 }` (double flats/sharps allowed) |
| Spelled pitch | spelled note + octave |
| Key | `{ tonic: SpelledNote, mode: "major" \| "minor" }` |
| Degree (chord tone) | string token, see 3.3 |

### 3.2 Key set

The 12 keys used when `keys: all`:

- Major: C, Db, D, Eb, E, F, **Gb**, G, Ab, A, Bb, B
- Minor: C, C#, D, Eb, E, F, F#, G, G#, A, Bb, B

(`THEORY-DECISION`: Gb major over F# major follows jazz lead-sheet convention.
Make the key set a single constant. Its *display* spelling may change, but the key
tokens used in card IDs (§ 5.3) are frozen once cards exist — changing them requires a
data migration.)

**Introduction order** for new cards (see § 7): circle of fourths from C —
C, F, Bb, Eb, Ab, Db, Gb, B, E, A, D, G. This is how jazz musicians typically
practice ii–V–Is.

### 3.3 Degree tokens

Each token has a **letter offset** (scale-step distance from the root letter) and a
**semitone offset**. Spelling = root letter + letter offset, then choose the accidental
that yields the semitone offset.

| Token | Letter offset | Semitones | Notes |
|---|---|---|---|
| `1` | 0 | 0 | |
| `b9` | 1 | 1 | |
| `2`, `9` | 1 | 2 | `2` for sus2/add2, `9` for extensions |
| `#9` | 1 | 3 | spelled as a raised 2nd, **not** as b3 |
| `b3` | 2 | 3 | |
| `3` | 2 | 4 | |
| `4`, `11` | 3 | 5 | |
| `#11` | 3 | 6 | |
| `b5` | 4 | 6 | |
| `5` | 4 | 7 | |
| `#5` | 4 | 8 | |
| `b13` | 5 | 8 | |
| `6`, `13` | 5 | 9 | |
| `bb7` | 6 | 9 | dim7 |
| `b7` | 6 | 10 | |
| `7` | 6 | 11 | |

A ChordSpec must not contain two tokens with the same pitch class (e.g. `#9` and `b3`,
`#11` and `b5`). This is validated at build time.

### 3.4 Chord qualities (M1 set, extend later)

| Quality | Tones |
|---|---|
| `maj` | 1 3 5 |
| `m` | 1 b3 5 |
| `dim` | 1 b3 b5 |
| `aug` | 1 3 #5 |
| `maj7` | 1 3 5 7 |
| `m7` | 1 b3 5 b7 |
| `7` | 1 3 5 b7 |
| `m7b5` | 1 b3 b5 b7 |
| `dim7` | 1 b3 b5 bb7 |
| `mMaj7` | 1 b3 5 7 |
| `6` | 1 3 5 6 |
| `m6` | 1 b3 5 6 |
| `7sus4` | 1 4 5 b7 |

Extensions (`9`, `13`, `7b9`, `7#11`, `7alt`, ...) come with the voicing milestones.

### 3.5 Roman numeral grammar

Progressions in templates are written key-relative so they transpose:

```
<accidental?><numeral>:<quality>
```

- `accidental`: `b` or `#` (optional), relative to the **major scale** of the key's
  tonic, regardless of mode — e.g. in C minor, `bIII:maj7` = Ebmaj7.
- `numeral`: `I`–`VII`; case is cosmetic (written `ii`, `V` for readability) and
  **does not** define quality. Quality is always explicit.
- Examples: `ii:m7`, `V:7`, `I:maj7`, `bII:7` (tritone sub), `vii:m7b5`.
- Reserved for later: secondary functions `V:7/ii`.

Root spelling: tonic letter + numeral letter offset, accidental chosen to match the
major-scale degree ± modifier. Then chord tones are spelled from that root via § 3.3.

**Root respelling** (`THEORY-DECISION`): if the resulting *root* needs a double
accidental, respell it to the enharmonic root with the fewest accidentals, preferring
flats on a tie. Lead sheets write G7, not Abb7, for `bII:7` in Gb (likewise D7 in Db).
Chord *tones* keep strict letter arithmetic (Cdim7 still contains Bbb).

**Build-time range check**: the manifest build spells every chord tone of every
template × key and fails if any accidental is outside `-2..2`.

---

## 4. ChordSpec and evaluation (`src/evaluation/`, pure)

### 4.1 ChordSpec (resolved form)

Templates may use high-level presets; the loader resolves them into this flat
structure, so the matcher stays simple.

```ts
type ToneRole = "required" | "optional" | "forbidden";

interface ChordSpec {
  root: SpelledNote;
  quality: Quality;
  tones: Record<DegreeToken, ToneRole>;   // every token mentioned explicitly
  extras: "forbid" | "allowTensions" | "allowAny"; // pitch classes not in `tones`
  allowDoubling: boolean;                 // same pitch class in several octaves
  bass?: DegreeToken[];                   // allowed lowest-note degrees
  order?: DegreeToken[][];                // bottom-up slot sequence, each slot = alternatives
  maxSpan?: number;                       // semitones from lowest to highest note
  minNotes?: number;
}
```

`allowTensions` permits 9/11/13 (and altered tensions on dominants) that are
idiomatic for the quality; define the per-quality tension list in one table.

### 4.2 Voicing presets → ChordSpec

| Preset | Resolution |
|---|---|
| `any` | all quality tones required except `5` optional; extras `forbid`; doubling allowed |
| `root_position` | all quality tones required; `bass: ["1"]` |
| `inversion_1` / `_2` / `_3` | all required; `bass` = 3rd / 5th / 7th of the quality |
| `shell` | `1`, 3rd, 7th required; everything else forbidden; `bass: ["1"]` |
| `guide_tones` | 3rd and 7th required; everything else forbidden (incl. root) |
| `rootless_a` | `order: [[3rd], ["5","13"], [7th], ["9"]]`; root forbidden |
| `rootless_b` | `order: [[7th], ["9"], [3rd], ["5","13"]]`; root forbidden |

"3rd" / "7th" mean the quality's own third/seventh token (`3` or `b3`; `7`, `b7`
or `bb7`). For 6-chords the "7th" slot is `6`. Rootless voicings on `m7b5` and
`dim7` need explicit `THEORY-DECISION`s — leave them unsupported in M1.

Templates may override any field of the resolved spec (`constraints:` block).

### 4.3 Matching algorithm

Input: a set of held MIDI notes. Output:

```ts
interface ChordMatchResult {
  correct: boolean;
  played: { midi: number; degree: DegreeToken | null }[];
  missing: DegreeToken[];          // required but absent
  forbidden: DegreeToken[];        // present but forbidden
  unexpected: number[];            // MIDI notes not mappable under `extras`
  violations: ("bass" | "order" | "span" | "doubling" | "minNotes")[];
}
```

1. Map each MIDI note to a pitch class, then to a degree token via the spec's tone
   table relative to the root (pitch-class level, so enharmonic input is irrelevant —
   MIDI has no spelling anyway).
2. Check required / forbidden / extras.
3. Check doubling, bass (lowest note), `order` (collapse doublings, compare
   bottom-up degree sequence to slots), span, minNotes.
4. `correct` iff no missing, no forbidden, no unexpected, no violations.

### 4.4 Chord capture (segmentation)

Turning a stream of `NoteEvent`s into "the chord the user played". Must support
legato voice leading (common tones held across chords), so we cannot wait for
"all keys released".

State machine over the set of held keys:
- Every note-on (re)starts a `settleMs` timer (default 120 ms). When it expires with no
  new onset → emit a **settled chord** = currently held keys (including keys held over
  from the previous chord). A separate cluster window is unnecessary: the timer reset
  already groups near-simultaneous onsets.
- Note-offs alone never emit a settled chord.
- A settled chord with fewer notes than the spec's minimum (`minNotes`, default =
  number of required tones) is ignored (user is still building it).

**Accept fast, reject slowly.** A settled chord that *matches* is accepted
immediately. A settled chord that does *not* match is only a candidate mistake; it is
**committed** as a mistake when the user releases or changes it (first note-off or
new onset after settling). Committing the same pitch set again in a row is not counted
twice. This lets a learner build a chord finger by finger without burning attempts.

Capture emits `{ kind: "settled" | "committed", notes, t }`; the exercise layer accepts
on a matching `settled` and records an error on a non-matching `committed`.

All thresholds are parameters; expose them in a dev settings panel so they can be
tuned on the real piano. Arpeggiated chords are out of scope until a lesson needs them.

### 4.5 Progression runner

For a sequence of ChordSpecs: evaluate each settled chord against the *current*
expected chord. Match → advance. Committed mismatch (§ 4.4) → record an error for
this chord, stay on it. Configurable `maxAttemptsPerChord` (default 3) after which the chord is
marked failed and the runner advances. Timing against a metronome is a later
milestone; until then only order matters.

### 4.6 Grading → FSRS rating (client-side)

Input: per-chord results, total duration, template `targetSeconds`.

| Rating | Rule |
|---|---|
| `Again` | any chord failed (attempts exhausted), or the whole exercise abandoned |
| `Hard` | all correct but ≥ 1 mistake, or duration > 1.5 × target |
| `Good` | all correct first try, duration ≤ 1.5 × target |
| `Easy` | all correct first try, duration ≤ 0.5 × target |

The UI shows the computed rating and lets the user override it before submitting.
Multiple-choice exercises: wrong answer → `Again`, correct → `Good` (or `Easy` if
under 0.5 × target).

---

## 5. Exercise system

### 5.1 Prompt × response

An exercise is the combination of **how it is presented** and **how it is answered**.
This orthogonality is what gives lessons varied exercise forms without one-off code.

| Prompt kinds | Response kinds |
|---|---|
| `symbol` — "Ebmaj7" / "Dm7 – G7 – Cmaj7" | `play` — play on the piano (evaluated via § 4) |
| `roman` — "ii–V–I in Eb" | `choice` — pick one of N options |
| `notation` — VexFlow staff | |
| `audio` — played via Tone.js (later) | |

Examples from the product brief:
- Progression shown as symbols → play it: `symbol × play`
- Several notation snippets, pick the right progression: `symbol × choice` with
  notation-rendered options
- Only the progression's name is given → play it: `roman × play`

Each exercise **type** registers: Zod schema for its YAML params, a React component,
and an evaluator. Adding a type must not require touching other types.

M1 types: `play_chord`. M2: `play_progression`, `choice_notation`, `name_chord`.

### 5.2 Template YAML

```yaml
id: ii-V-I-shell              # immutable, kebab-case
type: play_progression
title: "ii–V–I mit Shell Voicings"
tags: [ii-V-I, shell, major]
importance: 5                  # 1–5, used by the planner
targetSeconds: 20
estimatedSeconds: 30           # initial planner estimate, replaced by measured EMA
mode: major
keys: all                      # or explicit list: [C, F, Bb]
prompt: { kind: roman }
response: { kind: play }
progression: ["ii:m7", "V:7", "I:maj7"]
voicing: shell
constraints: {}                # optional overrides of the resolved ChordSpec
deprecated: false
```

### 5.3 Cards

A card is one template instantiated in one key (optionally one variant):

```
card_id = "<template_id>@<key>[~<variant>]"     e.g. "ii-V-I-shell@Eb", "triads-minor@Fs"
```

Each card has its own FSRS state. Key tokens are URL-safe ASCII: the § 3.2 names with
`#` written as `s` (`C#` → `Cs`, `F#` → `Fs`, `G#` → `Gs`); flats stay `b`. `#` is never
used in IDs (it is both the variant-separator trap and a URL fragment character).
Key tokens are frozen (§ 3.2).

### 5.4 Content manifest

`apps/web/scripts/build-manifest.ts` reads `content/exercises/*.yaml` and lesson
frontmatter, validates with Zod (including § 3.3 pitch-class collision checks and
roman numeral parsing in every key), and writes `manifest.json`:

```json
{
  "version": "<content hash>",
  "templates": [{ "id", "type", "importance", "estimatedSeconds", "keys", "deprecated", ... }],
  "lessons":   [{ "id", "order", "title", "estimatedMinutes", "introduces": ["template-id"], "prerequisites": [] }]
}
```

The backend loads the same file at startup (path from env) and validates it with
pydantic. The pydantic model covers **only the fields the backend uses** (template id,
mode, importance, estimatedSeconds, keys, deprecated; lesson id, order, introduces,
estimatedMinutes) with `extra="ignore"`, so the full Zod schema is not mirrored by hand.
The web build also writes `manifest.schema.json` via Zod 4's `z.toJSONSchema()` for
reference. A backend test validates the real manifest.

---

## 6. Lessons (MDX)

```mdx
---
id: shell-voicings-intro
title: Shell Voicings
order: 3
estimatedMinutes: 25
introduces: [shell-maj7, shell-m7, shell-dom7]
prerequisites: [seventh-chords-intro]
---

## Warum Shell Voicings?
...
<ChordDemo chord="Dm7" voicing="shell" />

<Exercise id="shell-m7" keyName="D" />
```

MDX components (grow as needed): `ChordDemo` (notation + on-screen keyboard +
playback), `Keyboard`, `Notation`, `Exercise` (renders a template instance inline),
`Callout`.

**Lesson completion** (`POST /lessons/{id}/complete`) creates all cards of the
`introduces` templates in state `new`. In-lesson exercise attempts are logged with
`source: "lesson"` but do not update FSRS state.

---

## 7. Daily planner (server)

Input: `settings.dailyMinutes`, `settings.newCardRatio` (default 0.2),
`settings.desiredRetention` (default 0.9), `settings.timezone` (IANA, default
`Europe/Berlin`), `settings.dayRolloverHour` (default 4).

**Practice day**: runs from `dayRolloverHour` local time to the next day's
`dayRolloverHour`. `day_end` = end of the current practice day.

**Remaining budget** = `dailyMinutes` − sum of `duration_ms` of today's `review_logs`
(source `review`). Reloading the page mid-session therefore never refills the budget.

1. **Due reviews**: cards with `due <= day_end`, not suspended, template not deprecated.
   Score = `importance × (1 − R_now)` where `R_now` is FSRS retrievability at plan time.
   Sort descending.
2. **New cards**: cards in app state `new` (introduced, never reviewed — see § 8.3),
   ordered by lesson order, then key introduction order (§ 3.2), then template
   importance.
3. **Time estimate per card**: EMA of measured durations for that template (from
   `review_logs`), falling back to `estimatedSeconds`.
4. Fill budget: reviews up to `(1 − newCardRatio) × budget`, new cards up to
   `newCardRatio × budget`; unused capacity in either bucket flows to the other.
5. **Ordering within the session**: interleave — avoid the same template twice in a
   row and the same key twice in a row where possible.
6. Response also contains: overflow count (due but not scheduled) and the next
   unlocked lesson, suggested only if it fits the remaining budget.

The plan is computed at session start and returned as an ordered list of card IDs.

---

## 8. Backend

### 8.1 Tables

```
cards          id (pk, text), template_id, key, variant, fsrs_state (json, NULL while new),
               due (datetime, indexed), introduced_at, suspended (bool)
review_logs    id (client-generated uuid, idempotent POST), card_id (indexed), ts, rating,
               duration_ms, attempts, source ("review"|"lesson"), content_version,
               details (json: ChordMatchResults, chosen option, pedal usage, ...)
lesson_progress lesson_id (pk), completed_at
settings       single row: daily_minutes, new_card_ratio, desired_retention,
               timezone, day_rollover_hour
```

`content_version` is the manifest hash at review time, so analytics stay
interpretable after content changes.

`details` must be stored completely — it enables later error analytics
("confuses b7/maj7 in sharp keys").

### 8.2 API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | |
| GET | `/plan` | today's session plan |
| POST | `/reviews` | `{id, card_id, rating, duration_ms, attempts, details, source}` → updates FSRS (if source=review), returns new due. Re-posting the same `id` is a no-op returning the original result |
| GET | `/cards` | filter by template / key / state |
| PATCH | `/cards/{id}` | suspend / unsuspend |
| POST | `/lessons/{id}/complete` | activates cards |
| GET | `/progress` | completed lessons, card counts per state, per-key stats |
| GET / PUT | `/settings` | |

FastAPI generates OpenAPI; the frontend client is generated from it
(`openapi-typescript`). Never hand-write API types on the frontend.

### 8.3 FSRS

Use `py-fsrs` (package `fsrs`, version pinned in `pyproject.toml`) with default
parameters and `desired_retention` from settings. Parameter optimization from logs is a
later milestone (needs several hundred reviews).

Current py-fsrs has **no `New` state** (cards start in `Learning`). "New" is an app
state: `fsrs_state IS NULL`. The first review creates the FSRS card. Card state as
exposed by the API = `new | learning | review | relearning`.

---

## 9. Testing

- **Theory**: table-driven spelling tests for all 12 keys × all qualities × all
  numerals. Include known traps: V7 in Db (Ab–C–Eb–Gb), Cdim7 (C–Eb–Gb–Bbb),
  #9 vs b3, Gb major scale (Cb!).
- **Property tests (fast-check)**:
  - Transposition invariance: if notes N match spec S in key k, then N + n semitones
    match the same template resolved in key k + n.
  - Matching never depends on input order of notes.
  - Doubling a required tone an octave up changes the result only if
    `allowDoubling = false` or a span/order constraint is hit.
- **Chord capture**: synthetic event sequences with realistic timing jitter, legato
  voice leading with held common tones, and recorded fixtures from the real piano.
- **Backend**: planner with frozen time, budget edge cases (no due cards, only new
  cards, overflow, budget already partly spent today, day rollover), manifest
  validation, review → FSRS state transition, idempotent review POST.

---

## 10. Milestones

### M1 — Vertical slice

Split into three slices, each ending with `pnpm check` green.

**M1a — Pure core** (no UI, no backend)
- Monorepo scaffold, `pnpm check` working.
- Theory core (§ 3) with full tests.
- ChordSpec resolution + matcher + chord capture (§ 4.1–4.4) for presets `any`,
  `root_position`, `inversion_*`, `shell`; grading (§ 4.6).
- Manifest build with all validations (§ 5.4, § 3.5 range check).

**M1b — Playable client** (no backend)
- Input: Web MIDI + virtual keyboard + replay; on-screen keyboard showing held keys.
- Exercise type `play_chord` with `symbol` and `roman` prompts, VexFlow display of
  the correct answer after the attempt.
- Dev panel for capture thresholds. Owner can tune them on the real piano here.

**M1c — Backend & practice loop**
- Backend: manifest loading, cards, reviews, FSRS, `/plan` (§ 7, except the
  next-lesson suggestion), settings.
- `POST /lessons/{id}/complete` (API only, UI in M2) so cards can be created; a
  dev button on the practice page calls it for the sample lesson.
- Practice page: run today's plan end-to-end.
- Content: 2–3 templates (e.g. major/minor triads, maj7/m7/7 root position) and one
  short sample lesson (frontmatter only is enough; rendering is M2).

**Acceptance**: on the real piano, the owner completes a daily session of
`play_chord` cards across several keys; reviews are persisted; the next day's plan
reflects them. `pnpm check` passes.

### M2 — Progressions & lessons
- Progression runner, `play_progression`, `guide_tones`, `rootless_a/b`.
- `choice_notation`, `name_chord` exercise types.
- Lesson pages with MDX components, lesson completion, course overview.
- Settings UI.

### M3 — Insight & polish
- Error analytics from `review_logs.details` (per key, per degree).
- Tone.js playback, `audio` prompt kind (ear training).
- Metronome + timing evaluation for progressions.
- FSRS parameter optimization.

### Later
- `AudioInputSource` (Basic Pitch) for the acoustic piano without MIDI.
- Melody/scale exercises, left/right hand split constraints.
- The actual course content (designed separately with the owner).

---

## 11. Open decisions

- Hosting/deployment target (affects token handling and HTTPS — Web MIDI requires a
  secure context; `localhost` is fine for development).
- Practice device: Safari (incl. iPad) has no Web MIDI. If a tablet at the piano is
  wanted, that needs a native wrapper or a different browser — decide before M2.
- Lesson language: German default, confirm before writing the course.
- Whether in-lesson attempts should seed the first FSRS review.
