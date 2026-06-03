import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dev-only endpoint for exfiltrating a scraped catalog from the browser
// into /data/nwcs-catalog.json. Disabled in production.

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  } as const;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled" }, { status: 404, headers: cors() });
  }
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: "expected JSON array" },
      { status: 400, headers: cors() },
    );
  }
  const dir = path.resolve(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.resolve(dir, "nwcs-catalog.json");
  fs.writeFileSync(file, JSON.stringify(body, null, 2));
  return NextResponse.json(
    { ok: true, count: body.length, file },
    { headers: cors() },
  );
}
