export type ItemLocation = {
  map: string;
  area: string;
  spots: string[];
  notes?: string;
  sourceUrl?: string;
};

export type Item = {
  id: string;
  name: string;
  type?: string;
  rarity?: string;
  description?: string;
  image?: string;
  sourceUrl?: string;
  recyclesTo?: string;
  recycledFrom?: string;
  sellPrice?: number;
  maxStack?: number;
  category?: string;
  keepFor?: string;
  locations: ItemLocation[];
};

export type Requirement = {
  itemId: string;
  quantity: number;
  notes?: string;
};

export type Stage = {
  id: string;
  name: string;
  requirements: Requirement[];
  reward?: string;
  stageLabel?: string;
};

export type Quest = {
  id: string;
  name: string;
  description?: string;
  stages: Stage[];
  faction?: string;
  trader?: string;
  requiredLocation?: string;
  objective?: string;
  reward?: string;
  image?: string;
  sourceUrl?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  stages: Stage[];
  unlocks?: string;
  image?: string;
  sourceUrl?: string;
};

export type WorkbenchUpgrade = {
  id: string;
  name: string;
  level: number;
  description?: string;
  requirements: Requirement[];
  benefit: string;
  image?: string;
  sourceUrl?: string;
};

export type ProgressCategory = "quest" | "project" | "workbench";

