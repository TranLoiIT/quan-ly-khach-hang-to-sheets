/**
 * FOTAMI Warranty - Google Apps Script Web App
 *
 * Script này chạy trong Apps Script gắn với Google Sheet và cung cấp API JSON
 * cho Next.js. Không dùng service account hay Google Cloud API key.
 *
 * Cài đặt:
 *   1. Tạo/cập nhật Script Property APP_TOKEN.
 *   2. Chạy setupSheet() một lần trong Apps Script Editor.
 *   3. Deploy dạng Web app, Execute as: Me, Who has access: Anyone.
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
var MAX_PRODUCTS_PER_TICKET = 10;
var LOCK_TIMEOUT_MS = 15000;

var UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Endpoint GET chỉ dùng để kiểm tra sức khỏe dịch vụ. Dữ liệu phải gửi bằng POST.
 * Health không yêu cầu token và không bao giờ trả token về client.
 */
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
        "Web App đang hoạt động. Hãy dùng POST với JSON body để gọi action list, append hoặc delete."
    });
  } catch (error) {
    console.error(
      "[fotami-warranty] Lỗi health check: " +
        (error && error.stack ? error.stack : String(error))
    );
    return jsonResponse_({
      ok: false,
      code: "INTERNAL",
      error: "Không thể kiểm tra trạng thái dịch vụ."
    });
  }
}

/**
 * Cổng API chính. Mọi action dữ liệu đều đi qua POST JSON.
 */
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
      "Đã xảy ra lỗi hệ thống. Vui lòng kiểm tra log Apps Script và thử lại.";

    if (code !== "INTERNAL") {
      message =
        error && error.message
          ? error.message
          : "Đã xảy ra lỗi không xác định.";
    }

    // Chỉ ghi log lỗi, không ghi request body/token.
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
 * Tạo tab và header nếu cần. Người dùng có thể chạy hàm này một lần từ editor
 * để cấp quyền và kiểm tra cấu trúc Sheet trước khi deploy.
 */
function setupSheet() {
  var spreadsheet = getSpreadsheet_();
  var sheet = withScriptLock_(function () {
    return ensureSheetReady_(spreadsheet);
  });

  var result =
    'Đã cấu hình tab "' +
    sheet.getName() +
    '" với ' +
    SHEET_HEADERS.length +
    " cột. Spreadsheet: " +
    spreadsheet.getUrl();

  console.log(result);
  return result;
}

/* -------------------------------------------------------------------------- */
/* Xác thực và xử lý request                                                  */
/* -------------------------------------------------------------------------- */

function parseRequestBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw badRequest_("Thiếu JSON body trong yêu cầu POST.");
  }

  var parsed;
  try {
    parsed = JSON.parse(e.postData.contents);
  } catch (error) {
    throw badRequest_("JSON body không hợp lệ.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw badRequest_("JSON body phải là một object.");
  }

  return parsed;
}

function authenticateRequest_(request) {
  var configuredToken = String(
    getScriptProperty_(APP_TOKEN_PROPERTY) || ""
  ).trim();

  if (!configuredToken) {
    throw appError_(
      "CONFIG",
      "Chưa cấu hình Script Property APP_TOKEN. Hãy thêm token bí mật trong Apps Script > Project Settings > Script Properties."
    );
  }

  var providedToken =
    typeof request.token === "string" ? request.token.trim() : "";

  if (!constantTimeEquals_(providedToken, configuredToken)) {
    throw appError_(
      "UNAUTHORIZED",
      "Token không hợp lệ. Kiểm tra APPS_SCRIPT_TOKEN ở server Next.js và APP_TOKEN trong Script Properties."
    );
  }
}

/**
 * So sánh không dừng sớm để hạn chế lộ thông tin qua thời gian xử lý.
 * Đây là so sánh "constant-time-like" phù hợp với môi trường Apps Script.
 */
function constantTimeEquals_(first, second) {
  var left = String(first);
  var right = String(second);
  var maxLength = Math.max(left.length, right.length);
  var difference = left.length ^ right.length;

  for (var index = 0; index < maxLength; index += 1) {
    var leftCode = index < left.length ? left.charCodeAt(index) : 0;
    var rightCode = index < right.length ? right.charCodeAt(index) : 0;
    difference |= leftCode ^ rightCode;
  }

  return difference === 0;
}

/* -------------------------------------------------------------------------- */
/* Action: list                                                               */
/* -------------------------------------------------------------------------- */

