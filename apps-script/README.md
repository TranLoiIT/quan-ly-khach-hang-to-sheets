# FOTAMI Warranty — Google Apps Script backend

Backend Google Sheets của hệ thống đăng ký bảo hành FOTAMI được triển khai dưới dạng một **Google Apps Script Web App** gắn với Google Sheet.

```
Next.js server (Route Handlers)
        │  POST JSON + APP_TOKEN, HTTPS
        ▼
Google Apps Script Web App (Code.gs)
        │  SpreadsheetApp
        ▼
Google Sheet (tab Sheet1)
```

Thiết kế này **không dùng** Google Cloud service account, Google Sheets API key hay OAuth client ID. Toàn bộ quyền đọc/ghi Google Sheet do chính tài khoản Google sở hữu Apps Script đảm nhiệm. Next.js chỉ gọi một URL Web App bằng shared token.

> Token và URL Web App chỉ được dùng ở server Next.js. Không đưa token vào `NEXT_PUBLIC_*`, mã client, URL trên trình duyệt hay lịch sử chat.

---

## Cấu trúc dữ liệu trong Google Sheet

Tab mặc định là `Sheet1` (có thể đổi bằng Script Property `SHEET_TAB_NAME`). Hàng 1 là header cố định, đúng thứ tự sau:

| Cột | Header | Khóa trong API | Ghi chú |
|---:|---|---|---|
| A | `ID dòng` | `rowId` | UUID duy nhất của **từng dòng sản phẩm**; dùng để xoá |
| B | `Mã phiếu` | `registrationCode` | Dùng chung cho các sản phẩm trong cùng một phiếu |
| C | `Thời gian tạo` | `createdAt` | ISO UTC, ví dụ `2026-11-06T03:20:15.123Z` |
| D | `Tên đại lý` | `dealerName` | |
| E | `Mã đại lý` | `dealerCode` | |
| F | `SĐT đại lý` | `dealerPhone` | Lưu dạng chuỗi để giữ số 0 đầu |
| G | `Họ tên khách hàng` | `customerName` | |
| H | `SĐT khách hàng` | `customerPhone` | Lưu dạng chuỗi để giữ số 0 đầu |
| I | `Địa chỉ khách hàng` | `customerAddress` | Có thể để trống |
| J | `Ngày giao hàng/lắp đặt` | `deliveryDate` | Định dạng `yyyy-mm-dd` |
| K | `Thời hạn bảo hành (tháng)` | `warrantyMonths` | Số nguyên 1–120 |
| L | `Tên sản phẩm` | `productName` | |
| M | `Model` | `model` | |
| N | `Serial (S/N)` | `serial` | Lưu dạng chuỗi để giữ số 0 đầu |
| O | `Ngày bán` | `saleDate` | Định dạng `yyyy-mm-dd` |

**Mỗi dòng là một sản phẩm.** Một phiếu có 3 sản phẩm sẽ có 3 dòng, cùng `Mã phiếu` và cùng `Thời gian tạo`. API `list` trả về từng dòng sản phẩm; trường `registrations` đếm số phiếu khác nhau. Xoá một `rowId` chỉ xoá đúng một dòng sản phẩm, không xoá các sản phẩm còn lại của cùng phiếu.

### Xem và sửa Sheet trực tiếp

- Mở Google Sheet từ Google Drive hoặc từ chính Apps Script (nếu script gắn liền với Sheet).
- Không đổi tên, đổi thứ tự, chèn hoặc xoá 15 cột A–O. Không sửa hàng header.
- Không xoá hoặc sửa cột `ID dòng`: hệ thống cần UUID này để xoá bản ghi.
- Có thể sửa nội dung dữ liệu trực tiếp. Với số điện thoại/serial có số 0 đầu, nên định dạng các cột F, H, N là **Plain text** hoặc nhập thêm dấu nháy đơn (`'0901234567`).
- Giữ ngày ở dạng văn bản `yyyy-mm-dd` để dữ liệu hiển thị ổn định.
- Nếu xoá trắng toàn bộ hàng 1, lần gọi API tiếp theo sẽ tự ghi lại header đúng. Nếu hàng 1 có dữ liệu nhưng sai cấu trúc, API trả lỗi `SETUP` và **không tự ghi đè**.
- Nếu đổi tên tab, cập nhật Script Property `SHEET_TAB_NAME` tương ứng. Nếu không, hệ thống sẽ tạo một tab mới với tên cũ.

