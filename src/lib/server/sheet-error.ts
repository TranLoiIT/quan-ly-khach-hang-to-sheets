import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { AppsScriptError } from "@/lib/server/apps-script-error";

const GENERIC_MESSAGE =
  "Không thể kết nối Google Apps Script. Vui lòng thử lại sau.";
const CONFIG_MESSAGE =
  "Cấu hình Google Apps Script không đúng. Kiểm tra APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN và Script Properties (APP_TOKEN), sau đó triển khai lại Web App.";

/**
 * Chuyển lỗi Apps Script thành response an toàn cho client.
 * Chi tiết đầy đủ (không gồm token/URL) chỉ ghi ở server log.
 */
export function appsScriptErrorResponse(error: unknown): NextResponse {
  console.error("[apps-script]", error);

  if (!(error instanceof AppsScriptError)) {
    return jsonError(GENERIC_MESSAGE, 502);
  }

  switch (error.code) {
    case "BAD_REQUEST":
      return jsonError(
        error.message || "Dữ liệu gửi lên không hợp lệ.",
        400,
      );

    case "NOT_FOUND":
      return jsonError(
        "Bản ghi không tồn tại hoặc đã bị xoá. Hãy tải lại danh sách.",
        404,
      );

    case "LOCK": {
      const response = jsonError(
        "Hệ thống đang bận, vui lòng thử lại sau ít phút.",
        503,
      );
      response.headers.set("Retry-After", "5");
      return response;
    }

    case "UNAUTHORIZED":
    case "CONFIG":
      return jsonError(CONFIG_MESSAGE, 502);

    case "SETUP":
      return jsonError(
        error.message ||
          "Google Sheet chưa được thiết lập đúng. Kiểm tra header và tên tab.",
        502,
      );

    case "INTERNAL":
    default:
      return jsonError(GENERIC_MESSAGE, 502);
  }
}
