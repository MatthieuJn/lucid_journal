"use client";

import React, { useEffect, useState } from "react";
import type { ActivityEvent } from "@/types/activity";

const DEFAULT_PX_PER_MIN = 1.8;
const MIN_PX_PER_MIN = 0.5;
const MAX_PX_PER_MIN = 12;
const GAP_LABEL_THRESHOLD_SEC = 120;
const MERGE_GAP_SEC = 30;
const MIN_DURATION_SEC = 4;

const APP_COLORS: Record<string, string> = {
  chrome: "#F59E0B", firefox: "#F97316", edge: "#3B82F6", safari: "#06B6D4",
  code: "#60A5FA", "visual studio": "#60A5FA", cursor: "#A78BFA", windsurf: "#A78BFA",
  terminal: "#34D399", powershell: "#34D399", cmd: "#34D399",
  slack: "#A855F7", teams: "#7C3AED", discord: "#818CF8",
  notion: "#E5E7EB", obsidian: "#A78BFA", spotify: "#22C55E",
  figma: "#F472B6", excel: "#22C55E", word: "#3B82F6",
  geforceNOW: "#76B900", steam: "#1B2838",
};

function normalizeApp(app: string): string {
  return app.replace(/\.(exe|app|bin|lnk)$/i, "").trim();
}

function getColor(app: string | null): string {
  if (!app) return "#6B7280";
  const key = normalizeApp(app).toLowerCase();
  for (const [name, color] of Object.entries(APP_COLORS)) {
    if (key.includes(name)) return color;
  }
  const hue = [...app].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}m` : ""}`;
}

interface Block {
  app: string;
  title: string | null;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  color: string;
  topMinutes: number;
  durationMinutes: number;
  showLabel: boolean;
}

function buildBlocks(events: ActivityEvent[]): Block[] {
  const raw = events
    .filter(e => (e.bucket_id.includes("window") || e.bucket_id.includes("android")) && e.app)
    .filter(e => e.duration_seconds >= MIN_DURATION_SEC)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(e => {
      const app = normalizeApp(e.app!);
      const start = new Date(e.timestamp);
      return {
        app,
        title: e.title,
        startTime: start,
        endTime: new Date(start.getTime() + e.duration_seconds * 1000),
        durationSeconds: e.duration_seconds,
        color: getColor(app),
      };
    });

  if (raw.length === 0) return [];

  // Merge consecutive same-app events within MERGE_GAP_SEC
  const merged = [{ ...raw[0] }];
  for (let i = 1; i < raw.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = raw[i];
    const gapSec = (curr.startTime.getTime() - prev.endTime.getTime()) / 1000;
    if (prev.app === curr.app && gapSec >= 0 && gapSec <= MERGE_GAP_SEC) {
      prev.endTime = curr.endTime;
      prev.durationSeconds = (prev.endTime.getTime() - prev.startTime.getTime()) / 1000;
    } else {
      merged.push({ ...curr });
    }
  }

  // Reference: midnight of that day
  const midnight = new Date(merged[0].startTime);
  midnight.setHours(0, 0, 0, 0);

  return merged.map((b, i) => {
    const topMin = (b.startTime.getTime() - midnight.getTime()) / 60000;
    const durationMin = b.durationSeconds / 60;
    const prevBlock = merged[i - 1];
    const gapBefore = prevBlock
      ? (b.startTime.getTime() - prevBlock.endTime.getTime()) / 1000
      : GAP_LABEL_THRESHOLD_SEC + 1;

    return {
      ...b,
      topMinutes: topMin,
      durationMinutes: durationMin,
      showLabel: gapBefore >= GAP_LABEL_THRESHOLD_SEC,
    };
  });
}

