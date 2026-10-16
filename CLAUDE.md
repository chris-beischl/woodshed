# CLAUDE.md — woodshed

Instructions for Claude Code working in this repository. Read `ARCHITECTURE.md` before
making any structural change; it is the source of truth for the data model, the exercise
system and the evaluation semantics.

## What this is

**woodshed** is a single-user web app for learning piano harmony and jazz piano.
The owner is an intermediate, mostly self-taught pianist who wants to learn theory
systematically and build fluency **in all 12 keys**.

Core loop:
1. Lessons (MDX) teach a concept and embed interactive exercises.
2. The user plays on a real piano (Yamaha Silent piano → USB MIDI). The browser
   evaluates what was played — **all evaluation runs client-side**.
3. Exercises become spaced-repetition cards (FSRS). Progress and scheduling live on
   the server.
4. A daily plan fills a user-defined time budget with the most important due cards.

## Stack

| Area | Choice |
|---|---|
| Frontend | Vite + React + TypeScript (SPA, no Next.js, no SSR) |
| Lessons | MDX via `@mdx-js/rollup` |
| Content validation | Zod (build-time validation of exercise YAML) |
| Notation | VexFlow |
| Audio playback | Tone.js (later milestones) |
| MIDI | Web MIDI API (no wrapper library unless justified) |
| Routing / server state | React Router, TanStack Query |
| Local UI state | Zustand |
| Styling | Tailwind CSS |
| Frontend tests | Vitest, fast-check (property tests) |
| Backend | FastAPI, Python 3.12+, managed with `uv` |
| DB | SQLite via SQLAlchemy 2.x + Alembic (keep it Postgres-compatible) |
| Scheduling | `py-fsrs` (server-side only) |
| Backend tests / lint | pytest, ruff, pyright |
| JS package manager | pnpm |
| Build tooling | `@vitejs/plugin-react`, `tsx` (runs scripts), `yaml` (content parsing), `openapi-typescript` (API types), `remark-frontmatter` + `remark-gfm` (MDX: skip the YAML header, render tables), `@mdx-js/mdx` (lesson compile test) |

Do not add dependencies outside this list without stating why in the PR/commit message.
JSON Schema export uses Zod 4's built-in `z.toJSONSchema()` — no extra library.
TypeScript is pinned to 6.x: TS 7 (native) has no JS compiler API, which `openapi-typescript` needs.

Supported browsers: Chromium-based and Firefox (Web MIDI). Safari/iPad has no Web MIDI.

## Environment variables

| Variable | Used by | Default (dev) |
|---|---|---|
| `WOODSHED_TOKEN` | API auth (bearer) and web client (`VITE_WOODSHED_TOKEN`) | `dev-token` |
| `WOODSHED_MANIFEST` | API: path to `manifest.json` | `../web/public/manifest.json` |
| `WOODSHED_DB` | API: SQLAlchemy URL | `sqlite:///./woodshed.db` |
| `VITE_API_URL` | web: API base URL | `http://localhost:8000` |

## Repository layout

```
woodshed/
├── CLAUDE.md
├── ARCHITECTURE.md
├── docs/theory-decisions.md   # ledger of every THEORY-DECISION (owner reviews)
├── docs/curriculum.md         # course plan: units, lessons, licks, fun mechanics
├── .claude/agents/            # subagent definitions
├── content/
│   ├── exercises/        # *.yaml — exercise templates (stable IDs!)
│   └── lessons/          # *.mdx  — lessons, reference exercises by ID
├── apps/
│   ├── web/              # Vite + React frontend
│   │   ├── scripts/      # build-manifest.ts (YAML → validated manifest.json)
│   │   └── src/
│   │       ├── input/        # InputSource abstraction, Web MIDI, virtual keyboard
│   │       ├── theory/       # PURE: pitch, spelling, intervals, keys, chords, roman numerals
│   │       ├── evaluation/   # PURE: chord capture, ChordSpec matching, progression runner, grading
│   │       ├── exercises/    # exercise type registry: schema + component + evaluator per type
│   │       ├── notation/     # VexFlow wrappers
│   │       ├── lessons/      # MDX components (ChordDemo, Exercise, Keyboard, ...)
│   │       ├── practice/     # daily plan / session UI
│   │       ├── api/          # generated OpenAPI client + TanStack Query hooks
│   │       └── ui/           # shared components
│   └── api/              # FastAPI backend
│       ├── woodshed_api/
│       │   ├── models/       # SQLAlchemy models
│       │   ├── routers/
│       │   ├── scheduling/   # FSRS wrapper, grading → rating mapping is NOT here (client)
│       │   ├── planner/      # daily plan
│       │   └── content/      # manifest loading (pydantic)
│       ├── alembic/
│       └── tests/
└── docker-compose.yml    # optional, for running both apps together
```

