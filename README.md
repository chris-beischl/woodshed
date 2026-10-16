# woodshed

Learn piano harmony and jazz piano **in all 12 keys** – in the browser, with your own
piano. Play on a MIDI keyboard (or the on-screen keyboard) and woodshed checks what you
played: chords, progressions, scales and theory quizzes, with correct spelling in every
key (A♭7 has a G♭, not an F♯).

- **Course** – lessons that build on each other, each with playable exercises.
- **Free practice** – every exercise at any time, in any key, no lesson needed.
- **Daily practice** – spaced repetition (FSRS) fills your daily time budget with what's due.
- **German and English** – switch in the header.

Everything runs in your browser. No account, no server: progress lives in this browser's
storage. Back it up under *Settings → Back up progress*.

**Browsers:** Chrome, Edge or Firefox (Web MIDI). Safari and iPad have no Web MIDI – on an
iPad, use a Web MIDI browser app from the App Store, or the on-screen keyboard.

## Deutsch

Klavier-Harmonik und Jazz-Piano in allen 12 Tonarten lernen, direkt im Browser mit dem
eigenen Klavier per MIDI. Kurs, freie Übungen und ein täglicher Übungsplan. Der
Fortschritt bleibt in deinem Browser (Sicherung unter *Einstellungen*).

## Development

```bash
pnpm install
pnpm --filter web dev     # dev server
pnpm check                # manifest build + typecheck + tests (definition of done)
pnpm --filter web build   # static site in apps/web/dist
```

Content lives in `content/` (exercise YAML, lesson MDX; every lesson has a German
`<id>.mdx` and an English `<id>.en.mdx`). Pushing to `main` deploys to GitHub Pages.
See `ARCHITECTURE.md` for the design and `CLAUDE.md` for working rules.
