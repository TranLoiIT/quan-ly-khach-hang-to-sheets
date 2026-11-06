/**
 * FOTAMI Invoice - Google Apps Script Web App
 *
 * Backend mỏng: FE gửi dữ liệu gì thì lưu đúng field đó.
 * Không validate dữ liệu ở Apps Script; FE chịu trách nhiệm validate.
 * Field thiếu, null hoặc chuỗi rỗng sẽ được ghi thành "-".
 */

var SHEET_HEADERS = [
  "ID dòng",
  "Mã phiếu",
  "Thời gian tạo",
  "Tên đại lý",
  "Mã đại lý",
  "SĐT đại lý",
  "Họ tên khách hàng",
  "SĐT khách hàng",
  "Địa chỉ khách hàng",
  "Ngày giao hàng/lắp đặt",
  "Thời hạn bảo hành (tháng)",
  "Tên sản phẩm",
  "Model",
  "Serial (S/N)",
  "Ngày bán"
];

// Thứ tự này phải khớp hoàn toàn với SHEET_HEADERS.
var SHEET_COLUMN_KEYS = [
  "rowId",
  "registrationCode",
  "createdAt",
  "dealerName",
  "dealerCode",
  "dealerPhone",
  "customerName",
  "customerPhone",
  "customerAddress",
  "deliveryDate",
  "warrantyMonths",
  "productName",
  "model",
  "serial",
  "saleDate"
];

var DEFAULT_SHEET_TAB_NAME = "Sheet1";
var APP_TOKEN_PROPERTY = "APP_TOKEN";
var SHEET_ID_PROPERTY = "SHEET_ID";
var SHEET_TAB_NAME_PROPERTY = "SHEET_TAB_NAME";
var LOCK_TIMEOUT_MS = 15000;

/* -------------------------------------------------------------------------- */
/* Web App entry points                                                       */
/* -------------------------------------------------------------------------- */

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === "health") {
      return jsonResponse_({
        ok: true,
        service: "fotami-warranty",
        time: new Date().toISOString()
      });
    }

    return jsonResponse_({
      ok: false,
      code: "BAD_REQUEST",
      error:
        "Web App đang hoạt động. Hãy dùng POST với JSON body cho action list, append hoặc delete."
    });
  } catch (error) {
    console.error(
      "[fotami-warranty] Health check error: " +
        (error && error.stack ? error.stack : String(error))
    );
    return jsonResponse_({
      ok: false,
      code: "INTERNAL",
      error: "Không thể kiểm tra trạng thái dịch vụ."
    });
  }
}

function doPost(e) {
  var action = "";

  try {
    var request = parseRequestBody_(e);
    action = typeof request.action === "string" ? request.action : "";

    authenticateRequest_(request);

    if (action === "list") {
      return jsonResponse_(listRecords_(request));
    }

    if (action === "append") {
      return jsonResponse_(appendRegistration_(request));
    }

    if (action === "delete") {
      return jsonResponse_(deleteRegistration_(request));
    }

    throw badRequest_("Action không hợp lệ. Chỉ hỗ trợ list, append và delete.");
  } catch (error) {
    var code = error && error.appCode ? String(error.appCode) : "INTERNAL";
    var message =
      code === "INTERNAL"
        ? "Đã xảy ra lỗi hệ thống. Vui lòng kiểm tra log Apps Script và thử lại."
        : error && error.message
          ? error.message
          : "Đã xảy ra lỗi không xác định.";

    // Không log request body/token.
    console.error(
      "[fotami-warranty] action=" +
        (action || "(missing)") +
        " code=" +
        code +
        " :: " +
        (error && error.stack ? error.stack : String(error))
    );

    return jsonResponse_({
      ok: false,
      code: code,
      error: message
    });
  }
}

/**
 * Chạy hàm này một lần từ Apps Script Editor để tạo tab/header và cấp quyền.
 */
function setupSheet() {
  var spreadsheet = getSpreadsheet_();
  var sheet = withScriptLock_(function () {
    return ensureSheetReady_(spreadsheet);
  });

  var message =
    'Đã cấu hình tab "' +
    sheet.getName() +
    '" với ' +
    SHEET_HEADERS.length +
    " cột. Spreadsheet: " +
    spreadsheet.getUrl();

  console.log(message);
  return message;
}

/* -------------------------------------------------------------------------- */
/* Request / auth / responses                                                 */
/* -------------------------------------------------------------------------- */

function parseRequestBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw badRequest_("Thiếu JSON body trong yêu cầu POST.");
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw badRequest_("JSON body không hợp lệ.");
  }
}

function authenticateRequest_(request) {
  var expected = PropertiesService.getScriptProperties().getProperty(
    APP_TOKEN_PROPERTY
  );

  if (!expected) {
    throw makeError_(
      "CONFIG",
      "Chưa cấu hình Script Property APP_TOKEN."
    );
  }

  var provided = request && request.token ? String(request.token) : "";

  if (!safeEqual_(provided, expected)) {
    throw makeError_("UNAUTHORIZED", "Token không đúng.");
  }
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;

  var mismatch = 0;
  for (var i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function makeError_(code, message) {
  var error = new Error(message);
  error.appCode = code;
  return error;
}

function badRequest_(message) {
  return makeError_("BAD_REQUEST", message);
}

/* -------------------------------------------------------------------------- */
/* Sheet access / structure                                                   */
/* -------------------------------------------------------------------------- */

function getSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  var sheetId = PropertiesService.getScriptProperties().getProperty(
    SHEET_ID_PROPERTY
  );

  if (!sheetId) {
    throw makeError_(
      "CONFIG",
      "Chưa tìm thấy Google Sheet. Hãy dùng Apps Script gắn liền với Sheet, hoặc thêm Script Property SHEET_ID nếu dùng script độc lập."
    );
  }

  return SpreadsheetApp.openById(sheetId);
}

function getSheetTabName_() {
  var value = PropertiesService.getScriptProperties().getProperty(
    SHEET_TAB_NAME_PROPERTY
  );

  return value && String(value).trim()
    ? String(value).trim()
    : DEFAULT_SHEET_TAB_NAME;
}

function withScriptLock_(callback) {
  var lock = LockService.getScriptLock();

  if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
    throw makeError_(
      "LOCK",
      "Hệ thống đang bận xử lý dữ liệu. Vui lòng thử lại sau."
    );
  }

  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function ensureSheetReady_(spreadsheet) {
  var tabName = getSheetTabName_();
  var sheet = spreadsheet.getSheetByName(tabName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(tabName);
  }

  var headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
  var existingHeaders = headerRange.getDisplayValues()[0];
  var hasHeader = false;

  for (var i = 0; i < existingHeaders.length; i += 1) {
    if (String(existingHeaders[i] || "").trim() !== "") {
      hasHeader = true;
      break;
    }
  }

  if (!hasHeader) {
    headerRange.setValues([SHEET_HEADERS]);
    headerRange
      .setFontWeight("bold")
      .setBackground("#d1fae5")
      .setFontColor("#065f46");
    sheet.setFrozenRows(1);
    return sheet;
  }

  for (var j = 0; j < SHEET_HEADERS.length; j += 1) {
    if (String(existingHeaders[j] || "").trim() !== SHEET_HEADERS[j]) {
      throw makeError_(
        "SETUP",
        'Header tab "' +
          tabName +
          '" không khớp. Cần: ' +
          SHEET_HEADERS.join(" | ") +
          ". Hãy sửa hàng 1 hoặc xoá trắng hàng 1 để app tự tạo header."
      );
    }
  }

  return sheet;
}

/* -------------------------------------------------------------------------- */
/* list                                                                       */
/* -------------------------------------------------------------------------- */

function listRecords_(request) {
  var sheet = ensureSheetReady_(getSpreadsheet_());
  var lastRow = sheet.getLastRow();
  var rows = [];

  if (lastRow > 1) {
    var values = sheet
      .getRange(2, 1, lastRow - 1, SHEET_HEADERS.length)
      .getDisplayValues();

    for (var i = 0; i < values.length; i += 1) {
      var row = values[i];
      var hasValue = false;

      for (var c = 0; c < row.length; c += 1) {
        if (String(row[c] || "").trim() !== "") {
          hasValue = true;
          break;
        }
      }

      if (hasValue) rows.push(mapRow_(row));
    }
  }

  var query =
    request && request.query
      ? String(request.query).trim().toLowerCase()
      : "";
  var filtered = rows;

  if (query) {
    filtered = rows.filter(function (record) {
      var searchable = SHEET_COLUMN_KEYS.map(function (key) {
        return record[key];
      })
        .join(" ")
        .toLowerCase();

      return searchable.indexOf(query) !== -1;
    });
  }

  // Mới nhất lên đầu; sort ổn định giữ thứ tự sản phẩm trong cùng phiếu.
  filtered.sort(function (a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });

  var pageSize = pageSize_(request);
  var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  var page = Math.min(Math.max(1, pageNumber_(request)), totalPages);
  var start = (page - 1) * pageSize;

  return {
    ok: true,
    rows: filtered.slice(start, start + pageSize),
    total: rows.length,
    registrations: countRegistrations_(rows),
    filtered: filtered.length,
    filteredRegistrations: countRegistrations_(filtered),
    page: page,
    pageSize: pageSize,
    totalPages: totalPages
  };
}

function mapRow_(values) {
  var record = {};

  for (var i = 0; i < SHEET_COLUMN_KEYS.length; i += 1) {
    var value = values[i];
    record[SHEET_COLUMN_KEYS[i]] =
      value === null || value === undefined ? "" : String(value);
  }

  return record;
}

function countRegistrations_(rows) {
  var seen = {};
  var count = 0;

  for (var i = 0; i < rows.length; i += 1) {
    var code = rows[i].registrationCode;

    if (code && !seen[code]) {
      seen[code] = true;
      count += 1;
    }
  }

  return count;
}

function pageSize_(request) {
  var value = request ? parseInt(request.pageSize, 10) : 10;
  if (!value || value < 5) return 10;
  return Math.min(value, 50);
}

function pageNumber_(request) {
  var value = request ? parseInt(request.page, 10) : 1;
  return value && value > 0 ? value : 1;
}

/* -------------------------------------------------------------------------- */
/* append - không validate dữ liệu                                            */
/* -------------------------------------------------------------------------- */

function appendRegistration_(request) {
  var data =
    request && request.data && typeof request.data === "object"
      ? request.data
      : {};
  var products = Array.isArray(data.products) ? data.products : [];

  if (products.length === 0) {
    // Vẫn tạo một dòng hóa đơn; các field thiếu sẽ là "-".
    products = [{}];
  }

  var result = withScriptLock_(function () {
    var sheet = ensureSheetReady_(getSpreadsheet_());
    var createdAt = new Date().toISOString();
    var registrationCode =
      "BH-" +
      createdAt.slice(0, 10).replace(/-/g, "") +
      "-" +
      Utilities.getUuid().replace(/-/g, "").slice(0, 6).toUpperCase();

    var rows = [];

    for (var i = 0; i < products.length; i += 1) {
      var product =
        products[i] && typeof products[i] === "object" ? products[i] : {};

      rows.push([
        Utilities.getUuid(),
        registrationCode,
        createdAt,
        valueOrDash_(data.dealerName),
        valueOrDash_(data.dealerCode),
        valueOrDash_(data.dealerPhone),
        valueOrDash_(data.customerName),
        valueOrDash_(data.customerPhone),
        valueOrDash_(data.customerAddress),
        valueOrDash_(data.deliveryDate),
        valueOrDash_(data.warrantyMonths),
        valueOrDash_(product.productName),
        valueOrDash_(product.model),
        valueOrDash_(product.serial),
        valueOrDash_(product.saleDate)
      ]);
    }

    var startRow = sheet.getLastRow() + 1;
    sheet
      .getRange(startRow, 1, rows.length, SHEET_HEADERS.length)
      .setValues(rows);
    SpreadsheetApp.flush();

    return {
      registrationCode: registrationCode,
      count: rows.length
    };
  });

  return {
    ok: true,
    registrationCode: result.registrationCode,
    count: result.count
  };
}

function valueOrDash_(value) {
  if (value === null || value === undefined) return "-";

  var text = String(value).trim();
  return text === "" ? "-" : text;
}

/* -------------------------------------------------------------------------- */
/* delete                                                                     */
/* -------------------------------------------------------------------------- */

function deleteRegistration_(request) {
  var rowId = request && request.rowId ? String(request.rowId) : "";

  if (!rowId) {
    throw badRequest_("Thiếu rowId.");
  }

  return withScriptLock_(function () {
    var sheet = ensureSheetReady_(getSpreadsheet_());
    var lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      throw makeError_("NOT_FOUND", "Không tìm thấy bản ghi.");
    }

    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    var foundIndex = -1;

    for (var i = 0; i < ids.length; i += 1) {
      if (String(ids[i][0] || "").trim() === rowId) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex === -1) {
      throw makeError_("NOT_FOUND", "Không tìm thấy bản ghi.");
    }

    sheet.deleteRow(foundIndex + 2);
    SpreadsheetApp.flush();

    return { ok: true, rowId: rowId };
  });
}
