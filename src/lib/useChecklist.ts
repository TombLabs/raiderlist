import { useState } from "react";

type ChecklistLink = { key: string; need: number };

type ChecklistItem = {
  itemId: string;
  name: string;
  total: number;
  have: number;
  links: ChecklistLink[];
};

type ChecklistMap = Record<string, ChecklistItem>;

const STORAGE_KEY = "arcraiders-checklist-v1";

const readInitial = (): ChecklistMap => {
  if (typeof window === "undefined") return {};
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return {};
  try {
    return JSON.parse(saved) as ChecklistMap;
  } catch {
    return {};
  }
};

export function useChecklist() {
  const [items, setItems] = useState<ChecklistMap>(readInitial);

  const persist = (next: ChecklistMap) => {
    setItems(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  };

  const add = (itemId: string, name: string, quantity: number, key?: string) => {
    const existing = items[itemId];
    const nextTotal = (existing?.total ?? 0) + quantity;
    const links: ChecklistLink[] = key ? [...(existing?.links ?? []), { key, need: quantity }] : existing?.links ?? [];
    const next: ChecklistItem = {
      itemId,
      name,
      total: nextTotal,
      have: existing?.have ?? 0,
      links,
    };
    persist({ ...items, [itemId]: next });
  };

  const setHave = (itemId: string, have: number) => {
    const target = items[itemId];
    if (!target) return;
    const clamped = Math.max(0, Math.min(have, target.total));
    persist({
      ...items,
      [itemId]: { ...target, have: clamped },
    });
  };

  const incrementHave = (itemId: string, delta: number) => {
    const target = items[itemId];
    if (!target) return;
    setHave(itemId, target.have + delta);
  };

  const remove = (itemId: string) => {
    const copy = { ...items };
    delete copy[itemId];
    persist(copy);
  };

  const clear = () => persist({});

  return { items, add, setHave, incrementHave, remove, clear };
}

