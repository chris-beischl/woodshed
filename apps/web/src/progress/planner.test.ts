import { describe, expect, it } from "vitest";
import type { Lesson, Manifest, ManifestTemplate } from "../exercises/schema";
import { buildPlan, interleave, practiceDayBounds, type LogEntry, type PlanItem, type PlannerCard, type PlannerSettings } from "./planner";
import { review, type FsrsCard, type RatingName } from "./scheduler";

// vite.config.ts pins TZ=Europe/Berlin for these tests.
const KEYS = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B", "E", "A", "D", "G"];
const NOW = new Date("2026-03-10T10:00:00Z"); // 11:00 Berlin
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const settings = (o: Partial<PlannerSettings> = {}): PlannerSettings => ({
  daily_minutes: 30,
  new_card_ratio: 0.2,
  desired_retention: 0.9,
  day_rollover_hour: 4,
  new_cards_per_day: 10,
  keys_in_progress: 4,
  ...o,
});
const SETTINGS = settings();
const BIG = settings({ daily_minutes: 600, new_card_ratio: 1, new_cards_per_day: 100 }); // budget never binds

const tpl = (id: string, importance: number, keys: string[], deprecated = false): ManifestTemplate => ({
  id,
  type: "play_chord",
  title: id,
  tags: [],
  importance,
  targetSeconds: 8,
  estimatedSeconds: 10,
  mode: "major",
  keys,
  prompt: { kind: "symbol" },
  response: { kind: "play" },
  deprecated,
  params: {},
});
const lesson = (id: string, order: number, o: Partial<Lesson> = {}): Lesson => ({
  id,
  title: id,
  order,
  estimatedMinutes: 10,
  unit: 1,
  introduces: [],
  prerequisites: [],
  hidden: false,
  ...o,
});
const manifest: Manifest = {
  version: "test",
  templates: [tpl("triads-major", 5, KEYS), tpl("triads-minor", 4, KEYS), tpl("old-thing", 3, ["C", "F"], true), tpl("orphan", 2, ["C", "F"])],
  lessons: [
    lesson("triads-intro", 1, { introduces: ["triads-major"] }),
    lesson("minor-intro", 2, { introduces: ["triads-minor", "old-thing", "orphan"], prerequisites: ["triads-intro"] }),
  ],
};

const newCard = (template: string, key: string): PlannerCard => ({ id: `${template}@${key}`, template_id: template, key, fsrs: null, suspended: false });

function reviewedCard(template: string, key: string, reviewedAt: Date, rating: RatingName = "good", times = 3): PlannerCard {
  let fsrs: FsrsCard | null = null;
  let t = reviewedAt;
  for (let i = 0; i < times; i++) {
    fsrs = review(fsrs, rating, t, 0.9);
    t = fsrs.due;
  }
  return { ...newCard(template, key), fsrs };
}

/** A card forced into learning (1) or relearning (3), due far in the future. */
function inProgressCard(template: string, key: string, state: 1 | 3): PlannerCard {
  const c = reviewedCard(template, key, ago(5 * DAY), "good", 1);
  return { ...c, fsrs: { ...c.fsrs!, state, due: new Date(NOW.getTime() + 30 * DAY) } };
}

const log = (ts: Date, duration_ms: number, source: LogEntry["source"] = "review", card_id = "", template_id = "triads-major"): LogEntry => ({
  ts,
  template_id,
  duration_ms,
  source,
  card_id,
});
const ids = (items: PlanItem[]) => items.map((i) => i.card_id);
const newIds = (items: PlanItem[]) => items.filter((i) => i.is_new).map((i) => i.card_id).sort();

describe("practiceDayBounds", () => {
  it("starts at the rollover hour; earlier hours belong to the previous day", () => {
    expect(practiceDayBounds(NOW, 4)).toEqual([new Date("2026-03-10T03:00:00Z"), new Date("2026-03-11T03:00:00Z")]);
    expect(practiceDayBounds(new Date("2026-03-10T02:00:00Z"), 4)).toEqual([new Date("2026-03-09T03:00:00Z"), new Date("2026-03-10T03:00:00Z")]);
  });

  it("follows DST", () => {
    // DST starts 2026-03-29 in Berlin: 04:00 CEST = 02:00Z.
    expect(practiceDayBounds(new Date("2026-03-29T12:00:00Z"), 4)).toEqual([new Date("2026-03-29T02:00:00Z"), new Date("2026-03-30T02:00:00Z")]);
  });
});

