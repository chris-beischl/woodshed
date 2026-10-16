/**
 * Everything the app remembers about one learner (ARCHITECTURE.md § 8). Pure: the
 * browser storage layer (client.ts) loads, saves and backs this up as JSON.
 */
import { z } from "zod";
import type { Manifest } from "../exercises/schema";
import { buildPlan, type Plan } from "./planner";
import { review, type RatingName } from "./scheduler";

const fsrsCardSchema = z.object({
  due: z.coerce.date(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  last_review: z.coerce.date().optional(),
});

export const settingsSchema = z.object({
  daily_minutes: z.number().int().min(1).max(1440).default(30),
  new_card_ratio: z.number().min(0).max(1).default(0.2),
  desired_retention: z.number().min(0.7).max(0.99).default(0.9),
  day_rollover_hour: z.number().int().min(0).max(23).default(4),
  new_cards_per_day: z.number().int().min(0).max(100).default(10),
  keys_in_progress: z.number().int().min(1).max(12).default(4),
});

const rating = z.enum(["again", "hard", "good", "easy"]);
const source = z.enum(["review", "lesson"]);

export const learnerSchema = z.object({
  version: z.literal(1),
  cards: z.record(
    z.string(),
    z.object({
      template_id: z.string(),
      key: z.string(),
      fsrs: fsrsCardSchema.nullable(),
      suspended: z.boolean(),
      introduced_at: z.coerce.date(),
    }),
  ),
  // shortcut: logs keep only what the planner reads (no attempt details) so years of
  // reviews fit in localStorage's ~5 MB; move to IndexedDB if error analytics need them.
  logs: z.array(z.object({ ts: z.coerce.date(), card_id: z.string(), rating, duration_ms: z.number(), source })),
  completed_lessons: z.array(z.string()),
  settings: settingsSchema.prefault({}),
});

export type Learner = z.infer<typeof learnerSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export const emptyLearner = (): Learner => learnerSchema.parse({ version: 1, cards: {}, logs: [], completed_lessons: [] });

export interface ReviewIn {
  card_id: string;
  rating: RatingName;
  duration_ms: number;
  source: z.infer<typeof source>;
}

/** Logs the attempt; only "review" attempts on existing cards move FSRS state. */
export function applyReview(learner: Learner, r: ReviewIn, now: Date): Learner {
  const logs = [...learner.logs, { ts: now, ...r }];
  const card = learner.cards[r.card_id];
  if (r.source !== "review" || !card) return { ...learner, logs };
  const fsrs = review(card.fsrs, r.rating, now, learner.settings.desired_retention);
  return { ...learner, logs, cards: { ...learner.cards, [r.card_id]: { ...card, fsrs } } };
}

/** Marks the lesson done and creates a "new" card per introduced template × key. */
export function completeLesson(learner: Learner, manifest: Manifest, lessonId: string, now: Date): { learner: Learner; cards_created: number } {
  const lesson = manifest.lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);
  const cards = { ...learner.cards };
  let created = 0;
  for (const tid of lesson.introduces) {
    const template = manifest.templates.find((t) => t.id === tid);
    if (!template || template.deprecated) continue;
    for (const key of template.keys) {
      const id = `${template.id}@${key}`;
      if (cards[id]) continue;
      cards[id] = { template_id: template.id, key, fsrs: null, suspended: false, introduced_at: now };
      created += 1;
    }
  }
  const completed = learner.completed_lessons.includes(lessonId) ? learner.completed_lessons : [...learner.completed_lessons, lessonId];
  return { learner: { ...learner, cards, completed_lessons: completed }, cards_created: created };
}

export function planFor(learner: Learner, manifest: Manifest, now: Date): Plan {
  const cards = Object.entries(learner.cards).map(([id, c]) => ({ id, ...c }));
  const templateOf = new Map(cards.map((c) => [c.id, c.template_id]));
  const logs = learner.logs.flatMap((l) => {
    const template_id = templateOf.get(l.card_id);
    return template_id ? [{ ...l, template_id }] : [];
  });
  return buildPlan(now, learner.settings, manifest, cards, logs, new Set(learner.completed_lessons));
}
