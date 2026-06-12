import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  ChevronDown,
  ArrowUpRight,
  ArrowUp,
  ArrowDownRight,
  Minus,
  PieChart as PieIcon,
  Zap,
  MessageSquare,
  Heart,
  Repeat2,
  ExternalLink,
  Filter,
  Image as ImageIcon,
  Play,
  AlertCircle,
  Star,
} from "lucide-react";

// ---- Platform tokens ----
const PLATFORMS = {
  Discord: { color: "#4285F4", soft: "#E8F0FE" },
  Reddit: { color: "#FF4500", soft: "#FFECE3" },
  Instagram: { color: "#FF0069", soft: "#FFE0EE" },
  "Instagram Channels": { color: "#7638FA", soft: "#EDE6FE" },
  X: { color: "#000000", soft: "#E5E7EB" },
  "X Communities": { color: "#808080", soft: "#F3F4F6" },
  TikTok: { color: "#00C2B2", soft: "#E0FDFB" },
};

// ---- Platform display order + classification ----
const PLAT_ORDER = ["Discord", "Reddit", "Instagram", "Instagram Channels", "X", "X Communities", "TikTok"];
const MEMBER_PLATFORMS = new Set(["Discord", "Reddit", "X Communities", "Instagram Channels"]);

// ---- Design tokens ----
const CARD = "bg-white border border-line rounded-2xl shadow-sm";
const EYEBROW = "text-[10px] font-semibold uppercase tracking-wider text-muted";

// ---- Cloudflare Worker proxy ----
const WORKER_URL = "https://fanintel.smudgy-mute2q.workers.dev";

// ---- Google Sheets config ----
const SHEET_ID = "2PACX-1vRX8lP3Nb-LWMmUoTtHDHihOX-SkhFMUXoQJIuinbUhctXSjgJ1CCI9NvO1MQZKdgy9jtG33DgrOtre";
const sheetTabs = (name: string) => ({ network: `${name} (Fan Network)`, pages: `${name} (Fan Pages)` });

// ---- LocalStorage cache utilities ----
const CACHE_MS = { sheets: 86_400_000, reddit: 900_000 };

function getCached<T>(key: string, ttl: number): { data: T; ts: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > ttl) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCached(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore quota/disabled errors */ }
}

