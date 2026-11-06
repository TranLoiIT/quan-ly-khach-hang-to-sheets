"use client";

import { AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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

  return (
    <AlertDialog
      open={Boolean(record)}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      {record && (
        <AlertDialogContent className="data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-md sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle />
            </AlertDialogMedia>
            <AlertDialogTitle>Xoá sản phẩm này?</AlertDialogTitle>
            <AlertDialogDescription>
              Dòng sản phẩm sẽ bị xoá khỏi Google Sheet. Hành động này không
              thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="overflow-hidden rounded-xl border border-border bg-muted/50">
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Sản phẩm
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {record.productName || "(Chưa có tên sản phẩm)"}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                {record.model || "—"}
                {record.serial ? ` · S/N: ${record.serial}` : ""}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-4 py-3 text-[11px]">
              <div className="min-w-0">
                <dt className="font-medium text-muted-foreground">
                  Mã hóa đơn
                </dt>
                <dd className="mt-0.5 truncate font-mono font-semibold text-foreground">
                  {record.registrationCode || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-muted-foreground">
                  Khách mua hàng
                </dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">
                  {record.customerName || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-muted-foreground">Ngày bán</dt>
                <dd className="mt-0.5 text-foreground">
                  {formatDate(record.saleDate)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-muted-foreground">Bảo hành</dt>
                <dd className="mt-0.5 text-foreground">
                  {formatWarrantyMonths(record.warrantyMonths)}
                </dd>
              </div>
            </dl>
          </div>

          <Alert className="gap-2.5 border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-800">
            <ShieldCheck className="mt-0.5" />
            <AlertDescription className="text-[11px] leading-5 text-amber-800">
              Chỉ dòng sản phẩm này bị xoá khỏi Google Sheet. Các sản phẩm khác
              cùng mã hóa đơn vẫn được giữ lại.
            </AlertDescription>
          </Alert>

          <AlertDialogFooter className="flex-col sm:flex-row">
            <AlertDialogCancel
              disabled={isDeleting}
              onClick={handleClose}
              className="h-10 flex-1 sm:flex-initial"
            >
              Giữ lại
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
              className="h-10 flex-1 gap-2 bg-destructive text-white hover:bg-destructive/90 sm:flex-initial"
            >
              {isDeleting ? (
                <>
                  <Spinner className="size-4" />
                  Đang xoá...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Xoá sản phẩm
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
