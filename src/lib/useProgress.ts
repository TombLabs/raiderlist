import { useState } from "react";
import { ProgressCategory } from "@/types/data";

export type ProgressMap = Record<string, number>;

const STORAGE_KEY = "arcraiders-progress-v1";

const readInitial = (): ProgressMap => {
  if (typeof window === "undefined") return {};
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return {};
  try {
    return JSON.parse(saved) as ProgressMap;
  } catch {
    return {};
  }
};

export const makeProgressKey = (
  category: ProgressCategory,
  entityId: string,
  stageId: string,
  itemId: string,
) => `${category}|${entityId}|${stageId}|${itemId}`;

export function useProgress() {
  const [progress, setProgress] = useState<ProgressMap>(readInitial);

  const persist = (next: ProgressMap) => {
    setProgress(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  };

  const setValue = (key: string, value: number) => {
    persist({ ...progress, [key]: Math.max(0, value) });
  };

  const increment = (key: string, delta: number, max?: number) => {
    const current = progress[key] ?? 0;
    const next = max !== undefined ? Math.min(max, current + delta) : current + delta;
    setValue(key, next);
  };

  const clear = () => persist({});

  return { progress, getValue: (key: string) => progress[key] ?? 0, setValue, increment, clear };
}

