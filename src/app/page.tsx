"use client";

import questsScraped from "@/data/quests-scraped.json";
import projectsManual from "@/data/projects.json";
import workbenchScraped from "@/data/workbench-scraped.json";
import itemsScraped from "@/data/items-scraped.json";
import Image from "next/image";
import {
  Item,
  Project,
  Quest,
  Requirement,
  Stage,
  WorkbenchUpgrade,
  ProgressCategory,
} from "@/types/data";
import { makeProgressKey, useProgress } from "@/lib/useProgress";
import { useChecklist } from "@/lib/useChecklist";
import styles from "./page.module.css";
import { useMemo, useState } from "react";

type NormalizedStage = Stage & { stageLabel?: string };
type SharedEntry = { id: string; name: string; description?: string; image?: string; sourceUrl?: string };
type QuestRecord = Quest & { trader?: string; requiredLocation?: string; objective?: string; reward?: string; image?: string; sourceUrl?: string };

type CategoryDefinition<T extends SharedEntry> = {
  id: ProgressCategory;
  label: string;
  data: T[];
  normalize: (entry: T) => NormalizedStage[];
  subtitle: (entry: T) => string;
  headerBadge?: (entry: T) => string | undefined;
};

const questData = questsScraped as QuestRecord[];
const projectData = projectsManual as Project[];
const workbenchData = workbenchScraped as WorkbenchUpgrade[];
const itemData = itemsScraped as Item[];

const categories: Array<
  CategoryDefinition<Quest> | CategoryDefinition<Project> | CategoryDefinition<WorkbenchUpgrade>
> = [
  {
    id: "quest",
    label: "Quests",
    data: questData,
    normalize: (entry: Quest) =>
      (entry as QuestRecord).stages?.length
        ? (entry as QuestRecord).stages
        : [
            {
              id: `${(entry as QuestRecord).id}-objective`,
              name: (entry as QuestRecord).objective ?? entry.description ?? "Objective",
              requirements: [],
              reward: (entry as QuestRecord).reward,
              stageLabel: (entry as QuestRecord).trader ? `Trader: ${(entry as QuestRecord).trader}` : "Quest",
            },
          ],
    subtitle: (entry: Quest) =>
      [
        (entry as QuestRecord).trader ? `Trader: ${(entry as QuestRecord).trader}` : null,
        (entry as QuestRecord).requiredLocation ? `Location: ${(entry as QuestRecord).requiredLocation}` : null,
      ]
        .filter(Boolean)
        .join(" • ") || "Quest chain",
    headerBadge: (entry: Quest) => ((entry as QuestRecord).reward ? "Reward" : undefined),
  },
  {
    id: "project",
    label: "Projects",
    data: projectData,
    normalize: (entry: Project) => entry.stages,
    subtitle: (entry: Project) => entry.unlocks ?? "Project build",
  },
  {
    id: "workbench",
    label: "Workbench",
    data: workbenchData,
    normalize: (entry: WorkbenchUpgrade) => [
      {
        id: `level-${entry.level}`,
        name: entry.name,
        requirements: entry.requirements,
        reward: entry.benefit,
        stageLabel: `Level ${entry.level}`,
      },
    ],
    subtitle: (entry: WorkbenchUpgrade) => `Benefit: ${entry.benefit}`,
    headerBadge: (entry: WorkbenchUpgrade) => `Lv ${entry.level}`,
  },
];

