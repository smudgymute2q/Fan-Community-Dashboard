import React, { useState, useMemo } from "react";
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
  Search,
  Settings2,
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
} from "lucide-react";

// ---- Platform tokens (light-theme friendly) ----
const PLATFORMS = {
  Discord: { color: "#5865F2", soft: "#E8EAFD" },
  Reddit: { color: "#FF4500", soft: "#FFECE3" },
  Instagram: { color: "#E1306C", soft: "#FCE4EE" },
  "Instagram Channels": { color: "#8B5CF6", soft: "#F1EBFE" },
  X: { color: "#1F2937", soft: "#E5E7EB" },
  "X Communities": { color: "#6B7280", soft: "#F3F4F6" },
  TikTok: { color: "#06B6D4", soft: "#E0F7FB" },
};

const ARTISTS = [
  { slug: "playboi-carti", name: "Playboi Carti", tagline: "Opium · Rage principal", totals: { value: 1495905, delta: 4537 }, platforms: { Discord: { value: 182148, delta: 338 }, Reddit: { value: 1029516, delta: 8064 }, Instagram: { value: 253236, delta: -3425 }, "Instagram Channels": { value: 23900, delta: -400 }, X: { value: 6995, delta: -38 }, "X Communities": { value: 110, delta: -2 } }, pages: [{ name: "/playboicarti", followers: 182148, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/pbc00", followers: 13193, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "ken-carson", name: "Ken Carson", tagline: "Opium · Project X", totals: { value: 536568, delta: 11932 }, platforms: { Discord: { value: 76270, delta: 236 }, Reddit: { value: 75448, delta: 904 }, Instagram: { value: 212157, delta: 8336 }, "Instagram Channels": { value: 22500, delta: 1000 }, X: { value: 45700, delta: 300 }, "X Communities": { value: 79146, delta: 9 }, TikTok: { value: 24300, delta: 100 } }, pages: [{ name: "/kencarson", followers: 76270, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/BuZYYKZQ", followers: 153, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "destroy-lonely", name: "Destroy Lonely", tagline: "Opium · The NS collective", totals: { value: 213034, delta: 59171 }, platforms: { Discord: { value: 36318, delta: 98 }, Reddit: { value: 55756, delta: 499 }, Instagram: { value: 65854, delta: 7484 }, "Instagram Channels": { value: 1600, delta: -2400 }, X: { value: 28706, delta: 28690 }, "X Communities": { value: 9200, delta: 0 }, TikTok: { value: 15600, delta: 0 } }, pages: [{ name: "/destroylonely", followers: 36318, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/bh3", followers: 1867, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "homixide-gang", name: "Homixide Gang", tagline: "Opium · HXG duo", totals: { value: 37566, delta: -231 }, platforms: { Discord: { value: 10277, delta: -51 }, Reddit: { value: 8943, delta: 35 }, Instagram: { value: 18346, delta: -215 } }, pages: [{ name: "/hxg", followers: 10277, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "pierre-bourne", name: "Pierre Bourne", tagline: "Producer · SossHouse", totals: { value: 37147, delta: 171 }, platforms: { Discord: { value: 4955, delta: 53 }, Reddit: { value: 22381, delta: 104 }, Instagram: { value: 9424, delta: -14 }, "Instagram Channels": { value: 387, delta: 28 } }, pages: [{ name: "/pierrebourne", followers: 4955, latest: "Apr 1, 2026", platform: "Discord" }, { name: "/yopierre", followers: 372, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "rema", name: "Rema", tagline: "Afrobeats · Mavin", totals: { value: 2123652, delta: 4239 }, platforms: { Discord: { value: 2541, delta: 23 }, Reddit: { value: 308, delta: 4 }, Instagram: { value: 698524, delta: 3991 }, X: { value: 22179, delta: -79 }, TikTok: { value: 1400100, delta: 300 } }, pages: [{ name: "/heisrema", followers: 2541, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "opium-00", name: "Opium Collective", tagline: "Label · Core fanbase", totals: { value: 168074, delta: 808 }, platforms: { Discord: { value: 8809, delta: 1 }, Reddit: { value: 19795, delta: 425 }, Instagram: { value: 95339, delta: 415 }, "Instagram Channels": { value: 9400, delta: -200 }, X: { value: 1775, delta: 154 }, TikTok: { value: 32956, delta: 13 } }, pages: [{ name: "/opium00", followers: 8809, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "untiljapan", name: "Untiljapan", tagline: "Emerging · Underground", totals: { value: 6802, delta: 136 }, platforms: { Discord: { value: 2039, delta: 44 }, Reddit: { value: 1416, delta: -7 }, Instagram: { value: 1713, delta: 22 }, X: { value: 1079, delta: 60 }, "X Communities": { value: 555, delta: 17 }, TikTok: { value: 9, delta: 0 } }, pages: [{ name: "/untiljapan", followers: 2039, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "apollo", name: "Apollo", tagline: "Emerging · SoundCloud era", totals: { value: 1659, delta: 80 }, platforms: { Discord: { value: 283, delta: 44 }, Reddit: { value: 56, delta: 8 }, Instagram: { value: 1320, delta: 28 } }, pages: [{ name: "/apollohub", followers: 564, latest: "Apr 9, 2026", platform: "Discord" }, { name: "/apollored1", followers: 283, latest: "Apr 1, 2026", platform: "Discord" }] },
  { slug: "pfe-project", name: "PfeRaWF4bG", tagline: "Emerging · Discord-native", totals: { value: 10144, delta: 2202 }, platforms: { Discord: { value: 6089, delta: 1410 }, Reddit: { value: 359, delta: 39 }, Instagram: { value: 322, delta: 131 }, X: { value: 2362, delta: 235 }, "X Communities": { value: 261, delta: 23 }, TikTok: { value: 751, delta: 364 } }, pages: [{ name: "/PfeRaWF4bG", followers: 6089, latest: "Apr 1, 2026", platform: "Discord" }] },
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
  "homixide-gang": [
    { platform: "Reddit", page: "/r/homixidegang", author: "u/hxg_forever", time: "2h ago", title: "Snot x Beno collab album rumors", body: "Someone in the Carti Discord dropped a snippet with both of them on a track.", engagement: { upvotes: 847, comments: 184 }, sentiment: "hype" },
    { platform: "Discord", page: "/hxg", author: "hxg_mod", time: "4h ago", title: "#snot-vs-beno", body: "Keep the discourse in this channel. No individual stan wars in #general.", engagement: { reactions: 124, replies: 48 }, sentiment: "neutral" },
    { platform: "Instagram", page: "@homixide_gang", author: "homixide_gang", time: "6h ago", title: null, body: "WE UP NEXT", engagement: { likes: 28471, comments: 1847 }, media: "image", sentiment: "hype" },
  ],
  "pierre-bourne": [
    { platform: "X", page: "@pierrebourne", author: "pierrebourne", time: "1h ago", title: null, body: "SossHouse Vol 3 mastering wrapped. release window q3.", engagement: { likes: 8473, reposts: 1247, replies: 384 }, sentiment: "hype" },
    { platform: "Reddit", page: "/r/pierrebourne", author: "u/yo_pierre_up", time: "3h ago", title: "Production breakdown: how Pierre builds his signature bell melodies", body: "Did a deep-dive breakdown in FL. Reverse-engineered the chord progressions.", engagement: { upvotes: 1284, comments: 247 }, sentiment: "positive" },
  ],
  "opium-00": [
    { platform: "Instagram", page: "@opium", author: "opium", time: "45m ago", title: null, body: "OPIUM TOUR 2026. full lineup next week.", engagement: { likes: 184273, comments: 8472 }, media: "image", sentiment: "hype" },
    { platform: "Reddit", page: "/r/opium", author: "u/label_watcher", time: "2h ago", title: "Who's joining Carti, Ken, and Destroy on the 2026 tour?", body: "The teaser shows 5 silhouettes not 3. Leaning toward Homixide + one new signee.", engagement: { upvotes: 2847, comments: 482 }, sentiment: "hype" },
    { platform: "Discord", page: "/opium00", author: "opium_verified", time: "4h ago", title: "#tour-2026", body: "Channel opened for tour discussion. All presale info will be posted here.", engagement: { reactions: 847, replies: 128 }, sentiment: "neutral" },
  ],
  "untiljapan": [
    { platform: "Discord", page: "/untiljapan", author: "untiljapan_mod", time: "1h ago", title: "#new-release", body: "EP drops Friday. 6 tracks, all produced with 808 Mafia. Thanks for sticking with us at 2K members.", engagement: { reactions: 247, replies: 84 }, sentiment: "positive" },
    { platform: "Reddit", page: "/r/untiljapan", author: "u/underground_digger", time: "5h ago", title: "This artist is about to pop — called it 6 months ago", body: "Been saying it since the Spotify algorithm started pushing them.", engagement: { upvotes: 482, comments: 89 }, sentiment: "hype" },
  ],
  "apollo": [
    { platform: "Instagram", page: "@apollo", author: "apollo", time: "3h ago", title: null, body: "BACK FROM HIATUS. new music soon.", engagement: { likes: 8471, comments: 847 }, media: "image", sentiment: "hype" },
    { platform: "Discord", page: "/apollohub", author: "apollo_staff", time: "6h ago", title: "#general", body: "Welcome to the new members. Pinned message has the FAQ and release schedule.", engagement: { reactions: 84, replies: 24 }, sentiment: "neutral" },
  ],
  "pfe-project": [
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

const fmt = (n) => { if (n === undefined || n === null) return "—"; const abs = Math.abs(n); if (abs >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2) + "M"; if (abs >= 10_000) return (n / 1_000).toFixed(0) + "K"; if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K"; return n.toLocaleString(); };
const fmtFull = (n) => (n ?? 0).toLocaleString();
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("en", { month: "short", year: "2-digit" }); };

function platformShareData(artist) {
  return Object.entries(artist.platforms).map(([name, v]) => ({ name, value: v.value, fill: PLATFORMS[name]?.color || "#888" }));
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
function platformRadar(artist) {
  const allPlats = ["Discord", "Reddit", "Instagram", "Instagram Channels", "X", "X Communities", "TikTok"];
  const maxes = {};
  allPlats.forEach((p) => { maxes[p] = Math.max(...ARTISTS.map((a) => a.platforms[p]?.value || 0), 1); });
  return allPlats.map((p) => ({ platform: p.replace("Instagram Channels", "IG Ch.").replace("X Communities", "X Comm."), value: Math.round(((artist.platforms[p]?.value || 0) / maxes[p]) * 100) }));
}

function DeltaPill({ value, small = false }) {
  if (value === 0 || value === null || value === undefined) return <span className={`inline-flex items-center gap-0.5 text-[#999] ${small ? "text-[10px]" : "text-xs"} font-medium`}><Minus size={small ? 10 : 12} strokeWidth={2.5} /> flat</span>;
  const up = value > 0;
  return <span className={`inline-flex items-center gap-0.5 font-semibold ${small ? "text-[10px]" : "text-xs"} ${up ? "text-green-700" : "text-red-600"}`}>{up ? <ArrowUpRight size={small ? 10 : 12} strokeWidth={3} /> : <ArrowDownRight size={small ? 10 : 12} strokeWidth={3} />}{up ? "+" : ""}{fmt(value)}</span>;
}

function KpiTile({ platform, value, delta, isTotal }) {
  const cfg = PLATFORMS[platform];
  return (
    <div className={`relative p-4 transition border ${isTotal ? "bg-black border-black text-white" : "bg-white border-[#e0e0e0] hover:border-black"}`}>
      {!isTotal && cfg && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full" style={{ background: cfg.color }} />
      )}
      {isTotal && (
        <div className="absolute top-4 right-4">
          <Sparkles size={14} className="text-white/60" />
        </div>
      )}
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isTotal ? "text-white/60" : "text-[#999]"}`}>{isTotal ? "Total Reach" : platform}</div>
      <div className={`font-bold tabular-nums leading-none ${isTotal ? "text-3xl text-white" : "text-2xl text-black"}`}>{fmtFull(value)}</div>
      <div className="mt-2"><DeltaPill value={delta} small /></div>
    </div>
  );
}

function ArtistPill({ artist, active, onClick }) {
  const initial = artist.name.charAt(0);
  return (
    <button onClick={onClick} className={`group relative shrink-0 text-left px-4 py-3 transition-all border ${active ? "bg-black text-white border-black" : "bg-white border-[#e0e0e0] hover:border-black"}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 flex items-center justify-center font-bold text-sm ${active ? "bg-white/20 text-white" : "bg-[#f0f0f0] text-black"}`}>{initial}</div>
        <div>
          <div className={`text-sm font-semibold ${active ? "text-white" : "text-black"}`}>{artist.name}</div>
          <div className={`text-[10px] ${active ? "text-white/60" : "text-[#999]"}`}>{artist.tagline}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 pl-12">
        <span className={`text-xs font-semibold tabular-nums ${active ? "text-white" : "text-black"}`}>{fmt(artist.totals.value)}</span>
        <span className={`text-[10px] font-semibold ${active ? "text-white/60" : artist.totals.delta >= 0 ? "text-green-700" : "text-red-600"}`}>{artist.totals.delta >= 0 ? "+" : ""}{fmt(artist.totals.delta)}</span>
      </div>
    </button>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-black shadow-lg p-3 text-xs">
      <div className="text-[10px] text-[#666] font-bold uppercase tracking-widest mb-2">{label && typeof label === "string" && label.includes("-") ? monthLabel(label) : label}</div>
      <div className="space-y-1.5">
        {payload.slice().sort((a, b) => b.value - a.value).map((p) => (
          <div key={p.dataKey || p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-[#666] flex-1">{p.dataKey || p.name}</span>
            <span className="font-semibold tabular-nums text-black ml-3">{fmtFull(p.value)}</span>
          </div>
        ))}
      </div>
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
  hype: { bg: "bg-black", text: "text-white", label: "HYPE" },
  positive: { bg: "bg-[#f0f0f0]", text: "text-black", label: "POSITIVE" },
  neutral: { bg: "bg-[#f0f0f0]", text: "text-[#666]", label: "NEUTRAL" },
  negative: { bg: "bg-[#f0f0f0]", text: "text-black", label: "WATCH" },
};

function FeedCard({ post }) {
  const cfg = PLATFORMS[post.platform];
  const sent = SENTIMENT_STYLE[post.sentiment];
  return (
    <div className="group relative bg-white border border-[#e0e0e0] hover:border-black transition-all overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ background: cfg.color }} />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-black truncate">{post.page}</div>
              <div className="text-[10px] text-[#999] truncate">@{post.author.replace(/^u\//, "").replace(/^@/, "")} · {post.time}</div>
            </div>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 ${sent.bg} ${sent.text} shrink-0 uppercase tracking-widest`}>{sent.label}</span>
        </div>
        {post.title && <div className="text-[13px] text-black font-semibold leading-snug mb-1">{post.title}</div>}
        <div className="text-xs text-[#555] leading-relaxed line-clamp-3">{post.body}</div>
        {post.media && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#666] bg-[#f5f5f5] px-2 py-1 w-fit">
            {post.media === "video" ? <Play size={10} /> : <ImageIcon size={10} />}
            <span className="uppercase tracking-widest font-semibold">{post.media}</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f0]">
          <div className="flex items-center gap-3.5">
            {engagementSummary(post).map((e, i) => {
              const Icon = e.icon;
              return (
                <div key={i} className="flex items-center gap-1 text-[11px] text-[#666] font-medium">
                  <Icon size={11} strokeWidth={2.2} />
                  <span className="tabular-nums">{e.label}</span>
                </div>
              );
            })}
          </div>
          <button className="opacity-0 group-hover:opacity-100 transition text-[10px] text-[#999] hover:text-black flex items-center gap-1 font-medium">open <ExternalLink size={10} /></button>
        </div>
      </div>
    </div>
  );
}

export default function FanDashboard() {
  const [selectedSlug, setSelectedSlug] = useState("playboi-carti");
  const [hiddenPlats, setHiddenPlats] = useState(new Set());
  const [feedFilter, setFeedFilter] = useState("All");
  const [yearRange, setYearRange] = useState("all"); // "all" | "2026" | "2025" | "2024" | "2023" | "2022" | "ytd" | "12m" | "6m" | "3m"

  React.useEffect(() => { setFeedFilter("All"); }, [selectedSlug]);

  const artist = ARTISTS.find((a) => a.slug === selectedSlug);
  const fullHistory = useMemo(() => buildHistory(artist), [artist]);

  // Filter history by selected range
  const history = useMemo(() => {
    if (yearRange === "all") return fullHistory;
    const now = new Date(2026, 2, 1); // Mar 2026 (end of data)
    if (yearRange === "ytd") {
      return fullHistory.filter((r) => r.date >= "2026-01");
    }
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
    // year-specific: "2025" etc
    return fullHistory.filter((r) => r.date.startsWith(yearRange));
  }, [fullHistory, yearRange]);

  // Stats derived from the filtered range
  const rangeStats = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0];
    const last = history[history.length - 1];
    const plats = Object.keys(artist.platforms);
    const startTotal = plats.reduce((s, p) => s + (first[p] || 0), 0);
    const endTotal = plats.reduce((s, p) => s + (last[p] || 0), 0);
    const net = endTotal - startTotal;
    const pct = startTotal > 0 ? ((net / startTotal) * 100) : 0;
    // best month
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
  const orderedPlats = [...Object.keys(artist.platforms)].sort((a, b) => artist.platforms[b].value - artist.platforms[a].value);

  const togglePlat = (p) => {
    const next = new Set(hiddenPlats);
    if (next.has(p)) next.delete(p); else next.add(p);
    setHiddenPlats(next);
  };

  return (
    <div className="min-h-screen w-full text-black" style={{ background: "#fff", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <style>{`
        .font-display { font-family: 'Nudge', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: bold; text-transform: uppercase; letter-spacing: -0.01em; }
        .marquee-fade { mask-image: linear-gradient(90deg, transparent 0, black 3%, black 97%, transparent 100%); }
        .recharts-cartesian-axis-tick text { fill: #999; font-size: 10px; font-weight: 500; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        .recharts-cartesian-grid line { stroke: #e8e8e8; }
        .recharts-polar-grid-angle line { stroke: #e8e8e8; }
        .recharts-polar-angle-axis-tick text { fill: #555; font-size: 10px; font-weight: 600; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
      `}</style>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 pb-4 border-b border-black">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 bg-black flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                  <path d="M4 20 L4 4 L12 4 L12 11 L20 11 L20 20 Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                  <circle cx="12" cy="11" r="1.5" fill="white" />
                </svg>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 ring-2 ring-white animate-pulse" />
              </div>
              <div className="leading-none">
                <div className="font-display text-xl text-black">FANINTEL PRO</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#999] mt-1">Community Intelligence</div>
              </div>
            </div>
            <div className="h-6 w-px bg-[#e0e0e0]" />
            <div className="flex items-center gap-2 border border-[#e0e0e0] px-3 py-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 animate-pulse" />
              <span className="text-[11px] font-medium text-[#555]">Live · synced 2m ago</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 border border-[#e0e0e0] hover:border-black flex items-center justify-center transition"><Search size={14} /></button>
            <button className="w-9 h-9 border border-[#e0e0e0] hover:border-black flex items-center justify-center transition"><Settings2 size={14} /></button>
          </div>
        </header>

        {/* Roster */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#999] font-bold">Roster</h2>
              <span className="text-[10px] text-[#bbb]">{ARTISTS.length} artists tracked</span>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto marquee-fade pb-2 -mx-2 px-2">
            {ARTISTS.map((a) => <ArtistPill key={a.slug} artist={a} active={a.slug === selectedSlug} onClick={() => setSelectedSlug(a.slug)} />)}
          </div>
        </section>

        {/* Main */}
        <div className="grid grid-cols-12 gap-5">
          <section className="col-span-12 lg:col-span-8 space-y-5">
            {/* Hero */}
            <div className="relative overflow-hidden bg-black p-8 text-white">
              <div className="relative flex items-end justify-between gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-3">Now viewing</div>
                  <h3 className="font-display text-6xl leading-none">{artist.name}</h3>
                  <div className="mt-3 text-sm text-white/60">{artist.tagline}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-3">Cumulative reach</div>
                  <div className="font-display text-5xl tabular-nums leading-none">{fmtFull(artist.totals.value)}</div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 border ${artist.totals.delta >= 0 ? "border-white/30 text-white" : "border-red-400/30 text-red-300"}`}>
                      {artist.totals.delta >= 0 ? "↑" : "↓"} {fmt(Math.abs(artist.totals.delta))}
                    </span>
                    <span className="text-[10px] text-white/40">last 28d</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Growth chart */}
            <div className="bg-white border border-[#e0e0e0] p-6">
              <div className="flex flex-col gap-4 mb-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[#999] font-bold">Fan Network Growth</div>
                    <div className="font-display text-xl text-black mt-0.5">Followers across platforms</div>
                    <div className="text-xs text-[#999] mt-1">
                      {history.length > 0 ? `${monthLabel(history[0].date)} — ${monthLabel(history[history.length - 1].date)}` : "No data in range"}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 border border-[#e0e0e0] p-1">
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
                        className={`text-[11px] font-semibold px-3 py-1.5 transition uppercase tracking-wider ${
                          yearRange === opt.key ? "bg-black text-white" : "text-[#666] hover:text-black"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-[#bbb] font-bold">Year:</span>
                  {["2022", "2023", "2024", "2025", "2026"].map((yr) => (
                    <button
                      key={yr}
                      onClick={() => setYearRange(yr)}
                      className={`text-[11px] font-semibold px-2.5 py-1 transition border ${
                        yearRange === yr ? "bg-black text-white border-black" : "border-[#e0e0e0] text-[#666] hover:border-black hover:text-black"
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                  {yearRange !== "all" && (
                    <button onClick={() => setYearRange("all")} className="text-[11px] font-semibold px-2.5 py-1 text-[#999] hover:text-black underline-offset-2 hover:underline">
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {orderedPlats.map((p) => {
                    const off = hiddenPlats.has(p);
                    return (
                      <button key={p} onClick={() => togglePlat(p)} className={`flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-semibold transition uppercase tracking-wider ${off ? "border-[#e0e0e0] text-[#ccc]" : "border-[#e0e0e0] text-[#555] hover:border-black"}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: off ? "#ddd" : PLATFORMS[p].color }} />
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {rangeStats && (
                <div className="grid grid-cols-4 gap-px mb-4 bg-[#e0e0e0]">
                  {[
                    { label: "Range start", value: fmt(rangeStats.startTotal) },
                    { label: "Range end", value: fmt(rangeStats.endTotal) },
                    { label: "Net growth", value: `${rangeStats.net >= 0 ? "+" : ""}${fmt(rangeStats.net)}`, sub: `(${rangeStats.pct >= 0 ? "+" : ""}${rangeStats.pct.toFixed(1)}%)`, color: rangeStats.net >= 0 ? "text-green-700" : "text-red-600" },
                    { label: "Best month", value: rangeStats.bestMonth ? monthLabel(rangeStats.bestMonth) : "—", sub: rangeStats.bestGain > 0 ? `+${fmt(rangeStats.bestGain)}` : "" },
                  ].map((s) => (
                    <div key={s.label} className="bg-white p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#999] mb-1">{s.label}</div>
                      <div className={`text-base font-bold tabular-nums ${s.color || "text-black"}`}>{s.value} {s.sub && <span className="text-[11px] font-semibold text-[#999]">{s.sub}</span>}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="h-[320px] -mx-2">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[#999] text-sm">No data in the selected range</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 4" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={monthLabel} interval={Math.max(0, Math.floor(history.length / 8))} axisLine={{ stroke: "#e0e0e0" }} tickLine={false} />
                      <YAxis tickFormatter={fmt} axisLine={false} tickLine={false} width={48} />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#ccc", strokeDasharray: "3 3" }} />
                      {orderedPlats.map((p) => hiddenPlats.has(p) ? null : <Line key={p} type="monotone" dataKey={p} stroke={PLATFORMS[p].color} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "white" }} />)}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Current reach */}
            <div className="bg-white border border-[#e0e0e0] p-6">
              <div className="mb-5">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#999] font-bold">Current Reach</div>
                <div className="font-display text-xl text-black mt-0.5">Per-platform follower counts</div>
                <div className="text-xs text-[#999] mt-1">Change vs 28 days ago</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#e0e0e0]">
                {orderedPlats.map((p) => <KpiTile key={p} platform={p} value={artist.platforms[p].value} delta={artist.platforms[p].delta} />)}
                <KpiTile isTotal platform="Total" value={artist.totals.value} delta={artist.totals.delta} />
              </div>
            </div>
          </section>

          <aside className="col-span-12 lg:col-span-4 space-y-5">
            <div className="bg-white border border-[#e0e0e0] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#e0e0e0] flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[#999] font-bold">Fan Page Tracker</div>
                  <div className="font-display text-lg text-black mt-0.5">Admin-run pages</div>
                </div>
                <button className="text-[10px] font-semibold text-[#555] border border-[#e0e0e0] hover:border-black px-2.5 py-1.5 flex items-center gap-1 transition">Discord <ChevronDown size={10} /></button>
              </div>
              <div>
                {artist.pages.map((p, i) => {
                  const platCfg = PLATFORMS[p.platform];
                  return (
                    <div key={p.name} className="px-5 py-3 flex items-center gap-3 hover:bg-[#f5f5f5] transition cursor-pointer group border-b border-[#f0f0f0] last:border-0">
                      <div className="w-8 h-8 flex items-center justify-center shrink-0 bg-[#f5f5f5]">
                        <span className="text-xs font-bold text-[#555]">{String(i + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-black group-hover:underline truncate">{p.name}</div>
                        <div className="text-[10px] text-[#999] mt-0.5">posted {p.latest}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold tabular-nums text-black">{fmtFull(p.followers)}</div>
                        <div className="text-[10px] text-[#999]">followers</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-[#e0e0e0] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#e0e0e0]">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#999] font-bold">Fastest Movers · 28d</div>
                <div className="font-display text-lg text-black mt-0.5">Biggest swings</div>
              </div>
              <div>
                {ARTISTS.slice().sort((a, b) => Math.abs(b.totals.delta) - Math.abs(a.totals.delta)).slice(0, 5).map((a, i) => {
                  const up = a.totals.delta >= 0;
                  return (
                    <button key={a.slug} onClick={() => setSelectedSlug(a.slug)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#f5f5f5] transition text-left border-b border-[#f0f0f0] last:border-0">
                      <div className="w-6 h-6 flex items-center justify-center text-xs font-bold text-[#999]">{i + 1}</div>
                      <span className="flex-1 text-sm font-semibold text-black truncate">{a.name}</span>
                      <span className={`text-xs font-bold tabular-nums px-2 py-0.5 border ${up ? "border-green-200 text-green-700 bg-green-50" : "border-red-200 text-red-600 bg-red-50"}`}>{up ? "+" : ""}{fmt(a.totals.delta)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        {/* Live Feed */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-black">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-4xl text-black">Live Feed</h2>
              <span className="text-xs text-[#999]">{artist.name} · recent posts</span>
            </div>
            <div className="flex items-center gap-2 border border-[#e0e0e0] px-3 py-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 animate-pulse" />
              <span className="text-[11px] text-[#555]">polling · 2m</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter size={12} className="text-[#bbb]" />
            {(() => {
              const posts = MOCK_FEED[artist.slug] || [];
              const platsInFeed = Array.from(new Set(posts.map((p) => p.platform)));
              const filters = ["All", ...platsInFeed];
              return filters.map((f) => {
                const active = feedFilter === f;
                const cfg = f !== "All" ? PLATFORMS[f] : null;
                const count = f === "All" ? posts.length : posts.filter((p) => p.platform === f).length;
                return (
                  <button key={f} onClick={() => setFeedFilter(f)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition border uppercase tracking-wider ${active ? "bg-black text-white border-black" : "bg-white border-[#e0e0e0] text-[#555] hover:border-black"}`}>
                    {cfg && <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />}
                    {f}
                    <span className={`text-[10px] px-1.5 py-0.5 ${active ? "bg-white/20" : "bg-[#f0f0f0] text-[#666]"}`}>{count}</span>
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
                <div className="border border-dashed border-[#e0e0e0] bg-white p-10 text-center">
                  <AlertCircle size={20} className="text-[#ccc] mx-auto mb-2" />
                  <div className="text-sm text-[#666] font-medium">No feed data for this artist yet</div>
                  <div className="text-xs text-[#bbb] mt-1">Connect a Reddit or Discord page to start tracking</div>
                </div>
              );
            }
            return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#e0e0e0]">{filtered.map((post, i) => <FeedCard key={i} post={post} />)}</div>;
          })()}

          <div className="mt-4 px-4 py-3 border border-[#e0e0e0] flex items-start gap-2">
            <AlertCircle size={14} className="text-[#999] mt-0.5 shrink-0" />
            <div className="text-xs text-[#666] leading-relaxed">
              <span className="font-semibold text-black">Mock data.</span> In production: Reddit via public API · Discord via bot · X via paid API · Instagram &amp; TikTok via aggregators or manual curation.
            </div>
          </div>
        </section>

        {/* Deep Analytics */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-black">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-4xl text-black">Deep Analytics</h2>
              <span className="text-xs text-[#999]">{artist.name} · cross-cuts</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-4 bg-white border border-[#e0e0e0] p-5">
              <div className="flex items-center gap-2 mb-1">
                <PieIcon size={12} className="text-[#999]" />
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#999] font-bold">Platform Share</div>
              </div>
              <div className="font-display text-lg text-black mb-3">Distribution of total reach</div>
              <div className="relative h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={platformShareData(artist)} innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value" stroke="white" strokeWidth={2}>
                      {platformShareData(artist).map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#999]">Total</div>
                  <div className="font-bold text-lg text-black tabular-nums">{fmt(artist.totals.value)}</div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs">
                {platformShareData(artist).sort((a, b) => b.value - a.value).slice(0, 3).map((d) => {
                  const pct = ((d.value / artist.totals.value) * 100).toFixed(1);
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                      <span className="text-[#555] flex-1 font-medium">{d.name}</span>
                      <span className="font-bold text-black tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="col-span-12 md:col-span-4 bg-white border border-[#e0e0e0] p-5">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={12} className="text-[#999]" />
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#999] font-bold">Platform Presence</div>
              </div>
              <div className="font-display text-lg text-black mb-3">Normalized vs roster top</div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={platformRadar(artist)}>
                    <PolarGrid stroke="#e8e8e8" />
                    <PolarAngleAxis dataKey="platform" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="value" stroke="#000" fill="#000" fillOpacity={0.1} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-12 md:col-span-4 bg-white border border-[#e0e0e0] p-5">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={12} className="text-[#999]" />
                <div className="text-[10px] uppercase tracking-[0.15em] text-[#999] font-bold">Growth Velocity</div>
              </div>
              <div className="font-display text-lg text-black mb-3">Net added · trailing 12mo</div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyVelocity(history, orderedPlats)} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(ym) => monthLabel(ym).split(" ")[0]} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tickFormatter={fmt} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="bg-white border border-black shadow p-3 text-xs">
                        <div className="text-[10px] text-[#999] font-bold uppercase tracking-widest">{monthLabel(label)}</div>
                        <div className="font-bold tabular-nums text-black text-sm mt-1">{payload[0].value >= 0 ? "+" : ""}{fmtFull(payload[0].value)}</div>
                      </div>
                    ) : null} cursor={{ fill: "#f5f5f5" }} />
                    <Bar dataKey="net" radius={[2, 2, 0, 0]}>
                      {monthlyVelocity(history, orderedPlats).map((d, i) => <Cell key={i} fill={d.net >= 0 ? "#000" : "#ccc"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-12 bg-white border border-[#e0e0e0] p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <BarChart3 size={12} className="text-[#999]" />
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[#999] font-bold">Roster Comparison</div>
                </div>
                <span className="text-[10px] text-[#bbb]">stacked by platform</span>
              </div>
              <div className="font-display text-lg text-black mb-3">Total reach — all tracked artists</div>
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ARTISTS.slice().sort((a, b) => b.totals.value - a.totals.value).map((a) => { const row = { name: a.name }; Object.entries(a.platforms).forEach(([p, v]) => { row[p] = v.value; }); return row; })} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 4" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmt} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fill: "#333", fontSize: 12, fontWeight: 500 }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f5f5f5" }} />
                    {Object.keys(PLATFORMS).map((p, i, arr) => (
                      <Bar key={p} dataKey={p} stackId="a" fill={PLATFORMS[p].color} radius={i === arr.length - 1 ? [0, 2, 2, 0] : i === 0 ? [2, 0, 0, 2] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {Object.keys(PLATFORMS).map((p) => (
                  <div key={p} className="flex items-center gap-1.5 text-[11px] text-[#555]">
                    <span className="w-2 h-2 rounded-full" style={{ background: PLATFORMS[p].color }} />
                    {p}
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-12 bg-white border border-[#e0e0e0] p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Activity size={12} className="text-[#999]" />
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[#999] font-bold">Cumulative Reach</div>
                </div>
                <span className="text-[10px] text-[#bbb]">stacked area · all platforms</span>
              </div>
              <div className="font-display text-lg text-black mb-3">
                How the total fanbase was built over time
                {yearRange !== "all" && <span className="ml-2 text-sm font-normal text-[#999]">· filtered: {yearRange === "ytd" ? "YTD" : yearRange === "12m" ? "last 12 months" : yearRange === "6m" ? "last 6 months" : yearRange === "3m" ? "last 3 months" : yearRange}</span>}
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <defs>
                      {orderedPlats.map((p) => (
                        <linearGradient key={p} id={`grad-${p.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={PLATFORMS[p].color} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={PLATFORMS[p].color} stopOpacity={0.05} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={monthLabel} interval={Math.floor(history.length / 8)} axisLine={{ stroke: "#e0e0e0" }} tickLine={false} />
                    <YAxis tickFormatter={fmt} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#ccc", strokeDasharray: "3 3" }} />
                    {orderedPlats.map((p) => <Area key={p} type="monotone" dataKey={p} stackId="1" stroke={PLATFORMS[p].color} strokeWidth={1.5} fill={`url(#grad-${p.replace(/\s/g, "")})`} />)}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 pt-6 border-t border-black flex items-center justify-between text-xs text-[#999]">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm text-black">FANINTEL PRO</span>
            <span className="text-[#e0e0e0]">·</span>
            <span>Data snapshot · Apr 18, 2026</span>
          </div>
          <span>v0.3 · Community Intelligence Platform</span>
        </footer>
      </div>
    </div>
  );
}
