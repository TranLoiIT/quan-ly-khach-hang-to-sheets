import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "sheetdesk_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 giờ

const ISSUER = "sheetdesk";
const AUDIENCE = "sheetdesk-web";

let cachedSecret: Uint8Array | null = null;

function getSecretKey(): Uint8Array {
  if (cachedSecret) return cachedSecret;

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET chưa được cấu hình hoặc ngắn hơn 32 ký tự. Hãy chạy: npm run secret",
    );
  }

  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.username)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (typeof payload.sub !== "string" || typeof payload.name !== "string") {
      return null;
    }

    return {
      username: payload.sub,
      name: payload.name,
      role: payload.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}
