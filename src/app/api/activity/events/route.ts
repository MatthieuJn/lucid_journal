import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const start = `${date}T00:00:00Z`;
  const end = `${date}T23:59:59Z`;

  const { data, error } = await supabaseAdmin
    .from("activity_events")
    .select("*")
    .gte("timestamp", start)
    .lte("timestamp", end)
    .order("timestamp", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
