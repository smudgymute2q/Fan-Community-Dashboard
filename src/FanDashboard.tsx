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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  AreaChart,
  Area,
} from "recharts";
import {
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Moon,
  Sun,
  Activity,
  BarChart3,
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
  Sparkles,
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
  TikTok: { color: "#00F2EA", soft: "#E0FDFB" },
};

// ---- Google Sheets config ----
// Published ID from File → Share → Publish to the web
const SHEET_ID = "2PACX-1vRX8lP3Nb-LWMmUoTtHDHihOX-SkhFMUXoQJIuinbUhctXSjgJ1CCI9NvO1MQZKdgy9jtG33DgrOtre";

// Tab names: "{ArtistName} (Fan Network)" / "{ArtistName} (Fan Pages)"
const SHEET_TABS: Record<string, { network: string; pages: string }> = {
  "opium":       { network: "Opium (Fan Network)",          pages: "Opium (Fan Pages)" },
  "playboi-carti":  { network: "Playboi Carti (Fan Network)",  pages: "Playboi Carti (Fan Pages)" },
  "ken-carson":     { network: "Ken Carson (Fan Network)",      pages: "Ken Carson (Fan Pages)" },
  "destroy-lonely": { network: "Destroy Lonely (Fan Network)",  pages: "Destroy Lonely (Fan Pages)" },
  "hxg":  { network: "HXG (Fan Network)",             pages: "HXG (Fan Pages)" },
  "pierre-bourne":  { network: "Pi'erre Bourne (Fan Network)",  pages: "Pi'erre Bourne (Fan Pages)" },
  "rema":           { network: "Rema (Fan Network)",            pages: "Rema (Fan Pages)" },
  "2hollis":        { network: "2hollis (Fan Network)",          pages: "2hollis (Fan Pages)" },
  "untiljapan":     { network: "untiljapan (Fan Network)",      pages: "untiljapan (Fan Pages)" },
  "jim-legxacy":    { network: "Jim Legxacy (Fan Network)",     pages: "Jim Legxacy (Fan Pages)" },
  "apollored1":     { network: "ApolloRed1 (Fan Network)",      pages: "ApolloRed1 (Fan Pages)" },
  "destin-laurel":  { network: "Destin Laurel (Fan Network)",  pages: "Destin Laurel (Fan Pages)" },
};

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

