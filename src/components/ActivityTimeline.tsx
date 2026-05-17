"use client";

import { useEffect, useState } from "react";
import type { ActivityEvent } from "@/types/activity";

const APP_COLORS: Record<string, string> = {
  // browsers
  chrome: "bg-yellow-500",
  firefox: "bg-orange-500",
  edge: "bg-blue-500",
  // dev
  code: "bg-blue-400",
  "windows terminal": "bg-green-600",
  // communication
  slack: "bg-purple-500",
  teams: "bg-violet-500",
  discord: "bg-indigo-500",
  // android
  android: "bg-green-400",
};

function getColor(app: string | null): string {
  if (!app) return "bg-gray-600";
  const key = app.toLowerCase();
  for (const [name, color] of Object.entries(APP_COLORS)) {
    if (key.includes(name)) return color;
  }
  return "bg-gray-500";
}

function groupByHour(events: ActivityEvent[]): Map<number, ActivityEvent[]> {
  const map = new Map<number, ActivityEvent[]>();
  for (const e of events) {
    const hour = new Date(e.timestamp).getHours();
    if (!map.has(hour)) map.set(hour, []);
    map.get(hour)!.push(e);
  }
  return map;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}m` : ""}`;
}

export function ActivityTimeline() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/activity/events?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [date]);

  const byHour = groupByHour(events);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
        />
        <span className="text-gray-400 text-sm">
          {events.length} événements
        </span>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Chargement...</p>
      ) : events.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Aucune activité pour ce jour. Lance le script Python pour synchroniser.
        </p>
      ) : (
        <div className="space-y-1">
          {hours.map((hour) => {
            const slotEvents = byHour.get(hour) ?? [];
            if (slotEvents.length === 0) return null;

            const totalSeconds = slotEvents.reduce(
              (acc, e) => acc + e.duration_seconds,
              0
            );

            return (
              <div key={hour} className="flex gap-3 items-start">
                <span className="text-gray-500 text-xs w-10 pt-1 shrink-0 text-right">
                  {String(hour).padStart(2, "0")}h
                </span>
                <div className="flex-1 space-y-0.5">
                  {slotEvents.map((e, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${getColor(e.app)} bg-opacity-20 border border-current border-opacity-20`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${getColor(e.app)} shrink-0`}
                      />
                      <span className="font-medium text-white truncate flex-1">
                        {e.app ?? "—"}
                      </span>
                      {e.title && (
                        <span className="text-gray-400 truncate max-w-[40%]">
                          {e.title}
                        </span>
                      )}
                      <span className="text-gray-400 shrink-0 ml-auto">
                        {e.source === "android" ? "📱" : "💻"}{" "}
                        {formatDuration(e.duration_seconds)}
                      </span>
                    </div>
                  ))}
                  <div className="text-gray-600 text-xs pl-1">
                    {formatDuration(totalSeconds)} total
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
