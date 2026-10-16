import { useEffect, useRef, useState } from "react";
import { useManifest } from "../content/useManifest";
import { createChordCapture, type CaptureEvent } from "../evaluation/capture";
import { EXERCISE_COMPONENTS } from "../exercises/registry";
import { createRecorder } from "../input/sources";
import { replaySource, subscribeAll, useInput } from "../input/store";
import type { NoteEvent } from "../input/types";
import { parseKeyToken } from "../theory/keys";
import { displayKey } from "../ui/music";
import { t } from "../ui/strings";
import { loc } from "../ui/i18n";

/** Capture tuning, recorder/replay and free play without touching the schedule. */
export function DevPage() {
  const { settleMs, setSettleMs } = useInput();
  const manifest = useManifest();
  const [templateId, setTemplateId] = useState<string>("");
  const [keyToken, setKeyToken] = useState<string>("C");
  const [round, setRound] = useState(0);
  const [log, setLog] = useState<CaptureEvent[]>([]);
  const recorder = useRef<ReturnType<typeof createRecorder> | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const capture = createChordCapture({ settleMs });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const add = (events: CaptureEvent[]) => events.length && setLog((l) => [...events, ...l].slice(0, 12));
    const unsubscribe = subscribeAll((e) => {
      add(capture.push(e));
      if (e.type === "noteOn") {
        clearTimeout(timer);
        timer = setTimeout(() => add(capture.advance(e.t + settleMs)), settleMs + 5);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [settleMs]);

  function toggleRecording() {
    if (!recorder.current) {
      // Record the merged stream so every source (MIDI, virtual) is captured.
      recorder.current = createRecorder(subscribeAll);
      setRecording(true);
      return;
    }
    const events = recorder.current.stop();
    recorder.current = null;
    setRecording(false);
    const url = URL.createObjectURL(new Blob([JSON.stringify(events, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `session-${Date.now()}.json` });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function replay(file: File) {
    replaySource.play(JSON.parse(await file.text()) as NoteEvent[]);
  }

  const template = manifest.data?.templates.find((tpl) => tpl.id === templateId);
  const Exercise = template && EXERCISE_COMPONENTS[template.type];

  return (
    <div className="space-y-6">
      <h1 className="display text-6xl">{t.dev.title}</h1>
      <label className="block">
        {t.dev.settle}: <strong>{settleMs}</strong>
        <input type="range" min={30} max={400} step={10} value={settleMs} onChange={(e) => setSettleMs(Number(e.target.value))} className="ml-3 align-middle accent-brass" />
      </label>

      <div className="flex gap-3">
        <button className="rounded-full border border-night-3 bg-night-2 px-4 py-1.5 hover:border-paper-dim cursor-pointer" onClick={toggleRecording}>
          {recording ? t.dev.stopRecord : t.dev.record}
        </button>
        <label className="rounded-full border border-night-3 bg-night-2 px-4 py-1.5 hover:border-paper-dim cursor-pointer">
          {t.dev.replay}
          <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && replay(e.target.files[0])} />
        </label>
      </div>

      <div>
        <h2 className="condensed text-xl font-bold">{t.dev.events}</h2>
        <ul className="font-mono text-xs text-paper-dim">
          {log.map((e, i) => (
            <li key={i}>{e.t.toFixed(0)} {e.kind} [{e.notes.join(" ")}]</li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="condensed text-xl font-bold">{t.dev.freePlay}</h2>
        <div className="flex gap-3">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="rounded-full border border-night-3 bg-night-2 px-3 py-1.5">
            <option value="">{t.dev.template} …</option>
            {manifest.data?.templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>{loc(tpl.title)}</option>
            ))}
          </select>
          {template && (
            <select value={keyToken} onChange={(e) => setKeyToken(e.target.value)} className="rounded-full border border-night-3 bg-night-2 px-3 py-1.5">
              {template.keys.map((k) => (
                <option key={k} value={k}>{displayKey(parseKeyToken(k, template.mode))}</option>
              ))}
            </select>
          )}
        </div>
        {Exercise && template && template.keys.includes(keyToken) && (
          <Exercise key={`${templateId}@${keyToken}#${round}`} template={template} keyToken={keyToken} onSubmit={() => setRound((r) => r + 1)} />
        )}
      </div>
    </div>
  );
}
