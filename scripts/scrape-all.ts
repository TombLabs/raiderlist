import { get } from "node:https";
import { load } from "cheerio";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

type ThumbResult = { title: string; image?: string };

type ScrapedQuest = {
  id: string;
  name: string;
  trader: string;
  requiredLocation: string;
  objective: string;
  reward: string;
  sourceUrl: string;
  image?: string;
};

type ScrapedItem = {
  id: string;
  name: string;
  rarity: string;
  recyclesTo: string;
  recycledFrom: string;
  sellPrice?: number;
  maxStack?: number;
  category: string;
  keepFor: string;
  type: "resource";
  description: string;
  sourceUrl: string;
  locations: unknown[];
  image?: string;
  _title?: string;
};

type ScrapedTrader = {
  id: string;
  name: string;
  role: string;
  description: string;
  requirements: unknown[];
  perk?: string;
  image?: string;
  sourceUrl: string;
};

type ScrapedProject = {
  id: string;
  name: string;
  description: string;
  stages: unknown[];
  sourceUrl: string;
  image?: string;
};

type ScrapedUpgrade = {
  id: string;
  name: string;
  level: number;
  description: string;
  requirements: { itemId: string; quantity: number; notes?: string }[];
  benefit: string;
  sourceUrl: string;
};

const WIKI_BASE = "https://arcraiders.wiki";

function fetch(url: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolvePromise(data));
    }).on("error", reject);
  });
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function fetchThumb(title: string): Promise<ThumbResult> {
  const api = `${WIKI_BASE}/w/api.php?action=query&titles=${encodeURIComponent(
    title,
  )}&prop=pageimages&piprop=thumbnail&pithumbsize=400&format=json`;
  try {
    const raw = await fetch(api);
    const parsed = JSON.parse(raw);
    const pages = parsed.query?.pages ?? {};
    const page = pages[Object.keys(pages)[0]];
    const image = page?.thumbnail?.source as string | undefined;
    return { title, image };
  } catch (error) {
    console.warn("thumb error", title, error);
    return { title };
  }
}

async function scrapeQuests() {
  const api =
    "https://arcraiders.wiki/w/api.php?action=parse&page=Quests&section=1&prop=text&format=json";
  const raw = await fetch(api);
  const parsed = JSON.parse(raw);
  const html: string = parsed.parse?.text?.["*"] ?? "";
  const $ = load(html);

  const quests: ScrapedQuest[] = $("table.wikitable tbody tr")
    .toArray()
    .map((row) => {
      const cells = $(row).find("td");
      if (cells.length < 5) return null;
      const name = $(cells[0]).text().trim();
      if (!name) return null;
      return {
        id: slugify(name),
        name,
        trader: $(cells[1]).text().trim(),
        requiredLocation: $(cells[2]).text().trim(),
        objective: $(cells[3]).text().trim().replace(/\s+/g, " "),
        reward: $(cells[4]).text().trim().replace(/\s+/g, " "),
        sourceUrl: "https://arcraiders.wiki/wiki/Quests",
      };
    })
    .filter(Boolean) as ScrapedQuest[];

  const thumbs = await Promise.all(quests.map((q) => fetchThumb(q.name)));
  const byTitle = new Map(thumbs.map((t) => [t.title.toLowerCase(), t.image]));
  const withImages = quests.map((q) => ({
    ...q,
    image: byTitle.get(q.name.toLowerCase()),
  }));

  const outPath = resolve(process.cwd(), "src/data/quests-scraped.json");
  writeFileSync(outPath, JSON.stringify(withImages, null, 2), "utf8");
  console.log(`Wrote ${withImages.length} quests -> ${outPath}`);
}