function listRecords_(request) {
  var query = request.query;

  if (query === undefined || query === null) {
    query = "";
  } else if (typeof query !== "string") {
    throw badRequest_("Tham số query phải là chuỗi.");
  }

  var pageSize = parseIntegerParameter_(request.pageSize, 10);
  pageSize = Math.min(50, Math.max(5, pageSize));

  var requestedPage = parseIntegerParameter_(request.page, 1);

  var spreadsheet = getSpreadsheet_();
  var sheet = withScriptLock_(function () {
    return ensureSheetReady_(spreadsheet);
  });

  var allRecords = readAllRecords_(sheet);
  var normalizedQuery = query.trim().toLowerCase();

  var filteredRecords = allRecords;
  if (normalizedQuery) {
    filteredRecords = allRecords.filter(function (record) {
      return buildSearchText_(record).indexOf(normalizedQuery) !== -1;
    });
  }

  var sortedRecords = sortByCreatedAtDescendingStable_(filteredRecords);
  var totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  var page = Math.min(Math.max(1, requestedPage), totalPages);
  var startIndex = (page - 1) * pageSize;

  return {
    ok: true,
    rows: sortedRecords.slice(startIndex, startIndex + pageSize),
    total: allRecords.length,
    registrations: countDistinctRegistrations_(allRecords),
    filtered: sortedRecords.length,
    filteredRegistrations: countDistinctRegistrations_(sortedRecords),
    page: page,
    pageSize: pageSize,
    totalPages: totalPages
  };
}

function parseIntegerParameter_(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  var numberValue;
  if (typeof value === "number") {
    numberValue = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    numberValue = Number(value);
  } else {
    return fallback;
  }

  if (!isFinite(numberValue)) {
    return fallback;
  }

  return Math.floor(numberValue);
}

function readAllRecords_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet
    .getRange(2, 1, lastRow - 1, SHEET_HEADERS.length)
    .getDisplayValues();

  var records = [];

  for (var rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    var row = values[rowIndex];
    var hasValue = false;

    for (var columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      if (String(row[columnIndex]).trim() !== "") {
        hasValue = true;
        break;
      }
    }

    // Bỏ qua các hàng hoàn toàn trống.
    if (!hasValue) continue;

    var record = {};
    for (var fieldIndex = 0; fieldIndex < SHEET_COLUMN_KEYS.length; fieldIndex += 1) {
      var fieldValue = row[fieldIndex];
      record[SHEET_COLUMN_KEYS[fieldIndex]] =
        fieldValue === null || fieldValue === undefined
          ? ""
          : String(fieldValue);
    }
    records.push(record);
  }

  return records;
}

