import { getSupabaseAdmin } from "./supabase";

export type Category = "work" | "fun" | "communication" | "system";

const BROWSERS = ["chrome", "firefox", "edge", "safari", "opera", "brave"];

function isBrowser(app: string) {
  return BROWSERS.some((b) => app.toLowerCase().includes(b));
}

function simplifyTitle(app: string, title: string | null): string {
  if (!title) return "";
  // For browsers, keep only the first segment ("YouTube - Chrome" → "YouTube")
  if (isBrowser(app)) return title.split(" - ")[0].trim().slice(0, 80);
  return "";
}

async function callGemini(items: { app: string; title: string }[]): Promise<Record<string, Category>> {
  const prompt = `Categorize each app into exactly one of: work, fun, communication, system.
- work: coding, writing, productivity, finance, learning
- fun: games, videos, music, social media, news, shopping
- communication: email, chat, video calls, meetings
- system: file manager, settings, antivirus, unknown

Reply ONLY with a JSON object like: {"0":"work","1":"fun"}

Items:
${items.map((it, i) => `${i}: ${it.app}${it.title ? ` — ${it.title}` : ""}`).join("\n")}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Gemini response");

  const parsed: Record<string, string> = JSON.parse(match[0]);
  const result: Record<string, Category> = {};
  items.forEach((item, i) => {
    result[`${item.app}::${item.title}`] = (parsed[String(i)] as Category) ?? "system";
  });
  return result;
}

export async function categorizeNewEvents(
  events: Array<{ app: string | null; title: string | null; bucket_id: string }>
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Only window/android events
  const relevant = events.filter(
    (e) => e.app && (e.bucket_id.includes("window") || e.bucket_id.includes("android"))
  );

  // Unique (app, title) pairs
  const unique = new Map<string, { app: string; title: string }>();
  for (const e of relevant) {
    const app = e.app!;
    const title = simplifyTitle(app, e.title);
    const key = `${app}::${title}`;
    if (!unique.has(key)) unique.set(key, { app, title });
  }
  if (unique.size === 0) return;

  const allItems = [...unique.values()];

  // Check cache
  const { data: existing } = await supabase
    .from("app_categories")
    .select("app, title")
    .in("app", allItems.map((i) => i.app));

  const cached = new Set((existing ?? []).map((r) => `${r.app}::${r.title}`));
  const newItems = allItems.filter((i) => !cached.has(`${i.app}::${i.title}`));

  if (newItems.length === 0) return;

  console.log(`Categorizing ${newItems.length} new app(s) via Gemini`);
  const categories = await callGemini(newItems);

  const rows = newItems.map((item) => ({
    app: item.app,
    title: item.title,
    category: categories[`${item.app}::${item.title}`] ?? "system",
  }));

  await supabase.from("app_categories").upsert(rows, { onConflict: "app,title" });
}