async function scrapeLoot() {
  const api =
    "https://arcraiders.wiki/w/api.php?action=parse&page=Loot&prop=text&format=json";
  const raw = await fetch(api);
  const parsed = JSON.parse(raw);
  const html: string = parsed.parse?.text?.["*"] ?? "";
  const $ = load(html);

  const items: ScrapedItem[] = [];
  $("table.wikitable tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 8) return;
    const name = $(cells[0]).text().trim();
    if (!name) return;
    const rarity = $(cells[1]).text().trim();
    const recyclesTo = $(cells[2]).text().trim().replace(/\s+/g, " ");
    const recycledFrom = $(cells[3]).text().trim().replace(/\s+/g, " ");
    const sellPrice = Number($(cells[4]).text().trim()) || undefined;
    const maxStack = Number($(cells[5]).text().trim()) || undefined;
    const category = $(cells[6]).text().trim();
    const keepFor = $(cells[7]).text().trim().replace(/\s+/g, " ");
    const linkTitle = $(cells[0]).find("a").attr("title") ?? name;

    items.push({
      id: slugify(name),
      name,
      rarity: rarity.toLowerCase(),
      recyclesTo,
      recycledFrom,
      sellPrice,
      maxStack,
      category,
      keepFor,
      type: "resource",
      description: keepFor || "Loot item",
      sourceUrl: `${WIKI_BASE}/wiki/${encodeURIComponent(linkTitle)}`,
      locations: [],
      _title: linkTitle,
    });
  });

  const thumbs = await Promise.all(
    items.map((i) => fetchThumb(i._title ?? i.name)),
  );
  const byTitle = new Map(thumbs.map((t) => [t.title.toLowerCase(), t.image]));
  const withImages = items.map(({ _title, ...rest }) => {
    const title = _title ?? rest.name;
    return {
      ...rest,
      image: byTitle.get(title.toLowerCase()),
    };
  });

  const outPath = resolve(process.cwd(), "src/data/items-scraped.json");
  writeFileSync(outPath, JSON.stringify(withImages, null, 2), "utf8");
  console.log(`Wrote ${withImages.length} loot items -> ${outPath}`);
}

async function scrapeTraders() {
  const api =
    "https://arcraiders.wiki/w/api.php?action=parse&page=Traders&prop=text&format=json";
  const raw = await fetch(api);
  const parsed = JSON.parse(raw);
  const html: string = parsed.parse?.text?.["*"] ?? "";
  const $ = load(html);

  const roster: ScrapedTrader[] = [];
  $("table.wikitable tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;
    const name = $(cells[0]).text().trim();
    if (!name) return;
    const image = $(cells[1]).find("img").attr("src");
    const sells = $(cells[2])
      .find("li")
      .toArray()
      .map((li) => $(li).text().trim())
      .filter(Boolean);

    const titleAttr = $(cells[0]).find("a").attr("title") ?? name;

    roster.push({
      id: slugify(name),
      name,
      role: "Trader",
      description: sells.join("; "),
      requirements: [],
      perk: sells[0],
      image: image ? (image.startsWith("http") ? image : `${WIKI_BASE}${image}`) : undefined,
      sourceUrl: `${WIKI_BASE}/wiki/${encodeURIComponent(titleAttr)}`,
    });
  });

  const outPath = resolve(process.cwd(), "src/data/roster-scraped.json");
  writeFileSync(outPath, JSON.stringify(roster, null, 2), "utf8");
  console.log(`Wrote ${roster.length} traders -> ${outPath}`);
}

