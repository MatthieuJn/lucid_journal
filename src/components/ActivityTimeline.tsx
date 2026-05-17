"use client";

import { useEffect, useState } from "react";
import type { ActivityEvent } from "@/types/activity";

import type { Category } from "@/lib/categorize";

const CATEGORY_COLORS: Record<string, string> = {
  work: "#60A5FA",          // blue
  fun: "#A78BFA",           // purple
  communication: "#FB923C", // orange
  system: "#4B5563",        // gray
};

const CATEGORY_LABELS: Record<string, string> = {
  work: "Travail",
  fun: "Divertissement",
  communication: "Communication",
  system: "Système",
};

const APP_COLORS: Record<string, string> = {
  chrome: "#F59E0B",
  firefox: "#F97316",
  edge: "#3B82F6",
  safari: "#06B6D4",
  code: "#60A5FA",
  "visual studio": "#60A5FA",
  cursor: "#A78BFA",
  windsurf: "#A78BFA",
  terminal: "#34D399",
  powershell: "#34D399",
  cmd: "#34D399",
  slack: "#A855F7",
  teams: "#7C3AED",
  discord: "#818CF8",
  notion: "#E5E7EB",
  obsidian: "#A78BFA",
  spotify: "#22C55E",
  figma: "#F472B6",
  excel: "#22C55E",
  word: "#3B82F6",
};

function getColor(app: string | null): string {
  if (!app) return "#6B7280";
  const key = app.toLowerCase();
  for (const [name, color] of Object.entries(APP_COLORS)) {
    if (key.includes(name)) return color;
  }
  // deterministic color from app name
  const hue = [...app].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}m` : ""}`;
}

interface AppSlice {
  app: string;
  seconds: number;
  color: string;
  topTitle: string | null;
}

interface HourSlot {
  hour: number;
  activeSeconds: number;
  apps: AppSlice[];
}

function buildSlots(events: ActivityEvent[]): HourSlot[] {
  const windowEvents = events.filter((e) => e.bucket_id.startsWith("aw-watcher-window") || e.bucket_id.startsWith("aw-watcher-android"));
  const afkEvents = events.filter((e) => e.bucket_id.startsWith("aw-watcher-afk") && e.app === "not-afk");

  // Active seconds per hour from AFk watcher
  const activeByHour = new Map<number, number>();
  for (const e of afkEvents) {
    const h = new Date(e.timestamp).getHours();
    activeByHour.set(h, (activeByHour.get(h) ?? 0) + e.duration_seconds);
  }

  // Aggregate window events by hour + app
  type AppMap = Map<string, { seconds: number; titles: Map<string, number> }>;
  const hourMap = new Map<number, AppMap>();
  for (const e of windowEvents) {
    if (!e.app) continue;
    const h = new Date(e.timestamp).getHours();
    if (!hourMap.has(h)) hourMap.set(h, new Map());
    const appMap = hourMap.get(h)!;
    if (!appMap.has(e.app)) appMap.set(e.app, { seconds: 0, titles: new Map() });
    const entry = appMap.get(e.app)!;
    entry.seconds += e.duration_seconds;
    if (e.title) entry.titles.set(e.title, (entry.titles.get(e.title) ?? 0) + 1);
  }

  const slots: HourSlot[] = [];
  for (const [hour, appMap] of hourMap) {
    const apps: AppSlice[] = Array.from(appMap.entries())
      .map(([app, { seconds, titles }]) => {
        const topTitle = titles.size > 0
          ? [...titles.entries()].sort((a, b) => b[1] - a[1])[0][0]
          : null;
        return { app, seconds, color: getColor(app), topTitle };
      })
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 6);

    slots.push({ hour, activeSeconds: activeByHour.get(hour) ?? 0, apps });
  }

  return slots.sort((a, b) => a.hour - b.hour);
}

export function ActivityTimeline() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/activity/events?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(Array.isArray(data.events) ? data.events : []);
        setCategoryMap(data.categories ?? {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [date]);

  const slots = buildSlots(events);
  const totalActive = slots.reduce((acc, s) => acc + s.activeSeconds, 0);

  function getCategory(app: string, title: string | null): Category {
    const simplified = app && ["chrome","firefox","edge","safari","opera","brave"].some(b => app.toLowerCase().includes(b))
      ? (title ?? "").split(" - ")[0].trim().slice(0, 80)
      : "";
    return (categoryMap[`${app}::${simplified}`] as Category) ?? "system";
  }

  function dominantCategory(apps: AppSlice[]): Category {
    const totals: Record<string, number> = { work: 0, fun: 0, communication: 0, system: 0 };
    for (const a of apps) {
      const cat = getCategory(a.app, a.topTitle);
      totals[cat] += a.seconds;
    }
    return Object.entries(totals).sort((x, y) => y[1] - x[1])[0][0] as Category;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
        />
        {!loading && slots.length > 0 && (() => {
          const totals: Record<string, number> = { work: 0, fun: 0, communication: 0, system: 0 };
          for (const slot of slots) {
            for (const app of slot.apps) {
              const cat = getCategory(app.app, app.topTitle);
              totals[cat] += app.seconds;
            }
          }
          const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
          return (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-gray-400 text-sm">{formatDuration(totalActive)} actif</span>
              {(["work", "fun", "communication"] as Category[]).map((cat) => totals[cat] > 0 && (
                <span key={cat} className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] + "33", color: CATEGORY_COLORS[cat] }}>
                  {CATEGORY_LABELS[cat]} {Math.round((totals[cat] / grand) * 100)}%
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Chargement...</p>
      ) : slots.length === 0 ? (
        <p className="text-gray-500 text-sm">Aucune activité pour ce jour.</p>
      ) : (
        <div className="space-y-2">
          {slots.map(({ hour, activeSeconds, apps }) => (
            <div key={hour} className="flex gap-3 items-start group">
              {/* Hour label */}
              <div className="w-10 shrink-0 text-right pt-2">
                <span className="text-gray-500 text-xs">{String(hour).padStart(2, "0")}h</span>
              </div>

              {/* Content */}
              <div className="flex-1 bg-gray-900 rounded-lg px-3 py-2 border border-gray-800 group-hover:border-gray-700 transition-colors"
                style={{ borderLeftColor: CATEGORY_COLORS[dominantCategory(apps)], borderLeftWidth: 3 }}
              >
                {/* Duration bar */}
                {activeSeconds > 0 && (
                  <div className="flex gap-0.5 mb-2 h-1.5 rounded-full overflow-hidden bg-gray-800">
                    {apps.map((a) => (
                      <div
                        key={a.app}
                        style={{
                          backgroundColor: a.color,
                          width: `${Math.min(100, (a.seconds / activeSeconds) * 100)}%`,
                        }}
                        className="h-full rounded-full"
                        title={`${a.app}: ${formatDuration(a.seconds)}`}
                      />
                    ))}
                  </div>
                )}

                {/* App pills */}
                <div className="flex flex-wrap gap-1.5">
                  {apps.map((a) => (
                    <div
                      key={a.app}
                      className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-gray-800"
                      title={a.topTitle ?? a.app}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: a.color }}
                      />
                      <span className="text-gray-200 font-medium">{a.app}</span>
                      <span className="text-gray-500">{formatDuration(a.seconds)}</span>
                    </div>
                  ))}
                </div>

                {/* Active time */}
                {activeSeconds > 0 && (
                  <p className="text-gray-600 text-xs mt-1.5">
                    {formatDuration(activeSeconds)} actif
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
