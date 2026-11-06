import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "FOTAMI Care",
  title: {
    default: "FOTAMI Care – Phiếu đăng ký bảo hành",
    template: "%s | FOTAMI Care",
  },
  description:
    "Bảng điều khiển nội bộ để tạo, xem và xoá phiếu đăng ký bảo hành FOTAMI trên Google Sheets.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: một số extension trình duyệt (Bitdefender,
    // ColorZilla, trình dịch...) chèn attribute vào <html>/<body> trước khi
    // React hydrate. Cảnh báo còn lại ở phần tử con là do extension, không
    // phải lỗi app; tắt extension hoặc dùng cửa sổ ẩn danh khi dev.
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
