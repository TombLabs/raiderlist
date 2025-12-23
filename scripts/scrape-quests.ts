import { get } from "node:https";
import { load } from "cheerio";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

type QuestRow = {
  id: string;
  name: string;
  trader: string;
  requiredLocation: string;
  objective: string;
  reward: string;
  sourceUrl: string;
};

const API =
  "https://arcraiders.wiki/w/api.php?action=parse&page=Quests&section=1&prop=text&format=json";

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolvePromise(data));
    }).on("error", reject);
  });
}

function normalizeId(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function run() {
  const raw = await fetchHtml(API);
  const parsed = JSON.parse(raw);
  const html: string = parsed.parse?.text?.["*"] ?? "";
  const $ = load(html);

  const rows: QuestRow[] = [];
  $("table.wikitable tbody tr").each((_, el) => {
    const cells = $(el).find("td");
    if (cells.length < 5) return;
    const name = $(cells[0]).text().trim();
    const trader = $(cells[1]).text().trim();
    const requiredLocation = $(cells[2]).text().trim();
    const objective = $(cells[3]).text().trim().replace(/\s+/g, " ");
    const reward = $(cells[4]).text().trim().replace(/\s+/g, " ");
    if (!name) return;
    rows.push({
      id: normalizeId(name),
      name,
      trader,
      requiredLocation,
      objective,
      reward,
      sourceUrl: "https://arcraiders.wiki/wiki/Quests",
    });
  });

  const outPath = resolve(process.cwd(), "src/data/quests-scraped.json");
  writeFileSync(outPath, JSON.stringify(rows, null, 2), "utf8");
  console.log(`Wrote ${rows.length} quests to ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});


