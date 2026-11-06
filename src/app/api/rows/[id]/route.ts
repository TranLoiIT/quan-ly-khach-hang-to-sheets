import { NextResponse } from "next/server";
import { isSameOrigin, jsonError, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { deleteRecord } from "@/lib/server/apps-script";
import { appsScriptErrorResponse } from "@/lib/server/sheet-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();

  if (!isSameOrigin(request)) {
    return jsonError("Yêu cầu không hợp lệ.", 403);
  }

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return jsonError("ID bản ghi không hợp lệ.", 400);
  }

  try {
    await deleteRecord(id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return appsScriptErrorResponse(error);
  }
}