const filterEntries = (
  text: string,
  entry: SharedEntry,
  requirements: Requirement[],
  itemLookup: Record<string, Item>,
) => {
  if (!text.trim()) return true;
  const lower = text.toLowerCase();
  const haystack = [
    entry.name,
    entry.description ?? "",
    (entry as QuestRecord).trader ?? "",
    (entry as QuestRecord).requiredLocation ?? "",
    (entry as QuestRecord).reward ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (haystack.includes(lower)) return true;
  return requirements.some((req) => {
    const item = itemLookup[req.itemId];
    return item?.name.toLowerCase().includes(lower);
  });
};

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<ProgressCategory>("quest");
  const [filter, setFilter] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const { getValue, increment, setValue, clear } = useProgress();
  const {
    items: checklist,
    add: addToChecklist,
    setHave,
    incrementHave,
    remove: removeChecklist,
    clear: clearChecklist,
  } = useChecklist();

  const syncChecklistToProgress = (itemId: string, have: number) => {
    const entry = checklist[itemId];
    if (!entry) return;
    let remaining = have;
    entry.links.forEach((link) => {
      if (remaining <= 0) {
        setValue(link.key, 0);
        return;
      }
      const use = Math.min(link.need, remaining);
      setValue(link.key, use);
      remaining -= use;
    });
  };

  const itemLookup = useMemo(
    () =>
      (itemData as Item[]).reduce<Record<string, Item>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [],
  );

  const selectedItem = selectedItemId ? itemLookup[selectedItemId] : null;
  const stats = useMemo(
    () => [
      { label: "Quests", value: questData.length },
      { label: "Projects", value: projectData.length },
    { label: "Workbench upgrades", value: workbenchData.length },
    { label: "Items", value: itemData.length },
    ],
    [],
  );

  const renderRequirement = (
    categoryId: ProgressCategory,
    entityId: string,
    stageId: string,
    req: Requirement,
    sourceLabel: string,
  ) => {
    const item = itemLookup[req.itemId];
    const key = makeProgressKey(categoryId, entityId, stageId, req.itemId);
    const current = getValue(key);
    const isDone = current >= req.quantity;
    const remaining = Math.max(0, req.quantity - current);
    const alreadyAdded = Boolean(
      checklist[req.itemId]?.links?.some((link) => link.key === key),
    );

    return (
      <div key={key} className={styles.requirementRow} data-done={isDone}>
        <div className={styles.reqMain}>
          <button
            className={styles.itemLink}
            type="button"
            onClick={() => setSelectedItemId(item?.id ?? null)}
          >
            {item?.name ?? req.itemId}
          </button>
          <p className={styles.reqNote}>{item?.description}</p>
          {req.notes ? <p className={styles.reqNote}>{req.notes}</p> : null}
          <div className={styles.reqActions}>
            <button
              type="button"
              className={styles.ghostButton}
              disabled={remaining === 0 || alreadyAdded}
              onClick={() => {
                if (remaining <= 0) return;
                addToChecklist(req.itemId, item?.name ?? req.itemId, remaining, key, sourceLabel);
              }}
            >
              {alreadyAdded
                ? "Added to in-game list"
                : remaining > 0
                  ? `Add to in-game list (+${remaining})`
                  : "Completed"}
            </button>
          </div>
        </div>
        <div className={styles.reqControls}>
          <span className={styles.reqQuantity}>
            {current} / {req.quantity}
          </span>
          <div className={styles.stepper}>
            <button
              type="button"
              onClick={() => increment(key, -1, req.quantity)}
              aria-label="Decrease"
            >
              −
            </button>
            <input
              type="number"
              min={0}
              max={req.quantity}
              value={current}
              onChange={(e) => setValue(key, Math.min(req.quantity, Math.max(0, Number(e.target.value))))}
            />
            <button
              type="button"
              onClick={() => increment(key, 1, req.quantity)}
              aria-label="Increase"
            >
              +
            </button>
          </div>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={isDone}
              onChange={(e) => setValue(key, e.target.checked ? req.quantity : 0)}
            />
            <span>Done</span>
          </label>
        </div>
      </div>
    );
  };

  const renderStage = (
    categoryId: ProgressCategory,
    entityId: string,
    stage: NormalizedStage,
    sourceLabel: string,
  ) => {
    const total = stage.requirements.reduce((sum, req) => sum + req.quantity, 0);
    const have = stage.requirements.reduce((sum, req) => {
      const key = makeProgressKey(categoryId, entityId, stage.id, req.itemId);
      return sum + Math.min(getValue(key), req.quantity);
    }, 0);
    const pct = total > 0 ? Math.round((have / total) * 100) : 0;

    return (
      <div key={stage.id} className={styles.stage}>
        <div className={styles.stageHead}>
          <div>
            <p className={styles.stageLabel}>{stage.stageLabel ?? "Stage"}</p>
            <h4>{stage.name}</h4>
          </div>
          <div className={styles.stageMeta}>
            <span className={styles.badge}>{pct}%</span>
            {stage.reward ? <span className={styles.badgeMuted}>{stage.reward}</span> : null}
          </div>
        </div>
        <div className={styles.progressBar}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className={styles.requirements}>
          {stage.requirements.map((req) => renderRequirement(categoryId, entityId, stage.id, req, sourceLabel))}
        </div>
      </div>
    );
  };

  const renderCards = () => {
    const currentCategory = categories.find((c) => c.id === activeCategory);
    if (!currentCategory) return null;

    return currentCategory.data
      .filter((entry) => {
        const stages = (currentCategory.normalize as (arg: Quest | Project | WorkbenchUpgrade) => NormalizedStage[])(entry);
        return filterEntries(
          filter,
          entry,
          stages.flatMap((stage) => stage.requirements),
          itemLookup,
        );
      })
      .map((entry) => {
        const stages = (currentCategory.normalize as (arg: Quest | Project | WorkbenchUpgrade) => NormalizedStage[])(entry);
        const entryId = entry.id;
        const title = entry.name;
        const description = entry.description ?? (currentCategory.id === "quest" ? (entry as QuestRecord).objective ?? "" : "");
        const image = (entry as SharedEntry).image;
        const sourceUrl = (entry as SharedEntry).sourceUrl;
        const questMeta =
          currentCategory.id === "quest"
            ? [
                (entry as QuestRecord).trader ? `Trader: ${(entry as QuestRecord).trader}` : null,
                (entry as QuestRecord).requiredLocation ? `Location: ${(entry as QuestRecord).requiredLocation}` : null,
                (entry as QuestRecord).reward ? `Reward: ${(entry as QuestRecord).reward}` : null,
              ].filter(Boolean)
            : [];

        const subtitle = (currentCategory.subtitle as (arg: Quest | Project | WorkbenchUpgrade) => string)(entry);
        const badge = currentCategory.headerBadge
          ? (currentCategory.headerBadge as (arg: Quest | Project | WorkbenchUpgrade) => string | undefined)(entry)
          : undefined;

        return (
          <section key={entryId} className={styles.card}>
            {image ? (
              <div className={styles.cardMedia}>
                <Image src={image} alt={title} width={400} height={240} />
              </div>
            ) : null}
            <header className={styles.cardHeader}>
              <div>
                <p className={styles.cardEyebrow}>{subtitle}</p>
                <h3>{title}</h3>
                <p className={styles.cardDescription}>{description}</p>
                {questMeta.length ? (
                  <div className={styles.metaRow}>
                    {questMeta.map((meta) => (
                      <span key={meta} className={styles.chip}>
                        {meta}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {badge ? <span className={styles.badge}>{badge}</span> : null}
            </header>
            {sourceUrl ? (
              <a className={styles.sourceLink} href={sourceUrl} target="_blank" rel="noreferrer">
                View on wiki
              </a>
            ) : null}
            <div className={styles.stages}>
              {stages.length ? (
                stages.map((s) => renderStage(currentCategory.id, entryId, s, `${currentCategory.label}: ${title}`))
              ) : (
                <div className={styles.emptyStage}>No stage details provided.</div>
              )}
            </div>
          </section>
        );
      });
  };

  return (
    <main className={styles.container}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>ARC Raiders companion</p>
          <h1>Track quests, projects, workbench upgrades, and roster unlocks</h1>
          <p className={styles.lead}>
            Data stays on your device. All checklists and item counts are persisted locally in your browser so you can
            prep runs without sending anything to a server.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.secondary} type="button" onClick={() => clear()}>
            Reset checklist
          </button>
          <a className={styles.primary} href="https://arcraiders.wiki/" target="_blank" rel="noreferrer">
            Open ARC Raiders Wiki
          </a>
        </div>
      </header>

      <section className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <span className={styles.statValue}>{stat.value}</span>
            <p className={styles.cardEyebrow}>{stat.label}</p>
          </div>
        ))}
      </section>

      <section className={styles.checklistPanel}>
        <div className={styles.checklistHead}>
          <div>
            <p className={styles.cardEyebrow}>In-game checklist</p>
            <h2>Gather list</h2>
            <p className={styles.cardDescription}>Add items from any quest/project/workbench requirement and track them here while you play.</p>
          </div>
          <button className={styles.secondary} type="button" onClick={() => clearChecklist()}>
            Clear list
          </button>
        </div>
        <div className={styles.checklistGrid}>
          {Object.values(checklist).length === 0 ? (
            <div className={styles.emptyStage}>No items yet. Click “Add to in-game list” next to a requirement.</div>
          ) : (
            Object.values(checklist).map((ci) => {
              const pct = ci.total > 0 ? Math.min(100, Math.round((ci.have / ci.total) * 100)) : 0;
              const sources = Array.from(
                new Set(
                  (ci.links ?? [])
                    .map((l) => l.source)
                    .filter((s): s is string => Boolean(s)),
                ),
              );
              return (
                <div key={ci.itemId} className={styles.checklistCard}>
                  <div className={styles.checklistTop}>
                    <div>
                      <p className={styles.cardEyebrow}>Item</p>
                      <h4>{ci.name}</h4>
                      {sources.length ? (
                        <div className={styles.metaRow}>
                          {sources.map((src) => (
                            <span key={src} className={styles.chip}>
                              {src}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button className={styles.ghostButton} type="button" onClick={() => removeChecklist(ci.itemId)}>
                      Remove
                    </button>
                  </div>
                  <div className={styles.progressBar}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className={styles.reqControls}>
                    <span className={styles.reqQuantity}>
                      {ci.have} / {ci.total}
                    </span>
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(0, ci.have - 1);
                          setHave(ci.itemId, next);
                          syncChecklistToProgress(ci.itemId, next);
                        }}
                        aria-label="Decrease"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={ci.total}
                        value={ci.have}
                        onChange={(e) => {
                          const next = Math.min(ci.total, Math.max(0, Number(e.target.value)));
                          setHave(ci.itemId, next);
                          syncChecklistToProgress(ci.itemId, next);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          incrementHave(ci.itemId, 1);
                          const next = Math.min(ci.total, ci.have + 1);
                          syncChecklistToProgress(ci.itemId, next);
                        }}
                        aria-label="Increase"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className={styles.toolbar}>
        <div className={styles.tabs}>
          {categories.map((category) => (
            <button
              key={category.id}
              className={activeCategory === category.id ? styles.tabActive : styles.tab}
              onClick={() => setActiveCategory(category.id)}
              type="button"
            >
              {category.label}
            </button>
          ))}
        </div>
        <input
          className={styles.search}
          placeholder="Filter by quest, item, map, or description"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </section>

      <section className={styles.grid}>{renderCards()}</section>

      {selectedItem ? (
        <div className={styles.drawer} role="dialog" aria-label={selectedItem.name}>
          <div className={styles.drawerBody}>
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.cardEyebrow}>{selectedItem.type}</p>
                <h3>{selectedItem.name}</h3>
                <p className={styles.cardDescription}>{selectedItem.description}</p>
              </div>
              <button className={styles.secondary} type="button" onClick={() => setSelectedItemId(null)}>
                Close
              </button>
            </div>
            {selectedItem.image ? (
              <div className={styles.drawerImage}>
                <Image src={selectedItem.image} alt={selectedItem.name} width={360} height={240} />
              </div>
            ) : null}
            <div className={styles.locationList}>
              {selectedItem.locations.map((loc) => (
                <article key={`${loc.map}-${loc.area}`} className={styles.locationCard}>
                  <header className={styles.locationHeader}>
                    <h4>{loc.map}</h4>
                    <span className={styles.badgeMuted}>{loc.area}</span>
                  </header>
                  <ul>
                    {loc.spots.map((spot) => (
                      <li key={spot}>{spot}</li>
                    ))}
                  </ul>
                  {loc.notes ? <p className={styles.cardDescription}>{loc.notes}</p> : null}
                  {loc.sourceUrl ? (
                    <a className={styles.sourceLink} href={loc.sourceUrl} target="_blank" rel="noreferrer">
                      Source: arcraiders.wiki
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