async function scrapeProjects() {
  const api =
    "https://arcraiders.wiki/w/api.php?action=parse&page=Projects&prop=text&format=json";
  const raw = await fetch(api);
  const parsed = JSON.parse(raw);
  const html: string = parsed.parse?.text?.["*"] ?? "";
  const $ = load(html);

  const projects: ScrapedProject[] = [];
  $("h2").each((_, h2) => {
    const title = $(h2).text().replace("[edit]", "").trim();
    if (!title || title === "Contents") return;

    const paragraphs: string[] = [];
    let next = $(h2).next();
    while (next.length && !/^h[1-2]$/.test(next[0].tagName || "")) {
      if (next[0].tagName === "p") {
        const text = next.text().trim();
        if (text) paragraphs.push(text);
      }
      next = next.next();
    }

    const description = paragraphs.join(" ").replace(/\s+/g, " ");
    projects.push({
      id: slugify(title),
      name: title,
      description: description || "Project entry",
      stages: [],
      sourceUrl: `${WIKI_BASE}/wiki/Projects`,
    });
  });

  const thumbs = await Promise.all(projects.map((p) => fetchThumb(p.name)));
  const byTitle = new Map(thumbs.map((t) => [t.title.toLowerCase(), t.image]));
  const withImages = projects.map((p) => ({
    ...p,
    image: byTitle.get(p.name.toLowerCase()),
  }));

  const outPath = resolve(process.cwd(), "src/data/projects-scraped.json");
  writeFileSync(outPath, JSON.stringify(withImages, null, 2), "utf8");
  console.log(`Wrote ${withImages.length} projects -> ${outPath}`);
}

function parseRequirement(text: string) {
  const match = text.match(/^([0-9]+)x?\s+(.*)$/i);
  if (match) {
    return { quantity: Number(match[1]), itemId: slugify(match[2]) || text.trim(), label: match[2].trim() };
  }
  return { quantity: 1, itemId: slugify(text) || "req", label: text.trim() };
}

async function scrapeWorkshop() {
  const api =
    "https://arcraiders.wiki/w/api.php?action=parse&page=Workshop&prop=text&format=json";
  const raw = await fetch(api);
  const parsed = JSON.parse(raw);
  const html: string = parsed.parse?.text?.["*"] ?? "";
  const $ = load(html);

  const upgrades: ScrapedUpgrade[] = [];
  let globalIndex = 0;
  $("table").each((_, table) => {
    const headers = $(table)
      .find("th")
      .toArray()
      .map((th) => $(th).text().trim().toLowerCase());
    if (!(headers.includes("level") && headers.some((h) => h.includes("requirements")))) return;

    // find nearest previous heading as station name
    let station = "Workshop";
    let prev = $(table).prev();
    while (prev.length) {
      if (/^h[1-4]$/.test(prev[0].tagName || "")) {
        station = prev.text().trim() || station;
        break;
      }
      prev = prev.prev();
    }
    const stationId = slugify(station);

    $(table)
      .find("tbody tr")
      .each((__, row) => {
        const cells = $(row).find("td");
        if (cells.length < 3) return;
        const levelText = $(cells[0]).text().trim();
        const level = Number(levelText.replace(/[^0-9]/g, "")) || 0;
        if (!level) return;

        const reqList = $(cells[1])
          .find("li")
          .toArray()
          .map((li) => parseRequirement($(li).text().trim()));
        const crafts = $(cells[2])
          .find("a, li")
          .toArray()
          .map((el) => $(el).text().trim())
          .filter(Boolean);

        upgrades.push({
          id: `${stationId}-l${level}-${globalIndex++}`,
          name: `${station} Level ${level}`,
          level,
          description: `${station} upgrade`,
          requirements: reqList.map((r) => ({ itemId: r.itemId, quantity: r.quantity, notes: r.label })),
          benefit: crafts.length ? `Crafts: ${crafts.join(", ")}` : "",
          sourceUrl: `${WIKI_BASE}/wiki/Workshop`,
        });
      });
  });

  const outPath = resolve(process.cwd(), "src/data/workbench-scraped.json");
  writeFileSync(outPath, JSON.stringify(upgrades, null, 2), "utf8");
  console.log(`Wrote ${upgrades.length} workshop rows -> ${outPath}`);
}

async function main() {
  await scrapeQuests();
  await scrapeLoot();
  await scrapeTraders();
  await scrapeProjects();
  await scrapeWorkshop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

