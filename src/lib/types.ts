import type { WarrantyRecordKey } from "@/lib/warranty";

export type UserRole = "admin" | "user";

export type SessionUser = {
  username: string;
  name: string;
  role: UserRole;
};

/** Mỗi dòng trong Google Sheet là một sản phẩm của một phiếu bảo hành. */
export type WarrantyRecord = Record<WarrantyRecordKey, string>;

export type RowsResponse = {
  rows: WarrantyRecord[];
  /** Tổng số dòng sản phẩm. */
  total: number;
  /** Tổng số phiếu (distinct mã phiếu). */
  registrations: number;
  /** Số dòng sản phẩm khớp bộ lọc. */
  filtered: number;
  /** Số phiếu khớp bộ lọc. */
  filteredRegistrations: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreatedRegistrationSummary = {
  registrationCode: string;
  count: number;
};

export type ApiErrorBody = {
  error: string;
  fields?: Record<string, string>;
};
