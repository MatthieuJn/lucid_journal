import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    SUPABASE_URL: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0, 30) + "..." : "MISSING",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 30) + "..." : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET (length=" + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ")" : "MISSING",
    SYNC_SECRET: process.env.SYNC_SECRET ? "SET" : "MISSING",
  });
}
