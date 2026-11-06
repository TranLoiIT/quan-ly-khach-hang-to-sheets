"use client";

import { useEffect, useRef } from "react";

/**
 * Khoá scroll nền + đóng dialog bằng Escape.
 * Việc đóng bị chặn khi blocked = true (ví dụ đang lưu/xoá).
 */
export function useDialogBehavior(
  open: boolean,
  onClose: () => void,
  blocked = false,
): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !blocked) {
        onCloseRef.current();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, blocked]);
}
