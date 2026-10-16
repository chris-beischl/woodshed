/** Progress persistence in the browser (localStorage) behind TanStack Query hooks. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useManifest } from "../content/useManifest";
import type { Plan } from "./planner";
import { applyReview, completeLesson, emptyLearner, learnerSchema, planFor, type Learner, type ReviewIn, type Settings } from "./state";

export type { Plan, PlanItem } from "./planner";
export type { ReviewIn, Settings } from "./state";

const STORAGE_KEY = "woodshed.progress.v1";

/** Throws on corrupt data instead of starting over, so a bad blob is never overwritten. */
function load(): Learner {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? emptyLearner() : learnerSchema.parse(JSON.parse(raw));
}

function save(learner: Learner): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(learner));
}

function update<T>(fn: (l: Learner) => { learner: Learner; result: T }): T {
  const { learner, result } = fn(load());
  save(learner);
  return result;
}

/** The plan is computed once per session start (ARCHITECTURE § 7), not after every review. */
export function usePlan() {
  const manifest = useManifest();
  return useQuery({
    queryKey: ["plan"],
    queryFn: (): Plan => planFor(load(), manifest.data!, new Date()),
    enabled: manifest.isSuccess,
    staleTime: Infinity,
  });
}

export function usePostReview() {
  return useMutation({
    mutationFn: async (r: ReviewIn) => update((l) => ({ learner: applyReview(l, r, new Date()), result: undefined })),
  });
}

export function useCompleteLesson() {
  const qc = useQueryClient();
  const manifest = useManifest();
  return useMutation({
    mutationFn: async (id: string) =>
      update((l) => {
        const { learner, cards_created } = completeLesson(l, manifest.data!, id, new Date());
        return { learner, result: { cards_created } };
      }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["plan"] }), qc.invalidateQueries({ queryKey: ["progress"] })]),
  });
}

export const useProgress = () =>
  useQuery({ queryKey: ["progress"], queryFn: () => ({ completed_lessons: load().completed_lessons }) });

export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => load().settings });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Settings) => update((l) => ({ learner: { ...l, settings: s }, result: s })),
    onSuccess: (s) => {
      qc.setQueryData(["settings"], s);
      return qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}

/** Downloads all progress as a JSON backup file. */
export function exportProgress(): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(load(), null, 1)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `woodshed-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(url);
}

/** Replaces all progress with a backup file; validated before anything is overwritten. */
export function useImportProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => save(learnerSchema.parse(JSON.parse(await file.text()))),
    onSuccess: () => qc.invalidateQueries(),
  });
}
