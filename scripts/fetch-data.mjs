// Build-time data fetcher.
//
// Runs in Node (GitHub Actions) before `vite build`. Fetches the published
// Google Sheet directly (no CORS in Node), parses every artist's tabs, and
// writes public/data.json as a single shared snapshot:
//
//   { "syncedAt": "<ISO timestamp>", "artists": { "<slug>": {...}, ... } }
//
// Every visitor reads this same file, so the data — and the "synced Xm ago"
// timestamp — are identical for everyone. If the fetch fails the script exits
// 0 without writing, and the app falls back to its live Worker fetch.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../public/data.json");

const SHEET_ID =
  "2PACX-1vRX8lP3Nb-LWMmUoTtHDHihOX-SkhFMUXoQJIuinbUhctXSjgJ1CCI9NvO1MQZKdgy9jtG33DgrOtre";

const SHEET_TABS = {
  "opium": { network: "Opium (Fan Network)", pages: "Opium (Fan Pages)" },
  "playboi-carti": { network: "Playboi Carti (Fan Network)", pages: "Playboi Carti (Fan Pages)" },
  "ken-carson": { network: "Ken Carson (Fan Network)", pages: "Ken Carson (Fan Pages)" },
  "destroy-lonely": { network: "Destroy Lonely (Fan Network)", pages: "Destroy Lonely (Fan Pages)" },
  "hxg": { network: "HXG (Fan Network)", pages: "HXG (Fan Pages)" },
  "pierre-bourne": { network: "Pi'erre Bourne (Fan Network)", pages: "Pi'erre Bourne (Fan Pages)" },
  "rema": { network: "Rema (Fan Network)", pages: "Rema (Fan Pages)" },
  "2hollis": { network: "2hollis (Fan Network)", pages: "2hollis (Fan Pages)" },
  "untiljapan": { network: "untiljapan (Fan Network)", pages: "untiljapan (Fan Pages)" },
  "jim-legxacy": { network: "Jim Legxacy (Fan Network)", pages: "Jim Legxacy (Fan Pages)" },
  "apollored1": { network: "ApolloRed1 (Fan Network)", pages: "ApolloRed1 (Fan Pages)" },
  "destin-laurel": { network: "Destin Laurel (Fan Network)", pages: "Destin Laurel (Fan Pages)" },
};

