import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/lib/types";

export function jsonError(
  message: string,
  status = 400,
  fields?: Record<string, string>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    fields ? { error: message, fields } : { error: message },
    { status },
  );
}

export function unauthorized(): NextResponse<ApiErrorBody> {
  return jsonError("Bạn cần đăng nhập để tiếp tục.", 401);
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function rateLimited(retryAfterSeconds: number): NextResponse<ApiErrorBody> {
  const response = jsonError(
    "Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại.",
    429,
  );
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}