function buildSearchText_(record) {
  var parts = [];
  for (var index = 0; index < SHEET_COLUMN_KEYS.length; index += 1) {
    parts.push(record[SHEET_COLUMN_KEYS[index]] || "");
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Sắp xếp mới nhất trước. Dùng thêm vị trí gốc để đảm bảo stable sort, nhờ đó
 * các dòng sản phẩm trong cùng một phiếu giữ đúng thứ tự đã nhập.
 */
function sortByCreatedAtDescendingStable_(records) {
  var indexed = records.map(function (record, index) {
    return { record: record, index: index };
  });

  indexed.sort(function (left, right) {
    var leftCreatedAt = left.record.createdAt || "";
    var rightCreatedAt = right.record.createdAt || "";

    if (leftCreatedAt < rightCreatedAt) return 1;
    if (leftCreatedAt > rightCreatedAt) return -1;
    return left.index - right.index;
  });

  return indexed.map(function (item) {
    return item.record;
  });
}

function countDistinctRegistrations_(records) {
  var seen = {};
  var count = 0;

  for (var index = 0; index < records.length; index += 1) {
    var code = String(records[index].registrationCode || "").trim();
    if (!code) continue;

    if (!Object.prototype.hasOwnProperty.call(seen, code)) {
      seen[code] = true;
      count += 1;
    }
  }

  return count;
}

/* -------------------------------------------------------------------------- */
/* Action: append                                                             */
/* -------------------------------------------------------------------------- */

function appendRegistration_(request) {
  var input = validateRegistrationData_(request.data);

  var createdAtDate = new Date();
  var createdAt = createdAtDate.toISOString();
  var datePart = createdAt.slice(0, 10).replace(/-/g, "");
  var registrationCode =
    "BH-" + datePart + "-" + randomHexSuffix_(6).toUpperCase();

  var rows = [];

  for (var index = 0; index < input.products.length; index += 1) {
    var product = input.products[index];
    rows.push([
      Utilities.getUuid(),
      registrationCode,
      createdAt,
      input.dealerName,
      input.dealerCode,
      input.dealerPhone,
      input.customerName,
      input.customerPhone,
      input.customerAddress,
      input.deliveryDate,
      input.warrantyMonths,
      product.productName,
      product.model,
      product.serial,
      product.saleDate
    ]);
  }

  return withScriptLock_(function () {
    var spreadsheet = getSpreadsheet_();
    var sheet = ensureSheetReady_(spreadsheet);
    var startRow = sheet.getLastRow() + 1;

    if (startRow < 2) startRow = 2;

    // Một lần setValues duy nhất cho toàn bộ sản phẩm của phiếu.
    sheet
      .getRange(startRow, 1, rows.length, SHEET_HEADERS.length)
      .setValues(rows);

    return {
      ok: true,
      registrationCode: registrationCode,
      count: rows.length
    };
  });
}

function randomHexSuffix_(length) {
  var uuid = Utilities.getUuid().replace(/-/g, "");
  return uuid.slice(0, length);
}

function validateRegistrationData_(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw badRequest_("Dữ liệu phiếu bảo hành không hợp lệ.");
  }

  var dealerName = requireText_(data.dealerName, "tên đại lý", 150, "");
  var dealerCode = requireText_(data.dealerCode, "mã đại lý", 50, "");
  var dealerPhone = requirePhone_(data.dealerPhone, "số điện thoại đại lý", "");
  var customerName = requireText_(
    data.customerName,
    "họ tên khách hàng",
    150,
    ""
  );
  var customerPhone = requirePhone_(
    data.customerPhone,
    "số điện thoại khách hàng",
    ""
  );
  var customerAddress = optionalText_(
    data.customerAddress,
    "địa chỉ khách hàng",
    300,
    ""
  );
  var deliveryDate = requireDate_(
    data.deliveryDate,
    "ngày giao hàng/lắp đặt",
    ""
  );
  var warrantyMonths = requireWarrantyMonths_(data.warrantyMonths);

  if (!Array.isArray(data.products)) {
    throw badRequest_("Danh sách sản phẩm không hợp lệ.");
  }

  if (data.products.length === 0) {
    throw badRequest_("Cần ít nhất một sản phẩm.");
  }

  if (data.products.length > MAX_PRODUCTS_PER_TICKET) {
    throw badRequest_(
      "Mỗi phiếu chỉ hỗ trợ tối đa " +
        MAX_PRODUCTS_PER_TICKET +
        " sản phẩm."
    );
  }

  var products = [];

  for (var index = 0; index < data.products.length; index += 1) {
    var prefix = "Sản phẩm " + (index + 1) + ": ";
    var product = data.products[index];

    if (!product || typeof product !== "object" || Array.isArray(product)) {
      throw badRequest_(prefix + "dữ liệu không hợp lệ.");
    }

    products.push({
      productName: requireText_(
        product.productName,
        "tên sản phẩm",
        150,
        prefix
      ),
      model: requireText_(product.model, "model", 100, prefix),
      serial: requireText_(product.serial, "serial", 100, prefix),
      saleDate: requireDate_(product.saleDate, "ngày bán", prefix)
    });
  }

  return {
    dealerName: dealerName,
    dealerCode: dealerCode,
    dealerPhone: dealerPhone,
    customerName: customerName,
    customerPhone: customerPhone,
    customerAddress: customerAddress,
    deliveryDate: deliveryDate,
    warrantyMonths: warrantyMonths,
    products: products
  };
}

function requireText_(value, label, maxLength, prefix) {
  var text = typeof value === "string" ? value.trim() : null;

  if (text === null || text === "") {
    throw badRequest_(prefix + "Vui lòng nhập " + label + ".");
  }

  if (text.length > maxLength) {
    throw badRequest_(
      prefix +
        capitalizeFirst_(label) +
        " không được dài quá " +
        maxLength +
        " ký tự."
    );
  }

  return text;
}

function optionalText_(value, label, maxLength, prefix) {
  if (value === undefined || value === null) return "";

  var text = typeof value === "string" ? value.trim() : null;
  if (text === null) {
    throw badRequest_(prefix + capitalizeFirst_(label) + " không hợp lệ.");
  }

  if (text.length > maxLength) {
    throw badRequest_(
      prefix +
        capitalizeFirst_(label) +
        " không được dài quá " +
        maxLength +
        " ký tự."
    );
  }

  return text;
}

function requirePhone_(value, label, prefix) {
  var phone = requireText_(value, label, 30, prefix);
  var digits = phone.replace(/[^0-9]/g, "");

  if (!/^[0-9+\s().-]+$/.test(phone) || digits.length < 8 || digits.length > 15) {
    throw badRequest_(
      prefix +
        capitalizeFirst_(label) +
        " không hợp lệ (cần 8-15 chữ số)."
    );
  }

  return phone;
}

function requireDate_(value, label, prefix) {
  var date = requireText_(value, label, 10, prefix);

  if (!isValidDateString_(date)) {
    throw badRequest_(prefix + capitalizeFirst_(label) + " không hợp lệ.");
  }

  return date;
}

function isValidDateString_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  var parsed = new Date(value + "T00:00:00.000Z");
  return (
    !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  );
}

