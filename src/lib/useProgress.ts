import { useState } from "react";
import { ProgressCategory } from "@/types/data";

const STORAGE_KEY = "arcraiders-progress-v1";

export type ProgressMap = Record<string, number>;

export const makeProgressKey = (
  category: ProgressCategory,
  entityId: string,
  stageId: string,
  itemId: string,
) => `${category}|${entityId}|${stageId}|${itemId}`;

const readInitialState = (): ProgressMap => {
  if (typeof window === "undefined") return {};
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn("Could not parse saved progress", error);
    }
  }
  return {};
};

export function useProgress() {
  const [progress, setProgress] = useState<ProgressMap>(readInitialState);

  const persist = (next: ProgressMap) => {
    setProgress(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  };

  const setValue = (key: string, value: number) => {
    const clamped = Math.max(0, value);
    persist({ ...progress, [key]: clamped });
  };

  const increment = (key: string, delta: number, max?: number) => {
    const current = progress[key] ?? 0;
    const next = max !== undefined ? Math.min(max, current + delta) : current + delta;
    setValue(key, next);
  };

  const clear = () => persist({});

  return {
    progress,
    setValue,
    increment,
    clear,
    getValue: (key: string) => progress[key] ?? 0,
  };
}

