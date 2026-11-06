"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  LogOut,
  MapPin,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AddWarrantyDialog } from "@/components/add-warranty-dialog";
import { Brand } from "@/components/brand";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type RowsApiResponse = RowsResponse & { error?: string };
type DeleteApiResponse = { ok?: boolean; id?: string; error?: string };
type RowsMeta = Omit<RowsResponse, "rows">;

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
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);

  function showToast(type: "success" | "error", message: string) {
    if (type === "success") {
      toast.success("Thành công", { description: message });
    } else {
      toast.error("Có lỗi", { description: message });
    }
  }

  function copyToClipboard(text: string, label: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSerial(text);
    showToast("success", `Đã sao chép ${label}: ${text}`);
    setTimeout(() => {
      setCopiedSerial((curr) => (curr === text ? null : curr));
    }, 2000);
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextQuery = query.trim();
      setDebouncedQuery((current) => (current === nextQuery ? current : nextQuery));
      setPage(1);
    }, 350);

    return () => clearTimeout(timeout);
  }, [query]);

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
            data?.error ?? "Không thể tải dữ liệu hóa đơn từ Google Sheets.",
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

  function clearSearch() {
    setQuery("");
    setDebouncedQuery("");
    setPage(1);
  }

  function handleCreated(summary: CreatedRegistrationSummary) {
    setIsAddOpen(false);
    showToast(
      "success",
      `Đã tạo hóa đơn ${summary.registrationCode} với ${summary.count} sản phẩm.`,
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
        ? ` khỏi hóa đơn ${target.registrationCode}`
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
      label: "Tổng hóa đơn",
      value: meta ? meta.registrations.toLocaleString("vi-VN") : "—",
      hint: "Mỗi mã hóa đơn có thể gồm nhiều sản phẩm",
      icon: FileSpreadsheet,
      iconClass: "bg-sky-50 text-sky-600 ring-sky-100",
    },
    {
      label: "Kết quả lọc",
      value: meta ? meta.filtered.toLocaleString("vi-VN") : "—",
      hint: debouncedQuery
        ? meta
          ? `${meta.filteredRegistrations.toLocaleString("vi-VN")} hóa đơn khớp từ khoá`
          : "Đang lọc dữ liệu"
        : "Chưa áp dụng bộ lọc",
      icon: Search,
      iconClass: "bg-violet-50 text-violet-600 ring-violet-100",
    },
  ];

  return (
    <div className="flex min-h-screen min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand subtitle="Quản lý bán hàng" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                aria-label={`Tài khoản ${user.name}`}
                className="h-10 gap-2.5 rounded-full bg-card pl-1.5 pr-3 shadow-sm"
              >
                <Avatar className="size-7 after:border-emerald-200">
                  <AvatarFallback className="bg-emerald-100 text-[10px] font-bold text-emerald-700">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 text-left leading-tight sm:block">
                  <span className="block max-w-[150px] truncate text-xs font-semibold text-foreground">
                    {user.name}
                  </span>
                  <span className="block text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    {user.role === "admin" ? "Quản trị viên" : "Thành viên"}
                  </span>
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold text-foreground">
                  {user.name}
                </p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  @{user.username} ·{" "}
                  {user.role === "admin" ? "Quản trị viên" : "Thành viên"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={isLoggingOut}
                onSelect={() => void handleLogout()}
                className="gap-2"
              >
                {isLoggingOut ? (
                  <Spinner className="size-4" />
                ) : (
                  <LogOut className="size-4" />
                )}
                {isLoggingOut ? "Đang thoát..." : "Đăng xuất"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge
              variant="outline"
              className="h-auto gap-2 rounded-md border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700"
            >
              <ShieldCheck />
              Dữ liệu bán hàng
            </Badge>
            <h1 className="mt-2.5 text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              Hóa đơn bán hàng
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
              Tạo hóa đơn bán hàng cho một hoặc nhiều sản phẩm và tra cứu
              nhanh theo mã hóa đơn, đại lý, khách mua hàng hoặc serial.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="h-10 w-full gap-2 px-4 text-xs font-semibold shadow-sm shadow-emerald-600/20 sm:w-auto"
          >
            <Plus className="size-4" />
            Tạo hóa đơn
          </Button>
        </div>

        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="gap-0 py-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                        {stat.value}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl ring-1",
                        stat.iconClass,
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <p className="mt-3 truncate text-[11px] text-muted-foreground">
                    {stat.hint}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card className="mt-5 gap-0 overflow-hidden py-0 shadow-sm">
          <div className="flex flex-col gap-2.5 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm mã hóa đơn, đại lý, khách mua hàng, serial..."
                aria-label="Tìm kiếm hóa đơn bán hàng"
                className="h-10 bg-card pl-9 pr-9 text-xs shadow-sm [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={clearSearch}
                  aria-label="Xoá từ khoá tìm kiếm"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground active:-translate-y-1/2"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={retry}
              disabled={isLoading}
              className="h-10 w-full gap-2 px-3.5 text-xs font-semibold shadow-sm sm:w-auto"
            >
              {isLoading ? (
                <Spinner className="size-4" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Làm mới
            </Button>
          </div>

          {error && rows.length > 0 && (
            <Alert className="flex items-center gap-2.5 rounded-none border-x-0 border-t-0 border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 [&>svg]:row-span-1 [&>svg]:translate-y-0">
              <AlertCircle className="size-4 shrink-0" />
              <AlertDescription className="flex-1 text-xs leading-5 text-amber-800">
                {error}
              </AlertDescription>
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={retry}
                className="h-auto shrink-0 p-0 text-xs font-semibold text-amber-800"
              >
                Thử lại
              </Button>
            </Alert>
          )}

          <div
            className={cn(
              "scrollbar-thin overflow-x-auto transition-opacity",
              isLoading && rows.length > 0 && "opacity-60",
            )}
          >
            <Table className="min-w-[900px] text-left">
              <TableCaption className="sr-only">
                Danh sách sản phẩm trong hóa đơn bán hàng
              </TableCaption>
              <TableHeader>
                <TableRow className="border-border bg-muted/60 hover:bg-muted/60">
                  <TableHead className="w-12 px-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    #
                  </TableHead>
                  <TableHead className="px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Mã hóa đơn
                  </TableHead>
                  <TableHead className="px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Đại lý
                  </TableHead>
                  <TableHead className="px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Khách mua hàng
                  </TableHead>
                  <TableHead className="px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Sản phẩm & Model
                  </TableHead>
                  <TableHead className="px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Serial (S/N)
                  </TableHead>
                  <TableHead className="px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Bảo hành
                  </TableHead>
                  <TableHead className="px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ngày bán
                  </TableHead>
                  <TableHead className="w-14 px-4 text-right">
                    <span className="sr-only">Thao tác</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && rows.length === 0 ? (
                  <SkeletonRows />
                ) : error && rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="whitespace-normal p-0">
                      <Empty className="rounded-none border-0 py-14">
                        <EmptyHeader>
                          <EmptyMedia
                            variant="icon"
                            className="size-14 rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100 [&_svg]:size-6"
                          >
                            <AlertCircle />
                          </EmptyMedia>
                          <EmptyTitle>Không tải được dữ liệu</EmptyTitle>
                          <EmptyDescription>{error}</EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={retry}
                            className="h-10 gap-2"
                          >
                            <RefreshCw className="size-4" />
                            Thử lại
                          </Button>
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="whitespace-normal p-0">
                      <Empty className="rounded-none border-0 py-14">
                        <EmptyHeader>
                          <EmptyMedia
                            variant="icon"
                            className="size-14 rounded-2xl bg-muted text-muted-foreground [&_svg]:size-6"
                          >
                            {debouncedQuery ? <Search /> : <FileSpreadsheet />}
                          </EmptyMedia>
                          <EmptyTitle>
                            {debouncedQuery
                              ? "Không tìm thấy hóa đơn/sản phẩm"
                              : "Chưa có hóa đơn"}
                          </EmptyTitle>
                          <EmptyDescription>
                            {debouncedQuery
                              ? `Không có dòng sản phẩm nào khớp với "${debouncedQuery}". Thử từ khoá khác hoặc xoá bộ lọc.`
                              : "Hóa đơn đầu tiên sẽ được ghi vào Google Sheet và hiển thị tại đây."}
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          {debouncedQuery ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={clearSearch}
                              className="h-10 gap-2"
                            >
                              <X className="size-4" />
                              Xoá tìm kiếm
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              onClick={() => setIsAddOpen(true)}
                              className="h-10 gap-2"
                            >
                              <Plus className="size-4" />
                              Tạo hóa đơn đầu tiên
                            </Button>
                          )}
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => {
                    const canDelete = UUID_RE.test(row.rowId);
                    const isSerialCopied = copiedSerial === row.serial;
                    return (
                      <TableRow
                        key={row.rowId}
                        className="group border-border/70 transition-colors hover:bg-muted/40"
                      >
                        <TableCell className="px-4 py-4 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                          {rangeStart + index}
                        </TableCell>

                        {/* Mã hóa đơn */}
                        <TableCell className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-foreground">
                              {row.registrationCode || "—"}
                            </span>
                            {row.registrationCode && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() =>
                                  copyToClipboard(row.registrationCode, "mã hóa đơn")
                                }
                                title="Sao chép mã hóa đơn"
                                className="text-muted-foreground opacity-60 transition group-hover:opacity-100"
                              >
                                <Copy className="size-3.5" />
                              </Button>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(row.createdAt)}
                          </p>
                        </TableCell>

                        {/* Đại lý */}
                        <TableCell
                          className="whitespace-normal px-4 py-4"
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
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm font-semibold text-foreground">
                              {row.dealerName || "—"}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {row.dealerCode && (
                              <Badge
                                variant="secondary"
                                className="h-auto rounded px-1.5 py-0.5 font-mono text-xs font-medium"
                              >
                                {row.dealerCode}
                              </Badge>
                            )}
                            {row.dealerPhone && (
                              <span className="inline-flex items-center gap-1 font-medium">
                                <Phone className="size-3" />
                                0{row.dealerPhone}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Khách hàng */}
                        <TableCell
                          className="whitespace-normal px-4 py-4"
                          title={row.customerAddress || undefined}
                        >
                          <div className="flex items-center gap-2">
                            <User className="size-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm font-semibold text-foreground">
                              {row.customerName || "—"}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {row.customerPhone && (
                              <span className="inline-flex items-center gap-1 font-medium">
                                <Phone className="size-3" />
                                0{row.customerPhone}
                              </span>
                            )}
                            {row.customerAddress &&
                              row.customerAddress !== "-" && (
                                <span
                                  className="inline-flex max-w-[180px] items-center gap-1 truncate text-xs"
                                  title={row.customerAddress}
                                >
                                  <MapPin className="size-3 shrink-0" />
                                  {row.customerAddress}
                                </span>
                              )}
                          </div>
                        </TableCell>

                        {/* Sản phẩm & Model */}
                        <TableCell
                          className="whitespace-normal px-4 py-4"
                          title={row.productName || undefined}
                        >
                          <div className="flex items-center gap-2">
                            <Package className="size-4 shrink-0 text-emerald-600" />
                            <span className="text-sm font-semibold text-foreground">
                              {row.productName || "—"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Model:{" "}
                            <span className="font-medium text-foreground">
                              {row.model || "—"}
                            </span>
                          </p>
                        </TableCell>

                        {/* Serial */}
                        <TableCell className="px-4 py-4">
                          {row.serial && row.serial !== "-" ? (
                            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2.5 py-1 font-mono text-xs font-semibold text-foreground shadow-2xs">
                              <span>{row.serial}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() =>
                                  copyToClipboard(row.serial, "mã serial")
                                }
                                title="Sao chép Serial"
                                className="text-muted-foreground hover:bg-muted hover:text-emerald-700"
                              >
                                {isSerialCopied ? (
                                  <Check className="size-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Bảo hành */}
                        <TableCell className="whitespace-nowrap px-4 py-4">
                          <Badge
                            variant="outline"
                            className="h-auto gap-1.5 rounded-full border-emerald-600/20 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                          >
                            <ShieldCheck className="text-emerald-600" />
                            {formatWarrantyMonths(row.warrantyMonths)}
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Giao: {formatDate(row.deliveryDate)}
                          </p>
                        </TableCell>

                        {/* Ngày bán */}
                        <TableCell className="whitespace-nowrap px-4 py-4 text-xs text-foreground">
                          <div className="flex items-center gap-1.5 font-medium">
                            <CalendarDays className="size-3.5 text-muted-foreground" />
                            {formatDate(row.saleDate)}
                          </div>
                        </TableCell>

                        {/* Thao tác */}
                        <TableCell className="px-4 py-4 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
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
                            className="text-muted-foreground opacity-60 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {meta && rows.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <p className="text-center text-xs text-muted-foreground sm:text-left">
                Hiển thị{" "}
                <span className="font-semibold text-foreground">
                  {rangeStart}–{rangeEnd}
                </span>{" "}
                trong{" "}
                <span className="font-semibold text-foreground">
                  {meta.filtered.toLocaleString("vi-VN")}
                </span>{" "}
                dòng sản phẩm
              </p>

              <Pagination
                aria-label="Phân trang hóa đơn"
                className="mx-auto w-auto sm:mx-0"
              >
                <PaginationContent className="gap-2">
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, meta.page - 1))}
                      disabled={meta.page <= 1 || isLoading}
                      aria-label="Trang trước"
                      className="h-9 gap-1 px-3 text-xs font-semibold"
                    >
                      <ChevronLeft className="size-4" />
                      <span>Trước</span>
                    </Button>
                  </PaginationItem>

                  <PaginationItem>
                    <span className="min-w-[80px] text-center text-xs font-semibold tabular-nums text-muted-foreground">
                      Trang {meta.page} / {meta.totalPages}
                    </span>
                  </PaginationItem>

                  <PaginationItem>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage(Math.min(meta.totalPages, meta.page + 1))
                      }
                      disabled={meta.page >= meta.totalPages || isLoading}
                      aria-label="Trang sau"
                      className="h-9 gap-1 px-3 text-xs font-semibold"
                    >
                      <span>Sau</span>
                      <ChevronRight className="size-4" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>

        <footer className="mt-6 flex flex-col gap-2 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            Mỗi dòng là một sản phẩm; nhiều sản phẩm cùng hóa đơn dùng chung mã
            hóa đơn.
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
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index} className="border-border/70 hover:bg-transparent">
          <TableCell className="px-4 py-4">
            <Skeleton className="h-3 w-5" />
          </TableCell>
          <TableCell className="px-4 py-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-2.5 w-20" />
          </TableCell>
          <TableCell className="px-4 py-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2 h-2.5 w-20" />
          </TableCell>
          <TableCell className="px-4 py-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-2.5 w-24" />
          </TableCell>
          <TableCell className="px-4 py-4">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="mt-2 h-2.5 w-16" />
          </TableCell>
          <TableCell className="px-4 py-4">
            <Skeleton className="h-3 w-24" />
          </TableCell>
          <TableCell className="px-4 py-4">
            <Skeleton className="h-3 w-20" />
          </TableCell>
          <TableCell className="hidden px-4 py-4 xl:table-cell">
            <Skeleton className="h-3 w-20" />
          </TableCell>
          <TableCell className="px-4 py-4">
            <Skeleton className="ml-auto size-7 rounded-lg" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