// Fetch the published HTML index page and extract tab name → GID mapping.
async function fetchGidMap(pubId: string): Promise<Record<string, string>> {
  const url = `https://docs.google.com/spreadsheets/d/e/${pubId}/pubhtml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`pubhtml HTTP ${res.status}`);
  const html = await res.text();
  const gids: Record<string, string> = {};

  // Pattern 1: navigation anchor tags — href="...?gid=N&...">Sheet Name</a>
  const anchorRe = /href="[^"]*[?&]gid=(\d+)[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const name = decodeHtmlEntities(m[2].trim());
    if (name) gids[name] = m[1];
  }
  if (Object.keys(gids).length > 0) return gids;

  // Pattern 2: JavaScript items.push({name:'...', pageUrl:'...gid=N...'})
  // Names are JS string literals — decode \x27 etc. before storing
  const jsRe = /name:\s*["']([^"']+)["'][^}]*gid=(\d+)/g;
  while ((m = jsRe.exec(html)) !== null) gids[decodeJsString(m[1].trim())] = m[2];
  if (Object.keys(gids).length > 0) return gids;

  // Pattern 3: JSON "name":"..." "gid":N
  const jsonRe = /"name":\s*"([^"]+)"[^}]*"gid":\s*(\d+)/g;
  while ((m = jsonRe.exec(html)) !== null) gids[decodeJsString(decodeHtmlEntities(m[1].trim()))] = m[2];
  if (Object.keys(gids).length > 0) return gids;

  // All patterns failed — log a sample so the format can be debugged
  console.warn("[sheets] GID extraction failed. HTML sample:", html.substring(0, 2000));
  return gids;
}

async function fetchSheetByGid(pubId: string, gid: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv&gid=${gid}&single=true`;
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

// Rows where "platform" is actually a computed summary — skip these
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

// ---- Static fallback artist data (used while sheets are loading or on fetch error) ----
const STATIC_ARTISTS = [
  { slug: "opium", name: "Opium", tagline: "Label · Core fanbase", totals: { value: 168074, delta: 808 }, platforms: { Discord: { value: 8809, delta: 1 }, Reddit: { value: 19795, delta: 425 }, Instagram: { value: 95339, delta: 415 }, "Instagram Channels": { value: 9400, delta: -200 }, X: { value: 1775, delta: 154 }, TikTok: { value: 32956, delta: 13 } }, pages: [{ name: "/opium00", followers: 8809, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "playboi-carti", name: "Playboi Carti", tagline: "Opium · Rage principal", totals: { value: 1495905, delta: 4537 }, platforms: { Discord: { value: 182148, delta: 338 }, Reddit: { value: 1029516, delta: 8064 }, Instagram: { value: 253236, delta: -3425 }, "Instagram Channels": { value: 23900, delta: -400 }, X: { value: 6995, delta: -38 }, "X Communities": { value: 110, delta: -2 } }, pages: [{ name: "/playboicarti", followers: 182148, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/pbc00", followers: 13193, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "ken-carson", name: "Ken Carson", tagline: "Opium · Project X", totals: { value: 536568, delta: 11932 }, platforms: { Discord: { value: 76270, delta: 236 }, Reddit: { value: 75448, delta: 904 }, Instagram: { value: 212157, delta: 8336 }, "Instagram Channels": { value: 22500, delta: 1000 }, X: { value: 45700, delta: 300 }, "X Communities": { value: 79146, delta: 9 }, TikTok: { value: 24300, delta: 100 } }, pages: [{ name: "/kencarson", followers: 76270, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/BuZYYKZQ", followers: 153, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "destroy-lonely", name: "Destroy Lonely", tagline: "Opium · The NS collective", totals: { value: 213034, delta: 59171 }, platforms: { Discord: { value: 36318, delta: 98 }, Reddit: { value: 55756, delta: 499 }, Instagram: { value: 65854, delta: 7484 }, "Instagram Channels": { value: 1600, delta: -2400 }, X: { value: 28706, delta: 28690 }, "X Communities": { value: 9200, delta: 0 }, TikTok: { value: 15600, delta: 0 } }, pages: [{ name: "/destroylonely", followers: 36318, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/bh3", followers: 1867, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "hxg", name: "HXG", tagline: "Opium · HXG duo", totals: { value: 37566, delta: -231 }, platforms: { Discord: { value: 10277, delta: -51 }, Reddit: { value: 8943, delta: 35 }, Instagram: { value: 18346, delta: -215 } }, pages: [{ name: "/hxg", followers: 10277, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "pierre-bourne", name: "Pi'erre Bourne", tagline: "Producer · SossHouse", totals: { value: 37147, delta: 171 }, platforms: { Discord: { value: 4955, delta: 53 }, Reddit: { value: 22381, delta: 104 }, Instagram: { value: 9424, delta: -14 }, "Instagram Channels": { value: 387, delta: 28 } }, pages: [{ name: "/pierrebourne", followers: 4955, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/yopierre", followers: 372, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "rema", name: "Rema", tagline: "Afrobeats · Mavin", totals: { value: 2123652, delta: 4239 }, platforms: { Discord: { value: 2541, delta: 23 }, Reddit: { value: 308, delta: 4 }, Instagram: { value: 698524, delta: 3991 }, X: { value: 22179, delta: -79 }, TikTok: { value: 1400100, delta: 300 } }, pages: [{ name: "/heisrema", followers: 2541, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "2hollis", name: "2hollis", tagline: "Emerging", totals: { value: 0, delta: 0 }, platforms: {}, pages: [] },
  { slug: "untiljapan", name: "untiljapan", tagline: "Emerging · Underground", totals: { value: 6802, delta: 136 }, platforms: { Discord: { value: 2039, delta: 44 }, Reddit: { value: 1416, delta: -7 }, Instagram: { value: 1713, delta: 22 }, X: { value: 1079, delta: 60 }, "X Communities": { value: 555, delta: 17 }, TikTok: { value: 9, delta: 0 } }, pages: [{ name: "/untiljapan", followers: 2039, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "jim-legxacy", name: "Jim Legxacy", tagline: "Emerging · Discord-native", totals: { value: 10144, delta: 2202 }, platforms: { Discord: { value: 6089, delta: 1410 }, Reddit: { value: 359, delta: 39 }, Instagram: { value: 322, delta: 131 }, X: { value: 2362, delta: 235 }, "X Communities": { value: 261, delta: 23 }, TikTok: { value: 751, delta: 364 } }, pages: [{ name: "/PfeRaWF4bG", followers: 6089, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "apollored1", name: "ApolloRed1", tagline: "Emerging · SoundCloud era", totals: { value: 1659, delta: 80 }, platforms: { Discord: { value: 283, delta: 44 }, Reddit: { value: 56, delta: 8 }, Instagram: { value: 1320, delta: 28 } }, pages: [{ name: "/apollohub", followers: 564, latest: "Apr 9, 2026", platform: "Discord" }, { name: "/apollored1", followers: 283, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "destin-laurel", name: "Destin Laurel", tagline: "Emerging", totals: { value: 0, delta: 0 }, platforms: {}, pages: [] },
];

const MOCK_FEED = {
  "playboi-carti": [
    { platform: "Reddit", page: "/r/playboicarti", author: "u/tearsofravage", time: "12m ago", title: "New snippet from the Antagonist sessions leaked on Discord", body: "Production credits line up with what Wheezy hinted at last week. Quality is rough but the hook is unreal.", engagement: { upvotes: 2847, comments: 412 }, media: "image", sentiment: "hype" },
    { platform: "Discord", page: "/playboicarti", author: "opium_insider", time: "38m ago", title: "#announcements", body: "Mod verified: the account that posted in #leaks last night was not affiliated with management. All links have been removed.", engagement: { reactions: 1893, replies: 67 }, sentiment: "neutral" },
    { platform: "Instagram", page: "@playboicarti", author: "playboicarti", time: "2h ago", title: null, body: "Antagonist. 06.13.", engagement: { likes: 847293, comments: 23847 }, media: "image", sentiment: "hype" },
    { platform: "Reddit", page: "/r/playboicarti", author: "u/narcissist_2020", time: "4h ago", title: "Ranking every Carti feature since Whole Lotta Red", body: "Been working on this list for a while. Guest verses, hook appearances, and the unreleased leaks.", engagement: { upvotes: 1204, comments: 287 }, sentiment: "neutral" },
    { platform: "X", page: "@playboicarti", author: "playboicarti", time: "6h ago", title: null, body: "soon.", engagement: { likes: 67482, reposts: 12847, replies: 8394 }, sentiment: "hype" },
    { platform: "Reddit", page: "/r/playboicarti", author: "u/vamp_anthem", time: "8h ago", title: "Is anyone else tired of the constant 'where is the album' posts?", body: "The sub has become unusable. Every other thread is doom-posting about delays.", engagement: { upvotes: 3421, comments: 892 }, sentiment: "negative" },
  ],
  "ken-carson": [
    { platform: "Instagram", page: "@kencarson", author: "kencarson", time: "23m ago", title: null, body: "A CHAIN FOR THE TEEN X. 💎", engagement: { likes: 234827, comments: 4829 }, media: "image", sentiment: "hype" },
    { platform: "Reddit", page: "/r/kencarson", author: "u/projectx_fan", time: "1h ago", title: "A Great Chaos deluxe confirmed by insider", body: "Saw it in a Discord leak channel — management is apparently shopping 4 extra tracks.", engagement: { upvotes: 1847, comments: 243 }, sentiment: "hype" },
    { platform: "Discord", page: "/kencarson", author: "teenx_mod", time: "2h ago", title: "#general", body: "Tour presale codes dropping tomorrow at 10am EST. Check the pinned message.", engagement: { reactions: 847, replies: 124 }, sentiment: "neutral" },
    { platform: "TikTok", page: "@kencarson", author: "kencarson", time: "3h ago", title: null, body: "studio vlog 03 — Atlanta", engagement: { likes: 184273, comments: 8273, shares: 12847 }, media: "video", sentiment: "hype" },
    { platform: "Reddit", page: "/r/kencarson", author: "u/chaos_chaos", time: "5h ago", title: "Unpopular opinion: his vocals have actually improved since AGC", body: "Been relistening to the rollout singles and the mixing is noticeably tighter.", engagement: { upvotes: 892, comments: 347 }, sentiment: "neutral" },
  ],
  "destroy-lonely": [
    { platform: "X", page: "@destroylonely", author: "destroylonely", time: "15m ago", title: null, body: "LOVE LASTS 4EVER DELUXE. 14 NEW TRACKS. MAY 22.", engagement: { likes: 28490, reposts: 8471, replies: 2847 }, sentiment: "hype" },
    { platform: "Reddit", page: "/r/destroylonely", author: "u/NS_nation", time: "1h ago", title: "The deluxe announcement just dropped — thread everything here", body: "Mod pinning this. Consolidating all deluxe speculation, leaked tracklists, and reaction videos.", engagement: { upvotes: 4823, comments: 1247 }, sentiment: "hype" },
    { platform: "Instagram", page: "@destroylonely", author: "destroylonely", time: "2h ago", title: null, body: "🏝️🏝️🏝️", engagement: { likes: 48273, comments: 1824 }, media: "image", sentiment: "neutral" },
    { platform: "Discord", page: "/destroylonely", author: "lonely_admin", time: "3h ago", title: "#leaks-discussion", body: "Reminder: linking to leak archives is a permanent ban. The deluxe drops in 5 weeks.", engagement: { reactions: 482, replies: 89 }, sentiment: "neutral" },
  ],
  "rema": [
    { platform: "TikTok", page: "@heisrema", author: "heisrema", time: "18m ago", title: null, body: "HEIS. world tour. Lagos kickoff 🇳🇬", engagement: { likes: 1284273, comments: 48273, shares: 184273 }, media: "video", sentiment: "hype" },
    { platform: "Instagram", page: "@heisrema", author: "heisrema", time: "2h ago", title: null, body: "Mavin x AfroRave — new era", engagement: { likes: 284721, comments: 8472 }, media: "image", sentiment: "hype" },
    { platform: "X", page: "@heisrema", author: "heisrema", time: "5h ago", title: null, body: "one of the best years of my life. thank you.", engagement: { likes: 47281, reposts: 3847, replies: 1482 }, sentiment: "positive" },
  ],
  "hxg": [
    { platform: "Reddit", page: "/r/homixidegang", author: "u/hxg_forever", time: "2h ago", title: "Snot x Beno collab album rumors", body: "Someone in the Carti Discord dropped a snippet with both of them on a track.", engagement: { upvotes: 847, comments: 184 }, sentiment: "hype" },
    { platform: "Discord", page: "/hxg", author: "hxg_mod", time: "4h ago", title: "#snot-vs-beno", body: "Keep the discourse in this channel. No individual stan wars in #general.", engagement: { reactions: 124, replies: 48 }, sentiment: "neutral" },
    { platform: "Instagram", page: "@homixide_gang", author: "homixide_gang", time: "6h ago", title: null, body: "WE UP NEXT", engagement: { likes: 28471, comments: 1847 }, media: "image", sentiment: "hype" },
  ],
  "pierre-bourne": [
    { platform: "X", page: "@pierrebourne", author: "pierrebourne", time: "1h ago", title: null, body: "SossHouse Vol 3 mastering wrapped. release window q3.", engagement: { likes: 8473, reposts: 1247, replies: 384 }, sentiment: "hype" },
    { platform: "Reddit", page: "/r/pierrebourne", author: "u/yo_pierre_up", time: "3h ago", title: "Production breakdown: how Pierre builds his signature bell melodies", body: "Did a deep-dive breakdown in FL. Reverse-engineered the chord progressions.", engagement: { upvotes: 1284, comments: 247 }, sentiment: "positive" },
  ],
  "opium": [
    { platform: "Instagram", page: "@opium", author: "opium", time: "45m ago", title: null, body: "OPIUM TOUR 2026. full lineup next week.", engagement: { likes: 184273, comments: 8472 }, media: "image", sentiment: "hype" },
    { platform: "Reddit", page: "/r/opium", author: "u/label_watcher", time: "2h ago", title: "Who's joining Carti, Ken, and Destroy on the 2026 tour?", body: "The teaser shows 5 silhouettes not 3. Leaning toward Homixide + one new signee.", engagement: { upvotes: 2847, comments: 482 }, sentiment: "hype" },
    { platform: "Discord", page: "/opium00", author: "opium_verified", time: "4h ago", title: "#tour-2026", body: "Channel opened for tour discussion. All presale info will be posted here.", engagement: { reactions: 847, replies: 128 }, sentiment: "neutral" },
  ],
  "untiljapan": [
    { platform: "Discord", page: "/untiljapan", author: "untiljapan_mod", time: "1h ago", title: "#new-release", body: "EP drops Friday. 6 tracks, all produced with 808 Mafia. Thanks for sticking with us at 2K members.", engagement: { reactions: 247, replies: 84 }, sentiment: "positive" },
    { platform: "Reddit", page: "/r/untiljapan", author: "u/underground_digger", time: "5h ago", title: "This artist is about to pop — called it 6 months ago", body: "Been saying it since the Spotify algorithm started pushing them.", engagement: { upvotes: 482, comments: 89 }, sentiment: "hype" },
  ],
  "apollored1": [
    { platform: "Instagram", page: "@apollo", author: "apollored1", time: "3h ago", title: null, body: "BACK FROM HIATUS. new music soon.", engagement: { likes: 8471, comments: 847 }, media: "image", sentiment: "hype" },
    { platform: "Discord", page: "/apollohub", author: "apollo_staff", time: "6h ago", title: "#general", body: "Welcome to the new members. Pinned message has the FAQ and release schedule.", engagement: { reactions: 84, replies: 24 }, sentiment: "neutral" },
  ],
  "jim-legxacy": [
    { platform: "TikTok", page: "@pfeproject", author: "pfeproject", time: "22m ago", title: null, body: "unreleased snippet → full track on friday", engagement: { likes: 18472, comments: 847, shares: 2847 }, media: "video", sentiment: "hype" },
    { platform: "Discord", page: "/PfeRaWF4bG", author: "pfe_mod", time: "2h ago", title: "#snippets", body: "New one tomorrow at 8pm EST. First listen will be live in the voice channel.", engagement: { reactions: 847, replies: 184 }, sentiment: "hype" },
    { platform: "X", page: "@pfeproject", author: "pfeproject", time: "4h ago", title: null, body: "the wait is almost over", engagement: { likes: 1284, reposts: 247, replies: 84 }, sentiment: "hype" },
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
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("en", { month: "short", year: "2-digit" }); };

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
function platformRadar(artist, allArtists) {
  const allPlats = ["Discord", "Reddit", "Instagram", "Instagram Channels", "X", "X Communities", "TikTok"];
  const maxes = {};
  allPlats.forEach((p) => { maxes[p] = Math.max(...allArtists.map((a) => a.platforms[p]?.value || 0), 1); });
  return allPlats.map((p) => ({ platform: p, value: Math.round(((artist.platforms[p]?.value || 0) / maxes[p]) * 100) }));
}

function DeltaPill({ value, small = false }) {
  if (value === 0 || value === null || value === undefined) return <span className={`inline-flex items-center gap-0.5 text-slate-500 ${small ? "text-[10px]" : "text-xs"} font-medium`}><Minus size={small ? 10 : 12} strokeWidth={2.5} /> 0</span>;
  const up = value > 0;
  return <span className={`inline-flex items-center gap-0.5 font-semibold ${small ? "text-[10px]" : "text-xs"} ${up ? "text-emerald-600" : "text-rose-500"}`}>{up ? <ArrowUpRight size={small ? 10 : 12} strokeWidth={3} /> : <ArrowDownRight size={small ? 10 : 12} strokeWidth={3} />}{up ? "+" : ""}{fmt(value)}</span>;
}

function KpiTile({ platform, value, delta, isTotal }) {
  const cfg = PLATFORMS[platform];
  return (
    <div className={`relative rounded-2xl p-4 ${isTotal ? "bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200" : "bg-white border border-slate-200"}`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-2 ${isTotal ? "text-amber-800" : "text-slate-500"}`}>
        {isTotal && <Sparkles size={11} className="text-amber-600" />}
        {isTotal ? "Total Reach" : platform}
      </div>
      <div className={`font-bold tabular-nums leading-none ${isTotal ? "text-3xl text-amber-900" : "text-2xl text-slate-900"}`}>{fmtFull(value)}</div>
      <div className="mt-2"><DeltaPill value={delta} small /></div>
    </div>
  );
}

const ARTIST_ICONS: Record<string, string> = {
  "opium":          "/Fan-Community-Dashboard/icons/opium.png",
  "playboi-carti":  "/Fan-Community-Dashboard/icons/playboi-carti.png",
  "ken-carson":     "/Fan-Community-Dashboard/icons/ken-carson.png",
  "destroy-lonely": "/Fan-Community-Dashboard/icons/destroy-lonely.png",
  "hxg":            "/Fan-Community-Dashboard/icons/hxg.png",
  "pierre-bourne":  "/Fan-Community-Dashboard/icons/pierre-bourne.png",
  "rema":           "/Fan-Community-Dashboard/icons/rema.png",
  "2hollis":        "/Fan-Community-Dashboard/icons/2hollis.png",
  "untiljapan":     "/Fan-Community-Dashboard/icons/untiljapan.png",
  "jim-legxacy":    "/Fan-Community-Dashboard/icons/jim-legxacy.png",
  "apollored1":     "/Fan-Community-Dashboard/icons/apollored1.png",
  "destin-laurel":  "/Fan-Community-Dashboard/icons/destin-laurel.png",
};

function ArtistPill({ artist, active, onClick }) {
  const initial = artist.name.charAt(0);
  const icon = ARTIST_ICONS[artist.slug];
  return (
    <button onClick={onClick} className={`group relative shrink-0 text-left px-3.5 py-2.5 rounded-2xl border transition-all ${active ? "bg-gradient-to-br from-[#000dff] to-blue-500 text-white border-transparent" : "bg-white border-slate-200"}`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
          {icon ? <img src={icon} alt={artist.name} className="w-full h-full object-cover" /> : initial}
        </div>
        <div>
          <div className={`text-sm font-semibold leading-tight ${active ? "text-white" : "text-slate-900"}`}>{artist.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-xs font-semibold tabular-nums ${active ? "text-white" : "text-slate-700"}`}>{fmt(artist.totals.value)}</span>
            <span className={`text-[10px] font-semibold ${active ? "text-blue-100" : artist.totals.delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{artist.totals.delta >= 0 ? "+" : ""}{fmt(artist.totals.delta)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs">
      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">{label && typeof label === "string" && label.includes("-") ? monthLabel(label) : label}</div>
      <div className="space-y-1.5">
        {payload.slice().sort((a, b) => b.value - a.value).map((p) => (
          <div key={p.dataKey || p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-slate-600 flex-1">{p.name}</span>
            <span className="font-semibold tabular-nums text-slate-900 ml-3">{fmtFull(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.payload?.fill || p.fill }} />
      <span className="text-slate-600 font-medium">{p.name}</span>
      <span className="font-bold tabular-nums text-slate-900">{fmtFull(p.value)}</span>
    </div>
  );
}

function engagementSummary(post) {
  const e = post.engagement;
  if (post.platform === "Reddit") return [{ icon: ArrowUpRight, label: fmt(e.upvotes) }, { icon: MessageSquare, label: fmt(e.comments) }];
  if (post.platform === "Discord") return [{ icon: Heart, label: fmt(e.reactions) }, { icon: MessageSquare, label: fmt(e.replies) }];
  if (post.platform === "X") return [{ icon: Heart, label: fmt(e.likes) }, { icon: Repeat2, label: fmt(e.reposts) }, { icon: MessageSquare, label: fmt(e.replies) }];
  if (post.platform === "TikTok") return [{ icon: Heart, label: fmt(e.likes) }, { icon: MessageSquare, label: fmt(e.comments) }, { icon: Repeat2, label: fmt(e.shares) }];
  return [{ icon: Heart, label: fmt(e.likes) }, { icon: MessageSquare, label: fmt(e.comments) }];
}

const SENTIMENT_STYLE = {
  hype: { bg: "bg-amber-100", text: "text-amber-700", label: "HYPE" },
  positive: { bg: "bg-emerald-100", text: "text-emerald-700", label: "POSITIVE" },
  neutral: { bg: "bg-slate-100", text: "text-slate-600", label: "NEUTRAL" },
  negative: { bg: "bg-rose-100", text: "text-rose-700", label: "WATCH" },
};

function FeedCard({ post }) {
  const cfg = PLATFORMS[post.platform];
  const sent = SENTIMENT_STYLE[post.sentiment];
  return (
    <div className="group relative bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.soft }}>
              <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">{post.page}</div>
              <div className="text-[10px] text-slate-500 truncate">@{post.author.replace(/^u\//, "").replace(/^@/, "")} · {post.time}</div>
            </div>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${sent.bg} ${sent.text} shrink-0`}>{sent.label}</span>
        </div>
        {post.title && <div className="text-[13px] text-slate-900 font-semibold leading-snug mb-1 line-clamp-2">{post.title}</div>}
        <div className="text-xs text-slate-600 leading-relaxed line-clamp-3">{post.body}</div>
        {post.media && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg w-fit">
            {post.media === "video" ? <Play size={10} /> : <ImageIcon size={10} />}
            <span className="uppercase tracking-wider font-semibold">{post.media}</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3.5">
            {engagementSummary(post).map((e, i) => {
              const Icon = e.icon;
              return (
                <div key={i} className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                  <Icon size={11} strokeWidth={2.2} />
                  <span className="tabular-nums">{e.label}</span>
                </div>
              );
            })}
          </div>
          <button className="opacity-0 group-hover:opacity-100 transition text-[10px] text-slate-500 hover:text-slate-900 flex items-center gap-1 font-medium">open <ExternalLink size={10} /></button>
        </div>
      </div>
    </div>
  );
}

export default function FanDashboard() {
  const [darkMode, setDarkMode] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("opium");
  const [pieHover, setPieHover] = useState<{ name: string; value: number; fill: string } | null>(null);
  const [piePos, setPiePos] = useState<{ x: number; y: number } | null>(null);
  const [hiddenPlats, setHiddenPlats] = useState(new Set());
  const [feedFilter, setFeedFilter] = useState("All");
  const [yearRange, setYearRange] = useState("all");
  const [pagesPlatform, setPagesPlatform] = useState("Discord");
  const rosterRef = React.useRef<HTMLDivElement>(null);
  const [rosterAtStart, setRosterAtStart] = useState(true);
  const [rosterAtEnd, setRosterAtEnd] = useState(false);
  const isScrollingToEnd = React.useRef(false);
  const isScrollingToStart = React.useRef(false);
  const [pagesDropdownOpen, setPagesDropdownOpen] = useState(false);
  const pagesListRef = React.useRef<HTMLDivElement>(null);
  const [pagesAtBottom, setPagesAtBottom] = useState(false);

  // ---- Sheets data loading ----
  const [sheetsData, setSheetsData] = useState<Record<string, any>>({});
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      // Phase 1: fetch published HTML page to extract tab name → GID map
      let gidMap: Record<string, string> = {};
      try {
        gidMap = await fetchGidMap(SHEET_ID);
      } catch (err) {
        console.error("[sheets] Could not read GID map:", err);
        setSheetsLoading(false);
        return;
      }
      if (cancelled) return;

      // Phase 2: fetch each artist's two tabs in parallel using their GIDs
      let pending = STATIC_ARTISTS.length;
      const onDone = () => {
        pending--;
        if (pending === 0 && !cancelled) {
          setSheetsLoading(false);
          setSyncedAt(new Date());
        }
      };

      for (const a of STATIC_ARTISTS) {
        const tabs = SHEET_TABS[a.slug];
        if (!tabs) { onDone(); continue; }

        const networkGid = gidMap[tabs.network];
        const pagesGid = gidMap[tabs.pages];

        if (!networkGid || !pagesGid) {
          console.warn(`[sheets] ${a.name}: tab not found in GID map. Keys: ${Object.keys(gidMap).join(", ")}`);
          onDone();
          continue;
        }

        Promise.all([
          fetchSheetByGid(SHEET_ID, networkGid),
          fetchSheetByGid(SHEET_ID, pagesGid),
        ])
          .then(([networkRows, pagesRows]) => {
            if (cancelled) return;
            const { history, platforms, totals } = parseNetworkTab(networkRows);
            const pages = parsePagesTab(pagesRows);
            setSheetsData((prev) => ({
              ...prev,
              [a.slug]: { history, platforms, totals, pages },
            }));
          })
          .catch((err) => console.warn(`[sheets] ${a.name}:`, err))
          .finally(onDone);
      }
    }

    loadAll().catch((err) => {
      console.error("[sheets] loadAll failed:", err);
      setSheetsLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // Merge static fallback with live sheets data
  const artists = useMemo(
    () => STATIC_ARTISTS.map((a) => ({ ...a, ...(sheetsData[a.slug] || {}) })),
    [sheetsData]
  );

  const artist = artists.find((a) => a.slug === selectedSlug)!;

  React.useEffect(() => {
    setFeedFilter("All");
    setPagesPlatform("Discord");
    setPieHover(null);
  }, [selectedSlug]);

  // Use sheets history if loaded, otherwise fall back to generated curve
  const fullHistory = useMemo(
    () =>
      sheetsData[selectedSlug]?.history?.length
        ? sheetsData[selectedSlug].history
        : buildHistory(artist),
    [sheetsData, selectedSlug, artist]
  );

  const history = useMemo(() => {
    if (yearRange === "all") return fullHistory;
    const now = new Date(2026, 2, 1);
    if (yearRange === "ytd") return fullHistory.filter((r) => r.date >= "2026-01");
    if (yearRange === "12m") {
      const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 12);
      return fullHistory.filter((r) => new Date(r.date + "-01") >= cutoff);
    }
    if (yearRange === "6m") {
      const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 6);
      return fullHistory.filter((r) => new Date(r.date + "-01") >= cutoff);
    }
    if (yearRange === "3m") {
      const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3);
      return fullHistory.filter((r) => new Date(r.date + "-01") >= cutoff);
    }
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

  const PLAT_ORDER = ["Discord", "Reddit", "Instagram", "Instagram Channels", "X", "X Communities", "TikTok"];
  const orderedPlats = PLAT_ORDER.filter((p) => artist.platforms[p] !== undefined);

  const togglePlat = (p) => {
    const next = new Set(hiddenPlats);
    if (next.has(p)) next.delete(p); else next.add(p);
    setHiddenPlats(next);
  };

  // Sync indicator label
  const syncLabel = sheetsLoading
    ? "syncing…"
    : syncedAt
    ? `synced ${Math.round((Date.now() - syncedAt.getTime()) / 60000) || "<1"}m ago`
    : "live";

  return (
    <div className={`min-h-screen w-full text-slate-800 ${darkMode ? "dark" : ""}`} style={{ background: darkMode ? "linear-gradient(135deg, #0a0c18 0%, #090b16 60%, #0c0a18 100%)" : "linear-gradient(180deg, #fef7ff 0%, #f0f9ff 50%, #fdf4ff 100%)", fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        .marquee-fade { mask-image: linear-gradient(90deg, transparent 0, black 3%, black 97%, transparent 100%); }
        .recharts-cartesian-axis-tick text { fill: #94a3b8; font-size: 10px; font-weight: 500; }
        .recharts-cartesian-grid line { stroke: #e2e8f0; }
        .recharts-polar-grid-angle line { stroke: #e2e8f0; }
        .recharts-polar-angle-axis-tick text { fill: #64748b; font-size: 10px; font-weight: 600; }
        /* Dark mode — 3-level hierarchy:
           page (#0a0c18) → card (#101422) → element (#1b2035) */
        .dark .rounded-3xl.bg-white { background: #101422 !important; }
        .dark .bg-white { background: #1b2035 !important; }
        .dark .bg-slate-50 { background: #0d1020 !important; }
        .dark .bg-slate-100 { background: #0c0f1e !important; }
        .dark .bg-slate-200 { background: #232840 !important; }
        .dark .bg-emerald-50 { background: rgba(16,185,129,0.08) !important; }
        .dark .border-slate-100 { border-color: rgba(255,255,255,0.04) !important; }
        .dark .border-slate-200 { border-color: rgba(255,255,255,0.07) !important; }
        .dark .border-slate-300 { border-color: rgba(255,255,255,0.12) !important; }
        .dark .border-emerald-200 { border-color: rgba(52,211,153,0.2) !important; }
        .dark .border-amber-200 { border-color: rgba(251,191,36,0.15) !important; }
        .dark .text-slate-900 { color: #eef1fc !important; }
        .dark .text-slate-800 { color: #c8ceec !important; }
        .dark .text-slate-700 { color: #8b94ba !important; }
        .dark .text-slate-600 { color: #636d96 !important; }
        .dark .text-slate-500 { color: #636d96 !important; }
        .dark .text-emerald-700 { color: #34d399 !important; }
        .dark .recharts-cartesian-axis-tick text { fill: #3d4566; }
        .dark .recharts-cartesian-grid line { stroke: #1b2035; }
        .dark .recharts-polar-grid-angle line { stroke: #1b2035; }
        .dark .recharts-polar-angle-axis-tick text { fill: #3d4566; }
        .dark .shadow-sm { box-shadow: 0 1px 4px rgba(0,0,0,0.6) !important; }
        .dark .shadow-lg { box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important; }
      `}</style>

      {/* Loading overlay — fades away once all sheets are fetched */}
      {sheetsLoading && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none ${darkMode ? "bg-slate-900/60" : "bg-white/60"}`}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#000dff] border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-slate-600">Loading data…</span>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-[#000dff] to-blue-500 flex items-center justify-center shadow-lg shadow-blue-300/50">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                  <path d="M4 20 L4 4 L12 4 L12 11 L20 11 L20 20 Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                  <circle cx="12" cy="11" r="1.5" fill="white" />
                </svg>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-white animate-pulse" />
              </div>
              <div className="leading-none">
                <div className="text-xl font-bold text-slate-900 tracking-tight">
                  FAN<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#000dff] to-blue-500">INTEL</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mt-1">Community Intelligence</div>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <div className={`w-2 h-2 rounded-full ${sheetsLoading ? "bg-amber-400" : "bg-emerald-500 animate-pulse"}`} />
              <span className="text-[11px] font-semibold text-emerald-700">Live · {syncLabel}</span>
            </div>
          </div>
          <button onClick={() => setDarkMode((d) => !d)} className="text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm w-9 h-9 rounded-xl flex items-center justify-center transition">
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </header>

        {/* Roster */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-xs uppercase tracking-[0.15em] text-slate-500 font-bold">Roster</h2>
              <span className="text-xs text-slate-400 font-medium">{artists.length} artists tracked</span>
            </div>
          </div>
          <div className="relative">
            <div className={`absolute left-0 -top-2 -bottom-2 w-20 pointer-events-none z-[5] transition-opacity duration-150 ${rosterAtStart ? "opacity-0" : "opacity-100"}`} style={{ background: `linear-gradient(to right, ${darkMode ? "#0a0c18" : "#fef7ff"}, transparent)` }} />
            <button
              onClick={() => { setRosterAtStart(true); isScrollingToStart.current = true; rosterRef.current?.scrollTo({ left: 0, behavior: "smooth" }); }}
              className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center hover:shadow-md transition-opacity duration-150 ${rosterAtStart ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            >
              <ChevronDown size={13} className="rotate-90 text-slate-500" />
            </button>
            <div
              ref={rosterRef}
              className="flex gap-3 overflow-x-auto scroll-smooth py-2 -my-2"
              style={{ scrollbarWidth: "none" }}
              onScroll={(e) => {
                const el = e.currentTarget;
                const atStart = el.scrollLeft <= 0;
                const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
                if (isScrollingToEnd.current) {
                  if (atEnd) isScrollingToEnd.current = false;
                  setRosterAtStart(atStart);
                } else if (isScrollingToStart.current) {
                  if (atStart) isScrollingToStart.current = false;
                  setRosterAtEnd(atEnd);
                } else {
                  setRosterAtStart(atStart);
                  setRosterAtEnd(atEnd);
                }
              }}
            >
              {artists.map((a) => <ArtistPill key={a.slug} artist={a} active={a.slug === selectedSlug} onClick={() => setSelectedSlug(a.slug)} />)}
            </div>
            <div className={`absolute right-0 -top-2 -bottom-2 w-20 pointer-events-none z-[5] transition-opacity duration-150 ${rosterAtEnd ? "opacity-0" : "opacity-100"}`} style={{ background: `linear-gradient(to left, ${darkMode ? "#0a0c18" : "#fef7ff"}, transparent)` }} />
            <button
              onClick={() => { const el = rosterRef.current; if (el) { setRosterAtEnd(true); isScrollingToEnd.current = true; el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: "smooth" }); } }}
              className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white border border-slate-200 rounded-full shadow-sm flex items-center justify-center hover:shadow-md transition-opacity duration-150 ${rosterAtEnd ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            >
              <ChevronDown size={13} className="-rotate-90 text-slate-500" />
            </button>
          </div>
        </section>

        {/* Main */}
        <div className="grid grid-cols-12 gap-5">
          <section className="col-span-12 lg:col-span-8 space-y-5">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#000dff] to-blue-600 p-6 text-white">
              <div className="absolute top-0 right-0 w-72 h-72 opacity-20 -mr-20 -mt-20"><div className="w-full h-full rounded-full bg-white blur-3xl" /></div>
              <div className="absolute bottom-0 left-1/2 w-64 h-64 opacity-10 -mb-32"><div className="w-full h-full rounded-full bg-yellow-200 blur-3xl" /></div>
              <div className="relative flex items-center justify-between gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-bold mb-2">Now viewing</div>
                  <h3 className="text-5xl font-bold tracking-tight leading-none">{artist.name}</h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-bold mb-2">Cumulative reach</div>
                  <div className="font-bold text-4xl tabular-nums leading-none">{fmtFull(artist.totals.value)}</div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${artist.totals.delta >= 0 ? "bg-white/20 text-white" : "bg-rose-900/30 text-rose-100"}`}>
                      {artist.totals.delta >= 0 ? "↑" : "↓"} {fmt(Math.abs(artist.totals.delta))}
                    </span>
                    <span className="text-[10px] text-white/70 font-medium">last 28d</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Growth chart */}
            <div className="bg-white border border-slate-200 rounded-3xl pt-6 px-6 pb-[14.5px] shadow-sm">
              <div className="flex flex-col gap-[15.5px] mb-[18px]">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Fan Network Growth</div>
                    <div className="text-base font-semibold text-slate-900 mt-0.5">Followers across platforms</div>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
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
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                          yearRange === opt.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {orderedPlats.map((p) => {
                    const off = hiddenPlats.has(p);
                    return (
                      <button key={p} onClick={() => togglePlat(p)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold transition ${off ? "border-slate-200 text-slate-400 bg-slate-50" : "border-slate-200 text-slate-700 bg-white hover:border-slate-300"}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: off ? "#cbd5e1" : PLATFORMS[p].color }} />
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {rangeStats && (
                <div className="flex mb-[13.5px] p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 divide-x divide-blue-200 dark:divide-blue-900/40">
                  <div className="flex-1 pr-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Net growth</div>
                    <div className={`text-base font-bold tabular-nums flex items-center gap-1 ${rangeStats.net >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {rangeStats.net >= 0 ? "+" : ""}{fmt(rangeStats.net)}
                      <span className="text-[10px] font-semibold">({rangeStats.pct >= 0 ? "+" : ""}{rangeStats.pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="flex-1 px-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Best month</div>
                    <div className="text-base font-bold text-slate-900">
                      {rangeStats.bestMonth ? monthLabel(rangeStats.bestMonth) : "—"}
                      {rangeStats.bestGain > 0 && <span className="text-xs text-emerald-600 ml-1.5 font-semibold">+{fmt(rangeStats.bestGain)}</span>}
                    </div>
                  </div>
                  <div className="flex-1 px-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Range start</div>
                    <div className="text-base font-bold tabular-nums text-slate-900">{fmt(rangeStats.startTotal)}</div>
                  </div>
                  <div className="flex-1 pl-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Range end</div>
                    <div className="text-base font-bold tabular-nums text-slate-900">{fmt(rangeStats.endTotal)}</div>
                  </div>
                </div>
              )}

              <div className="h-[320px] -mx-2">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data in the selected range</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 4" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={monthLabel} interval={Math.max(0, Math.floor(history.length / 8))} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                      <YAxis tickFormatter={fmt} axisLine={false} tickLine={false} width={48} ticks={(() => { const cur = Math.max(...orderedPlats.filter(p => !hiddenPlats.has(p)).map(p => artist.platforms[p]?.value || 0), 1); const hist = Math.max(...history.flatMap(d => orderedPlats.filter(p => !hiddenPlats.has(p)).map(p => (d[p] as number) || 0)), 1); const maxVal = hist <= cur * 2 ? hist : cur; const rawStep = maxVal / 4; const mag = Math.pow(10, Math.floor(Math.log10(rawStep))); const norm = rawStep / mag; const step = ([1,1.5,2,2.5,3,4,5,6,7,8,10].find(f => f >= norm) ?? 10) * mag; return [0, step, step * 2, step * 3, step * 4]; })()} domain={[0, (() => { const cur = Math.max(...orderedPlats.filter(p => !hiddenPlats.has(p)).map(p => artist.platforms[p]?.value || 0), 1); const hist = Math.max(...history.flatMap(d => orderedPlats.filter(p => !hiddenPlats.has(p)).map(p => (d[p] as number) || 0)), 1); const maxVal = hist <= cur * 2 ? hist : cur; const rawStep = maxVal / 4; const mag = Math.pow(10, Math.floor(Math.log10(rawStep))); const norm = rawStep / mag; const step = ([1,1.5,2,2.5,3,4,5,6,7,8,10].find(f => f >= norm) ?? 10) * mag; return step * 4; })()]} />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }} wrapperStyle={{ transition: "none" }} />
                      {(() => {
                        const maxVal = Math.max(...orderedPlats.map((p) => artist.platforms[p]?.value || 0));
                        return orderedPlats.map((p) => {
                          if (hiddenPlats.has(p)) return null;
                          const isMinor = (artist.platforms[p]?.value || 0) < maxVal * 0.15;
                          return <Line key={p} type="monotone" dataKey={p} stroke={PLATFORMS[p].color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "white" }} isAnimationActive={false} />;
                        });
                      })()}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Current reach */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="mb-5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Current Reach</div>
                <div className="text-base font-semibold text-slate-900 mt-0.5">Per-platform follower counts</div>
                <div className="text-xs text-slate-500">Change vs previous month</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {orderedPlats.map((p) => <KpiTile key={p} platform={p} value={artist.platforms[p].value} delta={artist.platforms[p].delta} />)}
              </div>
            </div>
          </section>

          <aside className="col-span-12 lg:col-span-4 space-y-5">
            {(() => {
              const PLAT_ORDER_PAGES = ["Discord", "Reddit", "Instagram", "Instagram Channels", "X", "X Communities", "TikTok"];
              const availablePlatformsSet = new Set(artist.pages.map((p) => p.platform).filter(Boolean));
              const availablePlatforms = PLAT_ORDER_PAGES.filter((p) => availablePlatformsSet.has(p));
              // Always use a platform that actually exists in the list
              const effectivePlatform = availablePlatforms.includes(pagesPlatform)
                ? pagesPlatform
                : availablePlatforms.includes("Discord")
                ? "Discord"
                : availablePlatforms[0] || "Discord";
              const filteredPages = artist.pages
                .filter((p) => p.platform === effectivePlatform)
                .sort((a, b) => b.followers - a.followers);
              return (
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Fan Page Tracker</div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">Admin-run pages</div>
                    </div>
                    <div className="relative">
                      {pagesDropdownOpen && (
                        <div className="fixed inset-0 z-10" onClick={() => setPagesDropdownOpen(false)} />
                      )}
                      <button
                        onClick={() => setPagesDropdownOpen((o) => !o)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 text-[10px] font-semibold text-slate-700 bg-white hover:border-slate-300 transition"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: PLATFORMS[effectivePlatform]?.color ?? "#94a3b8" }} />
                        {effectivePlatform}
                        <ChevronDown size={10} className="text-slate-400" />
                      </button>
                      {pagesDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-slate-200 rounded-2xl shadow-lg py-1.5 min-w-[200px]">
                          {availablePlatforms.map((plat) => (
                            <button
                              key={plat}
                              onClick={() => { setPagesPlatform(plat); setPagesDropdownOpen(false); setPagesAtBottom(false); if (pagesListRef.current) pagesListRef.current.scrollTop = 0; }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold transition hover:bg-slate-50 ${plat === effectivePlatform ? "text-slate-900" : "text-slate-500"}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PLATFORMS[plat]?.color ?? "#94a3b8" }} />
                              {plat}
                              {plat === effectivePlatform && <span className="ml-auto text-[#000dff]">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                  <div
                    ref={pagesListRef}
                    className="p-2 max-h-[594px] overflow-y-auto"
                    onScroll={(e) => { const el = e.currentTarget; setPagesAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 8); }}
                  >
                    {filteredPages.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-slate-400">No {effectivePlatform} pages tracked yet</div>
                    ) : (
                      filteredPages.map((p, i) => {
                        const platCfg = PLATFORMS[effectivePlatform] || { soft: "#f1f5f9", color: "#64748b" };
                        const Tag = p.link ? "a" : "div";
                        return (
                          <Tag key={p.link || `${p.platform}-${p.name}-${i}`} {...(p.link ? { href: p.link, target: "_blank", rel: "noopener noreferrer" } : {})} className="p-3 flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer group rounded-xl no-underline">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: platCfg.soft }}>
                              <span className="text-sm font-bold" style={{ color: platCfg.color }}>{String(i + 1).padStart(2, "0")}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <div className="text-sm font-semibold text-slate-900 group-hover:text-[#000dff] transition truncate">{p.name}</div>
                                {p.managed && <Star size={11} className="shrink-0 text-amber-400 fill-amber-400" />}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{p.latest ? `Last post ${fmtPageDate(p.latest)}` : p.platform}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold tabular-nums text-slate-900">{fmtFull(p.followers)}</div>
                              <div className="text-[10px] text-slate-500">{["Discord","Reddit","X Communities","Instagram Channels"].includes(effectivePlatform) ? "members" : "followers"}</div>
                            </div>
                          </Tag>
                        );
                      })
                    )}
                  </div>
                  </div>
                  {filteredPages.length > 0 && (
                    <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-medium">{filteredPages.length} {(() => { const n = filteredPages.length; if (effectivePlatform === "Discord") return n === 1 ? "server" : "servers"; if (effectivePlatform === "Reddit") return n === 1 ? "subreddit" : "subreddits"; if (effectivePlatform === "Instagram Channels") return n === 1 ? "channel" : "channels"; if (effectivePlatform === "X Communities") return n === 1 ? "community" : "communities"; return n === 1 ? "page" : "pages"; })()} tracked</span>
                      {!pagesAtBottom && filteredPages.length > 9 && <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">scroll for more <ChevronDown size={10} /></span>}
                    </div>
                  )}
                </div>
              );
            })()}

          </aside>
        </div>

        {/* Live Feed */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between mb-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Live <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#000dff] to-blue-500 pr-1">Feed</span></h2>
              <span className="text-xs text-slate-500 font-medium">{artist.name} · recent posts</span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-700">polling · 2m</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter size={14} className="text-slate-400" />
            {(() => {
              const posts = MOCK_FEED[artist.slug] || [];
              const platsInFeed = Array.from(new Set(posts.map((p) => p.platform)));
              const filters = ["All", ...platsInFeed];
              return filters.map((f) => {
                const active = feedFilter === f;
                const cfg = f !== "All" ? PLATFORMS[f] : null;
                const count = f === "All" ? posts.length : posts.filter((p) => p.platform === f).length;
                return (
                  <button key={f} onClick={() => setFeedFilter(f)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${active ? "bg-slate-900 dark:bg-[#000dff] text-white" : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"}`}>
                    {cfg && <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />}
                    {f}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-slate-100"}`}>{count}</span>
                  </button>
                );
              });
            })()}
          </div>

          {(() => {
            const posts = MOCK_FEED[artist.slug] || [];
            const filtered = feedFilter === "All" ? posts : posts.filter((p) => p.platform === feedFilter);
            if (posts.length === 0) {
              return (
                <div className="border-2 border-dashed border-slate-200 rounded-3xl bg-white p-10 text-center">
                  <AlertCircle size={20} className="text-slate-400 mx-auto mb-2" />
                  <div className="text-sm text-slate-600 font-medium">No feed data for this artist yet</div>
                  <div className="text-xs text-slate-400 mt-1">Connect a Reddit or Discord page to start tracking</div>
                </div>
              );
            }
            return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map((post, i) => <FeedCard key={i} post={post} />)}</div>;
          })()}

          <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Mock data.</span> In production: Reddit via public API · Discord via bot · X via paid API · Instagram &amp; TikTok via aggregators or manual curation.
            </div>
          </div>
        </section>

        {/* Deep Analytics */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between mb-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Deep <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#000dff] to-blue-500 pr-1">Analytics</span></h2>
              <span className="text-xs text-slate-500 font-medium">{artist.name} · cross-cuts</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center"><PieIcon size={12} className="text-blue-600" /></div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Platform Share</div>
              </div>
              <div className="text-sm font-semibold text-slate-900 mb-3">Distribution of total reach</div>
              <div
                className="relative h-[200px]"
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
                      innerRadius={55} outerRadius={85}
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
                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Total</div>
                  <div className="font-bold text-lg text-slate-900 tabular-nums">{fmt(artist.totals.value)}</div>
                </div>
                {pieHover && piePos && (
                  <div
                    className="absolute pointer-events-none z-10 flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-lg"
                    style={{ left: piePos.x + 14, top: piePos.y - 16, transform: "translateY(-50%)" }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: pieHover.fill }} />
                    <span className="text-slate-600 font-medium">{pieHover.name}</span>
                    <span className="font-bold tabular-nums text-slate-900">{fmtFull(pieHover.value)}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-1.5 text-xs">
                {platformShareData(artist).sort((a, b) => b.value - a.value).slice(0, 3).map((d) => {
                  const pct = ((d.value / artist.totals.value) * 100).toFixed(1);
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                      <span className="text-slate-600 flex-1 font-medium">{d.name}</span>
                      <span className="font-bold text-slate-900 tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

<div className="col-span-12 md:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center"><Zap size={12} className="text-amber-600" /></div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Growth Velocity</div>
              </div>
              <div className="text-sm font-semibold text-slate-900 mb-3">Net added · trailing 12mo</div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyVelocity(history, orderedPlats)} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(ym) => monthLabel(ym).split(" ")[0]} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tickFormatter={fmt} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{monthLabel(label)}</div>
                        <div className="font-bold tabular-nums text-slate-900 text-sm mt-1">{payload[0].value >= 0 ? "+" : ""}{fmtFull(payload[0].value)}</div>
                      </div>
                    ) : null} cursor={{ fill: darkMode ? "#1e293b" : "#f1f5f9" }} wrapperStyle={{ transition: "none" }} />
                    <Bar dataKey="net" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      {monthlyVelocity(history, orderedPlats).map((d, i) => <Cell key={i} fill={d.net >= 0 ? "#10b981" : "#f43f5e"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-12 md:col-span-4 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Fastest Movers · 28d</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">Biggest swings across the roster</div>
              </div>
              <div className="p-2">
                {artists.slice().sort((a, b) => Math.abs(b.totals.delta) - Math.abs(a.totals.delta)).slice(0, 5).map((a, i) => {
                  const up = a.totals.delta >= 0;
                  return (
                    <div key={a.slug} className="w-full p-3 flex items-center gap-3 rounded-xl">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-700" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-500"}`}>{i + 1}</div>
                      <span className="flex-1 text-sm font-semibold text-slate-900 truncate">{a.name}</span>
                      <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${up ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{up ? "+" : ""}{fmt(a.totals.delta)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
