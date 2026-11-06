import "server-only";
import { WARRANTY_COLUMNS } from "@/lib/warranty";
import type { WarrantyInput } from "@/lib/validation";
import type {
  CreatedRegistrationSummary,
  RowsResponse,
  WarrantyRecord,
} from "@/lib/types";
import { AppsScriptError } from "@/lib/server/apps-script-error";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;
const MIN_TOKEN_LENGTH = 24;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const INVALID_RESPONSE_MESSAGE =
  "Phản hồi từ Google Apps Script không đúng định dạng.";
const DEPLOYMENT_PATH = /^\/macros\/s\/[A-Za-z0-9_-]+\/(?:exec|dev)\/?$/;

type AppsScriptConfig = {
  url: string;
  token: string;
};

type JsonRecord = Record<string, unknown>;

function configError(message: string): AppsScriptError {
  return new AppsScriptError("CONFIG", message);
}

function readConfig(): AppsScriptConfig {
  const rawUrl = process.env.APPS_SCRIPT_URL?.trim();
  if (!rawUrl) {
    throw configError(
      "Thiếu biến môi trường APPS_SCRIPT_URL. Đặt URL Web App của Apps Script (dạng https://script.google.com/macros/s/.../exec).",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw configError(
      "APPS_SCRIPT_URL không phải URL hợp lệ. Dùng URL triển khai Web App dạng https://script.google.com/macros/s/.../exec.",
    );
  }

  // Cho phép mock server chạy local trong môi trường dev để test tích hợp.
  // Production chỉ chấp nhận URL HTTPS của Google Apps Script.
  const isLocalDev =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
    url.port !== "" &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === "" &&
    url.pathname === "/exec";

  const isValidUrl =
    isLocalDev ||
    (url.protocol === "https:" &&
      url.hostname === "script.google.com" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      DEPLOYMENT_PATH.test(url.pathname));

  if (!isValidUrl) {
    throw configError(
      "APPS_SCRIPT_URL không hợp lệ. Chỉ chấp nhận https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec (hoặc /dev), không kèm query string.",
    );
  }

  const token = process.env.APPS_SCRIPT_TOKEN?.trim();
  if (!token) {
    throw configError(
      "Thiếu biến môi trường APPS_SCRIPT_TOKEN. Đặt token bí mật trùng với Script Property APP_TOKEN của Apps Script.",
    );
  }

  if (token.length < MIN_TOKEN_LENGTH) {
    throw configError(
      `APPS_SCRIPT_TOKEN phải có ít nhất ${MIN_TOKEN_LENGTH} ký tự. Tạo bằng "npm run secret" (hoặc "openssl rand -hex 32") rồi đặt cùng giá trị vào Script Properties với khoá APP_TOKEN.`,
    );
  }

  // Chặn trường hợp dán cả URL vào ô token. Không chặn token bắt đầu bằng
  // AKfy vì một số người dùng có thể đã đặt APP_TOKEN trùng Deployment ID;
  // trường hợp đó vẫn hoạt động, dù nên đổi sang token random để bảo mật hơn.
  if (token.includes("://") || token.includes("/") || /\s/.test(token)) {
    throw configError(
      "APPS_SCRIPT_TOKEN không hợp lệ. Token phải là một chuỗi bí mật duy nhất, không phải URL và không chứa khoảng trắng.",
    );
  }

  return { url: url.toString(), token };
}

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    // Không log URL/token. Chỉ log loại lỗi để chẩn đoán timeout/mạng.
    const reason =
      error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError";
    console.error("[apps-script] request failed:", reason);
    throw new AppsScriptError(
      "INTERNAL",
      "Không thể kết nối Google Apps Script.",
    );
  }
}

function assertRedirectTarget(target: URL): void {
  const isValidHost =
    target.hostname === "script.google.com" ||
    target.hostname === "script.googleusercontent.com";

  const isLocalDevTarget =
    process.env.NODE_ENV !== "production" &&
    target.protocol === "http:" &&
    (target.hostname === "127.0.0.1" || target.hostname === "localhost") &&
    target.port !== "" &&
    target.username === "" &&
    target.password === "";

  if (
    !isLocalDevTarget &&
    (target.protocol !== "https:" ||
      !isValidHost ||
      target.port !== "" ||
      target.username !== "" ||
      target.password !== "")
  ) {
    throw new AppsScriptError(
      "INTERNAL",
      "Google Apps Script trả về chuyển hướng không hợp lệ.",
    );
  }
}

