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
} from "recharts";
import {
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  Star,
  LayoutList,
  Gauge,
  TrendingUp,
  Filter,
} from "lucide-react";

// ---- Platform tokens ----
const PLATFORMS = {
  Discord: { color: "#5865F2" },
  Reddit: { color: "#FF4500" },
  Instagram: { color: "#FF0069" },
  "Instagram Channels": { color: "#D300C5" },
  X: { color: "#000000" },
  "X Communities": { color: "#808080" },
  TikTok: { color: "#25F4EE" },
};

// ---- Platform display order + classification ----
const PLAT_ORDER = ["Discord", "Reddit", "Instagram", "Instagram Channels", "X", "X Communities", "TikTok"];
const MEMBER_PLATFORMS = new Set(["Discord", "Reddit", "X Communities", "Instagram Channels"]);

// ---- Design tokens ----
const CARD = "bg-white rounded-[var(--rad)]";

// ---- Cloudflare Worker proxy ----
const WORKER_URL = "https://fanintel.smudgy-mute2q.workers.dev";

// ---- Google Sheets config ----
const SHEET_ID = "2PACX-1vRX8lP3Nb-LWMmUoTtHDHihOX-SkhFMUXoQJIuinbUhctXSjgJ1CCI9NvO1MQZKdgy9jtG33DgrOtre";
const sheetTabs = (name: string) => ({ network: `${name} (Fan Network)`, pages: `${name} (Fan Pages)` });

// ---- LocalStorage cache utilities ----
const CACHE_MS = { sheets: 86_400_000 };

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

// ---- Artist roster (names/slugs only — all data comes from Sheets) ----
const STATIC_ARTISTS = [
  { slug: "opium", name: "Opium" },
  { slug: "playboi-carti", name: "Playboi Carti" },
  { slug: "ken-carson", name: "Ken Carson" },
  { slug: "destroy-lonely", name: "Destroy Lonely" },
  { slug: "hxg", name: "HXG" },
  { slug: "pierre-bourne", name: "Pi'erre Bourne" },
  { slug: "rema", name: "Rema" },
  { slug: "untiljapan", name: "untiljapan" },
  { slug: "jim-legxacy", name: "Jim Legxacy" },
  { slug: "apollored1", name: "ApolloRed1" },
  { slug: "destin-laurel", name: "Destin Laurel" },
  { slug: "2hollis", name: "2hollis" },
];


const fmt = (n) => { if (n === undefined || n === null) return "—"; const abs = Math.abs(n); if (abs >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2) + "M"; if (abs >= 10_000) return (n / 1_000).toFixed(0) + "K"; if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"; return n.toLocaleString(); };
const fmtFull = (n) => (n ?? 0).toLocaleString();
const fmtPageDate = (s: string) => { const [m, d, y] = s.split("/").map(Number); const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]; return y === new Date().getFullYear() ? `${mon} ${d}` : `${mon} ${d}, ${y}`; };
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("en", { month: "short", year: "numeric" }); };

function platformShareData(artist) {
  return Object.entries(artist.platforms).map(([name, v]) => ({ name, value: v.value, fill: PLATFORMS[name]?.color || "#888" })).sort((a, b) => b.value - a.value);
}
function monthlyVelocity(history, plats) {
  if (history.length < 2) return [];
  const latestYear = history[history.length - 1].date.slice(0, 4);
  const firstIdx = history.findIndex((r) => r.date >= `${latestYear}-01`);
  const startIdx = Math.max(0, (firstIdx === -1 ? history.length - 1 : firstIdx) - 1);
  const recent = history.slice(startIdx);
  return recent.slice(1).map((row, i) => {
    const prev = recent[i];
    const total = plats.reduce((s, p) => s + (row[p] || 0), 0);
    const totalPrev = plats.reduce((s, p) => s + (prev[p] || 0), 0);
    return { date: row.date, net: total - totalPrev };
  });
}

// ---- Components ----

