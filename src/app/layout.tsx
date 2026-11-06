import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://fotamicare.vn"
  ),
  applicationName: "FOTAMI Care",
  title: {
    default: "FOTAMI Care – Hệ Thống Quản Lý Bán Hàng & Hóa Đơn Bảo Hành",
    template: "%s | FOTAMI Care",
  },
  description:
    "Phần mềm quản lý bán hàng và theo dõi hóa đơn, kích hoạt bảo hành điện tử chính hãng FOTAMI đồng bộ tự động trực tiếp với Google Sheets.",
  keywords: [
    "FOTAMI",
    "FOTAMI Care",
    "quản lý bán hàng",
    "quản lý khách hàng",
    "hóa đơn bán hàng",
    "bảo hành điện tử",
    "tra cứu serial",
    "google sheets",
  ],
  authors: [{ name: "FOTAMI Care" }],
  creator: "FOTAMI",
  publisher: "FOTAMI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "/",
    siteName: "FOTAMI Care",
    title: "FOTAMI Care – Hệ Thống Quản Lý Bán Hàng & Hóa Đơn",
    description:
      "Nền tảng quản lý bán hàng, tạo và tra cứu hóa đơn, theo dõi serial và bảo hành FOTAMI tiện lợi trên Google Sheets.",
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "FOTAMI Care Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "FOTAMI Care – Quản Lý Bán Hàng & Hóa Đơn",
    description:
      "Quản lý hóa đơn bán hàng và dữ liệu khách hàng FOTAMI tiện lợi, đồng bộ trực tiếp Google Sheets.",
    images: ["/icon.svg"],
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        {process.env.NODE_ENV !== "production" && (
          <Script id="strip-extension-dom-attrs" strategy="beforeInteractive">
            {`
              (function () {
                function strip(root) {
                  if (!root || root.nodeType !== 1) return;
                  if (root.hasAttribute("bis_skin_checked")) root.removeAttribute("bis_skin_checked");
                  if (root.hasAttribute("bis_register")) root.removeAttribute("bis_register");
                  var rootAttrs = root.attributes;
                  for (var i = rootAttrs.length - 1; i >= 0; i--) {
                    if (rootAttrs[i].name.indexOf("__processed_") === 0) {
                      root.removeAttribute(rootAttrs[i].name);
                    }
                  }
                  if (root.querySelectorAll) {
                    var nodes = root.querySelectorAll("*");
                    for (var j = 0; j < nodes.length; j++) {
                      var el = nodes[j];
                      if (el.hasAttribute("bis_skin_checked")) el.removeAttribute("bis_skin_checked");
                      if (el.hasAttribute("bis_register")) el.removeAttribute("bis_register");
                      var attrs = el.attributes;
                      for (var k = attrs.length - 1; k >= 0; k--) {
                        if (attrs[k].name.indexOf("__processed_") === 0) {
                          el.removeAttribute(attrs[k].name);
                        }
                      }
                    }
                  }
                }
                function start() {
                  strip(document.documentElement);
                  var observer = new MutationObserver(function (mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var mutation = mutations[i];
                      if (mutation.type === "attributes") {
                        var name = mutation.attributeName || "";
                        if (
                          name === "bis_skin_checked" ||
                          name === "bis_register" ||
                          name.indexOf("__processed_") === 0
                        ) {
                          mutation.target.removeAttribute(name);
                        }
                      } else {
                        for (var j = 0; j < mutation.addedNodes.length; j++) {
                          if (mutation.addedNodes[j].nodeType === 1) {
                            strip(mutation.addedNodes[j]);
                          }
                        }
                      }
                    }
                  });
                  observer.observe(document.documentElement, {
                    subtree: true,
                    childList: true,
                    attributes: true
                  });
                }
                if (document.readyState === "loading") {
                  document.addEventListener("DOMContentLoaded", start);
                } else {
                  start();
                }
              })();
            `}
          </Script>
        )}
        {children}
      </body>
    </html>
  );
}