export function ActivityTimeline() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [pxPerMin, setPxPerMin] = useState(DEFAULT_PX_PER_MIN);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/activity/events?date=${date}`)
      .then(r => r.json())
      .then(data => {
        setEvents(Array.isArray(data.events) ? data.events : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [date]);

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // only zoom when Ctrl held
      e.preventDefault();
      setPxPerMin(prev => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        return Math.min(MAX_PX_PER_MIN, Math.max(MIN_PX_PER_MIN, prev * factor));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [loading]);

  const blocks = buildBlocks(events);

  if (loading) return <p className="text-gray-500 text-sm mt-6">Chargement...</p>;

  const firstHour = blocks.length > 0 ? Math.floor(blocks[0].topMinutes / 60) : 0;
  const lastBlock = blocks[blocks.length - 1];
  const lastHour = blocks.length > 0
    ? Math.ceil((lastBlock.topMinutes + lastBlock.durationMinutes) / 60)
    : 24;

  const offsetPx = firstHour * 60 * pxPerMin;
  const containerHeight = Math.max(200, (lastHour - firstHour) * 60 * pxPerMin);
  const hourMarkers = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);

  return (
    <div>
      {/* Date picker */}
      <div className="flex items-center gap-3 mb-8">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
        />
        {blocks.length > 0 && (
          <span className="text-gray-500 text-xs">{blocks.length} sessions</span>
        )}
      </div>

      {blocks.length === 0 ? (
        <p className="text-gray-500 text-sm">Aucune activité pour ce jour.</p>
      ) : (
        <div className="flex gap-0 select-none">
          {/* Left: hour labels */}
          <div className="relative w-14 shrink-0" style={{ height: containerHeight }}>
            {hourMarkers.map(h => (
              <div
                key={h}
                className="absolute right-2 text-white text-sm font-semibold leading-none"
                style={{ top: (h - firstHour) * 60 * pxPerMin - 7 }}
              >
                {String(h).padStart(2, "0")}h
              </div>
            ))}
          </div>

          {/* Center: timeline */}
          <div ref={containerRef} className="relative flex-1" style={{ height: containerHeight }}>

            {/* Dotted hour lines */}
            {hourMarkers.map(h => (
              <div
                key={h}
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: (h - firstHour) * 60 * pxPerMin,
                  borderTop: "1px dashed #1F2937",
                }}
              />
            ))}

            {/* Activity blocks */}
            {blocks.map((block, i) => {
              const topPx = block.topMinutes * pxPerMin - offsetPx;
              const heightPx = Math.max(3, block.durationMinutes * pxPerMin);
              return (
                <div
                  key={i}
                  className="absolute left-6 right-2 rounded-sm overflow-hidden cursor-default"
                  style={{
                    top: topPx,
                    height: heightPx,
                    backgroundColor: block.color + "28",
                    borderLeft: `3px solid ${block.color}`,
                  }}
                  title={`${block.app} · ${formatTime(block.startTime)} → ${formatTime(block.endTime)} (${formatDuration(block.durationSeconds)})`}
                >
                  {heightPx >= 16 && (
                    <span className="absolute inset-0 flex items-center px-2 text-xs text-gray-300 truncate">
                      <span className="font-medium mr-1.5">{block.app}</span>
                      {heightPx >= 24 && block.title && (
                        <span className="text-gray-500 truncate">
                          {block.title.split(" - ")[0]}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Time labels — rendered after blocks so they're always on top */}
            {blocks.map((block, i) => {
              const topPx = block.topMinutes * pxPerMin - offsetPx;
              const heightPx = Math.max(3, block.durationMinutes * pxPerMin);
              return (
                <React.Fragment key={`t${i}`}>
                  <div
                    className="absolute left-0 right-0 flex justify-center pointer-events-none"
                    style={{ top: topPx - 11 }}
                  >
                    <span className="text-white text-xs font-medium leading-none px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(0,0,0,0.85)" }}>
                      {formatTime(block.startTime)}
                    </span>
                  </div>
                  {i === blocks.length - 1 && (
                    <div
                      className="absolute left-0 right-0 flex justify-center pointer-events-none"
                      style={{ top: topPx + heightPx + 4 }}
                    >
                      <span className="text-white text-xs font-medium leading-none px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(0,0,0,0.85)" }}>
                        {formatTime(block.endTime)}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
