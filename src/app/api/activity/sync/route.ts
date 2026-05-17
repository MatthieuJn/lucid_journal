import { NextRequest, NextResponse } from "next/server";
import type { ActivityEvent } from "@/types/activity";

const SYNC_SECRET = process.env.SYNC_SECRET;

export async function POST(req: NextRequest) {
  // Fail fast with a clear message if Supabase env vars are missing
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server" },
      { status: 500 }
    );
  }

  if (SYNC_SECRET) {
    const auth = req.headers.get("x-sync-secret");
    if (auth !== SYNC_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let events: ActivityEvent[];
  try {
    events = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  const { supabaseAdmin } = await import("@/lib/supabase");

  const rows = events.map((e) => ({
    source: e.source,
    bucket_id: e.bucket_id,
    event_id: e.event_id,
    timestamp: e.timestamp,
    duration_seconds: e.duration_seconds,
    app: e.app ?? null,
    title: e.title ?? null,
    raw_data: e.raw_data,
  }));

  // upsert on (source, bucket_id, event_id) to be idempotent
  const { error, count } = await supabaseAdmin
    .from("activity_events")
    .upsert(rows, {
      onConflict: "source,bucket_id,event_id",
      count: "exact",
    });

  if (error) {
    console.error("Supabase upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: count });
}
