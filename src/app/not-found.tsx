import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <FileQuestion className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-lg font-semibold tracking-tight text-slate-900">
          Không tìm thấy trang
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Đường dẫn không tồn tại hoặc đã được di chuyển.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Về bảng điều khiển
        </Link>
      </div>
    </main>
  );
}
