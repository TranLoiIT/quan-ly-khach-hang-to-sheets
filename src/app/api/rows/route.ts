import { NextResponse } from "next/server";
import { isSameOrigin, jsonError, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import {
  appendRegistration,
  listRecords,
} from "@/lib/server/apps-script";
import { appsScriptErrorResponse } from "@/lib/server/sheet-error";
import { fieldErrorsFromZod, warrantyInputSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSizeParam = Number.parseInt(
    url.searchParams.get("pageSize") ?? "10",
    10,
  );

  const page = Number.isFinite(pageParam) ? pageParam : 1;
  const pageSize = Number.isFinite(pageSizeParam)
    ? Math.min(Math.max(pageSizeParam, 5), 50)
    : 10;

  try {
    const result = await listRecords({ query, page, pageSize });
    return NextResponse.json(result);
  } catch (error) {
    return appsScriptErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  if (!isSameOrigin(request)) {
    return jsonError("Yêu cầu không hợp lệ.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Dữ liệu gửi lên không hợp lệ.", 400);
  }

  const parsed = warrantyInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "Vui lòng nhập đầy đủ thông tin bắt buộc.",
      400,
      fieldErrorsFromZod(parsed.error),
    );
  }

  try {
    const summary = await appendRegistration(parsed.data);
    return NextResponse.json(
      {
        ok: true,
        registrationCode: summary.registrationCode,
        count: summary.count,
      },
      { status: 201 },
    );
  } catch (error) {
    return appsScriptErrorResponse(error);
  }
}
