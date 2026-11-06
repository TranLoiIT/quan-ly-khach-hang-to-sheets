"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { AddWarrantyDialog } from "@/components/add-warranty-dialog";
import { Brand } from "@/components/brand";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import type {
  CreatedRegistrationSummary,
  RowsResponse,
  SessionUser,
  WarrantyRecord,
} from "@/lib/types";
import {
  cn,
  formatDate,
  formatDateTime,
  formatWarrantyMonths,
  getInitials,
} from "@/lib/utils";

const PAGE_SIZE = 10;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const secondaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

type RowsApiResponse = RowsResponse & { error?: string };
type DeleteApiResponse = { ok?: boolean; id?: string; error?: string };
type RowsMeta = Omit<RowsResponse, "rows">;
type ToastState = { type: "success" | "error"; message: string };

export function DashboardClient({ user }: { user: SessionUser }) {
  const router = useRouter();

  const [rows, setRows] = useState<WarrantyRecord[]>([]);
  const [meta, setMeta] = useState<RowsMeta | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WarrantyRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextQuery = query.trim();
      setDebouncedQuery((current) => (current === nextQuery ? current : nextQuery));
      setPage(1);
    }, 350);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    // Bắt đầu một network request mới: đây là side effect hợp lệ, không phải
    // derived state. Rule của React Compiler bắt nhầm setState đồng bộ ở đây.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (debouncedQuery) params.set("q", debouncedQuery);

    async function loadRows() {
      try {
        const response = await fetch(`/api/rows?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          router.refresh();
          return;
        }

        const data = (await response
          .json()
          .catch(() => null)) as RowsApiResponse | null;

        if (!response.ok || !data || !Array.isArray(data.rows)) {
          throw new Error(
            data?.error ?? "Không thể tải dữ liệu bảo hành từ Google Sheets.",
          );
        }

        if (controller.signal.aborted) return;

        setRows(data.rows);
        setMeta({
          total: data.total,
          registrations: data.registrations,
          filtered: data.filtered,
          filteredRegistrations: data.filteredRegistrations,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages,
        });

        if (data.page !== page) {
          setPage(data.page);
        }
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải dữ liệu. Vui lòng thử lại.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadRows();
    return () => controller.abort();
  }, [debouncedQuery, page, refreshKey, router]);

  function retry() {
    setRefreshKey((current) => current + 1);
  }

  function showToast(type: ToastState["type"], message: string) {
    setToast({ type, message });
  }

  function clearSearch() {
    setQuery("");
    setDebouncedQuery("");
    setPage(1);
  }

  function handleCreated(summary: CreatedRegistrationSummary) {
    setIsAddOpen(false);
    showToast(
      "success",
      `Đã tạo phiếu ${summary.registrationCode} với ${summary.count} sản phẩm.`,
    );
    setQuery("");
    setDebouncedQuery("");
    setPage(1);
    setRefreshKey((current) => current + 1);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    const target = deleteTarget;
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/rows/${encodeURIComponent(target.rowId)}`,
        { method: "DELETE" },
      );

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      const data = (await response
        .json()
        .catch(() => null)) as DeleteApiResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ?? "Không thể xoá sản phẩm. Vui lòng thử lại.",
        );
      }

      const productLabel =
        target.productName || target.serial || "đã chọn";
      const ticketLabel = target.registrationCode
        ? ` khỏi phiếu ${target.registrationCode}`
        : "";
      setDeleteTarget(null);
      showToast(
        "success",
        `Đã xoá sản phẩm "${productLabel}"${ticketLabel}.`,
      );

      if (rows.length === 1 && meta && meta.page > 1) {
        setPage(meta.page - 1);
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (deleteError) {
      showToast(
        "error",
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xoá sản phẩm. Vui lòng thử lại.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch {
      showToast("error", "Không thể đăng xuất. Vui lòng thử lại.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const rangeStart =
    meta && rows.length > 0 ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const rangeEnd = rangeStart > 0 ? rangeStart + rows.length - 1 : 0;

  const stats: Array<{
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    iconClass: string;
  }> = [
    {
      label: "Tổng sản phẩm",
      value: meta ? meta.total.toLocaleString("vi-VN") : "—",
      hint: "Tất cả dòng sản phẩm trong Google Sheet",
      icon: Package,
      iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    },
    {
      label: "Tổng phiếu",
      value: meta ? meta.registrations.toLocaleString("vi-VN") : "—",
      hint: "Mỗi mã phiếu có thể gồm nhiều sản phẩm",
      icon: FileSpreadsheet,
      iconClass: "bg-sky-50 text-sky-600 ring-sky-100",
    },
    {
      label: "Kết quả lọc",
      value: meta ? meta.filtered.toLocaleString("vi-VN") : "—",
      hint: debouncedQuery
        ? meta
          ? `${meta.filteredRegistrations.toLocaleString("vi-VN")} phiếu khớp từ khoá`
          : "Đang lọc dữ liệu"
        : "Chưa áp dụng bộ lọc",
      icon: Search,
      iconClass: "bg-violet-50 text-violet-600 ring-violet-100",
    },
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand subtitle="Warranty console" />

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                {getInitials(user.name)}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="max-w-[150px] truncate text-xs font-semibold text-slate-800">
                  {user.name}
                </p>
                <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                  {user.role === "admin" ? "Quản trị viên" : "Thành viên"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? "Đang đăng xuất" : "Đăng xuất"}
              className={secondaryButton}
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isLoggingOut ? "Đang thoát..." : "Đăng xuất"}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-emerald-100">
                <ShieldCheck className="h-3 w-3" />
              </span>
              Dữ liệu bảo hành
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Phiếu bảo hành FOTAMI
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Tạo phiếu đăng ký bảo hành cho một hoặc nhiều sản phẩm và tra cứu
              nhanh theo mã phiếu, đại lý, khách hàng hoặc serial.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className={primaryButton}
          >
            <Plus className="h-4 w-4" />
            Tạo phiếu
          </button>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <article
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                      {stat.value}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1",
                      stat.iconClass,
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                </div>
                <p className="mt-3 truncate text-[11px] text-slate-400">
                  {stat.hint}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm mã phiếu, đại lý, khách hàng, serial..."
                aria-label="Tìm kiếm phiếu bảo hành"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-xs text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Xoá từ khoá tìm kiếm"
                  className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={retry}
              disabled={isLoading}
              className={secondaryButton}
            >
              <RefreshCw
                className={cn("h-4 w-4", isLoading && "animate-spin")}
              />
              Làm mới
            </button>
          </div>

          {error && rows.length > 0 && (
            <div className="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={retry}
                className="font-semibold underline underline-offset-2 hover:text-amber-900"
              >
                Thử lại
              </button>
            </div>
          )}

          <div
            className={cn(
              "scrollbar-thin overflow-x-auto transition-opacity",
              isLoading && rows.length > 0 && "opacity-60",
            )}
          >
            <table className="w-full min-w-[1240px] text-left text-sm">
              <caption className="sr-only">
                Danh sách sản phẩm bảo hành trong Google Sheet
              </caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="w-12 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    STT
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Mã phiếu
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Đại lý
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Khách hàng
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Sản phẩm
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Serial
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Bảo hành
                  </th>
                  <th className="hidden px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 xl:table-cell">
                    Ngày bán
                  </th>
                  <th className="w-14 px-4 py-3">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && rows.length === 0 ? (
                  <SkeletonRows />
                ) : error && rows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex flex-col items-center px-6 py-16 text-center">
                        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                          <AlertCircle className="h-6 w-6" />
                        </span>
                        <h3 className="mt-4 text-sm font-semibold text-slate-800">
                          Không tải được dữ liệu
                        </h3>
                        <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                          {error}
                        </p>
                        <button
                          type="button"
                          onClick={retry}
                          className={cn(secondaryButton, "mt-4")}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Thử lại
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex flex-col items-center px-6 py-16 text-center">
                        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                          {debouncedQuery ? (
                            <Search className="h-6 w-6" />
                          ) : (
                            <FileSpreadsheet className="h-6 w-6" />
                          )}
                        </span>
                        <h3 className="mt-4 text-sm font-semibold text-slate-800">
                          {debouncedQuery
                            ? "Không tìm thấy phiếu/sản phẩm"
                            : "Chưa có phiếu bảo hành"}
                        </h3>
                        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                          {debouncedQuery
                            ? `Không có dòng sản phẩm nào khớp với "${debouncedQuery}". Thử từ khoá khác hoặc xoá bộ lọc.`
                            : "Phiếu bảo hành đầu tiên sẽ được ghi vào Google Sheet và hiển thị tại đây."}
                        </p>
                        {debouncedQuery ? (
                          <button
                            type="button"
                            onClick={clearSearch}
                            className={cn(secondaryButton, "mt-4")}
                          >
                            <X className="h-4 w-4" />
                            Xoá tìm kiếm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsAddOpen(true)}
                            className={cn(primaryButton, "mt-4")}
                          >
                            <Plus className="h-4 w-4" />
                            Tạo phiếu đầu tiên
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const canDelete = UUID_RE.test(row.rowId);
                    return (
                      <tr
                        key={row.rowId}
                        className="transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3.5 text-xs tabular-nums text-slate-400">
                          {rangeStart + index}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="whitespace-nowrap font-mono text-xs font-semibold text-slate-800">
                            {row.registrationCode || "—"}
                          </p>
                          <p className="mt-0.5 whitespace-nowrap text-[10px] text-slate-400">
                            {formatDateTime(row.createdAt)}
                          </p>
                        </td>
                        <td
                          className="px-4 py-3.5"
                          title={
                            [
                              row.dealerName,
                              row.dealerCode ? `Mã: ${row.dealerCode}` : "",
                              row.dealerPhone ? `SĐT: ${row.dealerPhone}` : "",
                            ]
                              .filter(Boolean)
                              .join(" · ") || undefined
                          }
                        >
                          <p className="max-w-[200px] truncate text-xs font-semibold text-slate-800">
                            {row.dealerName || "—"}
                          </p>
                          <p className="mt-0.5 max-w-[200px] truncate text-[10px] text-slate-400">
                            {row.dealerCode || "—"}
                            {row.dealerPhone && (
                              <span className="hidden 2xl:inline">
                                {" "}
                                · {row.dealerPhone}
                              </span>
                            )}
                          </p>
                        </td>
                        <td
                          className="px-4 py-3.5"
                          title={row.customerAddress || undefined}
                        >
                          <p className="max-w-[200px] truncate text-xs font-semibold text-slate-800">
                            {row.customerName || "—"}
                          </p>
                          <p className="mt-0.5 max-w-[200px] truncate text-[10px] text-slate-400">
                            {row.customerPhone || "—"}
                          </p>
                        </td>
                        <td
                          className="px-4 py-3.5"
                          title={row.productName || undefined}
                        >
                          <p className="max-w-[220px] truncate text-xs font-semibold text-slate-800">
                            {row.productName || "—"}
                          </p>
                          <p className="mt-0.5 max-w-[220px] truncate text-[10px] text-slate-400">
                            Model: {row.model || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className="block max-w-[180px] truncate font-mono text-[11px] font-medium text-slate-700"
                            title={row.serial || undefined}
                          >
                            {row.serial || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <p className="text-xs font-semibold text-slate-700">
                            {formatWarrantyMonths(row.warrantyMonths)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Giao: {formatDate(row.deliveryDate)}
                          </p>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3.5 text-xs text-slate-500 xl:table-cell">
                          {formatDate(row.saleDate)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            disabled={!canDelete}
                            aria-label={`Xoá sản phẩm ${
                              row.productName || row.serial || "này"
                            }`}
                            title={
                              canDelete
                                ? "Xoá dòng sản phẩm này"
                                : "Dòng sản phẩm thiếu ID nên không thể xoá an toàn"
                            }
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {meta && rows.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-slate-500">
                Hiển thị{" "}
                <span className="font-semibold text-slate-700">
                  {rangeStart}–{rangeEnd}
                </span>{" "}
                trong{" "}
                <span className="font-semibold text-slate-700">
                  {meta.filtered.toLocaleString("vi-VN")}
                </span>{" "}
                dòng sản phẩm
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, meta.page - 1))}
                  disabled={meta.page <= 1 || isLoading}
                  aria-label="Trang trước"
                  className={cn(secondaryButton, "h-8 px-2.5")}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Trước</span>
                </button>

                <span className="min-w-[74px] text-center text-[11px] font-medium tabular-nums text-slate-500">
                  Trang {meta.page} / {meta.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPage(Math.min(meta.totalPages, meta.page + 1))
                  }
                  disabled={meta.page >= meta.totalPages || isLoading}
                  aria-label="Trang sau"
                  className={cn(secondaryButton, "h-8 px-2.5")}
                >
                  <span className="hidden sm:inline">Sau</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-6 flex flex-col gap-2 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Mỗi dòng là một sản phẩm; nhiều sản phẩm cùng phiếu dùng chung mã
            phiếu.
          </p>
          <p>Phiên đăng nhập tự hết hạn sau 8 giờ.</p>
        </footer>
      </main>

      {isAddOpen && (
        <AddWarrantyDialog
          onClose={() => setIsAddOpen(false)}
          onCreated={handleCreated}
        />
      )}

      <DeleteRecordDialog
        record={deleteTarget}
        isDeleting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="animate-pop-in fixed bottom-4 left-4 right-4 z-[60] flex max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl shadow-slate-900/10 sm:left-auto sm:w-[360px]"
        >
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1",
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
                : "bg-red-50 text-red-600 ring-red-100",
            )}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800">
              {toast.type === "success" ? "Thành công" : "Có lỗi"}
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Đóng thông báo"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="border-b border-slate-100 last:border-0">
          <td className="px-4 py-4">
            <div className="h-3 w-5 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-2.5 w-16 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="hidden px-4 py-4 xl:table-cell">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-4 py-4">
            <div className="ml-auto h-7 w-7 animate-pulse rounded-lg bg-slate-100" />
          </td>
        </tr>
      ))}
    </>
  );
}