async function fetchAppsScript(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let currentUrl = url;
  let response = await safeFetch(currentUrl, {
    ...init,
    redirect: "manual",
  });
  let hops = 0;

  while (REDIRECT_STATUSES.has(response.status)) {
    if (hops >= MAX_REDIRECTS) {
      throw new AppsScriptError(
        "INTERNAL",
        "Google Apps Script chuyển hướng quá nhiều lần.",
      );
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new AppsScriptError(
        "INTERNAL",
        "Google Apps Script trả về chuyển hướng thiếu Location.",
      );
    }

    let target: URL;
    try {
      target = new URL(location, currentUrl);
    } catch {
      throw new AppsScriptError(
        "INTERNAL",
        "Google Apps Script trả về chuyển hướng không hợp lệ.",
      );
    }

    assertRedirectTarget(target);
    currentUrl = target.toString();
    hops += 1;

    response = await safeFetch(currentUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  return response;
}

function redactSecrets(text: string): string {
  const token = process.env.APPS_SCRIPT_TOKEN?.trim();
  const url = process.env.APPS_SCRIPT_URL?.trim();
  let redacted = text;

  if (token) redacted = redacted.split(token).join("[redacted]");
  if (url) redacted = redacted.split(url).join("[redacted]");

  return redacted;
}

function previewBody(text: string): string {
  return redactSecrets(text).slice(0, 300);
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!response.ok) {
    console.error(
      `[apps-script] HTTP ${response.status}: ${previewBody(text)}`,
    );
    throw new AppsScriptError(
      "INTERNAL",
      `Google Apps Script trả về HTTP ${response.status}.`,
      response.status,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    console.error(
      `[apps-script] JSON không hợp lệ (HTTP ${response.status}): ${previewBody(text)}`,
    );
    throw new AppsScriptError(
      "INTERNAL",
      "Google Apps Script trả về dữ liệu không phải JSON.",
      response.status,
    );
  }
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Gọi Apps Script Web App và trả về phần dữ liệu JSON đã xác thực `ok:true`.
 * Token chỉ được gửi trong body, không bao giờ nằm trong URL hay thông báo lỗi.
 */
async function callAppsScript<T>(payload: JsonRecord): Promise<T> {
  const { url, token } = readConfig();

  const response = await fetchAppsScript(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, ...payload }),
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = await readResponse(response);

  if (!isJsonRecord(data)) {
    throw new AppsScriptError(
      "INTERNAL",
      INVALID_RESPONSE_MESSAGE,
      response.status,
    );
  }

  if (data.ok !== true) {
    const code =
      typeof data.code === "string" && data.code.trim()
        ? data.code.trim()
        : "INTERNAL";
    const message =
      typeof data.error === "string" && data.error.trim()
        ? data.error.trim()
        : "Google Apps Script báo lỗi.";
    throw new AppsScriptError(
      code,
      redactSecrets(message),
      response.status,
    );
  }

  return data as T;
}

function invalidResponse(): AppsScriptError {
  return new AppsScriptError("INTERNAL", INVALID_RESPONSE_MESSAGE);
}

function requireNumber(record: JsonRecord, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalidResponse();
  }
  return value;
}

function mapRows(value: unknown): WarrantyRecord[] {
  if (!Array.isArray(value)) {
    throw invalidResponse();
  }

  return value.map((row) => {
    if (!isJsonRecord(row)) {
      throw invalidResponse();
    }

    const record = {} as WarrantyRecord;
    for (const column of WARRANTY_COLUMNS) {
      const cell = row[column.key];
      record[column.key] =
        cell === null || cell === undefined ? "" : String(cell);
    }
    return record;
  });
}

export async function listRecords(params: {
  query: string;
  page: number;
  pageSize: number;
}): Promise<RowsResponse> {
  const data = await callAppsScript<unknown>({
    action: "list",
    query: params.query,
    page: params.page,
    pageSize: params.pageSize,
  });

  if (!isJsonRecord(data)) {
    throw invalidResponse();
  }

  return {
    rows: mapRows(data.rows),
    total: requireNumber(data, "total"),
    registrations: requireNumber(data, "registrations"),
    filtered: requireNumber(data, "filtered"),
    filteredRegistrations: requireNumber(data, "filteredRegistrations"),
    page: requireNumber(data, "page"),
    pageSize: requireNumber(data, "pageSize"),
    totalPages: requireNumber(data, "totalPages"),
  };
}

export async function appendRegistration(
  input: WarrantyInput,
): Promise<CreatedRegistrationSummary> {
  const data = await callAppsScript<unknown>({
    action: "append",
    data: input,
  });

  if (!isJsonRecord(data)) {
    throw invalidResponse();
  }

  const { registrationCode, count } = data;
  if (
    typeof registrationCode !== "string" ||
    registrationCode.trim() === "" ||
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 1
  ) {
    throw invalidResponse();
  }

  return { registrationCode, count };
}

export async function deleteRecord(rowId: string): Promise<void> {
  const data = await callAppsScript<unknown>({
    action: "delete",
    rowId,
  });

  if (
    !isJsonRecord(data) ||
    typeof data.rowId !== "string" ||
    data.rowId.length === 0
  ) {
    throw invalidResponse();
  }
}
