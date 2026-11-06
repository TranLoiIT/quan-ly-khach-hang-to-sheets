"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen min-h-dvh place-items-center bg-background px-4 py-8">
      <Card className="w-full max-w-md gap-0 p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
          <AlertCircle className="size-6" />
        </span>
        <h1 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
          Đã có lỗi xảy ra
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Trang không thể tải đúng. Hãy thử lại. Nếu lỗi tiếp tục xuất hiện,
          kiểm tra log trên Vercel hoặc cấu hình Google Sheets.
        </p>
        {error.digest && (
          <p className="mt-3 text-[10px] text-muted-foreground">
            Mã lỗi: {error.digest}
          </p>
        )}
        <Button
          type="button"
          onClick={reset}
          className="mt-6 h-10 gap-2 self-center px-4 text-sm font-semibold"
        >
          <RotateCcw className="size-4" />
          Thử lại
        </Button>
      </Card>
    </main>
  );
}
