import { useEffect, useState, type ReactNode } from "react";
import { useSaveSettings, useSettings, type Settings } from "../api/client";
import { useInput } from "../input/store";
import { t } from "../ui/strings";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-baseline">
      <span className="condensed text-lg font-bold">{label}</span>
      <span className="space-y-1">
        {children}
        {hint && <span className="block text-sm text-paper-dim">{hint}</span>}
      </span>
    </label>
  );
}

const input = "w-40 rounded-md border border-night-3 bg-night-2 px-3 py-1.5 tabular-nums";

export function SettingsPage() {
  const settings = useSettings();
  const save = useSaveSettings();
  const { settleMs, setSettleMs } = useInput();
  const [draft, setDraft] = useState<Settings | null>(null);
  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  if (settings.isError) return <p className="text-signal">{t.practice.error}: {settings.error.message}</p>;
  if (!draft) return <p className="text-paper-dim">{t.practice.loading}</p>;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft({ ...draft, [k]: v });
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);

  return (
    <form
      className="max-w-3xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(draft);
      }}
    >
      <h1 className="display text-7xl">{t.settings.title}</h1>
      <Field label={t.settings.dailyMinutes}>
        <input type="number" min={1} max={1440} value={draft.daily_minutes} onChange={num("daily_minutes")} className={input} />
      </Field>
      <Field label={t.settings.newCardsPerDay} hint={t.settings.newCardsPerDayHint}>
        <input type="number" min={0} max={100} value={draft.new_cards_per_day} onChange={num("new_cards_per_day")} className={input} />
      </Field>
      <Field label={t.settings.keysInProgress} hint={t.settings.keysInProgressHint}>
        <input type="number" min={1} max={12} value={draft.keys_in_progress} onChange={num("keys_in_progress")} className={input} />
      </Field>
      <Field label={t.settings.newCardRatio} hint={t.settings.newCardRatioHint}>
        <input type="number" min={0} max={1} step={0.05} value={draft.new_card_ratio} onChange={num("new_card_ratio")} className={input} />
      </Field>
      <Field label={t.settings.retention} hint={t.settings.retentionHint}>
        <input type="number" min={0.7} max={0.99} step={0.01} value={draft.desired_retention} onChange={num("desired_retention")} className={input} />
      </Field>
      <Field label={t.settings.timezone}>
        <input value={draft.timezone} onChange={(e) => set("timezone", e.target.value)} className={`${input} w-56`} />
      </Field>
      <Field label={t.settings.rollover} hint={t.settings.rolloverHint}>
        <input type="number" min={0} max={23} value={draft.day_rollover_hour} onChange={num("day_rollover_hour")} className={input} />
      </Field>
      <Field label={t.dev.settle} hint={t.settings.settleHint}>
        <input type="range" min={30} max={400} step={10} value={settleMs} onChange={(e) => setSettleMs(Number(e.target.value))} className="accent-brass" />
        <span className="ml-3 tabular-nums">{settleMs}</span>
      </Field>
      <div className="flex items-center gap-4 pt-4">
        <button type="submit" disabled={save.isPending} className="rounded-full bg-brass px-7 py-2.5 font-bold text-night hover:bg-brass-deep disabled:opacity-50">
          {t.settings.save}
        </button>
        {save.isSuccess && <span className="text-sage">{t.settings.saved}</span>}
        {save.isError && <span className="text-signal">{save.error.message}</span>}
      </div>
    </form>
  );
}
