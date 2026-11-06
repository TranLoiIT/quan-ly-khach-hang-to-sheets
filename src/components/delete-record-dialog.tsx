"use client";

import { AlertTriangle, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import { useDialogBehavior } from "@/components/use-dialog-behavior";
import type { WarrantyRecord } from "@/lib/types";
import { formatDate, formatWarrantyMonths } from "@/lib/utils";

export function DeleteRecordDialog({
  record,
  isDeleting,
  onClose,
  onConfirm,
}: {
  record: WarrantyRecord | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  function handleClose() {
    if (!isDeleting) onClose();
  }

  useDialogBehavior(Boolean(record), handleClose, isDeleting);

  if (!record) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-record-title"
        aria-describedby="delete-record-description"
        className="animate-pop-in w-full max-w-md rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            aria-label="Đóng"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-5 pt-4">
          <h2
            id="delete-record-title"
            className="text-base font-semibold tracking-tight text-slate-900"
          >
            Xoá sản phẩm này?
          </h2>
          <p
            id="delete-record-description"
            className="mt-1.5 text-sm leading-6 text-slate-500"
          >
            Dòng sản phẩm sẽ bị xoá khỏi Google Sheet. Hành động này không thể
            hoàn tác.
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Sản phẩm
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                {record.productName || "(Chưa có tên sản phẩm)"}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                {record.model || "—"}
                {record.serial ? ` · S/N: ${record.serial}` : ""}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-200 px-4 py-3 text-[11px]">
              <div className="min-w-0">
                <dt className="font-medium text-slate-400">Mã phiếu</dt>
                <dd className="mt-0.5 truncate font-mono font-semibold text-slate-700">
                  {record.registrationCode || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-slate-400">Khách hàng</dt>
                <dd className="mt-0.5 truncate font-medium text-slate-700">
                  {record.customerName || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-slate-400">Ngày bán</dt>
                <dd className="mt-0.5 text-slate-700">
                  {formatDate(record.saleDate)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-slate-400">Bảo hành</dt>
                <dd className="mt-0.5 text-slate-700">
                  {formatWarrantyMonths(record.warrantyMonths)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] leading-5 text-amber-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Chỉ dòng sản phẩm này bị xoá khỏi Google Sheet. Các sản phẩm khác
              cùng mã phiếu vẫn được giữ lại.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Giữ lại
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm shadow-red-600/20 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang xoá...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Xoá sản phẩm
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