---

## 1. Tạo Google Sheet và tab dữ liệu

1. Tạo một Google Spreadsheet mới tại [sheets.new](https://sheets.new) hoặc Google Drive.
2. Đặt tên file, ví dụ `FOTAMI Warranty Data`.
3. Đổi tên tab dữ liệu thành `Sheet1` (hoặc giữ tên này nếu Google đã tạo sẵn), hoặc dùng tên tab khác và ghi nhớ tên đó để khai báo `SHEET_TAB_NAME`.
4. Không cần tạo header thủ công; `setupSheet()` sẽ tạo giúp.

Nên dùng **script gắn liền với Sheet** (container-bound): mở Sheet → `Extensions` → `Apps Script`. Cách này không cần `SHEET_ID`.

---

## 2. Mở Apps Script và dán mã nguồn

1. Trong Google Sheet, chọn **Extensions → Apps Script**.
2. Đổi tên project ở góc trên trái, ví dụ `FOTAMI Warranty API`.
3. Mở file `Code.gs` trong editor, xoá hàm mẫu (nếu có) rồi dán toàn bộ nội dung file [`Code.gs`](./Code.gs) của thư mục này.
4. Nhấn **Save** (hoặc `Ctrl+S`).
5. Không cần tạo thêm file HTML hay manifest.

---

## 3. Khai báo Script Properties

1. Trong Apps Script, mở **Project Settings** (biểu tượng bánh răng ở thanh bên trái).
2. Kéo xuống mục **Script Properties** → **Add script property**.
3. Thêm các thuộc tính sau:

| Property | Bắt buộc | Ý nghĩa |
|---|---|---|
| `APP_TOKEN` | Có | Chuỗi bí mật dài, do bạn tự sinh. Next.js phải gửi cùng giá trị này. |
| `SHEET_TAB_NAME` | Không | Tên tab dữ liệu. Mặc định là `Sheet1`. |
| `SHEET_ID` | Chỉ script độc lập | ID Spreadsheet. Không cần nếu mở Apps Script từ trong Google Sheet. |

### Sinh `APP_TOKEN`

Chạy lệnh sau trên máy có Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Copy nguyên chuỗi kết quả (khoảng 43 ký tự) vào giá trị `APP_TOKEN`. Không thêm dấu ngoặc kép, khoảng trắng hay xuống dòng vào Script Property.

Ví dụ kết quả:

```text
Hk3YpQ8w2vB6mN1xR7tL0sJ5cF4dG9aZ8uE2iO6kPqA
```

### Khi nào dùng `SHEET_ID`?

- **Khuyến nghị:** tạo Apps Script bằng `Extensions → Apps Script` từ Google Sheet. Khi đó `SpreadsheetApp.getActiveSpreadsheet()` tìm thấy Sheet, không cần `SHEET_ID`.
- **Chỉ dùng `SHEET_ID`** nếu bạn tạo script độc lập tại [script.google.com](https://script.google.com). ID là phần nằm giữa `/d/` và `/edit` trong URL Spreadsheet:
  `https://docs.google.com/spreadsheets/d/`**`1AbCd...`**`/edit`
- Tài khoản chạy Web App phải có quyền chỉnh sửa Spreadsheet đó.

---

## 4. Chạy `setupSheet()` một lần để tạo tab và header

1. Trong Apps Script Editor, ở thanh chọn function phía trên, chọn `setupSheet`.
2. Nhấn **Run**.
3. Google sẽ yêu cầu cấp quyền:
   - Chọn tài khoản Google sở hữu Sheet.
   - Chọn **Review permissions** → chọn tài khoản → **Advanced** → **Go to ... (unsafe)** chỉ khi bạn tin tưởng mã nguồn của chính mình → **Allow**.
   - Với tài khoản Google Workspace, quản trị viên có thể chặn cấp quyền; khi đó cần liên hệ admin.
4. Mở **Execution log** để xem thông báo thành công.
5. Quay lại Google Sheet, kiểm tra tab `Sheet1` (hoặc `SHEET_TAB_NAME`):
   - Hàng 1 có đủ 15 header như bảng phía trên.
   - Hàng 1 được in đậm và được freeze.
   - Nếu có sẵn header sai, `setupSheet()` sẽ báo lỗi liệt kê header cần có và header đang có; sửa hoặc xoá trắng hàng 1 rồi chạy lại.

Các action `list`, `append`, `delete` cũng tự gọi bước chuẩn bị tab/header này, nhưng chạy `setupSheet()` trước giúp hoàn tất cấp quyền và kiểm tra cấu trúc ngay trong editor.

---

## 5. Deploy thành Web App

1. Trong Apps Script, chọn **Deploy → New deployment**.
2. Bấm biểu tượng bánh răng cạnh **Select type** và chọn **Web app**.
3. Điền:
   - **Description:** ví dụ `FOTAMI warranty production`.
   - **Execute as:** `Me` (tài khoản sở hữu Sheet/Apps Script).
   - **Who has access:** `Anyone`.
4. Nhấn **Deploy**. Nếu được hỏi, nhấn **Authorize access** và cấp quyền.
5. Copy **Web app URL**, đảm bảo URL kết thúc bằng `/exec`.
6. Copy thêm **Deployment ID** nếu cần lưu để quản lý deployment (không dùng làm mật khẩu).

Vì sao chọn **Anyone**?

- Server Next.js không có phiên đăng nhập Google OAuth, nên nếu chọn `Anyone with a Google account` hoặc chỉ `Only myself`, Google sẽ trả trang đăng nhập thay vì JSON.
- `Anyone` chỉ mở endpoint ở tầng Google. Mọi action dữ liệu vẫn yêu cầu đúng `APP_TOKEN`, và token chỉ nằm ở server Next.js.
- Endpoint health là công khai nhưng **không trả token, không trả dữ liệu khách hàng**.

Dùng URL `/exec` của deployment, không dùng URL `/dev`. URL `/dev` chỉ dùng khi đang đăng nhập Google trong trình duyệt và không phù hợp cho server.

---

## 6. “API key” nằm ở đâu?

**Google Apps Script không cấp API key trên script.google.com.** Không có nút tạo API key cho một Apps Script Web App, và Apps Script cũng không dùng Google Cloud API key hay OAuth client ID cho cách tích hợp này.

Các “khóa” hệ thống cần là:

1. **Web app URL** kết thúc `/exec` — địa chỉ endpoint.
2. **`APP_TOKEN`** — shared secret do bạn tự sinh ở bước 3, dùng để xác thực từng request.

Tùy chọn, chỉ phục vụ quản lý:

- **Script ID:** hiển thị trong Project Settings, dùng khi thao tác với Apps Script API/CI.
- **Deployment ID:** hiển thị trong deployment, dùng để quản lý phiên bản deploy.
- Hai ID này không thay thế `APP_TOKEN` và **không** phải khóa xác thực của ứng dụng.

API key, OAuth client ID, service account và việc bật Google Sheets API thuộc **Google Cloud Console**, không thuộc Apps Script. Không bật Google Cloud API hay tạo service account cho kiến trúc này.

---

## 7. Cấu hình Next.js

### Chạy local

Tạo hoặc cập nhật `.env.local` ở thư mục gốc project Next.js:

```dotenv
APPS_SCRIPT_URL="https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
APPS_SCRIPT_TOKEN="dán_token_vừa_sinh"
```

- `APPS_SCRIPT_URL` phải là URL Web App đầy đủ, kết thúc bằng `/exec`.
- `APPS_SCRIPT_TOKEN` phải trùng chính xác giá trị `APP_TOKEN` trong Script Properties.
- Khởi động lại dev server sau khi sửa biến môi trường.
- Không thêm `NEXT_PUBLIC_` vào tên token. Token chỉ được đọc trong route server.

### Vercel / production

1. Vào Vercel Project → **Settings → Environment Variables**.
2. Thêm `APPS_SCRIPT_URL` và `APPS_SCRIPT_TOKEN` cho môi trường Production (và Preview/Development nếu cần).
3. Lưu và **redeploy** để các biến mới có hiệu lực.
4. Không commit `.env.local`; file này đã nằm trong `.gitignore`.

Nếu chuyển từ cách dùng service account cũ, có thể bỏ các biến `GOOGLE_SERVICE_ACCOUNT_*`, `GOOGLE_SHEET_ID` không còn dùng bởi backend Apps Script này. Không cần dùng chung `SHEET_TAB_NAME` ở Next.js: tên tab được cấu hình trong Script Properties của Apps Script.

---

## 8. Kiểm tra API bằng curl hoặc PowerShell

Có thể kiểm tra trực tiếp Apps Script trước khi kiểm tra qua Next.js. Apps Script thường trả redirect; luôn dùng `-L` với curl. Next.js server dùng `fetch` và tự theo redirect mặc định.

### PowerShell

Gán biến trong phiên hiện tại (không cần đưa token vào file):

```powershell
$env:APPS_SCRIPT_URL = "https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
$env:APPS_SCRIPT_TOKEN = "dán_token_vào_đây"
```

#### Health

```powershell
Invoke-RestMethod -Method Get -Uri "$($env:APPS_SCRIPT_URL)?action=health" |
  ConvertTo-Json -Depth 5
```

Kết quả mong đợi (thời gian thay đổi theo thực tế):

```json
{
  "ok": true,
  "service": "fotami-warranty",
  "time": "2026-11-06T03:20:15.123Z"
}
```

#### List

```powershell
$body = @{
  token    = $env:APPS_SCRIPT_TOKEN
  action   = "list"
  query    = ""
  page     = 1
  pageSize = 10
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Method Post `
  -Uri $env:APPS_SCRIPT_URL `
  -ContentType "application/json; charset=utf-8" `
  -Body $body |
  ConvertTo-Json -Depth 10
```

Khi sheet mới chưa có dữ liệu, kết quả mong đợi:

```json
{
  "ok": true,
  "rows": [],
  "total": 0,
  "registrations": 0,
  "filtered": 0,
  "filteredRegistrations": 0,
  "page": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

Sau khi có dữ liệu, mỗi phần tử trong `rows` có dạng:

```json
{
  "rowId": "c9c5f12e-0d27-4a6a-b743-4c1d2a8e5f01",
  "registrationCode": "BH-20261106-A1B2C3",
  "createdAt": "2026-11-06T03:20:15.123Z",
  "dealerName": "Đại lý FOTAMI Hà Nội",
  "dealerCode": "DL-HN-01",
  "dealerPhone": "0901234567",
  "customerName": "Nguyễn Văn A",
  "customerPhone": "0912345678",
  "customerAddress": "123 Đường Ví Dụ, Hà Nội",
  "deliveryDate": "2026-11-05",
  "warrantyMonths": "12",
  "productName": "Máy lọc nước FOTAMI A1",
  "model": "FTM-A1",
  "serial": "00012345",
  "saleDate": "2026-11-05"
}
```

### curl (Bash/macOS/Linux/Git Bash)

```bash
export APPS_SCRIPT_URL="https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
export APPS_SCRIPT_TOKEN="dán_token_vào_đây"

curl -L -sS "$APPS_SCRIPT_URL?action=health"

curl -L -sS -X POST "$APPS_SCRIPT_URL" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$APPS_SCRIPT_TOKEN\",\"action\":\"list\",\"query\":\"\",\"page\":1,\"pageSize\":10}"
```

Windows 10/11 có sẵn `curl.exe`. Nếu PowerShell 5.1 gặp lỗi redirect với `Invoke-RestMethod`, dùng PowerShell 7 hoặc một lệnh `curl.exe -L` tương đương (lưu ý cú pháp escape JSON của PowerShell khác Bash).

### Kiểm tra nhanh append/delete (tuỳ chọn)

Append hai sản phẩm trong cùng một phiếu:

```powershell
$payload = @{
  token  = $env:APPS_SCRIPT_TOKEN
  action = "append"
  data   = @{
    dealerName      = "Đại lý FOTAMI Hà Nội"
    dealerCode      = "DL-HN-01"
    dealerPhone     = "0901234567"
    customerName    = "Nguyễn Văn A"
    customerPhone   = "0912345678"
    customerAddress = "123 Đường Ví Dụ, Hà Nội"
    deliveryDate    = "2026-11-05"
    warrantyMonths  = 12
    products        = @(
      @{
        productName = "Máy lọc nước FOTAMI A1"
        model       = "FTM-A1"
        serial      = "00012345"
        saleDate    = "2026-11-05"
      },
      @{
        productName = "Máy lọc nước FOTAMI A2"
        model       = "FTM-A2"
        serial      = "00012346"
        saleDate    = "2026-11-05"
      }
    )
  }
} | ConvertTo-Json -Depth 6 -Compress

Invoke-RestMethod -Method Post -Uri $env:APPS_SCRIPT_URL `
  -ContentType "application/json; charset=utf-8" -Body $payload |
  ConvertTo-Json -Depth 5
```

Kết quả mong đợi:

```json
{
  "ok": true,
  "registrationCode": "BH-20261106-A1B2C3",
  "count": 2
}
```

Xoá một dòng sản phẩm bằng `rowId` lấy từ action `list`:

```powershell
$body = @{
  token  = $env:APPS_SCRIPT_TOKEN
  action = "delete"
  rowId  = "c9c5f12e-0d27-4a6a-b743-4c1d2a8e5f01"
} | ConvertTo-Json -Compress

Invoke-RestMethod -Method Post -Uri $env:APPS_SCRIPT_URL `
  -ContentType "application/json; charset=utf-8" -Body $body |
  ConvertTo-Json -Depth 5
```

Kết quả mong đợi:

```json
{
  "ok": true,
  "rowId": "c9c5f12e-0d27-4a6a-b743-4c1d2a8e5f01"
}
```

> Mọi response đều là JSON và HTTP status thường là **200**, kể cả khi lỗi. Phía Next.js phải kiểm tra trường `ok` và `code`, không chỉ dựa vào HTTP status.

---

## 9. Cập nhật code sau khi deploy

Khi sửa `Code.gs`:

1. Dán code mới, nhấn **Save**.
2. Chọn **Deploy → Manage deployments**.
3. Chọn deployment đang dùng → bấm biểu tượng bút chì **Edit**.
4. Ở **Version**, chọn **New version** → **Deploy**.
5. URL `/exec` giữ nguyên; không cần đổi biến môi trường Next.js.

Nếu chọn **Deploy → New deployment** thay vì cập nhật deployment cũ, Google sẽ tạo URL mới. Khi đó phải cập nhật `APPS_SCRIPT_URL` trong `.env.local` và Vercel rồi redeploy Next.js.

Thay đổi **Script Properties** (ví dụ xoay token) không cần tạo version mới; Apps Script đọc property tại thời điểm request. Tuy nhiên phía Next.js phải cập nhật biến môi trường và redeploy.

---

## 10. Bảo mật và vận hành

- **Coi URL Web App + `APP_TOKEN` là thông tin mật.** Web App để `Anyone` nghĩa là ai có URL cũng chạm được endpoint; token mới là lớp xác thực dữ liệu. Người có cả hai có thể đọc và ghi dữ liệu khách hàng.
- Không đăng URL/token lên GitHub, ảnh chụp màn hình, ticket hỗ trợ, chat công khai hoặc log.
- Chỉ lưu `APP_TOKEN` trong Apps Script **Script Properties** và `APPS_SCRIPT_TOKEN` trong biến môi trường server/Vercel. Không đặt trong browser code, `NEXT_PUBLIC_*`, query string URL hoặc mã nguồn frontend.
- Token được gửi trong **POST body**, không đưa lên URL. Token không xuất hiện trong response health hay log của `Code.gs`.
- Kết nối là HTTPS do `script.google.com` cung cấp. Không dựng proxy HTTP trung gian.
- Next.js server gọi Apps Script trực tiếp nên không gặp vấn đề CORS của trình duyệt. Không cho browser gọi URL Apps Script trực tiếp.
- Chỉ chia sẻ Google Sheet cho tài khoản đang chạy Web App (thường chỉ bạn). Server Next.js không cần quyền truy cập Sheet.
- Khi nghi ngờ lộ token, xoay ngay:
  1. Sinh token mới bằng lệnh Node ở bước 3.
  2. Cập nhật `APP_TOKEN` trong Script Properties.
  3. Cập nhật `APPS_SCRIPT_TOKEN` trong `.env.local` và Vercel.
  4. Redeploy Next.js / restart dev server.
  Token cũ mất hiệu lực ngay sau khi đổi Script Property; nên đổi đồng thời hai phía để tránh gián đoạn.
- Apps Script không cung cấp rate limit riêng cho ứng dụng. Hãy giữ endpoint trong server Next.js, không công khai trực tiếp cho người dùng cuối, và theo dõi **Executions** trong Apps Script.
- Ghi/xoá được bảo vệ bằng `LockService.getScriptLock()` để tránh hai request ghi chen nhau. Request đang chờ quá 15 giây sẽ nhận lỗi `LOCK` và có thể thử lại.

---

## 11. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp | Cách khắc phục |
|---|---|---|
| `UNAUTHORIZED` / “Token không hợp lệ” | `APPS_SCRIPT_TOKEN` khác `APP_TOKEN`; dính khoảng trắng/xuống dòng khi copy; sửa env nhưng chưa restart/redeploy | So sánh lại hai giá trị; dán lại token sạch; restart dev server hoặc redeploy Vercel. Có thể xoay token mới cho chắc chắn. |
| Trình duyệt hiện trang đăng nhập Google / `Access denied` / trả HTML thay vì JSON | Web App chưa để **Who has access: Anyone**, hoặc deployment cũ, hoặc tài khoản bị chính sách Workspace chặn | Sửa deployment: **Execute as: Me**, **Who has access: Anyone**, tạo version mới. Gọi thử bằng tài khoản ẩn danh. Nếu Workspace chặn, nhờ admin hoặc dùng tài khoản Google cá nhân. |
| `Script function not found: doPost` | Deployment đang trỏ tới version không có hàm `doPost`; dán code chưa Save/Deploy; dùng nhầm URL | Kiểm tra hàm phải tên chính xác `doPost`. Save code, vào Manage deployments → Edit → **New version** → Deploy. Dùng URL `/exec` của đúng deployment. |
| `SETUP` / “Header ... không khớp cấu hình” | Hàng 1 bị đổi tên, đổi thứ tự, thiếu cột hoặc có header lạ; dùng nhầm tab; tên tab khác `SHEET_TAB_NAME` | Đối chiếu bảng 15 cột ở đầu README. Sửa hàng 1 cho khớp, hoặc xoá trắng hàng 1 để app tự tạo lại. Không chèn cột trước cột A. |
| `CONFIG` / không tìm thấy Google Sheet | Chưa có `APP_TOKEN`; script độc lập thiếu/sai `SHEET_ID`; tài khoản chạy Web App không có quyền Sheet | Thêm `APP_TOKEN`; dùng script gắn liền với Sheet hoặc thêm `SHEET_ID` đúng; cấp quyền Editor cho tài khoản chạy script. |
| `LOCK` | Một request ghi khác đang giữ script lock quá 15 giây, hoặc Apps Script đang quá tải | Thử lại sau vài giây; tránh bấm gửi/nhập liên tục nhiều request đồng thời. |
| `NOT_FOUND` | `rowId` không còn trong Sheet; danh sách trên giao diện đã cũ | Tải lại danh sách trước khi xoá; kiểm tra cột A còn đúng UUID hay không. |
| Lỗi quota / `Service invoked too many times` / timeout | Vượt hạn mức Apps Script hoặc thao tác quá lớn | Chờ quota reset rồi thử lại; tránh gọi lặp; kiểm tra **Executions** và hạn mức Apps Script của tài khoản. Dữ liệu ghi theo một lần `setValues` nên ít có nguy cơ ghi dở dang. |
| Bị redirect hoặc kết quả lạ khi tự gọi endpoint | Apps Script thường chuyển hướng sang `script.googleusercontent.com` | Next.js `fetch` mặc định theo redirect; nếu tự gọi bằng curl, dùng `-L`. Luôn dùng URL `/exec` ban đầu, không copy URL trung gian. Không gửi token qua query string. |
| Ngày/giờ lệch múi giờ | `createdAt` và ngày trong `Mã phiếu` được sinh theo **UTC**; Sheet có thể hiển thị theo múi giờ của Spreadsheet | Đây là thiết kế có chủ đích. Giữ ngày nhập ở dạng `yyyy-mm-dd`; không đổi code sang giờ địa phương nếu backend và giao diện đang thống nhất UTC. Kiểm tra cả timezone của project Apps Script/Spreadsheet khi đối chiếu log. |
| Danh sách trống dù vừa append | Next.js đang trỏ deployment cũ; append vào tab khác; bộ lọc còn query; Sheet/Tab sai | Kiểm tra URL/deployment version; kiểm tra `SHEET_TAB_NAME`; xoá bộ lọc. Xem trực tiếp tab tương ứng trong Google Sheet. |

Nếu cần xem lỗi chi tiết phía Google: mở Apps Script → **Executions**, chọn lần chạy gần nhất. `Code.gs` chỉ ghi log lỗi và không ghi token.

---

## Phụ lục: Hợp đồng API

### Health

`GET {APPS_SCRIPT_URL}?action=health`

```json
{ "ok": true, "service": "fotami-warranty", "time": "..." }
```

Không cần token. Các request GET khác trả JSON hướng dẫn dùng POST.

### Action dữ liệu

Tất cả đều là `POST` với `Content-Type: application/json`.

| Action | Body chính | Kết quả thành công |
|---|---|---|
| `list` | `token`, `query`, `page`, `pageSize` | `rows`, `total`, `registrations`, `filtered`, `filteredRegistrations`, `page`, `pageSize`, `totalPages` |
| `append` | `token`, `data` gồm thông tin đại lý, khách hàng và `products[]` | `registrationCode`, `count` |
| `delete` | `token`, `rowId` | `rowId` |

Quy tắc chính:

- Mỗi phiếu tối đa **10 sản phẩm**.
- `pageSize` được giới hạn trong khoảng 5–50; `page` được giới hạn trong khoảng 1–`totalPages`.
- `total` là tổng số dòng sản phẩm; `registrations` là số mã phiếu khác nhau.
- Tìm kiếm không phân biệt hoa/thường trên toàn bộ 15 cột.
- Dữ liệu mới nhất (`createdAt`) đứng trước; các sản phẩm cùng phiếu giữ nguyên thứ tự.
- `rowId` phải là UUID; mỗi sản phẩm có một UUID riêng.
- Ngày hợp lệ theo `yyyy-mm-dd`; số điện thoại có 8–15 chữ số; `warrantyMonths` là số nguyên 1–120.

### Lỗi

```json
{
  "ok": false,
  "code": "BAD_REQUEST",
  "error": "Thông báo lỗi bằng tiếng Việt"
}
```

| Mã | Ý nghĩa |
|---|---|
| `BAD_REQUEST` | JSON/action/field/rowId không hợp lệ |
| `UNAUTHORIZED` | Thiếu hoặc sai token |
| `CONFIG` | Thiếu `APP_TOKEN`, thiếu/không mở được Google Sheet |
| `SETUP` | Không tạo được tab hoặc header không khớp cấu trúc |
| `NOT_FOUND` | Không tìm thấy `rowId` cần xoá |
| `LOCK` | Không lấy được lock ghi trong 15 giây |
| `INTERNAL` | Lỗi không mong đợi; xem Apps Script Executions |

HTTP status của Apps Script thường luôn là `200`; phía Next.js phải kiểm tra `ok`.
