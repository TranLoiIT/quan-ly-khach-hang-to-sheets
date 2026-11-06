/**
 * Lỗi trả về từ lớp giao tiếp Google Apps Script.
 *
 * `code` giữ nguyên mã lỗi do Apps Script gửi về (BAD_REQUEST, UNAUTHORIZED,
 * CONFIG, SETUP, NOT_FOUND, LOCK, INTERNAL) để route/response mapper quyết
 * định HTTP status và thông báo an toàn cho client.
 */
export class AppsScriptError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 502) {
    super(message);
    this.name = "AppsScriptError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
