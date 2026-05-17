import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const start = `${date}T00:00:00Z`;
  const end = `${date}T23:59:59Z`;

  const supabase = getSupabaseAdmin();

  const [{ data: events, error }, { data: categories }] = await Promise.all([
    supabase
      .from("activity_events")
      .select("*")
      .gte("timestamp", start)
      .lte("timestamp", end)
      .order("timestamp", { ascending: true }),
    supabase.from("app_categories").select("app, title, category"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const categoryMap = Object.fromEntries(
    (categories ?? []).map((c) => [`${c.app}::${c.title}`, c.category])
  );

  return NextResponse.json({ events: events ?? [], categories: categoryMap });
}
