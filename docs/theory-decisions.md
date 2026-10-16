# Theory decisions

Every `THEORY-DECISION:` in code or spec gets an entry here. The owner reviews `open`
entries and sets them to `approved` or `changed`.

| # | Decision | Rationale | Where | Status |
|---|---|---|---|---|
| 1 | Major key set uses Gb, not F# | Jazz lead-sheet convention | `apps/web/src/theory/keys.ts`, ARCHITECTURE § 3.2 | open |
| 2 | A root that would need a double accidental is respelled enharmonically (fewest accidentals, flats on tie): `bII:7` in Gb → G7, in Db → D7 | Lead sheets never write Abb7; chord tones keep strict letter arithmetic | `apps/web/src/theory/roman.ts`, ARCHITECTURE § 3.5 | open |
| 3 | `any` preset: only the literal `5` is optional; `b5`/`#5` stay required | Altered fifths define dim/aug/m7b5 | `apps/web/src/evaluation/presets.ts` | open |
| 4 | `shell` and `inversion_3` are rejected at build time for triads; `shell` on 6-chords uses `6` as the "7th" | Shell needs a 7th; triads have no 3rd inversion | `apps/web/src/evaluation/presets.ts` | open |