function requireWarrantyMonths_(value) {
  var months = NaN;

  if (typeof value === "number") {
    months = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    months = Number(value);
  }

  if (!isFinite(months) || Math.floor(months) !== months) {
    throw badRequest_("Thời hạn bảo hành phải là số nguyên.");
  }

  if (months < 1) {
    throw badRequest_("Thời hạn bảo hành phải từ 1 tháng trở lên.");
  }

  if (months > 120) {
    throw badRequest_("Thời hạn bảo hành không được vượt quá 120 tháng.");
  }

  return months;
}

/* -------------------------------------------------------------------------- */
/* Action: delete                                                             */
/* -------------------------------------------------------------------------- */

function deleteRegistration_(request) {
  var rowId =
    typeof request.rowId === "string" ? request.rowId.trim() : "";

  if (!UUID_PATTERN.test(rowId)) {
    throw badRequest_("rowId không hợp lệ. Cần một UUID của dòng sản phẩm.");
  }

  return withScriptLock_(function () {
    var spreadsheet = getSpreadsheet_();
    var sheet = ensureSheetReady_(spreadsheet);
    var lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      var idValues = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();

      for (var index = 0; index < idValues.length; index += 1) {
        if (String(idValues[index][0]).trim() === rowId) {
          // Chỉ xoá đúng một hàng sản phẩm.
          sheet.deleteRow(index + 2);
          return { ok: true, rowId: rowId };
        }
      }
    }

    throw appError_(
      "NOT_FOUND",
      "Không tìm thấy bản ghi cần xoá. Có thể bản ghi đã bị xoá hoặc dữ liệu đã thay đổi."
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Google Sheet, header và lock                                               */
/* -------------------------------------------------------------------------- */

function getSpreadsheet_() {
  var activeSpreadsheet = null;

  try {
    activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  } catch (error) {
    activeSpreadsheet = null;
  }

  // Ưu tiên spreadsheet gắn liền (container-bound).
  if (activeSpreadsheet) return activeSpreadsheet;

  var sheetId = String(getScriptProperty_(SHEET_ID_PROPERTY) || "").trim();

  if (!sheetId) {
    throw appError_(
      "CONFIG",
      "Chưa tìm thấy Google Sheet. Hãy dùng Apps Script gắn liền với Sheet, hoặc thêm Script Property SHEET_ID nếu dùng script độc lập."
    );
  }

  try {
    var spreadsheet = SpreadsheetApp.openById(sheetId);
    if (!spreadsheet) {
      throw new Error("openById returned null");
    }
    return spreadsheet;
  } catch (error) {
    throw appError_(
      "CONFIG",
      "Không mở được Google Sheet từ SHEET_ID. Kiểm tra lại SHEET_ID và quyền truy cập của tài khoản đang chạy Web App."
    );
  }
}

function getSheetTabName_() {
  var tabName = String(
    getScriptProperty_(SHEET_TAB_NAME_PROPERTY) || ""
  ).trim();

  return tabName || DEFAULT_SHEET_TAB_NAME;
}

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 * Bảo đảm tab và header tồn tại. Không tự ghi đè nếu hàng 1 đang có dữ liệu
 * nhưng không khớp cấu trúc.
 */
function ensureSheetReady_(spreadsheet) {
  var tabName = getSheetTabName_();

  try {
    var sheet = spreadsheet.getSheetByName(tabName);

    if (!sheet) {
      try {
        sheet = spreadsheet.insertSheet(tabName);
      } catch (insertError) {
        throw appError_(
          "SETUP",
          'Không thể tạo tab "' +
            tabName +
            '" trong Google Sheet. Kiểm tra quyền chỉnh sửa và tên tab.'
        );
      }
    }

    ensureMinimumColumns_(sheet);

    var headerState = inspectHeaders_(sheet);

    if (!headerState.present) {
      writeHeaders_(sheet);
      return sheet;
    }

    if (!headerState.matches) {
      var foundText =
        headerState.found.length > 0
          ? headerState.found.join(" | ")
          : "(trống)";

      throw appError_(
        "SETUP",
        'Header của tab "' +
          tabName +
          '" không khớp cấu hình. Cần: ' +
          SHEET_HEADERS.join(" | ") +
          ". Đang có: " +
          foundText +
          ". Hãy sửa hàng 1 hoặc xoá trắng hàng 1 để app tự tạo header."
      );
    }

    return sheet;
  } catch (error) {
    if (error && error.appCode) throw error;

    console.error(
      "[fotami-warranty] Lỗi chuẩn bị Sheet: " +
        (error && error.stack ? error.stack : String(error))
    );

    throw appError_(
      "SETUP",
      'Không thể đọc/ghi tab "' +
        tabName +
        '". Kiểm tra quyền truy cập Google Sheet và cấu trúc tab.'
    );
  }
}

function ensureMinimumColumns_(sheet) {
  var currentColumns = sheet.getMaxColumns();
  var requiredColumns = SHEET_HEADERS.length;

  if (currentColumns < requiredColumns) {
    sheet.insertColumnsAfter(currentColumns, requiredColumns - currentColumns);
  }
}

function inspectHeaders_(sheet) {
  var scanColumns = Math.max(SHEET_HEADERS.length, sheet.getLastColumn());
  var rowValues = sheet.getRange(1, 1, 1, scanColumns).getDisplayValues()[0];

  var present = false;
  var matches = true;
  var found = [];

  for (var index = 0; index < SHEET_HEADERS.length; index += 1) {
    var value = index < rowValues.length ? rowValues[index] : "";
    var normalizedValue = String(value).trim();

    if (normalizedValue !== "") present = true;
    if (normalizedValue !== SHEET_HEADERS[index]) matches = false;

    found.push(formatHeaderForMessage_(value));
  }

  // Các cột thừa có header cũng bị coi là sai cấu trúc.
  for (var extraIndex = SHEET_HEADERS.length; extraIndex < rowValues.length; extraIndex += 1) {
    var extraValue = String(rowValues[extraIndex]).trim();

    if (extraValue !== "") {
      present = true;
      matches = false;
      found.push(formatHeaderForMessage_(rowValues[extraIndex]));
    }
  }

  return {
    present: present,
    matches: matches,
    found: found
  };
}

function formatHeaderForMessage_(value) {
  var text = String(value === null || value === undefined ? "" : value).trim();
  return text || "(trống)";
}

function writeHeaders_(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
  headerRange.setValues([SHEET_HEADERS]);
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

/**
 * Khoá dùng chung khi chuẩn bị Sheet hoặc ghi dữ liệu. Nếu không lấy được khoá
 * trong 15 giây thì trả LOCK thay vì ghi chen vào một request khác.
 */
function withScriptLock_(callback) {
  var lock = LockService.getScriptLock();
  var acquired = false;

  try {
    acquired = lock.tryLock(LOCK_TIMEOUT_MS);
  } catch (error) {
    acquired = false;
  }

  if (!acquired) {
    throw appError_(
      "LOCK",
      "Hệ thống đang bận xử lý dữ liệu. Vui lòng thử lại sau vài giây."
    );
  }

  try {
    return callback();
  } finally {
    try {
      lock.releaseLock();
    } catch (releaseError) {
      // Không cần xử lý thêm; khoá sẽ tự hết hạn khi execution kết thúc.
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Tiện ích                                                                   */
/* -------------------------------------------------------------------------- */

function capitalizeFirst_(value) {
  var text = String(value);
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function appError_(code, message) {
  var error = new Error(message);
  error.appCode = code;
  return error;
}

function badRequest_(message) {
  return appError_("BAD_REQUEST", message);
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