## Commands

Define these early and keep them working. **`pnpm check` is the definition of done**:
it runs every test, typecheck and lint in both apps. Run it before claiming a task is finished.

```bash
pnpm install                     # root
pnpm check                       # ALL tests + typecheck + lint, web and api
pnpm --filter web dev            # frontend dev server
pnpm --filter web build          # runs build-manifest first, fails on invalid content
pnpm --filter web test           # vitest
pnpm --filter web typecheck
pnpm --filter web gen:api        # regenerate TS client from FastAPI OpenAPI

cd apps/api
uv sync
uv run fastapi dev woodshed_api/main.py
uv run pytest
uv run ruff check . && uv run ruff format --check .
uv run pyright
uv run alembic upgrade head
```

## Hard rules

### Music theory correctness is the top priority
The user is *learning* from this app. A wrong evaluation teaches wrong theory, and
the user is by definition not yet able to spot it. Therefore:

- **Never derive note names from pitch class alone.** Spelling is done with letter
  arithmetic relative to key and chord root (e.g. V7 in Db is Ab7 with **Gb**, not F#;
  Cdim7 contains **Bbb**). See `ARCHITECTURE.md § Theory core`.
- **Every theory/evaluation test must run across all 12 keys**, not just C.
  Use table-driven tests and property tests (transposition invariance, see
  `ARCHITECTURE.md § Testing`).
- When a theory decision is ambiguous (enharmonics, which tones count as optional,
  voicing definitions), **do not guess silently**. Implement the conservative option,
  leave a `THEORY-DECISION:` comment (`//` in TS, `#` in Python), add an entry to
  `docs/theory-decisions.md` (status `open`), and list it in your summary so the owner
  can review it.

### Purity boundaries
- `src/theory/` and `src/evaluation/` are pure TypeScript: no React, no DOM, no
  Web MIDI, no `Date.now()` (timestamps are passed in). They must be fully unit-testable.
- Input devices only emit `NoteEvent`s through the `InputSource` interface. Evaluation
  never knows whether notes came from MIDI, the virtual keyboard or (later) audio.

### Content IDs are immutable
- Exercise template IDs and lesson IDs are persisted in the database. **Never rename
  them.** To change an exercise's meaning, create a new ID and mark the old one
  `deprecated: true`.
- Key tokens inside card IDs (`Db`, `Fs`, …, see `ARCHITECTURE.md § 5.3`) are frozen
  too. Changing the key set requires an Alembic data migration.
- Lessons reference exercises by ID; exercises are never defined inside MDX.

### Scheduling lives on the server
- The client computes the *grade* (Again/Hard/Good/Easy) from the evaluation result and
  sends it with the raw details. The server owns FSRS state and the daily plan.

### Testability without a piano
- Claude Code cannot play the piano. Everything must be testable via synthetic
  `NoteEvent` sequences. Keep a virtual on-screen/computer-keyboard input for manual
  testing, and support replaying recorded MIDI sessions from JSON fixtures
  (`apps/web/src/input/fixtures/`).

## Conventions

- Code, identifiers, comments, commit messages: English.
- UI text and lesson content: German by default (jazz terminology stays English:
  "Shell Voicing", "Guide Tones", "ii–V–I"). Keep UI strings in one place so this can
  change later.
- TypeScript `strict: true`. No `any` in `theory/` or `evaluation/`.
- Python: full type hints, pydantic models for all API I/O.
- Small, focused commits. Each milestone in `ARCHITECTURE.md` ends with passing tests,
  typecheck and lint.
- When you finish a task, summarize: what changed, any `THEORY-DECISION`s made,
  and anything the owner should verify on the real piano.

## Current milestone

M1 is done. Next: **M2a** (`ARCHITECTURE.md § 10`), which serves curriculum units 1–2
(`docs/curriculum.md`). Do not build ahead into later milestones before the current one
passes `pnpm check`.

Every exercise needs a playful hook (`docs/curriculum.md § Fun mechanics`); a drill
without one is not done.

## Agents

Subagents live in `.claude/agents/`:
- `theory-oracle` — writes theory/evaluation tests from the spec only (never reads the
  implementation first) and reviews every change to `theory/`, `evaluation/`, `content/`.
- `web-builder` — implements `apps/web`.
- `api-builder` — implements `apps/api`.

The main session owns the shared contracts (manifest schema, OpenAPI models,
`NoteEvent`/`ChordSpec` types) and merges. Web and API work run in parallel only after
those contracts are fixed.
