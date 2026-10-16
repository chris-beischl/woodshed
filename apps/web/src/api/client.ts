import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "./schema";

type Schemas = components["schemas"];
export type Plan = Schemas["PlanOut"];
export type PlanItem = Schemas["PlanItemOut"];
export type ReviewIn = Schemas["ReviewIn"];
export type ReviewOut = Schemas["ReviewOut"];
export type Settings = Schemas["SettingsModel"];

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN = import.meta.env.VITE_WOODSHED_TOKEN ?? "dev-token";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, `${method} ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const usePlan = () =>
  useQuery({ queryKey: ["plan"], queryFn: () => request<Plan>("GET", "/plan"), staleTime: Infinity });

export function usePostReview() {
  return useMutation({ mutationFn: (r: ReviewIn) => request<ReviewOut>("POST", "/reviews", r), retry: 3 });
}

export function useCompleteLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<Schemas["LessonCompleteOut"]>("POST", `/lessons/${encodeURIComponent(id)}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan"] }),
  });
}
