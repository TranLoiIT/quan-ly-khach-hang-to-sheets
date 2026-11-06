import { z } from "zod";
import { MAX_PRODUCTS_PER_TICKET } from "@/lib/warranty";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function normalizeVietnamesePhone(value: string): string {
  let phone = value.replace(/[\s.\-()]/g, "");

  if (phone.startsWith("+84")) {
    phone = phone.slice(3);
  } else if (phone.startsWith("0084")) {
    phone = phone.slice(4);
  } else if (phone.startsWith("84") && phone.length >= 11) {
    phone = phone.slice(2);
  }

  // Cho phép nhập thiếu số 0 đầu, ví dụ 901234567.
  if (!phone.startsWith("0")) {
    phone = `0${phone}`;
  }

  return phone;
}

function isValidVietnamesePhone(value: string): boolean {
  const phone = normalizeVietnamesePhone(value);
  // Di động: 03, 05, 07, 08, 09 + 8 số (10 số).
  // Cố định: 02 + 8-9 số (10-11 số).
  return /^0(3|5|7|8|9)\d{8}$/.test(phone) || /^02\d{8,9}$/.test(phone);
}

function phoneSchema(label: string) {
  return z
    .string()
    .trim()
    .min(1, `Vui lòng nhập ${label}.`)
    .max(10, `${label} không được dài quá 10 ký tự.`)
    .transform(normalizeVietnamesePhone)
    .refine(
      isValidVietnamesePhone,
      `${label} không đúng định dạng số điện thoại hợp lệ.`,
    );
}

export const productInputSchema = z.object({
  productName: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên sản phẩm.")
    .max(150, "Tên sản phẩm không được dài quá 150 ký tự."),
  model: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập model.")
    .max(100, "Model không được dài quá 100 ký tự."),
  serial: z
    .string()
    .trim()
    .max(100, "Serial không được dài quá 100 ký tự.")
    .transform((val) => (val === "" ? "-" : val))
    .default("-"),
  saleDate: z
    .string()
    .trim()
    .min(1, "Vui lòng chọn ngày bán.")
    .refine(isValidDateString, "Ngày bán không hợp lệ."),
});

export const warrantyInputSchema = z.object({
  dealerName: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên đại lý.")
    .max(150, "Tên đại lý không được dài quá 150 ký tự."),
  dealerCode: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập mã đại lý.")
    .max(50, "Mã đại lý không được dài quá 50 ký tự."),
  dealerPhone: phoneSchema("số điện thoại đại lý"),
  customerName: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập họ tên khách hàng.")
    .max(150, "Họ tên khách hàng không được dài quá 150 ký tự."),
  customerPhone: phoneSchema("số điện thoại khách hàng"),
  customerAddress: z
    .string()
    .trim()
    .max(300, "Địa chỉ không được dài quá 300 ký tự.")
    .transform((val) => (val === "" ? "-" : val))
    .default("-"),
  deliveryDate: z
    .string()
    .trim()
    .min(1, "Vui lòng chọn ngày giao hàng/lắp đặt.")
    .refine(isValidDateString, "Ngày giao hàng/lắp đặt không hợp lệ."),
  warrantyMonths: z.coerce
    .number()
    .int("Thời hạn bảo hành phải là số nguyên.")
    .min(1, "Thời hạn bảo hành phải từ 1 tháng trở lên.")
    .max(120, "Thời hạn bảo hành không được vượt quá 120 tháng."),
  products: z
    .array(productInputSchema)
    .min(1, "Cần ít nhất một sản phẩm.")
    .max(
      MAX_PRODUCTS_PER_TICKET,
      `Mỗi phiếu chỉ hỗ trợ tối đa ${MAX_PRODUCTS_PER_TICKET} sản phẩm.`,
    ),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type WarrantyInput = z.infer<typeof warrantyInputSchema>;

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên đăng nhập.")
    .max(64, "Tên đăng nhập không hợp lệ."),
  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu.")
    .max(128, "Mật khẩu không hợp lệ.")
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "Mật khẩu không được dài quá 72 byte.",
    ),
});

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}
