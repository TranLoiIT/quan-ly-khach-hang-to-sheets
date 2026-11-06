import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Đăng nhập",
};

function safeNext(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/dashboard";
  }
  if (candidate.includes("\\") || candidate.startsWith("/login")) {
    return "/dashboard";
  }
  return candidate;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-slate-950 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(16,185,129,0.2),transparent_34%),radial-gradient(circle_at_88%_92%,rgba(20,184,166,0.12),transparent_36%)]" />
      <div className="bg-grid-emerald pointer-events-none absolute inset-0 opacity-50" />

      <div className="relative mx-auto flex min-h-[calc(100dvh-3rem)] max-w-5xl items-center justify-center sm:min-h-[calc(100dvh-4rem)]">
        <div className="grid w-full overflow-hidden rounded-[26px] border border-white/10 bg-white shadow-2xl shadow-black/40 lg:grid-cols-[1.02fr_0.98fr]">
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#042f26] p-10 lg:flex xl:p-12">
            <div className="bg-grid-emerald pointer-events-none absolute inset-0 opacity-60" />
            <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />

            <div className="relative">
              <Brand
                tone="onDark"
                subtitle="Không gian bán hàng FOTAMI"
              />

              <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Quản lý bán hàng
              </div>

              <h1 className="mt-5 max-w-sm text-[2.15rem] font-bold leading-[1.15] tracking-tight text-white">
                Hóa đơn bán hàng, gọn trong một màn hình.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-emerald-100/60">
                Tạo hóa đơn với một hoặc nhiều sản phẩm, tra cứu serial và xoá
                dòng trực tiếp trên Google Sheets — không cần mở spreadsheet.
              </p>

              <ul className="mt-8 space-y-4">
                <li className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/10">
                    <span className="text-sm font-bold">1</span>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-emerald-50">
                      Một hóa đơn, nhiều sản phẩm
                    </p>
                    <p className="text-[11px] text-emerald-100/45">
                      Mặc định 1 dòng, thêm sản phẩm khi cần
                    </p>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/10">
                    <span className="text-sm font-bold">2</span>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-emerald-50">
                      Kiểm tra đầy đủ trước khi lưu
                    </p>
                    <p className="text-[11px] text-emerald-100/45">
                      Bắt buộc thông tin đại lý, khách mua hàng, sản phẩm
                    </p>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/10">
                    <span className="text-sm font-bold">3</span>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-emerald-50">
                      Mỗi sản phẩm là một dòng Sheet
                    </p>
                    <p className="text-[11px] text-emerald-100/45">
                      Dễ tra cứu theo serial và xoá từng dòng
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* <div className="relative mt-12">
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/55">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Hóa đơn gần đây
                  </div>
                  <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-medium text-emerald-100/45">
                    Sheet1
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    ["Máy lọc nước FOTAMI A1", "BH-20261106-4F2A", "FT2026000123"],
                    ["Cây nước nóng lạnh", "BH-20261106-8C1D", "FT2026000456"],
                    ["Máy lọc nước FOTAMI S3", "BH-20261105-2B7E", "FT2026000789"],
                  ].map(([product, code, serial]) => (
                    <div
                      key={serial}
                      className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-200">
                        <span className="text-[10px] font-bold">SN</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-emerald-50/90">
                          {product}
                        </p>
                        <p className="truncate text-[10px] text-emerald-100/40">
                          {serial} · {code}
                        </p>
                      </div>
                      <span className="text-[10px] text-emerald-100/25">
                        •••
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-5 flex items-center gap-2 text-[10px] text-emerald-100/35">
                <ShieldCheck className="h-3.5 w-3.5" />
                Phiên HttpOnly · mật khẩu bcrypt · không lưu plaintext
              </p>
            </div> */}
          </aside>

          <section className="relative flex flex-col justify-center bg-white p-7 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-[380px]">
              <div className="lg:hidden">
                <Brand subtitle="Quản lý bán hàng FOTAMI" />
              </div>

              <div className="mt-8 lg:mt-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                  Welcome back
                </p>
                <h2 className="mt-3 text-[1.85rem] font-bold tracking-tight text-slate-900">
                  Đăng nhập
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Sử dụng tài khoản nội bộ được quản trị viên cấp để truy cập
                  hóa đơn bán hàng.
                </p>
              </div>

              <LoginForm nextPath={nextPath} />

              <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[11px] leading-5 text-slate-500">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-500">
                  i
                </span>
                <span>
                  Quên mật khẩu? Liên hệ quản trị viên để được cấp lại. Tài
                  khoản được quản lý trong file cấu hình JSON của server.
                </span>
              </div>

              <p className="mt-6 text-center text-[10px] text-slate-400">
                © {new Date().getFullYear()} FOTAMI Care · Internal use only
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
