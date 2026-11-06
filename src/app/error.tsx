"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
          <AlertCircle className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-lg font-semibold tracking-tight text-slate-900">
          Đã có lỗi xảy ra
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Trang không thể tải đúng. Hãy thử lại. Nếu lỗi tiếp tục xuất hiện,
          kiểm tra log trên Vercel hoặc cấu hình Google Sheets.
        </p>
        {error.digest && (
          <p className="mt-3 text-[10px] text-slate-400">
            Mã lỗi: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-4 w-4" />
          Thử lại
        </button>
      </div>
    </main>
  );
}
