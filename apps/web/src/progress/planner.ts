/** Daily planner (ARCHITECTURE.md § 7). Pure: all inputs, including `now`, are parameters. */
import type { Lesson, Manifest, ManifestTemplate } from "../exercises/schema";
import { retrievability, stateName, type FsrsCard } from "./scheduler";

const EMA_ALPHA = 0.3;
const MIN_ESTIMATE_SECONDS = 1;
const EPS = 1e-9;

export interface PlannerSettings {
  daily_minutes: number;
  new_card_ratio: number;
  desired_retention: number;
  day_rollover_hour: number;
  new_cards_per_day: number;
  keys_in_progress: number;
}

export interface PlannerCard {
  id: string;
  template_id: string;
  key: string;
  /** null while the card is "new" (never reviewed). */
  fsrs: FsrsCard | null;
  suspended: boolean;
}

export interface LogEntry {
  ts: Date;
  template_id: string;
  duration_ms: number;
  source: "review" | "lesson";
  card_id: string;
}

export interface PlanItem {
  card_id: string;
  template_id: string;
  key: string;
  estimated_seconds: number;
  is_new: boolean;
}

export interface Plan {
  items: PlanItem[];
  overflow: number;
  remaining_seconds: number;
  next_lesson: Lesson | null;
}

/** [dayStart, dayEnd) of the practice day containing `now`, in the browser's local time. */
export function practiceDayBounds(now: Date, rolloverHour: number): [Date, Date] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), rolloverHour);
  if (now < start) start.setDate(start.getDate() - 1);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, rolloverHour);
  return [start, end];
}

function estimates(manifest: Manifest, logs: readonly LogEntry[]): Map<string, number> {
  const byTemplate = new Map<string, LogEntry[]>();
  for (const log of logs) {
    if (log.source !== "review") continue;
    byTemplate.set(log.template_id, [...(byTemplate.get(log.template_id) ?? []), log]);
  }
  const result = new Map<string, number>();
  for (const template of manifest.templates) {
    const entries = [...(byTemplate.get(template.id) ?? [])].sort((a, b) => a.ts.getTime() - b.ts.getTime());
    let ema = template.estimatedSeconds;
    if (entries.length > 0) {
      ema = entries[0]!.duration_ms / 1000;
      for (const e of entries.slice(1)) ema = EMA_ALPHA * (e.duration_ms / 1000) + (1 - EMA_ALPHA) * ema;
    }
    result.set(template.id, Math.max(ema, MIN_ESTIMATE_SECONDS));
  }
  return result;
}

/**
 * Greedy: highest-priority remaining item differing from the previous in template and
 * key; else relax key, then template; else just the highest priority.
 */
export function interleave(items: readonly PlanItem[]): PlanItem[] {
  const remaining = [...items];
  const out: PlanItem[] = [];
  while (remaining.length > 0) {
    let pick = 0;
    const prev = out.at(-1);
    if (prev) {
      const tiers = [
        (i: PlanItem) => i.template_id !== prev.template_id && i.key !== prev.key,
        (i: PlanItem) => i.template_id !== prev.template_id,
        (i: PlanItem) => i.key !== prev.key,
      ];
      for (const ok of tiers) {
        const n = remaining.findIndex(ok);
        if (n >= 0) {
          pick = n;
          break;
        }
      }
    }
    out.push(remaining.splice(pick, 1)[0]!);
  }
  return out;
}