describe("buildPlan", () => {
  it("is empty without cards", () => {
    const plan = buildPlan(NOW, SETTINGS, manifest, [], []);
    expect(plan.items).toEqual([]);
    expect(plan.overflow).toBe(0);
    expect(plan.remaining_seconds).toBe(1800);
  });

  it("schedules only new cards, starting with the first lesson's first key", () => {
    const cards = [newCard("orphan", "C"), newCard("triads-minor", "C"), ...["G", "C", "F"].map((k) => newCard("triads-major", k))];
    const plan = buildPlan(NOW, SETTINGS, manifest, cards, []);
    expect(plan.items.every((i) => i.is_new)).toBe(true);
    expect(new Set(ids(plan.items))).toEqual(new Set(cards.map((c) => c.id)));
    expect(plan.items[0]!.card_id).toBe("triads-major@C");
  });

  it("orders new cards by lesson, then key introduction order", () => {
    const s = settings({ daily_minutes: 1, new_card_ratio: 1 }); // 60s: 6 cards fit
    const cards = [newCard("orphan", "C"), newCard("triads-minor", "C"), ...["G", "C", "F", "Bb"].map((k) => newCard("triads-major", k))];
    expect(new Set(ids(buildPlan(NOW, s, manifest, cards, []).items))).toEqual(new Set(cards.map((c) => c.id)));
    // 30s already spent today: the earliest lesson's first keys win.
    const plan = buildPlan(NOW, s, manifest, cards, [log(ago(MIN), 30_000, "review", "", "x")]);
    expect(new Set(ids(plan.items))).toEqual(new Set(["triads-major@C", "triads-major@F", "triads-major@Bb"]));
  });

  it("scores due reviews and excludes future ones", () => {
    const future = reviewedCard("triads-major", "F", NOW, "good", 4);
    expect(future.fsrs!.due.getTime()).toBeGreaterThan(NOW.getTime() + 2 * DAY);
    const cards = [reviewedCard("triads-major", "C", ago(30 * DAY)), reviewedCard("triads-minor", "C", ago(30 * DAY)), future];
    const plan = buildPlan(NOW, SETTINGS, manifest, cards, []);
    expect(ids(plan.items)).toEqual(["triads-major@C", "triads-minor@C"]);
    expect(plan.overflow).toBe(0);
  });

  it("includes cards due before the practice day ends", () => {
    const c = reviewedCard("triads-major", "C", ago(DAY), "good", 1);
    const dueAt = (ms: number): PlannerCard => ({ ...c, fsrs: { ...c.fsrs!, due: new Date(NOW.getTime() + ms) } });
    expect(ids(buildPlan(NOW, SETTINGS, manifest, [dueAt(10 * HOUR)], []).items)).toEqual([c.id]); // day ends 03:00Z
    expect(buildPlan(NOW, SETTINGS, manifest, [dueAt(20 * HOUR)], []).items).toEqual([]);
  });

  it("skips deprecated templates and suspended cards", () => {
    const suspended = { ...reviewedCard("triads-major", "C", ago(30 * DAY)), suspended: true };
    const cards = [reviewedCard("old-thing", "C", ago(30 * DAY)), suspended, newCard("old-thing", "F")];
    expect(buildPlan(NOW, SETTINGS, manifest, cards, []).items).toEqual([]);
  });

  it("counts due cards that do not fit as overflow", () => {
    const s = settings({ daily_minutes: 1 }); // 60s: 6 cards of 10s
    const cards = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B"].map((k) => reviewedCard("triads-major", k, ago(30 * DAY)));
    const plan = buildPlan(NOW, s, manifest, cards, []);
    expect(plan.items).toHaveLength(6);
    expect(plan.overflow).toBe(2);
  });

  it("subtracts today's review time from the budget", () => {
    const logs = [log(ago(HOUR), 600_000), log(ago(2 * HOUR), 60_000, "lesson"), log(ago(DAY), 600_000)];
    expect(buildPlan(NOW, SETTINGS, manifest, [], logs).remaining_seconds).toBe(1200);
    const plan = buildPlan(NOW, SETTINGS, manifest, [newCard("triads-major", "C")], [log(ago(HOUR), 3_600_000)]);
    expect(plan.remaining_seconds).toBe(0);
    expect(plan.items).toEqual([]);
  });

  it("assigns logs before the rollover hour to the previous day", () => {
    const now = new Date("2026-03-10T02:00:00Z"); // 03:00 Berlin: practice day of the 9th
    const logs = [log(new Date("2026-03-09T20:00:00Z"), 300_000), log(new Date("2026-03-09T01:00:00Z"), 300_000)];
    expect(buildPlan(now, SETTINGS, manifest, [], logs).remaining_seconds).toBe(1500);
  });

  it("estimates durations with an EMA in chronological order", () => {
    const logs = [log(ago(2 * DAY), 20_000), log(ago(3 * DAY), 10_000)];
    // 10s then 20s: 0.3*20 + 0.7*10 = 13
    expect(buildPlan(NOW, SETTINGS, manifest, [newCard("triads-major", "C")], logs).items[0]!.estimated_seconds).toBeCloseTo(13, 9);
    expect(buildPlan(NOW, SETTINGS, manifest, [newCard("triads-minor", "C")], logs).items[0]!.estimated_seconds).toBe(10);
  });

  it("skips cards that do not fit and keeps filling", () => {
    const s = settings({ daily_minutes: 1, new_card_ratio: 0.5 });
    const plan = buildPlan(NOW, s, manifest, [newCard("triads-major", "C"), newCard("triads-minor", "C")], [log(ago(2 * DAY), 100_000)]);
    expect(ids(plan.items)).toEqual(["triads-minor@C"]);
  });

  it("splits the budget into buckets and tops up unused capacity", () => {
    const s = settings({ daily_minutes: 1, new_card_ratio: 0.5 }); // 30s reviews, 30s new
    const reviews = ["C", "F", "Bb", "Eb", "Ab"].map((k) => reviewedCard("triads-major", k, ago(30 * DAY)));
    const news = ["C", "F", "Bb", "Eb", "Ab"].map((k) => newCard("triads-minor", k));
    const plan = buildPlan(NOW, s, manifest, [...reviews, ...news], []);
    expect(plan.items.filter((i) => !i.is_new)).toHaveLength(3);
    expect(plan.items.filter((i) => i.is_new)).toHaveLength(3);
    expect(buildPlan(NOW, s, manifest, reviews, []).items).toHaveLength(5);
    expect(buildPlan(NOW, s, manifest, [...reviews, news[0]!], []).items).toHaveLength(6);
  });

  it("caps new cards per day", () => {
    const cards = KEYS.map((k) => newCard("triads-major", k));
    const s = settings({ daily_minutes: 600, new_card_ratio: 1, new_cards_per_day: 3, keys_in_progress: 12 });
    expect(newIds(buildPlan(NOW, s, manifest, cards, []).items)).toHaveLength(3);
    expect(buildPlan(NOW, { ...s, new_cards_per_day: 0 }, manifest, cards, []).items).toEqual([]);
  });

  it("counts toward the cap only cards first reviewed today", () => {
    const s = settings({ daily_minutes: 600, new_card_ratio: 1, new_cards_per_day: 3, keys_in_progress: 12 });
    const today = ago(HOUR);
    const logs = [
      log(today, 5000, "review", "triads-major@C"),
      log(today, 5000, "review", "triads-major@F"),
      // reviewed again today, but first reviewed yesterday: not counted
      log(ago(DAY), 5000, "review", "triads-major@Bb"),
      log(today, 5000, "review", "triads-major@Bb"),
      log(today, 5000, "lesson", "triads-major@Eb"), // lesson attempts are not reviews
    ];
    const plan = buildPlan(NOW, s, manifest, KEYS.slice(3).map((k) => newCard("triads-major", k)), logs);
    expect(newIds(plan.items)).toHaveLength(1);
  });

  it("unlocks keys gradually", () => {
    const plan = buildPlan(NOW, BIG, manifest, KEYS.map((k) => newCard("triads-major", k)), []);
    expect(newIds(plan.items)).toEqual(KEYS.slice(0, 4).map((k) => `triads-major@${k}`).sort());
  });

  it("counts learning and relearning cards as keys in progress", () => {
    const fresh = KEYS.slice(2).map((k) => newCard("triads-major", k));
    for (const inProgress of [
      [inProgressCard("triads-major", "C", 1), inProgressCard("triads-major", "F", 1)],
      [inProgressCard("triads-major", "C", 1), inProgressCard("triads-major", "F", 3)],
    ]) {
      expect(newIds(buildPlan(NOW, BIG, manifest, [...fresh, ...inProgress], []).items)).toEqual(["triads-major@Bb", "triads-major@Eb"]);
    }
  });

  it("does not count review-state cards as in progress", () => {
    const settled = KEYS.slice(0, 2).map((k) => reviewedCard("triads-major", k, ago(30 * DAY)));
    expect(settled.every((c) => c.fsrs!.state === 2)).toBe(true);
    const plan = buildPlan(NOW, BIG, manifest, [...KEYS.slice(2).map((k) => newCard("triads-major", k)), ...settled], []);
    expect(newIds(plan.items)).toHaveLength(4);
  });

  it("combines the daily cap with the key unlock across templates", () => {
    // cap 6: major takes its 4 (unlock limit), minor gets the remaining 2.
    const s = settings({ daily_minutes: 600, new_card_ratio: 1, new_cards_per_day: 6 });
    const cards = ["triads-major", "triads-minor"].flatMap((t) => KEYS.map((k) => newCard(t, k)));
    expect(newIds(buildPlan(NOW, s, manifest, cards, []).items)).toEqual(
      [...KEYS.slice(0, 4).map((k) => `triads-major@${k}`), ...KEYS.slice(0, 2).map((k) => `triads-minor@${k}`)].sort(),
    );
  });
});

