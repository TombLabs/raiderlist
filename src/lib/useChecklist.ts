import { useState } from "react";
import quests from "@/data/quests-scraped.json";
import projects from "@/data/projects.json";
import workbench from "@/data/workbench.json";
import { Project, Quest, WorkbenchUpgrade } from "@/types/data";

type ChecklistLink = { key: string; need: number; source: string };

export type ChecklistItem = {
  itemId: string;
  name: string;
  total: number;
  have: number;
  links: ChecklistLink[];
};

type ChecklistMap = Record<string, ChecklistItem>;

const STORAGE_KEY = "arcraiders-checklist-v1";

const questData = quests as Quest[];
const projectData = projects as Project[];
const workbenchData = workbench as WorkbenchUpgrade[];

const sourceIndex: Record<string, string[]> = {};
const indexReqs = (label: string, requirements: { itemId: string }[]) => {
  requirements.forEach((r) => {
    if (!sourceIndex[r.itemId]) sourceIndex[r.itemId] = [];
    sourceIndex[r.itemId].push(label);
  });
};

questData.forEach((q) => q.stages?.forEach((s) => indexReqs(`Quest: ${q.name}`, s.requirements)));
projectData.forEach((p) => p.stages?.forEach((s) => indexReqs(`Project: ${p.name}`, s.requirements)));
workbenchData.forEach((w) => indexReqs(`Workbench: ${w.name}`, w.requirements));

const migrate = (raw: unknown): ChecklistMap => {
  if (!raw || typeof raw !== "object") return {};
  const map = raw as Record<string, ChecklistItem | undefined>;
  const next: ChecklistMap = {};
  Object.keys(map).forEach((key) => {
    const entry = map[key] as Partial<ChecklistItem> | undefined;
    const links = Array.isArray(entry?.links)
      ? entry.links.map((l) => ({
          key: typeof l?.key === "string" ? l.key : "",
          need: typeof l?.need === "number" ? l.need : 0,
          source: typeof l?.source === "string" ? l.source : "Legacy",
        }))
      : [];
    const inferredSources = sourceIndex[key] ?? [];
    const normalizedLinks =
      links.length === 0 && (entry?.total ?? 0) > 0
        ? (inferredSources.length
            ? inferredSources.map((src) => ({ key: "", need: entry?.total ?? 0, source: src }))
            : [{ key: "", need: entry?.total ?? 0, source: "Unknown source" }])
        : links;
    next[key] = {
      itemId: entry?.itemId ?? key,
      name: entry?.name ?? key,
      total: typeof entry?.total === "number" ? entry.total : 0,
      have: typeof entry?.have === "number" ? entry.have : 0,
      links: normalizedLinks,
    };
  });
  return next;
};

const readInitial = (): ChecklistMap => {
  if (typeof window === "undefined") return {};
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return {};
  try {
    return migrate(JSON.parse(saved));
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

  const add = (itemId: string, name: string, quantity: number, key?: string, source?: string) => {
    const existing = items[itemId];
    const nextTotal = (existing?.total ?? 0) + quantity;
    const links = key
      ? [...(existing?.links ?? []), { key, need: quantity, source: source ?? "Unknown" }]
      : existing?.links ?? [];
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
    persist({ ...items, [itemId]: { ...target, have: clamped } });
  };

  const incrementHave = (itemId: string, delta: number) => {
    const target = items[itemId];
    if (!target) return;
    setHave(itemId, target.have + delta);
  };

  const remove = (itemId: string) => {
    const next = { ...items };
    delete next[itemId];
    persist(next);
  };

  const clear = () => persist({});

  return { items, add, setHave, incrementHave, remove, clear };
}

