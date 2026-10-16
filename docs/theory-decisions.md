# Theory decisions

Every `THEORY-DECISION:` in code or spec gets an entry here. The owner reviews `open`
entries and sets them to `approved` or `changed`.

| # | Decision | Rationale | Where | Status |
|---|---|---|---|---|
| 1 | Major key set uses Gb, not F# | Jazz lead-sheet convention | `apps/web/src/theory/keys.ts`, ARCHITECTURE § 3.2 | open |
| 2 | A *chromatic* root (numeral with `b`/`#`) that would need a double accidental is respelled enharmonically (fewest accidentals, flats on tie): `bII:7` in Gb → G7, in Db → D7. Diatonic roots are never respelled: `vii:dim7` in G# minor = F##dim7 | Lead sheets never write Abb7; respelling a diatonic root would break functional spelling. Chord tones keep strict letter arithmetic | `apps/web/src/theory/roman.ts`, ARCHITECTURE § 3.5 | open |
| 3 | `any` preset: only the literal `5` is optional; `b5`/`#5` stay required | Altered fifths define dim/aug/m7b5 | `apps/web/src/evaluation/presets.ts` | open |
| 4 | `shell` and `inversion_3` are rejected at build time for triads; `shell` on 6-chords uses `6` as the "7th" | Shell needs a 7th; triads have no 3rd inversion | `apps/web/src/evaluation/presets.ts` | open |
| 5 | Tension table for `extras: allowTensions` (e.g. dom7: b9 9 #9 #11 b13 13; m7: 9 11 13; maj7: 9 #11 13; m7b5: 9 11 b13; dim7: 9 11 b13 7) | Common jazz-pedagogy tension sets; not used by any M1 preset | `apps/web/src/evaluation/tensions.ts` | open |
| 6 | Rootless voicings on 6-chords use only `5` in the "5/13" slot (the 6 is the "7th" slot) | Avoids a duplicate pitch class | `apps/web/src/evaluation/presets.ts` | open |
| 7 | Single-accidental chromatic roots are kept: `bII:7` in Eb = **Fb7** (not E7) | Owner: Fb7 is closer to the theory (bII of Eb is an F-letter chord); only double-accidental roots are respelled | `apps/web/src/theory/roman.ts` | approved |
| 8 | 7sus4: the "3rd" slot is `4` for `inversion_1`, `shell` (1-4-b7) and `guide_tones` (4-b7). Rootless A/B on 7sus4 is rejected | `4` takes the 3rd's role in sus chords. Rootless sus voicings are a different shape (b7-9-11-13), so the 3-7-9 template doesn't apply | `apps/web/src/theory/chords.ts` (`thirdOf`), `apps/web/src/evaluation/presets.ts` | approved (owner); rootless exception open |
| 9 | `guide_tones` on triads is rejected (PresetError), like `shell` | No 7th to guide | `apps/web/src/evaluation/presets.ts` | open |
| 10 | A played note whose pitch class is not in `tones` (and not an allowed tension) is reported as `unexpected`, never as a forbidden degree | `forbidden` only lists tokens the spec names explicitly | `apps/web/src/evaluation/match.ts` | open |
| 11 | Progression runner: a committed mismatch only counts if the same note set settled while the current chord was expected | Releasing the just-accepted chord must not count against the next one | `apps/web/src/evaluation/runner.ts`, ARCHITECTURE § 4.5 | open |