describe("next lesson", () => {
  const nxt = (m: Manifest, done: string[]) => buildPlan(NOW, SETTINGS, m, [], [], new Set(done)).next_lesson?.id ?? null;

  it("is the lowest-order lesson whose prerequisites are done", () => {
    expect(nxt(manifest, [])).toBe("triads-intro");
    expect(nxt(manifest, ["triads-intro"])).toBe("minor-intro");
    expect(nxt(manifest, ["triads-intro", "minor-intro"])).toBeNull();
    expect(nxt(manifest, ["minor-intro"])).toBe("triads-intro");
  });

  it("skips hidden lessons and unmet prerequisites", () => {
    const m: Manifest = {
      version: "v",
      templates: [],
      lessons: [lesson("a", 1, { hidden: true }), lesson("b", 2, { prerequisites: ["c"] }), lesson("c", 3)],
    };
    expect(nxt(m, [])).toBe("c");
    expect(nxt(m, ["c"])).toBe("b");
    expect(nxt(m, ["c", "b"])).toBeNull();
  });
});

describe("interleave", () => {
  const item = (template: string, key: string): PlanItem => ({ card_id: `${template}@${key}`, template_id: template, key, estimated_seconds: 10, is_new: false });

  it("avoids the same template or key twice in a row", () => {
    const items = ["a", "b"].flatMap((t) => ["C", "F", "G"].map((k) => item(t, k)));
    const out = interleave(items);
    expect(ids(out).sort()).toEqual(ids(items).sort());
    out.slice(1).forEach((n, i) => {
      expect(n.template_id).not.toBe(out[i]!.template_id);
      expect(n.key).not.toBe(out[i]!.key);
    });
  });

  it("relaxes the rule when it cannot be met", () => {
    expect(ids(interleave([item("a", "C"), item("a", "F"), item("a", "G")]))).toEqual(["a@C", "a@F", "a@G"]);
    expect(interleave([item("a", "C"), item("a", "C"), item("a", "F")]).map((i) => i.key)).toEqual(["C", "F", "C"]);
  });
});
