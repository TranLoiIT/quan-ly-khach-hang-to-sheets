import { NextResponse } from "next/server";
import { isSameOrigin, jsonError, rateLimited } from "@/lib/api";
import {
  AccountsConfigError,
  verifyCredentials,
} from "@/lib/auth/accounts";
import {
  consumeRateLimit,
  getClientIp,
  resetRateLimit,
} from "@/lib/auth/rate-limit";
import { setSession } from "@/lib/auth/session";
import { fieldErrorsFromZod, loginSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const IP_LIMIT = 10;
const USER_LIMIT = 5;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError("Yêu cầu không hợp lệ.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Dữ liệu gửi lên không hợp lệ.", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "Vui lòng kiểm tra lại thông tin đăng nhập.",
      400,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const username = parsed.data.username.toLowerCase();
  const ip = getClientIp(request);
  const ipKey = `login:ip:${ip}`;
  const userKey = `login:user:${username}`;

  const ipResult = consumeRateLimit(ipKey, IP_LIMIT, WINDOW_MS);
  if (!ipResult.allowed) {
    return rateLimited(ipResult.retryAfterSeconds);
  }

  const userResult = consumeRateLimit(userKey, USER_LIMIT, WINDOW_MS);
  if (!userResult.allowed) {
    return rateLimited(userResult.retryAfterSeconds);
  }

  try {
    const user = await verifyCredentials(username, parsed.data.password);

    if (!user) {
      return jsonError("Tên đăng nhập hoặc mật khẩu không đúng.", 401);
    }

    resetRateLimit(ipKey);
    resetRateLimit(userKey);
    await setSession(user);

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    if (error instanceof AccountsConfigError) {
      console.error("[auth/login] Accounts config error:", error.message);
      return jsonError(
        "Cấu hình tài khoản trên server không hợp lệ. Vui lòng kiểm tra data/accounts.json hoặc AUTH_USERS_JSON.",
        500,
      );
    }

    console.error("[auth/login] Unexpected error:", error);
    return jsonError(
      "Không thể đăng nhập lúc này. Vui lòng thử lại.",
      500,
    );
  }
}
