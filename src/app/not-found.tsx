import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="grid min-h-screen min-h-dvh place-items-center bg-background px-4 py-8">
      <Card className="w-full max-w-md gap-0 p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <FileQuestion className="size-6" />
        </span>
        <h1 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
          Không tìm thấy trang
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Đường dẫn không tồn tại hoặc đã được di chuyển.
        </p>
        <Button
          asChild
          className="mt-6 h-10 gap-2 self-center px-4 text-sm font-semibold"
        >
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Về bảng điều khiển
          </Link>
        </Button>
      </Card>
    </main>
  );
}