function DeltaPill({ value, small = false }: { value: number | null | undefined; small?: boolean }) {
  if (value === null || value === undefined)
    return <span className={`text-muted ${small ? "text-[10px]" : "text-xs"} font-medium`}>—</span>;
  if (value === 0)
    return (
      <span className={`inline-flex items-center font-semibold tabular-nums rounded-full bg-[#f0f0f3] text-muted ${
        small ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
      }`}>
        0
      </span>
    );
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums rounded-full ${
      small ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
    } ${up ? "bg-[#e8f5ea] text-pos" : "bg-[#fdecea] text-neg"}`}>
      {up ? "+" : ""}{fmtFull(value)}
      <span className={small ? "text-[8px] -mr-0.5" : "text-[10px] -mr-0.5"}>{up ? "\u2197" : "\u2198"}</span>
    </span>
  );
}

const iconFor = (slug: string) => `./icons/${slug}.png`;

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload
    .filter((p) => p.value !== null && p.value !== undefined)
    .slice()
    .sort((a, b) => b.value - a.value);
  if (!rows.length) return null;
  return (
    <div className="bg-white rounded-[var(--rad)] p-3.5 min-w-[184px]" style={{ boxShadow: "0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -6px rgba(0,0,0,0.12), 0 24px 56px -16px rgba(0,0,0,0.16)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">
        {label && typeof label === "string" && label.includes("-") ? monthLabel(label) : label}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((p) => (
          <div key={p.dataKey || p.name} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-[14px] font-medium text-primary flex-1 whitespace-nowrap">{p.name}</span>
            <span className="text-[14px] font-semibold tabular-nums text-primary ml-6">{fmtFull(p.value)}</span>
          </div>
        ))}
        {rows.length > 1 && (
          <div className="flex items-center gap-2.5 pt-2 mt-0.5">
            <span className="w-2.5 h-2.5 shrink-0" />
            <span className="text-[14px] font-semibold text-primary flex-1">Total</span>
            <span className="text-[14px] font-bold tabular-nums text-primary ml-6">{fmtFull(rows.reduce((s, p) => s + (p.value || 0), 0))}</span>
          </div>
        )}
      </div>
    </div>
  );
}


// ---- Main dashboard ----

export default function FanDashboard() {
  const [selectedSlug, setSelectedSlug] = useState("opium");
  const [hiddenPlats, setHiddenPlats] = useState(new Set());
  const [yearRange, setYearRange] = useState("all");
  const [pagesPlatform, setPagesPlatform] = useState("Discord");
  const [pagesDropdownOpen, setPagesDropdownOpen] = useState(false);
  const [platDropdownOpen, setPlatDropdownOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const pagesListRef = React.useRef<HTMLDivElement>(null);
  const [pagesScrollable, setPagesScrollable] = useState(false);
  const [sbThumb, setSbThumb] = useState({ top: 0, height: 0, show: false });
  const sbDrag = React.useRef<{ startY: number; startScroll: number } | null>(null);
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
        const res = await fetch(`./data.json`, { cache: "no-store" });
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
    () => STATIC_ARTISTS.map((a) => ({
      slug: a.slug,
      name: a.name,
      totals: { value: 0, delta: 0 },
      platforms: {},
      pages: [],
      ...(sheetsData[a.slug] || {}),
    })),
    [sheetsData]
  );

  const artist = artists.find((a) => a.slug === selectedSlug)!;

  useEffect(() => {
    setPagesPlatform("Discord");
    setHiddenPlats(new Set());
    setShowStarredOnly(false);
  }, [selectedSlug]);

  const fullHistory = useMemo(
    () => sheetsData[selectedSlug]?.history || [],
    [sheetsData, selectedSlug]
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

  // Non-stacked line chart data: blank out each platform's leading zeros so its
  // line begins cleanly at launch instead of running along 0 then spiking up.
  const chartHistory = useMemo(() => {
    const firstIdx: Record<string, number> = {};
    orderedPlats.forEach((p) => { firstIdx[p] = history.findIndex((d) => ((d[p] as number) || 0) > 0); });
    return history.map((row, i) => {
      const next: any = { date: row.date };
      orderedPlats.forEach((p) => { next[p] = firstIdx[p] === -1 || i < firstIdx[p] ? null : ((row[p] as number) || 0); });
      return next;
    });
  }, [history, orderedPlats]);

  const velocityData = useMemo(() => monthlyVelocity(fullHistory, orderedPlats), [fullHistory, orderedPlats]);

  const yScale = useMemo(() => {
    const active = orderedPlats.filter((p) => !hiddenPlats.has(p));
    const maxVal = Math.max(1, ...history.map((d) => Math.max(0, ...active.map((p) => (d[p] as number) || 0))));
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

  const fpEntityPlural = fpEffectivePlatform === "Discord" ? "servers"
    : fpEffectivePlatform === "Reddit" ? "subreddits"
    : fpEffectivePlatform === "Instagram Channels" ? "channels"
    : fpEffectivePlatform === "X Communities" ? "communities"
    : "pages";
  const fpEntitySingular = fpEffectivePlatform === "Discord" ? "server"
    : fpEffectivePlatform === "Reddit" ? "subreddit"
    : fpEffectivePlatform === "Instagram Channels" ? "channel"
    : fpEffectivePlatform === "X Communities" ? "community"
    : "page";

  const SB_INSET = 22; // px inset top & bottom for the custom scrollbar track

  const updateScrollbar = React.useCallback(() => {
    const el = pagesListRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const trackH = clientHeight - SB_INSET * 2;
    const scrollable = scrollHeight > clientHeight + 4 && trackH > 24;
    setPagesScrollable(scrollHeight > clientHeight + 4);
    if (!scrollable) { setSbThumb((s) => (s.show ? { ...s, show: false } : s)); return; }
    const thumbH = Math.max(28, (clientHeight / scrollHeight) * trackH);
    const maxScroll = scrollHeight - clientHeight;
    const frac = maxScroll > 0 ? scrollTop / maxScroll : 0;
    const top = SB_INSET + frac * (trackH - thumbH);
    setSbThumb({ top, height: thumbH, show: true });
  }, []);

  useEffect(() => {
    const el = pagesListRef.current;
    if (!el) return;
    updateScrollbar();
    const ro = new ResizeObserver(updateScrollbar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filteredPages, fpEffectivePlatform, showStarredOnly, updateScrollbar]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = pagesListRef.current;
      if (!el || !sbDrag.current) return;
      const trackH = el.clientHeight - SB_INSET * 2;
      const thumbH = Math.max(28, (el.clientHeight / el.scrollHeight) * trackH);
      const maxScroll = el.scrollHeight - el.clientHeight;
      const dy = e.clientY - sbDrag.current.startY;
      const deltaScroll = (dy / (trackH - thumbH)) * maxScroll;
      el.scrollTop = sbDrag.current.startScroll + deltaScroll;
    };
    const onUp = () => { sbDrag.current = null; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

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
    ? "Syncing…"
    : syncedAt
    ? (() => {
        const mins = Math.floor((Date.now() - syncedAt.getTime()) / 60000);
        if (mins < 60) return `Synced ${mins || "<1"}m ago`;
        return `Synced ${Math.floor(mins / 60)}h ago`;
      })()
    : "Live";

  const hasData = Object.keys(sheetsData).length > 0;

  if (sheetsLoading || !hasData) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f5f5f7]" style={{ fontFamily: "'Satoshi', ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <header className="px-[var(--pad)] pt-[var(--pad)] pb-[var(--pad)] flex items-center justify-end gap-4 shrink-0">
            <div className="flex items-center gap-[var(--pad)]">
              <div className="h-12 w-[130px] rounded-full bg-white" />
              <div className="h-12 w-[140px] rounded-full bg-white" />
            </div>
          </header>
          <div className="flex-1 min-h-0 px-[var(--pad)] pb-[22px] flex flex-col gap-[var(--pad)] overflow-y-auto">
            <div className="grid grid-cols-12 gap-[var(--pad)] items-stretch">
              <div className="col-span-12 lg:col-span-6 bg-white rounded-[var(--rad)] p-[var(--pad)]">
                <div className="mt-[var(--vlg)] mb-[var(--vlg)]" style={{ height: 36 }} />
                {[...Array(6)].map((_, i, arr) => (
                  <div key={i} className={i === arr.length - 1 ? "pt-[var(--vsm)]" : "py-[var(--vsm)]"} style={{ height: i === arr.length - 1 ? 36 : 50 }} />
                ))}
              </div>
              <div className="col-span-12 lg:col-span-3 min-h-[440px] lg:min-h-0 bg-white rounded-[var(--rad)]" />
              <div className="col-span-12 lg:col-span-3 flex flex-col gap-[var(--pad)]">
                <div className="flex-1 min-h-[140px] bg-white rounded-[var(--rad)]" />
                <div className="flex-1 min-h-[140px] bg-white rounded-[var(--rad)]" />
              </div>
            </div>
            <div className="flex-1 min-h-[300px] grid grid-cols-12 gap-[var(--pad)] items-stretch">
              <div className="col-span-12 lg:col-span-8 min-h-[320px] bg-white rounded-[var(--rad)]" />
              <div className="col-span-12 lg:col-span-4 min-h-[320px] bg-white rounded-[var(--rad)]" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ---- Render ----
  return (
    <div
      className="flex h-screen overflow-hidden text-primary"
      style={{ fontFamily: "'Satoshi', ui-sans-serif, system-ui, -apple-system, sans-serif" }}
    >
      <style>{`
        .recharts-cartesian-axis-tick text { fill: #86868b; font-variant-numeric: tabular-nums; }
        .fng-axis .recharts-cartesian-axis-tick text { text-transform: uppercase; letter-spacing: 0.05em; }
        .recharts-cartesian-grid line { stroke: #e5e5ea; }
        button, [role="button"], a, select { cursor: pointer; }
        .no-scrollbar { scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>


      {/* ---- Main ---- */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="px-[var(--pad)] pt-[var(--pad)] pb-[var(--pad)] flex items-center justify-end gap-4 shrink-0">
          <div className="flex items-center gap-[var(--pad)] shrink-0 relative">
            {/* Sync status */}
            <div className="flex items-center gap-2.5 h-12 px-4 rounded-full bg-white text-[14px] font-medium text-primary">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sheetsLoading ? "bg-[#ff9f0a]" : "bg-[#34c759] animate-pulse"}`} />
              <span className="leading-none">{syncLabel}</span>
            </div>

            {/* Artist switcher */}
            <div>
              {switcherOpen && (
                <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setSwitcherOpen(false)} />
              )}
              <button
                onClick={() => setSwitcherOpen((o) => !o)}
                className="relative z-50 flex items-center gap-2.5 h-12 pl-1.5 pr-3 rounded-full bg-white hover:bg-[#ebebed] transition"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-[#f0f0f3] flex items-center justify-center font-bold text-primary text-sm">
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
                <div className="text-left leading-tight min-w-0">
                  <div className="text-[14px] font-medium text-primary truncate max-w-[150px]">{artist.name}</div>
                </div>
                <ChevronDown size={16} className={`text-muted transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
              </button>

              {switcherOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-[var(--rad)] p-1.5 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                  {artists.map((a) => {
                    const active = a.slug === selectedSlug;
                    return (
                      <button
                        key={a.slug}
                        onClick={() => { setSelectedSlug(a.slug); setSwitcherOpen(false); }}
                        className={`w-full flex items-center gap-2.5 py-1.5 px-2 rounded-xl transition text-left ${active ? "bg-[#f5f5f7]" : "hover:bg-[#f5f5f7]"}`}
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-[#f0f0f3] flex items-center justify-center font-bold text-xs text-primary">
                          <img
                            src={iconFor(a.slug)}
                            alt={a.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const el = e.target as HTMLImageElement;
                              el.style.display = "none";
                              if (el.parentElement) el.parentElement.textContent = a.name.charAt(0);
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-medium text-primary truncate leading-tight">{a.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[14px] tabular-nums font-semibold text-primary">{fmtFull(a.totals.value)}</span>
                            <DeltaPill value={a.totals.delta} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 min-h-0 px-[var(--pad)] pb-[22px] flex flex-col gap-[var(--pad)] overflow-y-auto">

          {/* Top row: Reach Network + Fan Page Tracker + Fastest Movers */}
          <div className="grid grid-cols-12 gap-[var(--pad)] items-stretch">
          {/* Follower Network — combined platform totals + share */}
          {orderedPlats.length > 0 && (
            <div className={`col-span-12 lg:col-span-6 ${CARD} p-[var(--pad)] min-h-0 overflow-y-auto overflow-x-hidden`}>
              <div className="flex items-center gap-2.5">
                <PieIcon size={20} className="text-primary shrink-0" strokeWidth={2.25} />
                <h2 className="text-[14px] font-semibold text-primary whitespace-nowrap leading-none">Fan Network Reach</h2>
              </div>
              <div
                className="mt-[var(--vlg)] mb-[var(--vlg)] grid gap-x-[var(--cgap)] gap-y-[var(--vsm)]"
                style={{ gridTemplateColumns: "max-content max-content", justifyContent: "start" }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted leading-none">Total Reach</div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted leading-none">Last 28 Days</div>
                <div className="flex items-center h-[14px] text-[14px] font-semibold tabular-nums text-primary leading-none">{fmtFull(artist.totals.value)}</div>
                <div className="flex items-center h-[14px]"><DeltaPill value={artist.totals.delta} /></div>
              </div>

              {/* Per-platform ranked table with in-row share bars */}
              <div
                className="grid items-center gap-x-[var(--cgap)]"
                style={{ gridTemplateColumns: "max-content max-content max-content minmax(0,1fr) max-content" }}
              >
                <div
                  className="grid items-center gap-x-[var(--cgap)] pb-0 leading-none text-[11px] font-semibold uppercase tracking-wider text-muted"
                  style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}
                >
                  <span>Platform</span>
                  <span className="text-right">Reach</span>
                  <span className="text-right">Last 28 days</span>
                  <span>Audience Share</span>
                  <span className="text-right">%</span>
                </div>
                {platformShareData(artist).map((d, i, arr) => {
                  const pd = artist.platforms[d.name];
                  const pctNum = artist.totals.value > 0 ? (d.value / artist.totals.value) * 100 : 0;
                  const pct = pctNum.toFixed(1);
                  return (
                    <div
                      key={d.name}
                      className={`grid items-center gap-x-[var(--cgap)] ${i === arr.length - 1 ? "pt-[var(--vsm)]" : "py-[var(--vsm)]"}`}
                      style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                        <span className="text-[14px] font-medium text-primary whitespace-nowrap leading-none">{d.name}</span>
                      </div>
                      <span className="text-right text-[14px] font-semibold tabular-nums text-primary leading-none">{fmtFull(d.value)}</span>
                      <div className="flex justify-end items-center h-[14px]">{pd ? <DeltaPill value={pd.delta} /> : null}</div>
                      <div className="h-2.5 rounded-full bg-[#f5f5f7] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pctNum}%`, background: d.fill }} />
                      </div>
                      <span className="text-right text-[14px] font-semibold tabular-nums text-primary leading-none">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

            {/* Fan Page Tracker */}
            <div className="col-span-12 lg:col-span-3 relative min-h-[440px] lg:min-h-0">
            <div className={`absolute inset-0 ${CARD} flex flex-col overflow-hidden`}>
              <div className="px-[var(--pad)] pt-[var(--pad)] pb-[var(--vlg)] shrink-0 relative">
                <div className="flex items-center gap-2.5">
                  <LayoutList size={20} className="text-primary shrink-0" strokeWidth={2.25} />
                  <h2 className="text-[14px] font-semibold text-primary whitespace-nowrap leading-none">Fan Page Tracker</h2>
                </div>
                <div className="absolute top-[var(--pad)] right-[var(--pad)] flex items-center gap-[var(--vsm)]">
                  <button
                    onClick={() => setShowStarredOnly((o) => !o)}
                    className={`w-[34px] h-[34px] rounded-full flex items-center justify-center transition ${
                      showStarredOnly ? "bg-[#FFF8E1]" : "bg-[#f5f5f7] hover:bg-[#ebebed]"
                    }`}
                    title="Show starred only"
                  >
                    <Star size={15} className={showStarredOnly ? "fill-[#FFCC00] text-[#FFCC00]" : "text-muted"} />
                  </button>
                  <div className="relative">
                    {pagesDropdownOpen && (
                      <div className="fixed inset-0 z-10" onClick={() => setPagesDropdownOpen(false)} />
                    )}
                    <button
                      onClick={() => setPagesDropdownOpen((o) => !o)}
                      className="flex items-center gap-2 h-[34px] pl-3 pr-2.5 rounded-full bg-[#f5f5f7] hover:bg-[#ebebed] transition"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PLATFORMS[fpEffectivePlatform]?.color ?? "#8e8e93" }} />
                      <span className="text-[14px] font-medium text-primary whitespace-nowrap leading-none">{fpEffectivePlatform}</span>
                      <ChevronDown size={14} className="text-muted" />
                    </button>
                    {pagesDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 z-20 bg-white rounded-[var(--rad)] p-1.5 min-w-[200px]" style={{ boxShadow: "0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -6px rgba(0,0,0,0.12), 0 24px 56px -16px rgba(0,0,0,0.16)" }}>
                        {fpAvailablePlatforms.map((plat) => (
                          <button
                            key={plat}
                            onClick={() => {
                              setPagesPlatform(plat);
                              setPagesDropdownOpen(false);
                              if (pagesListRef.current) pagesListRef.current.scrollTop = 0;
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[14px] font-medium transition ${plat === fpEffectivePlatform ? "text-primary bg-[#f5f5f7]" : "text-muted hover:bg-[#f5f5f7]"}`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PLATFORMS[plat]?.color ?? "#8e8e93" }} />
                            <span className="leading-none">{plat}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative flex-1 min-h-0">
              <div
                ref={pagesListRef}
                className={`h-full overflow-y-auto no-scrollbar pl-[var(--pad)] pb-[var(--vsm)] ${pagesScrollable ? "pr-[50px]" : "pr-[var(--pad)]"}`}
                onScroll={updateScrollbar}
              >
                {filteredPages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-[13px] text-muted">No {fpEffectivePlatform} pages tracked yet</div>
                ) : (() => {
                  const unit = MEMBER_PLATFORMS.has(fpEffectivePlatform) ? "Members" : "Followers";
                  const entityCount = `${filteredPages.length} ${filteredPages.length === 1 ? fpEntitySingular : fpEntityPlural}`;
                  return (
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-[var(--cgap)]">
                      <div className="sticky top-0 z-10 bg-white grid items-center gap-x-[var(--cgap)] pb-0 leading-none -mx-2.5 px-2.5" style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted tabular-nums whitespace-nowrap">{entityCount}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted text-right">{unit}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted text-right">Last Post</span>
                      </div>
                      {filteredPages.map((p, i) => {
                        const Tag = p.link ? "a" : "div";
                        return (
                          <Tag
                            key={p.link || `${p.platform}-${p.name}-${i}`}
                            {...(p.link ? { href: p.link, target: "_blank", rel: "noopener noreferrer" } : {})}
                            className="grid items-center gap-x-[var(--cgap)] py-[var(--vsm)] no-underline rounded-xl px-2.5 -mx-2.5 hover:bg-[#f5f5f7] transition-colors"
                            style={{ gridColumn: "1 / -1", gridTemplateColumns: "subgrid" }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[14px] font-medium text-primary truncate leading-none pb-[4px] -mb-[4px]">{p.name}</span>
                              {p.managed && <Star size={12} className="shrink-0 text-[#FFCC00] fill-[#FFCC00]" />}
                            </div>
                            <span className="text-right text-[14px] font-semibold tabular-nums text-primary leading-none">{fmtFull(p.followers)}</span>
                            <span className="text-right text-[14px] font-semibold text-primary whitespace-nowrap leading-none">{p.latest ? fmtPageDate(p.latest) : "\u2014"}</span>
                          </Tag>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              {sbThumb.show && (
                <>
                  <div className="absolute right-[22px] top-[22px] bottom-[22px] w-[6px] rounded-full bg-[#f5f5f7]" />
                  <div
                    className="absolute right-[22px] w-[6px] rounded-full bg-[#86868b] hover:bg-[#6e6e73] active:bg-[#5b5b60] transition-colors cursor-pointer"
                    style={{ top: sbThumb.top, height: sbThumb.height }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const el = pagesListRef.current;
                      if (!el) return;
                      sbDrag.current = { startY: e.clientY, startScroll: el.scrollTop };
                      document.body.style.userSelect = "none";
                    }}
                  />
                </>
              )}
              </div>
            </div>
            </div>

            {/* Fastest Movers — split into top gainers / biggest drops */}
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-[var(--pad)]">
              {[
                { title: "Top Gainers", icon: ArrowUpRight, list: artists.slice().filter((a) => a.totals.delta > 0).sort((a, b) => b.totals.delta - a.totals.delta).slice(0, 3), kind: "gains" },
                { title: "Biggest Drops", icon: ArrowDownRight, list: artists.slice().filter((a) => a.totals.delta < 0).sort((a, b) => a.totals.delta - b.totals.delta).slice(0, 3), kind: "drops" },
              ].map((grp) => {
                const Icon = grp.icon;
                return (
                  <div key={grp.title} className={`${CARD} p-[var(--pad)] flex flex-col overflow-hidden`}>
                    <div className="flex items-center gap-2.5 shrink-0 mb-[var(--vlg)]">
                      <Icon size={20} className="text-primary shrink-0" strokeWidth={2.25} />
                      <h2 className="text-[14px] font-semibold text-primary whitespace-nowrap leading-none">{grp.title}</h2>
                    </div>
                    {grp.list.length > 0 && (
                      <div className="flex items-center justify-between shrink-0 pb-[var(--vsm)] text-[11px] font-semibold uppercase tracking-wider text-muted leading-none">
                        <span>Artist</span>
                        <span>Last 28 Days</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-[var(--pad)]">
                      {grp.list.length === 0 ? (
                        <div className="text-center text-[13px] text-muted py-4">No {grp.kind} in range</div>
                      ) : grp.list.map((a) => (
                          <div key={a.slug} className="w-full flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-[#f0f0f3] flex items-center justify-center font-bold text-xs text-primary">
                              <img
                                src={iconFor(a.slug)}
                                alt={a.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const el = e.target as HTMLImageElement;
                                  el.style.display = "none";
                                  if (el.parentElement) el.parentElement.textContent = a.name.charAt(0);
                                }}
                              />
                            </div>
                            <span className="flex-1 text-[14px] font-medium text-primary truncate">{a.name}</span>
                            <DeltaPill value={a.totals.delta} />
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lower row: Fan Network Growth + Growth Velocity */}
          <div className="flex-1 min-h-[300px] grid grid-cols-12 gap-[var(--pad)] items-stretch">
            {/* Growth chart */}
            <div className={`col-span-12 lg:col-span-8 ${CARD} flex flex-col overflow-hidden min-h-[320px]`}>
              <div className="px-[var(--pad)] pt-[var(--pad)] pb-[var(--vlg)] shrink-0 relative">
                <div className="flex items-center gap-2.5">
                  <TrendingUp size={20} className="text-primary shrink-0" strokeWidth={2.25} />
                  <h2 className="text-[14px] font-semibold text-primary whitespace-nowrap leading-none">Fan Network Growth</h2>
                </div>
                <div className="absolute top-[var(--pad)] right-[var(--pad)] flex items-center gap-[var(--vsm)]">
                  <div className="flex items-center gap-1 bg-[#f5f5f7] p-1 rounded-full shrink-0">
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
                        className={`text-[12px] font-semibold px-3 py-1 rounded-full transition-all ${
                          yearRange === opt.key
                            ? "bg-white text-primary"
                            : "text-muted hover:text-primary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    {platDropdownOpen && (
                      <div className="fixed inset-0 z-10" onClick={() => setPlatDropdownOpen(false)} />
                    )}
                    <button
                      onClick={() => setPlatDropdownOpen((o) => !o)}
                      className={`relative z-20 w-[34px] h-[34px] rounded-full flex items-center justify-center transition ${
                        platDropdownOpen ? "bg-[#ebebed]" : "bg-[#f5f5f7] hover:bg-[#ebebed]"
                      }`}
                      title="Filter platforms"
                    >
                      <Filter size={15} className={hiddenPlats.size > 0 ? "text-primary" : "text-muted"} />
                    </button>
                    {platDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 z-20 bg-white rounded-[var(--rad)] p-1.5 min-w-[200px]" style={{ boxShadow: "0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -6px rgba(0,0,0,0.12), 0 24px 56px -16px rgba(0,0,0,0.16)" }}>
                        {orderedPlats.map((p) => {
                          const off = hiddenPlats.has(p);
                          return (
                            <button
                              key={p}
                              onClick={() => togglePlat(p)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[14px] font-medium transition ${off ? "text-muted hover:bg-[#f5f5f7]" : "text-primary hover:bg-[#f5f5f7]"}`}
                              title={off ? `Show ${p}` : `Hide ${p}`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 transition-colors" style={{ background: off ? "#d2d2d7" : PLATFORMS[p].color }} />
                              <span className="leading-none flex-1 text-left">{p}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-[var(--vlg)] flex items-start gap-4">
                  {rangeStats && (
                    <div className="flex items-start flex-wrap gap-x-[var(--cgap)] gap-y-3 min-w-0">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted leading-none mb-[var(--vsm)]">{monthLabel(history[0].date)}</div>
                        <div className="text-[14px] font-semibold tabular-nums text-primary leading-none">{fmtFull(rangeStats.startTotal)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted leading-none mb-[var(--vsm)]">{monthLabel(history[history.length - 1].date)}</div>
                        <div className="text-[14px] font-semibold tabular-nums text-primary leading-none">{fmtFull(rangeStats.endTotal)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted leading-none mb-[var(--vsm)]">Net Growth</div>
                        <div className="flex items-center gap-[var(--vsm)] h-[14px]">
                          <DeltaPill value={rangeStats.net} />
                          <span className="text-[14px] font-semibold tabular-nums text-primary leading-none">{rangeStats.pct >= 0 ? "+" : ""}{Math.abs(rangeStats.pct) >= 100 ? Math.round(rangeStats.pct) : rangeStats.pct.toFixed(1).replace(/\.0$/, "")}%</span>
                        </div>
                      </div>
                      {rangeStats.bestGain > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted leading-none mb-[var(--vsm)]">Best Month</div>
                          <div className="flex items-center gap-[var(--vsm)] h-[14px]">
                            <span className="text-[14px] font-semibold tabular-nums text-primary whitespace-nowrap leading-none">{monthLabel(rangeStats.bestMonth)}</span>
                            <DeltaPill value={rangeStats.bestGain} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Chart area — stacked gradient area */}
              <div className="fng-axis flex-1 min-h-0 pl-[var(--pad)] pr-[var(--pad)] pb-[var(--pad)]">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted text-sm">No data in the selected range</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartHistory} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e5e5ea" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={monthLabel}
                        interval={Math.max(0, Math.floor(history.length / 8))}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={19}
                        height={36}
                        padding={{ left: 0, right: 0 }}
                        tick={{ fill: "#86868b", fontSize: 11, fontWeight: 600 }}
                      />
                      <YAxis
                        tickFormatter={fmt}
                        axisLine={false}
                        tickLine={false}
                        width={55}
                        tickMargin={16}
                        ticks={yScale.ticks}
                        domain={[0, yScale.max]}
                        tick={{ fill: "#86868b", fontSize: 11, fontWeight: 600 }}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ stroke: "#d2d2d7", strokeDasharray: "3 3" }}
                        wrapperStyle={{ transition: "none" }}
                      />
                      {orderedPlats.map((p) => {
                        if (hiddenPlats.has(p)) return null;
                        return (
                          <Line
                            key={p}
                            type="linear"
                            dataKey={p}
                            name={p}
                            stroke={PLATFORMS[p].color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 2, stroke: "white" }}
                            isAnimationActive={false}
                            connectNulls={false}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Growth Velocity */}
            <div className={`col-span-12 lg:col-span-4 ${CARD} p-[var(--pad)] flex flex-col overflow-hidden min-h-[320px]`}>
              <div className="flex items-center gap-2.5 shrink-0 mb-[var(--vlg)]">
                <Gauge size={20} className="text-primary shrink-0" strokeWidth={2.25} />
                <h2 className="text-[14px] font-semibold text-primary whitespace-nowrap leading-none">Growth Velocity</h2>
              </div>
              {velocityData.length > 0 && (
                <div
                  className="shrink-0 mb-[var(--vlg)] grid gap-x-[var(--cgap)] gap-y-[var(--vsm)]"
                  style={{ gridTemplateColumns: "max-content max-content", justifyContent: "start" }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted leading-none">Latest Month</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted leading-none">Positive Months</div>
                  <div className="flex items-center h-[14px]"><DeltaPill value={velocityData[velocityData.length - 1].net} /></div>
                  <div className="flex items-center h-[14px] text-[14px] font-semibold tabular-nums text-primary leading-none">
                    {velocityData.filter((d) => d.net > 0).length}<span>/{velocityData.length}</span>
                  </div>
                </div>
              )}
              <div className="fng-axis flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e5e5ea" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(ym) => monthLabel(ym).split(" ")[0]}
                      axisLine={false} tickLine={false} interval={0}
                      tickMargin={19}
                      height={36}
                      padding={{ left: 22, right: 8 }}
                      tick={{ fill: "#86868b", fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis
                      tickFormatter={fmt} axisLine={false} tickLine={false} width={55} tickMargin={16}
                      tick={{ fill: "#86868b", fontSize: 11, fontWeight: 600 }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="bg-white rounded-[var(--rad)] p-3.5" style={{ boxShadow: "0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -6px rgba(0,0,0,0.12), 0 24px 56px -16px rgba(0,0,0,0.16)" }}>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">{monthLabel(label)}</div>
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: payload[0].value >= 0 ? "#248a3d" : "#d70015" }} />
                              <span className="text-[14px] font-medium text-primary flex-1">Net change</span>
                              <span className="text-[14px] font-semibold tabular-nums text-primary ml-6">{payload[0].value >= 0 ? "+" : ""}{fmtFull(payload[0].value)}</span>
                            </div>
                          </div>
                        ) : null
                      }
                      cursor={{ fill: "#f5f5f7" }}
                      wrapperStyle={{ transition: "none" }}
                    />
                    <Bar dataKey="net" radius={[18, 18, 0, 0]} isAnimationActive={false}>
                      {velocityData.map((d, i) => (
                        <Cell key={i} fill={d.net >= 0 ? "#248a3d" : "#d70015"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

