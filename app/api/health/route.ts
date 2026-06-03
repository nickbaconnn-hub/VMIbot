import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Railway healthcheck endpoint. Kept deliberately cheap — no DB call.
export function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