function parseCSVText(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuote && next === '"') { cell += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      row.push(cell.trim()); cell = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuote) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = []; cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length > 0) { row.push(cell.trim()); if (row.some((c) => c !== "")) rows.push(row); }
  return rows;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function decodeJsString(str) {
  return str
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

async function fetchGidMap(pubId) {
  const url = `https://docs.google.com/spreadsheets/d/e/${pubId}/pubhtml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`pubhtml HTTP ${res.status}`);
  const html = await res.text();
  const gids = {};
  let m;

  const anchorRe = /href="[^"]*[?&]gid=(\d+)[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/gi;
  while ((m = anchorRe.exec(html)) !== null) {
    const name = decodeHtmlEntities(m[2].trim());
    if (name) gids[name] = m[1];
  }
  if (Object.keys(gids).length > 0) return gids;

  const jsRe = /name:\s*["']([^"']+)["'][^}]*gid=(\d+)/g;
  while ((m = jsRe.exec(html)) !== null) gids[decodeJsString(m[1].trim())] = m[2];
  if (Object.keys(gids).length > 0) return gids;

  const jsonRe = /"name":\s*"([^"]+)"[^}]*"gid":\s*(\d+)/g;
  while ((m = jsonRe.exec(html)) !== null) gids[decodeJsString(decodeHtmlEntities(m[1].trim()))] = m[2];
  return gids;
}

async function fetchSheetByGid(pubId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv&gid=${gid}&single=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCSVText(await res.text());
}

function parseDateToYearMonth(raw) {
  const s = raw.trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const iso = s.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const us = s.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
  if (us) return `${us[2]}-${us[1].padStart(2, "0")}`;
  const my = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (my) return `${my[2]}-${my[1].padStart(2, "0")}`;
  const MONTHS = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const mon = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (mon) {
    const mm = MONTHS[mon[1].toLowerCase().slice(0, 3)];
    if (mm) return `${mon[2]}-${mm}`;
  }
  return null;
}

const SKIP_PLATFORMS = new Set(["Total", "total", "TOTAL", "Grand Total"]);

function parseNetworkTab(rows) {
  const dataRows = rows.slice(1).filter((r) => r.length >= 3 && r[0] && r[1]);
  const dateMap = new Map();
  for (const row of dataRows) {
    const platform = row[0].trim();
    if (SKIP_PLATFORMS.has(platform)) continue;
    const date = parseDateToYearMonth(row[1]);
    const followers = parseInt(row[2].replace(/[^\d]/g, ""), 10);
    if (!platform || !date || isNaN(followers)) continue;
    if (!dateMap.has(date)) dateMap.set(date, {});
    dateMap.get(date)[platform] = followers;
  }
  const sortedDates = Array.from(dateMap.keys()).sort();
  const history = sortedDates.map((date) => ({ date, ...dateMap.get(date) }));
  const platforms = {};
  if (history.length > 0) {
    const latest = history[history.length - 1];
    const prev = history.length >= 2 ? history[history.length - 2] : null;
    for (const [key, val] of Object.entries(latest)) {
      if (key === "date") continue;
      const value = val;
      const prevVal = prev && typeof prev[key] === "number" ? prev[key] : value;
      platforms[key] = { value, delta: value - prevVal };
    }
  }
  const totalValue = Object.values(platforms).reduce((s, p) => s + p.value, 0);
  const totalDelta = Object.values(platforms).reduce((s, p) => s + p.delta, 0);
  return { history, platforms, totals: { value: totalValue, delta: totalDelta } };
}

function parsePagesTab(rows) {
  return rows
    .slice(1)
    .filter((r) => r.length >= 4 && r[0] && r[1])
    .map((row) => ({
      platform: row[0].trim(),
      name: row[1].trim(),
      link: row[2]?.trim() || "",
      followers: parseInt(row[3]?.replace(/[^\d]/g, "") || "0", 10),
      latest: row[4]?.trim() || "",
      managed: row[5]?.trim().toLowerCase() === "yes",
    }))
    .filter((p) => !isNaN(p.followers));
}

async function main() {
  const gidMap = await fetchGidMap(SHEET_ID);
  if (Object.keys(gidMap).length === 0) throw new Error("GID map empty");

  const artists = {};
  await Promise.all(
    Object.entries(SHEET_TABS).map(async ([slug, tabs]) => {
      const networkGid = gidMap[tabs.network];
      const pagesGid = gidMap[tabs.pages];
      if (!networkGid || !pagesGid) {
        console.warn(`[fetch-data] ${slug}: tab not found in GID map`);
        return;
      }
      try {
        const [networkRows, pagesRows] = await Promise.all([
          fetchSheetByGid(SHEET_ID, networkGid),
          fetchSheetByGid(SHEET_ID, pagesGid),
        ]);
        const { history, platforms, totals } = parseNetworkTab(networkRows);
        const pages = parsePagesTab(pagesRows);
        artists[slug] = { history, platforms, totals, pages };
      } catch (err) {
        console.warn(`[fetch-data] ${slug}:`, err.message);
      }
    })
  );

  if (Object.keys(artists).length === 0) throw new Error("No artist data fetched");

  const snapshot = { syncedAt: new Date().toISOString(), artists };
  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(snapshot));
  console.log(`[fetch-data] Wrote ${Object.keys(artists).length} artists to public/data.json`);
}

main().catch((err) => {
  // Non-fatal: don't block the build. The app falls back to its live fetch.
  console.error("[fetch-data] Failed, skipping snapshot:", err.message);
  process.exit(0);
});
