import { NextResponse } from "next/server";
import { isSameOrigin, jsonError } from "@/lib/api";
import { clearSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError("Yêu cầu không hợp lệ.", 403);
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