/** Lowest-order visible lesson not completed whose prerequisites are all completed. */
export function nextLesson(manifest: Manifest, completed: ReadonlySet<string>): Lesson | null {
  const sorted = [...manifest.lessons].sort((a, b) => a.order - b.order);
  return sorted.find((l) => !l.hidden && !completed.has(l.id) && l.prerequisites.every((p) => completed.has(p))) ?? null;
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildPlan(
  now: Date,
  settings: PlannerSettings,
  manifest: Manifest,
  cards: readonly PlannerCard[],
  logs: readonly LogEntry[],
  completedLessons: ReadonlySet<string> = new Set(),
): Plan {
  const [dayStart, dayEnd] = practiceDayBounds(now, settings.day_rollover_hour);
  const today = (ts: Date) => dayStart <= ts && ts <= now;
  const spent = logs.filter((l) => l.source === "review" && today(l.ts)).reduce((s, l) => s + l.duration_ms / 1000, 0);
  const budget = Math.max(0, settings.daily_minutes * 60 - spent);

  // Cards whose first review (earliest review-source log) happened this practice day.
  const firstReview = new Map<string, Date>();
  for (const log of logs) {
    if (log.source !== "review" || !log.card_id) continue;
    const prev = firstReview.get(log.card_id);
    if (!prev || log.ts < prev) firstReview.set(log.card_id, log.ts);
  }
  const newToday = [...firstReview.values()].filter(today).length;
  const newLeft = Math.max(0, settings.new_cards_per_day - newToday);
  const est = estimates(manifest, logs);
  const templates = new Map<string, ManifestTemplate>(manifest.templates.map((t) => [t.id, t]));

  // Due reviews, scored by importance x (1 - R_now), descending (stable on card id).
  const scored: [number, PlannerCard][] = [];
  for (const c of cards) {
    const t = templates.get(c.template_id);
    if (!c.fsrs || c.fsrs.due > dayEnd || c.suspended || !t || t.deprecated) continue;
    scored.push([t.importance * (1 - retrievability(c.fsrs, now, settings.desired_retention)), c]);
  }
  scored.sort((a, b) => b[0] - a[0] || byString(a[1].id, b[1].id));

  // New cards: lesson order, key introduction order, importance desc.
  const lessonOrder = new Map<string, number>();
  for (const lesson of manifest.lessons) {
    for (const tid of lesson.introduces) lessonOrder.set(tid, Math.min(lessonOrder.get(tid) ?? lesson.order, lesson.order));
  }
  const newSortKey = (c: PlannerCard): [number, number, number] => {
    const t = templates.get(c.template_id)!;
    const keyIndex = t.keys.indexOf(c.key);
    return [lessonOrder.get(t.id) ?? 1e9, keyIndex < 0 ? t.keys.length : keyIndex, -t.importance];
  };
  const newCards = cards
    .filter((c) => !c.fsrs && !c.suspended && templates.has(c.template_id) && !templates.get(c.template_id)!.deprecated)
    .map((c) => [newSortKey(c), c] as const)
    .sort(([a, ca], [b, cb]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || byString(ca.id, cb.id))
    .map(([, c]) => c);

  const item = (c: PlannerCard, isNew: boolean): PlanItem => ({
    card_id: c.id,
    template_id: c.template_id,
    key: c.key,
    estimated_seconds: est.get(c.template_id)!,
    is_new: isNew,
  });
  const reviewItems = scored.map(([, c]) => item(c, false));
  const newItems = newCards.map((c) => item(c, true));

  const chosen = new Set<string>();
  const inProgress = new Map<string, number>();
  for (const c of cards) {
    if (c.fsrs && (stateName(c.fsrs) === "learning" || stateName(c.fsrs) === "relearning")) {
      inProgress.set(c.template_id, (inProgress.get(c.template_id) ?? 0) + 1);
    }
  }
  let newChosen = 0;
  const used = { review: 0, new: 0 };

  function take(candidates: PlanItem[], bucket: "review" | "new", limit: number, totalLimit: number | null) {
    for (const it of candidates) {
      if (chosen.has(it.card_id)) continue;
      if (it.is_new && (newChosen >= newLeft || (inProgress.get(it.template_id) ?? 0) >= settings.keys_in_progress)) continue;
      if (used[bucket] + it.estimated_seconds > limit + EPS) continue;
      if (totalLimit !== null && used.review + used.new + it.estimated_seconds > totalLimit + EPS) continue;
      chosen.add(it.card_id);
      used[bucket] += it.estimated_seconds;
      if (it.is_new) {
        newChosen += 1;
        inProgress.set(it.template_id, (inProgress.get(it.template_id) ?? 0) + 1);
      }
    }
  }

  take(reviewItems, "review", (1 - settings.new_card_ratio) * budget, null);
  take(newItems, "new", settings.new_card_ratio * budget, null);
  // Unused capacity of either bucket tops up the other (within the total budget).
  take(reviewItems, "review", budget, budget);
  take(newItems, "new", budget, budget);

  const selected = [...reviewItems, ...newItems].filter((i) => chosen.has(i.card_id));
  return {
    items: interleave(selected),
    overflow: reviewItems.filter((i) => !chosen.has(i.card_id)).length,
    remaining_seconds: budget,
    next_lesson: nextLesson(manifest, completedLessons),
  };
}