// ---- CSV fetch + parse utilities ----
function parseCSVText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function decodeJsString(str: string): string {
  return str
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

async function fetchGidMap(pubId: string): Promise<Record<string, string>> {
  const url = `${WORKER_URL}/sheets?pubId=${pubId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`pubhtml HTTP ${res.status}`);
  const html = await res.text();
  const gids: Record<string, string> = {};

  const anchorRe = /href="[^"]*[?&]gid=(\d+)[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/gi;
  let m: RegExpExecArray | null;
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
  if (Object.keys(gids).length > 0) return gids;

  console.warn("[sheets] GID extraction failed. HTML sample:", html.substring(0, 2000));
  return gids;
}

async function fetchSheetByGid(pubId: string, gid: string): Promise<string[][]> {
  const url = `${WORKER_URL}/sheets?pubId=${pubId}&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCSVText(await res.text());
}

function parseDateToYearMonth(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const iso = s.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const us = s.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
  if (us) return `${us[2]}-${us[1].padStart(2, "0")}`;
  const my = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (my) return `${my[2]}-${my[1].padStart(2, "0")}`;
  const MONTHS: Record<string, string> = {
    jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
    jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  };
  const mon = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (mon) {
    const m = MONTHS[mon[1].toLowerCase().slice(0, 3)];
    if (m) return `${mon[2]}-${m}`;
  }
  return null;
}

const SKIP_PLATFORMS = new Set(["Total", "total", "TOTAL", "Grand Total"]);

function parseNetworkTab(rows: string[][]) {
  const dataRows = rows.slice(1).filter((r) => r.length >= 3 && r[0] && r[1]);
  const dateMap: Map<string, Record<string, number>> = new Map();
  for (const row of dataRows) {
    const platform = row[0].trim();
    if (SKIP_PLATFORMS.has(platform)) continue;
    const date = parseDateToYearMonth(row[1]);
    const followers = parseInt(row[2].replace(/[^\d]/g, ""), 10);
    if (!platform || !date || isNaN(followers)) continue;
    if (!dateMap.has(date)) dateMap.set(date, {});
    dateMap.get(date)![platform] = followers;
  }
  const sortedDates = Array.from(dateMap.keys()).sort();
  const history = sortedDates.map((date) => ({ date, ...dateMap.get(date)! }));
  const platforms: Record<string, { value: number; delta: number }> = {};
  if (history.length > 0) {
    const latest = history[history.length - 1];
    const prev = history.length >= 2 ? history[history.length - 2] : null;
    for (const [key, val] of Object.entries(latest)) {
      if (key === "date") continue;
      const value = val as number;
      const prevVal = prev && typeof prev[key] === "number" ? (prev[key] as number) : value;
      platforms[key] = { value, delta: value - prevVal };
    }
  }
  const totalValue = Object.values(platforms).reduce((s, p) => s + p.value, 0);
  const totalDelta = Object.values(platforms).reduce((s, p) => s + p.delta, 0);
  return { history, platforms, totals: { value: totalValue, delta: totalDelta } };
}

function parsePagesTab(rows: string[][]) {
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

// ---- Static fallback artist data ----
const STATIC_ARTISTS = [
  { slug: "opium", name: "Opium", subreddit: "opium", totals: { value: 168074, delta: 808 }, platforms: { Discord: { value: 8809, delta: 1 }, Reddit: { value: 19795, delta: 425 }, Instagram: { value: 95339, delta: 415 }, "Instagram Channels": { value: 9400, delta: -200 }, X: { value: 1775, delta: 154 }, TikTok: { value: 32956, delta: 13 } }, pages: [{ name: "/opium00", followers: 8809, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "playboi-carti", name: "Playboi Carti", subreddit: "playboicarti", totals: { value: 1495905, delta: 4537 }, platforms: { Discord: { value: 182148, delta: 338 }, Reddit: { value: 1029516, delta: 8064 }, Instagram: { value: 253236, delta: -3425 }, "Instagram Channels": { value: 23900, delta: -400 }, X: { value: 6995, delta: -38 }, "X Communities": { value: 110, delta: -2 } }, pages: [{ name: "/playboicarti", followers: 182148, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/pbc00", followers: 13193, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "ken-carson", name: "Ken Carson", subreddit: "kencarson", totals: { value: 536568, delta: 11932 }, platforms: { Discord: { value: 76270, delta: 236 }, Reddit: { value: 75448, delta: 904 }, Instagram: { value: 212157, delta: 8336 }, "Instagram Channels": { value: 22500, delta: 1000 }, X: { value: 45700, delta: 300 }, "X Communities": { value: 79146, delta: 9 }, TikTok: { value: 24300, delta: 100 } }, pages: [{ name: "/kencarson", followers: 76270, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/BuZYYKZQ", followers: 153, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "destroy-lonely", name: "Destroy Lonely", subreddit: "destroylonely", totals: { value: 213034, delta: 59171 }, platforms: { Discord: { value: 36318, delta: 98 }, Reddit: { value: 55756, delta: 499 }, Instagram: { value: 65854, delta: 7484 }, "Instagram Channels": { value: 1600, delta: -2400 }, X: { value: 28706, delta: 28690 }, "X Communities": { value: 9200, delta: 0 }, TikTok: { value: 15600, delta: 0 } }, pages: [{ name: "/destroylonely", followers: 36318, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/bh3", followers: 1867, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "hxg", name: "HXG", subreddit: "homixidegang", totals: { value: 37566, delta: -231 }, platforms: { Discord: { value: 10277, delta: -51 }, Reddit: { value: 8943, delta: 35 }, Instagram: { value: 18346, delta: -215 } }, pages: [{ name: "/hxg", followers: 10277, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "pierre-bourne", name: "Pi'erre Bourne", subreddit: "pierrebourne", totals: { value: 37147, delta: 171 }, platforms: { Discord: { value: 4955, delta: 53 }, Reddit: { value: 22381, delta: 104 }, Instagram: { value: 9424, delta: -14 }, "Instagram Channels": { value: 387, delta: 28 } }, pages: [{ name: "/pierrebourne", followers: 4955, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/yopierre", followers: 372, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "rema", name: "Rema", subreddit: "rema", totals: { value: 2123652, delta: 4239 }, platforms: { Discord: { value: 2541, delta: 23 }, Reddit: { value: 308, delta: 4 }, Instagram: { value: 698524, delta: 3991 }, X: { value: 22179, delta: -79 }, TikTok: { value: 1400100, delta: 300 } }, pages: [{ name: "/heisrema", followers: 2541, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "untiljapan", name: "untiljapan", subreddit: "untiljapan", totals: { value: 6802, delta: 136 }, platforms: { Discord: { value: 2039, delta: 44 }, Reddit: { value: 1416, delta: -7 }, Instagram: { value: 1713, delta: 22 }, X: { value: 1079, delta: 60 }, "X Communities": { value: 555, delta: 17 }, TikTok: { value: 9, delta: 0 } }, pages: [{ name: "/untiljapan", followers: 2039, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "jim-legxacy", name: "Jim Legxacy", subreddit: "jimlegxacy", totals: { value: 10144, delta: 2202 }, platforms: { Discord: { value: 6089, delta: 1410 }, Reddit: { value: 359, delta: 39 }, Instagram: { value: 322, delta: 131 }, X: { value: 2362, delta: 235 }, "X Communities": { value: 261, delta: 23 }, TikTok: { value: 751, delta: 364 } }, pages: [{ name: "/PfeRaWF4bG", followers: 6089, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "apollored1", name: "ApolloRed1", subreddit: "apollored1", totals: { value: 1659, delta: 80 }, platforms: { Discord: { value: 283, delta: 44 }, Reddit: { value: 56, delta: 8 }, Instagram: { value: 1320, delta: 28 } }, pages: [{ name: "/apollohub", followers: 564, latest: "Apr 9, 2026", platform: "Discord" }, { name: "/apollored1", followers: 283, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "destin-laurel", name: "Destin Laurel", subreddit: "destinlaurel", totals: { value: 0, delta: 0 }, platforms: {}, pages: [] },
  { slug: "2hollis", name: "2hollis", subreddit: "2hollis", totals: { value: 0, delta: 0 }, platforms: {}, pages: [] },
];

const MOCK_FEED = {
  "playboi-carti": [
    { platform: "Reddit", page: "/r/playboicarti", author: "u/tearsofravage", time: "12m ago", title: "New snippet from the Antagonist sessions leaked on Discord", body: "Production credits line up with what Wheezy hinted at last week.", engagement: { upvotes: 2847, comments: 412 }, media: "image", sentiment: "hype" },
    { platform: "Instagram", page: "@playboicarti", author: "playboicarti", time: "2h ago", title: null, body: "Antagonist. 06.13.", engagement: { likes: 847293, comments: 23847 }, media: "image", sentiment: "hype" },
    { platform: "X", page: "@playboicarti", author: "playboicarti", time: "6h ago", title: null, body: "soon.", engagement: { likes: 67482, reposts: 12847, replies: 8394 }, sentiment: "hype" },
  ],
  "ken-carson": [
    { platform: "Instagram", page: "@kencarson", author: "kencarson", time: "23m ago", title: null, body: "A CHAIN FOR THE TEEN X.", engagement: { likes: 234827, comments: 4829 }, media: "image", sentiment: "hype" },
  ],
  "destroy-lonely": [
    { platform: "X", page: "@destroylonely", author: "destroylonely", time: "15m ago", title: null, body: "LOVE LASTS 4EVER DELUXE. 14 NEW TRACKS. MAY 22.", engagement: { likes: 28490, reposts: 8471, replies: 2847 }, sentiment: "hype" },
  ],
  "rema": [
    { platform: "TikTok", page: "@heisrema", author: "heisrema", time: "18m ago", title: null, body: "HEIS. world tour. Lagos kickoff", engagement: { likes: 1284273, comments: 48273, shares: 184273 }, media: "video", sentiment: "hype" },
  ],
  "hxg": [
    { platform: "Reddit", page: "/r/homixidegang", author: "u/hxg_forever", time: "2h ago", title: "Snot x Beno collab album rumors", body: "Someone in the Carti Discord dropped a snippet.", engagement: { upvotes: 847, comments: 184 }, sentiment: "hype" },
  ],
  "pierre-bourne": [
    { platform: "X", page: "@pierrebourne", author: "pierrebourne", time: "1h ago", title: null, body: "SossHouse Vol 3 mastering wrapped. release window q3.", engagement: { likes: 8473, reposts: 1247, replies: 384 }, sentiment: "hype" },
  ],
  "opium": [
    { platform: "Instagram", page: "@opium", author: "opium", time: "45m ago", title: null, body: "OPIUM TOUR 2026. full lineup next week.", engagement: { likes: 184273, comments: 8472 }, media: "image", sentiment: "hype" },
  ],
  "untiljapan": [
    { platform: "Discord", page: "/untiljapan", author: "untiljapan_mod", time: "1h ago", title: "#new-release", body: "EP drops Friday. 6 tracks, all produced with 808 Mafia.", engagement: { reactions: 247, replies: 84 }, sentiment: "positive" },
  ],
  "apollored1": [
    { platform: "Instagram", page: "@apollo", author: "apollored1", time: "3h ago", title: null, body: "BACK FROM HIATUS. new music soon.", engagement: { likes: 8471, comments: 847 }, media: "image", sentiment: "hype" },
  ],
  "jim-legxacy": [
    { platform: "TikTok", page: "@pfeproject", author: "pfeproject", time: "22m ago", title: null, body: "unreleased snippet → full track on friday", engagement: { likes: 18472, comments: 847, shares: 2847 }, media: "video", sentiment: "hype" },
  ],
};

function buildHistory(artist) {
  const months = [];
  const start = new Date(2022, 7, 1);
  const end = new Date(2026, 2, 1);
  const cur = new Date(start);
  while (cur <= end) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
  const seedFromSlug = artist.slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (i) => { const x = Math.sin(seedFromSlug * 97 + i * 13) * 10000; return x - Math.floor(x); };
  return months.map((d, i) => {
    const t = i / (months.length - 1);
    const row = { date: d.toISOString().slice(0, 7) };
    Object.keys(artist.platforms).forEach((plat, pIdx) => {
      const current = artist.platforms[plat].value;
      let curve;
      if (plat === "Reddit") curve = Math.pow(t, 0.6);
      else if (plat === "Instagram") { const base = Math.pow(t, 0.8); const wobble = Math.sin(t * 9 + pIdx) * 0.04; curve = Math.max(0, base + wobble); }
      else if (plat === "Discord") curve = Math.pow(t, 1.1);
      else if (plat === "TikTok") curve = t < 0.3 ? 0 : Math.pow((t - 0.3) / 0.7, 0.7);
      else if (plat === "X") curve = t < 0.4 ? 0 : (t - 0.4) / 0.6;
      else curve = Math.pow(t, 1.3);
      const noise = (rand(i * 7 + pIdx) - 0.5) * 0.03;
      row[plat] = Math.max(0, Math.round(current * (curve + noise)));
    });
    return row;
  });
}

const fmt = (n) => { if (n === undefined || n === null) return "—"; const abs = Math.abs(n); if (abs >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2) + "M"; if (abs >= 10_000) return (n / 1_000).toFixed(0) + "K"; if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"; return n.toLocaleString(); };
const fmtFull = (n) => (n ?? 0).toLocaleString();
const fmtPageDate = (s: string) => { const [m, d, y] = s.split("/").map(Number); const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]; return y === new Date().getFullYear() ? `${mon} ${d}` : `${mon} ${d}, ${y}`; };
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("en", { month: "short", year: "numeric" }); };

function platformShareData(artist) {
  return Object.entries(artist.platforms).map(([name, v]) => ({ name, value: v.value, fill: PLATFORMS[name]?.color || "#888" })).sort((a, b) => b.value - a.value);
}
function monthlyVelocity(history, plats) {
  const recent = history.slice(-13);
  return recent.slice(1).map((row, i) => {
    const prev = recent[i];
    const total = plats.reduce((s, p) => s + (row[p] || 0), 0);
    const totalPrev = plats.reduce((s, p) => s + (prev[p] || 0), 0);
    return { date: row.date, net: total - totalPrev };
  });
}

// ---- Components ----

function DeltaPill({ value, small = false }: { value: number | null | undefined; small?: boolean }) {
  if (value === 0 || value === null || value === undefined)
    return <span className={`text-muted ${small ? "text-[10px]" : "text-xs"} font-medium`}>—</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center font-bold tabular-nums rounded-full ${
      small ? "text-[10px] px-1.5 py-px" : "text-xs px-2 py-0.5"
    } ${up ? "bg-emerald-50 text-pos" : "bg-rose-50 text-neg"}`}>
      {up ? "+" : ""}{fmt(value)}
    </span>
  );
}

function KpiTile({ platform, value, delta }: { platform: string; value: number; delta: number }) {
  const cfg = PLATFORMS[platform];
  return (
    <div className="rounded-xl px-3 py-2 bg-white border border-line shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        {cfg && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted truncate">{platform}</span>
      </div>
      <div className="font-bold tabular-nums text-lg text-primary leading-none">{fmtFull(value)}</div>
      <div className="mt-1"><DeltaPill value={delta} /></div>
    </div>
  );
}

const iconFor = (slug: string) => `${import.meta.env.BASE_URL}icons/${slug}.png`;

function SidebarArtistRow({ artist, active, onClick }: { artist: any; active: boolean; onClick: () => void }) {
  const icon = iconFor(artist.slug);
  const initial = artist.name.charAt(0);
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 py-2 rounded-xl transition-all text-left border-l-2 pl-2.5 pr-3 ${
        active ? "border-l-brand bg-[#eef0ff]" : "border-l-transparent hover:bg-slate-50"
      }`}
    >
      <div
        className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs"
        style={{ background: active ? "rgba(0,13,255,0.12)" : "#f1f5f9" }}
      >
        <img
          src={icon}
          alt={artist.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            el.style.display = "none";
            if (el.parentElement) el.parentElement.textContent = initial;
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold truncate leading-tight ${active ? "text-brand" : "text-primary"}`}>
          {artist.name}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] tabular-nums font-medium text-muted">{fmt(artist.totals.value)}</span>
          <DeltaPill value={artist.totals.delta} small />
        </div>
      </div>
    </button>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-line rounded-xl shadow-lg p-3 text-xs">
      <div className={`${EYEBROW} mb-2`}>
        {label && typeof label === "string" && label.includes("-") ? monthLabel(label) : label}
      </div>
      <div className="space-y-1.5">
        {payload.slice().sort((a, b) => b.value - a.value).map((p) => (
          <div key={p.dataKey || p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-secondary flex-1">{p.name}</span>
            <span className="font-semibold tabular-nums text-primary ml-3">{fmtFull(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function engagementSummary(post) {
  const e = post.engagement;
  if (post.platform === "Reddit") return [{ icon: ArrowUp, label: fmt(e.upvotes) }, { icon: MessageSquare, label: fmt(e.comments) }];
  if (post.platform === "Discord") return [{ icon: Heart, label: fmt(e.reactions) }, { icon: MessageSquare, label: fmt(e.replies) }];
  if (post.platform === "X") return [{ icon: Heart, label: fmt(e.likes) }, { icon: Repeat2, label: fmt(e.reposts) }, { icon: MessageSquare, label: fmt(e.replies) }];
  if (post.platform === "TikTok") return [{ icon: Heart, label: fmt(e.likes) }, { icon: MessageSquare, label: fmt(e.comments) }, { icon: Repeat2, label: fmt(e.shares) }];
  return [{ icon: Heart, label: fmt(e.likes) }, { icon: MessageSquare, label: fmt(e.comments) }];
}

const SENTIMENT_STYLE = {
  hype: { bg: "bg-amber-100", text: "text-amber-700", label: "HYPE" },
  positive: { bg: "bg-emerald-100", text: "text-emerald-700", label: "POSITIVE" },
  neutral: { bg: "bg-slate-100", text: "text-secondary", label: "NEUTRAL" },
  negative: { bg: "bg-rose-100", text: "text-rose-700", label: "WATCH" },
};

function FeedCard({ post }: { post: any }) {
  const cfg = PLATFORMS[post.platform];
  const sent = SENTIMENT_STYLE[post.sentiment];
  return (
    <div className="group relative bg-white border border-line rounded-2xl hover:border-slate-300 hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg?.soft || "#f1f5f9" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: cfg?.color || "#94a3b8" }} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-primary truncate">{post.page}</div>
              <div className="text-[10px] text-muted truncate">@{post.author.replace(/^u\//, "").replace(/^@/, "")} · {post.time}</div>
            </div>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${sent.bg} ${sent.text} shrink-0`}>{sent.label}</span>
        </div>
        {post.title && <div className="text-[13px] text-primary font-semibold leading-snug mb-1 line-clamp-2">{post.title}</div>}
        <div className="text-xs text-secondary leading-relaxed line-clamp-3">{post.body}</div>
        {post.media && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted bg-slate-50 px-2 py-1 rounded-xl w-fit">
            {post.media === "video" ? <Play size={10} /> : <ImageIcon size={10} />}
            <span className="uppercase tracking-wider font-semibold">{post.media}</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-divider">
          <div className="flex items-center gap-3.5">
            {engagementSummary(post).map((e, i) => {
              const Icon = e.icon;
              return (
                <div key={i} className="flex items-center gap-1 text-[11px] text-secondary font-medium">
                  <Icon size={11} strokeWidth={2.2} />
                  <span className="tabular-nums">{e.label}</span>
                </div>
              );
            })}
          </div>
          {post.link
            ? <a href={post.link} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition text-[10px] text-muted hover:text-primary flex items-center gap-1 font-medium">open <ExternalLink size={10} /></a>
            : <span className="opacity-0 group-hover:opacity-100 transition text-[10px] text-muted flex items-center gap-1 font-medium">open <ExternalLink size={10} /></span>
          }
        </div>
      </div>
    </div>
  );
}

// ---- Main dashboard ----

export default function FanDashboard() {
  const [selectedSlug, setSelectedSlug] = useState("opium");
  const [pieHover, setPieHover] = useState<{ name: string; value: number; fill: string } | null>(null);
  const [piePos, setPiePos] = useState<{ x: number; y: number } | null>(null);
  const [hiddenPlats, setHiddenPlats] = useState(new Set());
  const [feedFilter, setFeedFilter] = useState("All");
  const [yearRange, setYearRange] = useState("all");
  const [pagesPlatform, setPagesPlatform] = useState("Discord");
  const [pagesDropdownOpen, setPagesDropdownOpen] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const pagesListRef = React.useRef<HTMLDivElement>(null);
  const [pagesAtBottom, setPagesAtBottom] = useState(false);
  const [redditPosts, setRedditPosts] = useState<any[]>([]);
  const [redditLoading, setRedditLoading] = useState(false);
  const [sheetsData, setSheetsData] = useState<Record<string, any>>({});
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [, setNowTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot(): Promise<boolean> {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data.json`, { cache: "no-store" });
        if (!res.ok) return false;
        const json = await res.json();
        if (!json?.artists || Object.keys(json.artists).length === 0) return false;
        if (cancelled) return true;
        setSheetsData(json.artists);
        setSyncedAt(json.syncedAt ? new Date(json.syncedAt) : null);
        setSheetsLoading(false);
        return true;
      } catch {
        return false;
      }
    }

    async function loadFallback() {
      const cached = getCached<Record<string, any>>("fanIntel_sheets", CACHE_MS.sheets);
      if (cached) {
        if (cancelled) return;
        setSheetsData(cached.data);
        setSyncedAt(new Date(cached.ts));
        setSheetsLoading(false);
        return;
      }

      let gidMap: Record<string, string> = {};
      try {
        gidMap = await fetchGidMap(SHEET_ID);
      } catch (err) {
        console.error("[sheets] Could not read GID map:", err);
        setSheetsLoading(false);
        return;
      }
      if (cancelled) return;

      const results: Record<string, any> = {};
      await Promise.all(
        STATIC_ARTISTS.map(async (a) => {
          const tabs = sheetTabs(a.name);
          const networkGid = gidMap[tabs.network];
          const pagesGid = gidMap[tabs.pages];
          if (!networkGid || !pagesGid) {
            console.warn(`[sheets] ${a.name}: tab not found in GID map.`);
            return;
          }
          try {
            const [networkRows, pagesRows] = await Promise.all([
              fetchSheetByGid(SHEET_ID, networkGid),
              fetchSheetByGid(SHEET_ID, pagesGid),
            ]);
            const { history, platforms, totals } = parseNetworkTab(networkRows);
            const pages = parsePagesTab(pagesRows);
            results[a.slug] = { history, platforms, totals, pages };
          } catch (err) {
            console.warn(`[sheets] ${a.name}:`, err);
          }
        })
      );

      if (cancelled) return;
      if (Object.keys(results).length > 0) {
        setSheetsData(results);
        setSyncedAt(new Date());
        setCached("fanIntel_sheets", results);
      }
      setSheetsLoading(false);
    }

    loadSnapshot().then((ok) => {
      if (!ok && !cancelled) {
        loadFallback().catch((err) => {
          console.error("[sheets] fallback failed:", err);
          if (!cancelled) setSheetsLoading(false);
        });
      }
    });

    return () => { cancelled = true; };
  }, []);

  const artists = useMemo(
    () => STATIC_ARTISTS.map((a) => ({ ...a, ...(sheetsData[a.slug] || {}) })),
    [sheetsData]
  );

  const artist = artists.find((a) => a.slug === selectedSlug)!;

  useEffect(() => {
    setFeedFilter("All");
    setPagesPlatform("Discord");
    setPieHover(null);
    setHiddenPlats(new Set());
    setShowStarredOnly(false);
  }, [selectedSlug]);

  useEffect(() => {
    const subreddit = STATIC_ARTISTS.find((a) => a.slug === selectedSlug)?.subreddit;
    if (!subreddit) { setRedditPosts([]); return; }
    let cancelled = false;
    setRedditLoading(true);
    setRedditPosts([]);
    const redditUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=6&raw_json=1`;

    const parseRedditData = (data: any) => {
      return (data.data?.children || []).filter((child: any) => !child.data.stickied).map((child: any) => {
        const p = child.data;
        const mins = Math.floor((Date.now() - p.created_utc * 1000) / 60000);
        const time = mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`;
        return {
          platform: "Reddit", page: `/r/${p.subreddit}`, author: `u/${p.author}`, time,
          title: p.title,
          body: p.selftext ? (p.selftext.length > 200 ? p.selftext.slice(0, 200) + "…" : p.selftext) : null,
          engagement: { upvotes: p.score, comments: p.num_comments },
          media: p.post_hint === "image" ? "image" : p.is_video ? "video" : undefined,
          sentiment: p.score > 2000 ? "hype" : p.score < 0 ? "negative" : "neutral",
          link: `https://reddit.com${p.permalink}`,
        };
      });
    };

    const tryFetch = async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    };

    async function loadReddit() {
      const cacheKey = `fanIntel_reddit_${selectedSlug}`;
      const cached = getCached<any[]>(cacheKey, CACHE_MS.reddit);
      if (cached) {
        if (!cancelled) { setRedditPosts(cached.data); setRedditLoading(false); }
        return;
      }
      const attempts = [
        `${WORKER_URL}/reddit?subreddit=${subreddit}`,
        redditUrl,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(redditUrl)}`,
      ];
      for (const url of attempts) {
        try {
          const data = await tryFetch(url);
          if (cancelled) return;
          const posts = parseRedditData(data);
          if (posts.length > 0) { setRedditPosts(posts); setRedditLoading(false); setCached(cacheKey, posts); return; }
        } catch { /* try next */ }
      }
      if (!cancelled) {
        const mockReddit = (MOCK_FEED[selectedSlug] || []).filter((p: any) => p.platform === "Reddit");
        setRedditPosts(mockReddit);
        setRedditLoading(false);
      }
    }

    loadReddit();
    return () => { cancelled = true; };
  }, [selectedSlug]);

  const fullHistory = useMemo(
    () => sheetsData[selectedSlug]?.history?.length ? sheetsData[selectedSlug].history : buildHistory(artist),
    [sheetsData, selectedSlug, artist]
  );

  const history = useMemo(() => {
    if (yearRange === "all") return fullHistory;
    const latestDate = fullHistory.length > 0 ? new Date(fullHistory[fullHistory.length - 1].date + "-01") : new Date();
    const latestYear = latestDate.getFullYear();
    if (yearRange === "ytd") return fullHistory.filter((r) => r.date >= `${latestYear}-01`);
    if (yearRange === "12m") { const c = new Date(latestDate); c.setMonth(c.getMonth() - 12); return fullHistory.filter((r) => new Date(r.date + "-01") >= c); }
    if (yearRange === "6m") { const c = new Date(latestDate); c.setMonth(c.getMonth() - 6); return fullHistory.filter((r) => new Date(r.date + "-01") >= c); }
    if (yearRange === "3m") { const c = new Date(latestDate); c.setMonth(c.getMonth() - 3); return fullHistory.filter((r) => new Date(r.date + "-01") >= c); }
    return fullHistory.filter((r) => r.date.startsWith(yearRange));
  }, [fullHistory, yearRange]);

  const rangeStats = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0];
    const last = history[history.length - 1];
    const plats = Object.keys(artist.platforms);
    const startTotal = plats.reduce((s, p) => s + (first[p] || 0), 0);
    const endTotal = plats.reduce((s, p) => s + (last[p] || 0), 0);
    const net = endTotal - startTotal;
    const pct = startTotal > 0 ? ((net / startTotal) * 100) : 0;
    let bestMonth = null;
    let bestGain = -Infinity;
    for (let i = 1; i < history.length; i++) {
      const prev = plats.reduce((s, p) => s + (history[i - 1][p] || 0), 0);
      const cur = plats.reduce((s, p) => s + (history[i][p] || 0), 0);
      const gain = cur - prev;
      if (gain > bestGain) { bestGain = gain; bestMonth = history[i].date; }
    }
    return { startTotal, endTotal, net, pct, bestMonth, bestGain };
  }, [history, artist]);

  const orderedPlats = PLAT_ORDER.filter((p) => artist.platforms[p] !== undefined);

  const yScale = useMemo(() => {
    const active = orderedPlats.filter((p) => !hiddenPlats.has(p));
    const cur = Math.max(...active.map((p) => artist.platforms[p]?.value || 0), 1);
    const hist = Math.max(...history.flatMap((d) => active.map((p) => (d[p] as number) || 0)), 1);
    const maxVal = hist <= cur * 2 ? hist : cur;
    const rawStep = maxVal / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    const step = ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10].find((f) => f >= norm) ?? 10) * mag;
    return { ticks: [0, step, step * 2, step * 3, step * 4], max: step * 4 };
  }, [orderedPlats, hiddenPlats, artist, history]);

  const fpAvailablePlatforms = useMemo(() => {
    const set = new Set(artist.pages.map((p) => p.platform).filter(Boolean));
    return PLAT_ORDER.filter((p) => set.has(p));
  }, [artist.pages]);

  const fpEffectivePlatform = fpAvailablePlatforms.includes(pagesPlatform)
    ? pagesPlatform
    : fpAvailablePlatforms.includes("Discord")
    ? "Discord"
    : fpAvailablePlatforms[0] || "Discord";

  const filteredPages = useMemo(
    () => artist.pages
      .filter((p) => p.platform === fpEffectivePlatform && (!showStarredOnly || p.managed))
      .sort((a, b) => b.followers - a.followers),
    [artist.pages, fpEffectivePlatform, showStarredOnly]
  );

  const togglePlat = (p) => {
    const next = new Set(hiddenPlats);
    if (next.has(p)) { next.delete(p); }
    else {
      const visibleCount = orderedPlats.filter((x) => !next.has(x)).length;
      if (visibleCount <= 1) return;
      next.add(p);
    }
    setHiddenPlats(next);
  };

  const syncLabel = sheetsLoading
    ? "syncing…"
    : syncedAt
    ? (() => {
        const mins = Math.floor((Date.now() - syncedAt.getTime()) / 60000);
        if (mins < 60) return `synced ${mins || "<1"}m ago`;
        return `synced ${Math.floor(mins / 60)}h ago`;
      })()
    : "live";

  // ---- Render ----
  return (
    <div
      className="flex h-screen overflow-hidden text-primary"
      style={{ background: "#f1f5f9", fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        .recharts-cartesian-axis-tick text { fill: #94a3b8; font-size: 10px; font-weight: 500; }
        .recharts-cartesian-grid line { stroke: #e2e8f0; }
      `}</style>

      {sheetsLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-secondary">Loading data…</span>
          </div>
        </div>
      )}

      {/* ---- Sidebar ---- */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-line overflow-hidden bg-white">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-line flex items-center gap-3 shrink-0">
          <div className="relative w-8 h-8 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-blue-300/40">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
              <path d="M4 20 L4 4 L12 4 L12 11 L20 11 L20 20 Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
              <circle cx="12" cy="11" r="1.5" fill="white" />
            </svg>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-white animate-pulse" />
          </div>
          <div className="leading-none">
            <div className="text-sm font-bold text-primary tracking-tight">
              FAN<span className="text-brand">INTEL</span>
            </div>
          </div>
        </div>

        {/* Roster header */}
        <div className="px-4 pt-4 pb-2 shrink-0 flex items-center justify-between">
          <span className={EYEBROW}>Roster</span>
          <span className="text-[10px] text-muted font-medium bg-slate-100 px-1.5 py-px rounded-md">{artists.length}</span>
        </div>

        {/* Artist list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-px" style={{ scrollbarWidth: "thin" }}>
          {artists.map((a) => (
            <SidebarArtistRow key={a.slug} artist={a} active={a.slug === selectedSlug} onClick={() => setSelectedSlug(a.slug)} />
          ))}
        </div>

        {/* Sync status */}
        <div className="px-4 py-3 border-t border-divider shrink-0 flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sheetsLoading ? "bg-amber-400" : "bg-emerald-500 animate-pulse"}`} />
          <span className="text-[10px] font-semibold text-muted truncate">{syncLabel}</span>
        </div>
      </aside>

      {/* ---- Main ---- */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header bar */}
        <header className="shrink-0 px-6 py-4 border-b border-line bg-white flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center font-bold text-lg bg-slate-100">
              <img
                src={iconFor(artist.slug)}
                alt={artist.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                  if (el.parentElement) el.parentElement.textContent = artist.name.charAt(0);
                }}
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-primary leading-none truncate">{artist.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <div className={`${EYEBROW} mb-1`}>Cumulative Reach</div>
              <div className="text-2xl font-bold tabular-nums text-primary leading-none">{fmtFull(artist.totals.value)}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <DeltaPill value={artist.totals.delta} />
              <span className="text-[10px] text-muted font-medium">last 28d</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 min-h-0 p-4 flex flex-col gap-3 overflow-hidden">

          {/* KPI strip */}
          {orderedPlats.length > 0 && (
            <div
              className="shrink-0 grid gap-3"
              style={{ gridTemplateColumns: `repeat(${orderedPlats.length}, 1fr)` }}
            >
              {orderedPlats.map((p) => (
                <KpiTile key={p} platform={p} value={artist.platforms[p].value} delta={artist.platforms[p].delta} />
              ))}
            </div>
          )}

          {/* Middle row: growth chart + fan page tracker */}
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-3">

            {/* Growth chart */}
            <div className={`col-span-8 ${CARD} flex flex-col overflow-hidden`}>
              <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-4 shrink-0 flex-wrap">
                <div>
                  <div className={EYEBROW}>Fan Network Growth</div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Platform toggles */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {orderedPlats.map((p) => {
                      const off = hiddenPlats.has(p);
                      return (
                        <button
                          key={p}
                          onClick={() => togglePlat(p)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition border ${
                            off
                              ? "border-line text-muted bg-slate-50"
                              : "border-line text-secondary bg-white hover:border-slate-300"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: off ? "#cbd5e1" : PLATFORMS[p].color }} />
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  {/* Range selector */}
                  <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl shrink-0">
                    {[
                      { key: "3m", label: "3M" },
                      { key: "6m", label: "6M" },
                      { key: "12m", label: "1Y" },
                      { key: "ytd", label: "YTD" },
                      { key: "all", label: "All" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setYearRange(opt.key)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${
                          yearRange === opt.key
                            ? "bg-white text-primary shadow-sm"
                            : "text-secondary hover:text-primary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Range stats strip */}
              {rangeStats && (
                <div className="mx-5 mb-3 flex shrink-0 rounded-2xl bg-blue-50 border border-blue-100 divide-x divide-blue-200">
                  <div className="flex-1 px-4 py-3">
                    <div className={`${EYEBROW} mb-1`}>Range Start</div>
                    <div className="text-base font-bold tabular-nums text-primary">{fmt(rangeStats.startTotal)}</div>
                  </div>
                  <div className="flex-1 px-4 py-3">
                    <div className={`${EYEBROW} mb-1`}>Range End</div>
                    <div className="text-base font-bold tabular-nums text-primary">{fmt(rangeStats.endTotal)}</div>
                  </div>
                  <div className="flex-1 px-4 py-3">
                    <div className={`${EYEBROW} mb-1`}>Net Growth</div>
                    <div className={`text-base font-bold tabular-nums flex items-center gap-1 ${rangeStats.net >= 0 ? "text-pos" : "text-neg"}`}>
                      {rangeStats.net >= 0 ? "+" : ""}{fmt(rangeStats.net)}
                      <span className="text-[10px] font-semibold">({rangeStats.pct >= 0 ? "+" : ""}{rangeStats.pct.toFixed(1).replace(/\.0$/, "")}%)</span>
                    </div>
                  </div>
                  <div className="flex-1 px-4 py-3">
                    <div className={`${EYEBROW} mb-1`}>Best Month</div>
                    <div className="text-base font-bold text-primary flex items-center gap-1.5">
                      {rangeStats.bestMonth ? monthLabel(rangeStats.bestMonth) : "—"}
                      {rangeStats.bestGain > 0 && <span className="text-xs text-pos font-semibold">+{fmt(rangeStats.bestGain)}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Chart area */}
              <div className="flex-1 min-h-0 p-4">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted text-sm">No data in the selected range</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={monthLabel}
                        interval={Math.max(0, Math.floor(history.length / 8))}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 500 }}
                      />
                      <YAxis
                        tickFormatter={fmt}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                        ticks={yScale.ticks}
                        domain={[0, yScale.max]}
                        tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 500 }}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
                        wrapperStyle={{ transition: "none" }}
                      />
                      {orderedPlats.map((p) => {
                        if (hiddenPlats.has(p)) return null;
                        return (
                          <Line
                            key={p}
                            type="monotone"
                            dataKey={p}
                            stroke={PLATFORMS[p].color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 2, stroke: "white" }}
                            isAnimationActive={false}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Fan Page Tracker */}
            <div className={`col-span-4 ${CARD} flex flex-col overflow-hidden`}>
              <div className="px-5 py-3 border-b border-line flex items-center justify-between shrink-0">
                <div>
                  <div className={EYEBROW}>Fan Page Tracker</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowStarredOnly((o) => !o)}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition border ${
                      showStarredOnly ? "bg-amber-50 border-amber-200" : "bg-white border-line hover:border-slate-300"
                    }`}
                    title="Show starred only"
                  >
                    <Star size={11} className={showStarredOnly ? "fill-amber-400 text-amber-400" : "text-muted"} />
                  </button>
                <div className="relative">
                  {pagesDropdownOpen && (
                    <div className="fixed inset-0 z-10" onClick={() => setPagesDropdownOpen(false)} />
                  )}
                  <button
                    onClick={() => setPagesDropdownOpen((o) => !o)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-line text-[10px] font-semibold text-secondary bg-white hover:border-slate-300 transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: PLATFORMS[fpEffectivePlatform]?.color ?? "#94a3b8" }} />
                    {fpEffectivePlatform}
                    <ChevronDown size={10} className="text-muted" />
                  </button>
                  {pagesDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-line rounded-2xl shadow-lg py-1.5 min-w-[190px]">
                      {fpAvailablePlatforms.map((plat) => (
                        <button
                          key={plat}
                          onClick={() => {
                            setPagesPlatform(plat);
                            setPagesDropdownOpen(false);
                            setPagesAtBottom(false);
                            if (pagesListRef.current) pagesListRef.current.scrollTop = 0;
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold transition hover:bg-slate-50 ${plat === fpEffectivePlatform ? "text-primary" : "text-muted"}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PLATFORMS[plat]?.color ?? "#94a3b8" }} />
                          {plat}
                          {plat === fpEffectivePlatform && <span className="ml-auto text-brand">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                </div>
              </div>

              <div
                ref={pagesListRef}
                className="flex-1 min-h-0 overflow-y-auto px-2 py-2"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setPagesAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
                }}
              >
                {filteredPages.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-muted">No {fpEffectivePlatform} pages tracked yet</div>
                ) : (
                  <div className="space-y-px">
                    {filteredPages.map((p, i) => {
                      const platCfg = PLATFORMS[fpEffectivePlatform] || { soft: "#f1f5f9", color: "#94a3b8" };
                      const Tag = p.link ? "a" : "div";
                      return (
                        <Tag
                          key={p.link || `${p.platform}-${p.name}-${i}`}
                          {...(p.link ? { href: p.link, target: "_blank", rel: "noopener noreferrer" } : {})}
                          className="p-2.5 flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer group rounded-xl no-underline"
                        >
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: platCfg.soft }}
                          >
                            <span className="text-xs font-bold" style={{ color: platCfg.color }}>{String(i + 1).padStart(2, "0")}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <div className="text-sm font-semibold text-primary group-hover:text-brand transition truncate">{p.name}</div>
                              {p.managed && <Star size={10} className="shrink-0 text-amber-400 fill-amber-400" />}
                            </div>
                            <div className="text-[10px] text-muted mt-0.5 truncate">
                              {p.latest ? `Last post ${fmtPageDate(p.latest)}` : p.platform}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold tabular-nums text-primary">{fmtFull(p.followers)}</div>
                            <div className="text-[10px] text-muted">{MEMBER_PLATFORMS.has(fpEffectivePlatform) ? "members" : "followers"}</div>
                          </div>
                        </Tag>
                      );
                    })}
                  </div>
                )}
              </div>

              {filteredPages.length > 0 && (
                <div className="px-5 py-2 border-t border-divider flex items-center justify-between shrink-0">
                  <span className="text-[10px] text-muted font-medium">
                    {filteredPages.length} {(() => {
                      const n = filteredPages.length;
                      if (fpEffectivePlatform === "Discord") return n === 1 ? "server" : "servers";
                      if (fpEffectivePlatform === "Reddit") return n === 1 ? "subreddit" : "subreddits";
                      if (fpEffectivePlatform === "Instagram Channels") return n === 1 ? "channel" : "channels";
                      if (fpEffectivePlatform === "X Communities") return n === 1 ? "community" : "communities";
                      return n === 1 ? "page" : "pages";
                    })()} tracked
                  </span>
                  {!pagesAtBottom && filteredPages.length > 6 && (
                    <span className="text-[10px] text-muted font-medium flex items-center gap-1">scroll <ChevronDown size={10} /></span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Analytics row */}
          <div className="shrink-0 grid grid-cols-3 gap-3" style={{ height: "230px" }}>

            {/* Platform Share */}
            <div className={`${CARD} p-4 flex flex-col overflow-hidden`}>
              <div className="flex items-center gap-2 shrink-0 mb-1">
                <div className="w-5 h-5 rounded-lg bg-blue-100 flex items-center justify-center">
                  <PieIcon size={11} className="text-blue-600" />
                </div>
                <div className={EYEBROW}>Platform Share</div>
              </div>
              <div className="flex-1 min-h-0 flex items-center gap-3">
                <div
                  className="relative h-full aspect-square shrink-0"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setPiePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                  onMouseLeave={() => { setPieHover(null); setPiePos(null); }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformShareData(artist)}
                        innerRadius="42%" outerRadius="72%"
                        dataKey="value" stroke="white" strokeWidth={2}
                        startAngle={90} endAngle={-270}
                        isAnimationActive={false}
                        onMouseEnter={(d) => setPieHover({ name: d.name, value: d.value, fill: d.payload?.fill || d.fill })}
                        onMouseLeave={() => setPieHover(null)}
                      >
                        {platformShareData(artist).map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[9px] font-semibold uppercase tracking-widest text-muted">Total</div>
                    <div className="font-bold text-sm text-primary tabular-nums">{fmt(artist.totals.value)}</div>
                  </div>
                  {pieHover && piePos && (
                    <div
                      className="absolute pointer-events-none z-10 flex items-center gap-2 text-xs bg-white border border-line rounded-xl px-3 py-1.5 shadow-lg whitespace-nowrap"
                      style={{ left: piePos.x + 14, top: piePos.y - 16, transform: "translateY(-50%)" }}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: pieHover.fill }} />
                      <span className="text-secondary font-medium">{pieHover.name}</span>
                      <span className="font-bold tabular-nums text-primary">{fmtFull(pieHover.value)}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  {platformShareData(artist).slice(0, 4).map((d) => {
                    const pct = artist.totals.value > 0 ? ((d.value / artist.totals.value) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: d.fill }} />
                        <span className="text-secondary flex-1 font-medium truncate">{d.name}</span>
                        <span className="font-bold text-primary tabular-nums shrink-0">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Growth Velocity */}
            <div className={`${CARD} p-4 flex flex-col overflow-hidden`}>
              <div className="flex items-center gap-2 shrink-0 mb-1">
                <div className="w-5 h-5 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Zap size={11} className="text-amber-600" />
                </div>
                <div className={EYEBROW}>Growth Velocity · 12mo</div>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyVelocity(history, orderedPlats)} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(ym) => monthLabel(ym).split(" ")[0]}
                      axisLine={false} tickLine={false} interval={1}
                      tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 500 }}
                    />
                    <YAxis
                      tickFormatter={fmt} axisLine={false} tickLine={false} width={36}
                      tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 500 }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="bg-white border border-line rounded-xl shadow-lg p-3 text-xs">
                            <div className={EYEBROW}>{monthLabel(label)}</div>
                            <div className="font-bold tabular-nums text-primary text-sm mt-1">
                              {payload[0].value >= 0 ? "+" : ""}{fmtFull(payload[0].value)}
                            </div>
                          </div>
                        ) : null
                      }
                      cursor={{ fill: "#f1f5f9" }}
                      wrapperStyle={{ transition: "none" }}
                    />
                    <Bar dataKey="net" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {monthlyVelocity(history, orderedPlats).map((d, i) => (
                        <Cell key={i} fill={d.net >= 0 ? "#059669" : "#f43f5e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fastest Movers */}
            <div className={`${CARD} p-4 flex flex-col overflow-hidden`}>
              <div className="flex items-center gap-2 shrink-0 mb-1">
                <div className="w-5 h-5 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <ArrowUpRight size={11} className="text-pos" />
                </div>
                <div className={EYEBROW}>Fastest Movers · 28d</div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto -mx-1" style={{ scrollbarWidth: "none" }}>
                {artists
                  .slice()
                  .sort((a, b) => Math.abs(b.totals.delta) - Math.abs(a.totals.delta))
                  .slice(0, 5)
                  .map((a, i) => {
                    const up = a.totals.delta >= 0;
                    return (
                      <button
                        key={a.slug}
                        onClick={() => setSelectedSlug(a.slug)}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 transition text-left"
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          i === 0 ? "bg-amber-100 text-amber-700"
                          : i === 1 ? "bg-slate-100 text-secondary"
                          : i === 2 ? "bg-orange-100 text-orange-700"
                          : "bg-slate-50 text-muted"
                        }`}>
                          {i + 1}
                        </div>
                        <span className="flex-1 text-sm font-semibold text-primary truncate">{a.name}</span>
                        <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full shrink-0 ${up ? "bg-emerald-50 text-pos" : "bg-rose-50 text-neg"}`}>
                          {up ? "+" : ""}{fmt(a.totals.delta)}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
