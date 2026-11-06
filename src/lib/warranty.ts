export const MAX_PRODUCTS_PER_TICKET = 10;

/**
 * Thứ tự cột trong Google Sheet. Khi thay đổi, hãy xoá trắng hàng 1
 * (hoặc sửa header) để app tự tạo lại đúng cấu trúc.
 */
export const WARRANTY_COLUMNS = [
  { key: "rowId", header: "ID dòng" },
  { key: "registrationCode", header: "Mã phiếu" },
  { key: "createdAt", header: "Thời gian tạo" },
  { key: "dealerName", header: "Tên đại lý" },
  { key: "dealerCode", header: "Mã đại lý" },
  { key: "dealerPhone", header: "SĐT đại lý" },
  { key: "customerName", header: "Họ tên khách hàng" },
  { key: "customerPhone", header: "SĐT khách hàng" },
  { key: "customerAddress", header: "Địa chỉ khách hàng" },
  { key: "deliveryDate", header: "Ngày giao hàng/lắp đặt" },
  { key: "warrantyMonths", header: "Thời hạn bảo hành (tháng)" },
  { key: "productName", header: "Tên sản phẩm" },
  { key: "model", header: "Model" },
  { key: "serial", header: "Serial (S/N)" },
  { key: "saleDate", header: "Ngày bán" },
] as const;

export type WarrantyRecordKey = (typeof WARRANTY_COLUMNS)[number]["key"];

export const SHEET_HEADERS = WARRANTY_COLUMNS.map((column) => column.header);

/** 15 cột => O. Hàm chỉ đúng khi số cột <= 26. */
export const SHEET_LAST_COLUMN = String.fromCharCode(64 + SHEET_HEADERS.length);

export type ProductFormValues = {
  productName: string;
  model: string;
  serial: string;
  saleDate: string;
};

export type WarrantyFormValues = {
  dealerName: string;
  dealerCode: string;
  dealerPhone: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryDate: string;
  warrantyMonths: string;
  products: ProductFormValues[];
};

export const PRODUCT_FIELDS = [
  {
    key: "productName",
    label: "Tên sản phẩm",
    placeholder: "VD: Máy lọc nước FOTAMI A1",
    maxLength: 150,
    type: "text",
  },
  {
    key: "model",
    label: "Model",
    placeholder: "VD: FTM-A1",
    maxLength: 100,
    type: "text",
  },
  {
    key: "serial",
    label: "Serial (S/N)",
    placeholder: "VD: FT2026000123",
    maxLength: 100,
    type: "text",
  },
  {
    key: "saleDate",
    label: "Ngày bán",
    placeholder: "",
    maxLength: 10,
    type: "date",
  },
] as const;

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyProductValues(): ProductFormValues {
  return {
    productName: "",
    model: "",
    serial: "",
    saleDate: getTodayDateString(),
  };
}

export function emptyWarrantyFormValues(): WarrantyFormValues {
  return {
    dealerName: "",
    dealerCode: "",
    dealerPhone: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    deliveryDate: getTodayDateString(),
    warrantyMonths: "12",
    products: [emptyProductValues()],
  };
}
