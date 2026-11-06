"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Hash,
  Loader2,
  MapPin,
  Package,
  Phone,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useDialogBehavior } from "@/components/use-dialog-behavior";
import type { CreatedRegistrationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  emptyProductValues,
  emptyWarrantyFormValues,
  MAX_PRODUCTS_PER_TICKET,
  type ProductFormValues,
  type WarrantyFormValues,
} from "@/lib/warranty";
import { fieldErrorsFromZod, warrantyInputSchema } from "@/lib/validation";

type CreateResponse = {
  ok?: boolean;
  registrationCode?: string;
  count?: number;
  error?: string;
  fields?: Record<string, string>;
};

type TopFieldKey = Exclude<keyof WarrantyFormValues, "products">;

const VALIDATION_SUMMARY =
  "Vui lòng nhập đầy đủ các trường bắt buộc trước khi lưu phiếu.";

const inputBase =
  "w-full rounded-xl border bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50";

function inputClass(hasError: boolean): string {
  return cn(
    inputBase,
    "h-11",
    hasError
      ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
      : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/10",
  );
}

function fieldElementId(key: string): string {
  if (key.startsWith("products.")) {
    const [, index, field] = key.split(".");
    return `warranty-product-${index}-${field}`;
  }
  if (key === "products") return "warranty-products-section";
  return `warranty-${key}`;
}

export function AddWarrantyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (summary: CreatedRegistrationSummary) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<WarrantyFormValues>(
    emptyWarrantyFormValues,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handleClose() {
    if (!isSaving) onClose();
  }

  useDialogBehavior(true, handleClose, isSaving);

  function clearError(key: string) {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function clearValidationSummary() {
    setFormError((current) =>
      current === VALIDATION_SUMMARY ? null : current,
    );
  }

  function focusField(key: string) {
    window.setTimeout(() => {
      const element = document.getElementById(fieldElementId(key));
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (element instanceof HTMLElement) element.focus({ preventScroll: true });
    }, 60);
  }

  function clearProductErrors() {
    setErrors((current) => {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(current)) {
        if (key !== "products" && !key.startsWith("products.")) {
          next[key] = value;
        }
      }
      return next;
    });
  }

  function updateTopField(key: TopFieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    clearError(key);
    clearValidationSummary();
  }

  function updateProduct(
    index: number,
    key: keyof ProductFormValues,
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      products: current.products.map((product, productIndex) =>
        productIndex === index ? { ...product, [key]: value } : product,
      ),
    }));
    clearError(`products.${index}.${key}`);
    clearValidationSummary();
  }

  function addProduct() {
    if (values.products.length >= MAX_PRODUCTS_PER_TICKET) return;
    setValues((current) => ({
      ...current,
      products: [...current.products, emptyProductValues()],
    }));
    clearProductErrors();
    clearValidationSummary();
  }

  function removeProduct(index: number) {
    if (values.products.length <= 1) return;
    setValues((current) => ({
      ...current,
      products: current.products.filter(
        (_, productIndex) => productIndex !== index,
      ),
    }));
    clearProductErrors();
    clearValidationSummary();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const parsed = warrantyInputSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors = fieldErrorsFromZod(parsed.error);
      setErrors(nextErrors);
      setFormError(VALIDATION_SUMMARY);

      const firstKey = Object.keys(nextErrors)[0];
      if (firstKey) focusField(firstKey);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const response = await fetch("/api/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }

      const data = (await response
        .json()
        .catch(() => null)) as CreateResponse | null;

      if (
        !response.ok ||
        !data?.registrationCode ||
        typeof data.count !== "number"
      ) {
        const serverFields = data?.fields ?? {};
        setErrors(serverFields);
        setFormError(
          data?.error ??
            "Không thể lưu phiếu bảo hành lúc này. Vui lòng thử lại.",
        );

        const firstServerKey = Object.keys(serverFields)[0];
        if (firstServerKey) focusField(firstServerKey);
        return;
      }

      onCreated({
        registrationCode: data.registrationCode,
        count: data.count,
      });
    } catch {
      setFormError(
        "Không kết nối được tới server. Kiểm tra kết nối mạng rồi thử lại.",
      );
    } finally {
      setIsSaving(false);
    }
  }

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
        aria-labelledby="add-warranty-title"
        aria-describedby="add-warranty-description"
        className="animate-pop-in flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="add-warranty-title"
                className="text-base font-semibold tracking-tight text-slate-900"
              >
                Tạo phiếu đăng ký bảo hành
              </h2>
              <p id="add-warranty-description" className="mt-0.5 text-xs text-slate-500">
                Mỗi sản phẩm sẽ được ghi thành một dòng trong Google Sheet.
                Mã phiếu được tạo tự động sau khi lưu.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Đóng"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-busy={isSaving}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <fieldset
              disabled={isSaving}
              className="m-0 min-w-0 space-y-6 border-0 p-0"
            >
              {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <Section
              icon={Store}
              title="Thông tin đại lý"
              description="Thông tin đơn vị bán và bảo hành sản phẩm."
            >
              <TextField
                id="warranty-dealerName"
                label="Tên đại lý"
                value={values.dealerName}
                onChange={(value) => updateTopField("dealerName", value)}
                placeholder="VD: Đại lý FOTAMI Hà Nội"
                maxLength={150}
                required
                autoFocus
                error={errors.dealerName}
                autoComplete="organization"
              />
              <TextField
                id="warranty-dealerCode"
                label="Mã đại lý"
                value={values.dealerCode}
                onChange={(value) => updateTopField("dealerCode", value)}
                placeholder="VD: DL-HN-001"
                maxLength={50}
                required
                error={errors.dealerCode}
                icon={Hash}
                autoComplete="off"
              />
              <TextField
                id="warranty-dealerPhone"
                label="Số điện thoại đại lý"
                type="tel"
                value={values.dealerPhone}
                onChange={(value) => updateTopField("dealerPhone", value)}
                placeholder="VD: 0901 234 567"
                maxLength={30}
                required
                error={errors.dealerPhone}
                autoComplete="tel"
                icon={Phone}
              />
            </Section>

            <Section
              icon={UserRound}
              title="Thông tin khách hàng"
              description="Người nhận sản phẩm và được hưởng bảo hành."
            >
              <TextField
                id="warranty-customerName"
                label="Họ và tên khách hàng"
                value={values.customerName}
                onChange={(value) => updateTopField("customerName", value)}
                placeholder="VD: Nguyễn Văn A"
                maxLength={150}
                required
                error={errors.customerName}
                autoComplete="name"
              />
              <TextField
                id="warranty-customerPhone"
                label="Số điện thoại khách hàng"
                type="tel"
                value={values.customerPhone}
                onChange={(value) => updateTopField("customerPhone", value)}
                placeholder="VD: 0901 234 567"
                maxLength={30}
                required
                error={errors.customerPhone}
                autoComplete="tel"
                icon={Phone}
              />
              <TextareaField
                id="warranty-customerAddress"
                label="Địa chỉ khách hàng"
                value={values.customerAddress}
                onChange={(value) => updateTopField("customerAddress", value)}
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                maxLength={300}
                error={errors.customerAddress}
                className="sm:col-span-2"
                optional
                icon={MapPin}
                autoComplete="street-address"
              />
            </Section>

            <Section
              icon={ShieldCheck}
              title="Thông tin bảo hành"
              description="Mốc thời gian áp dụng cho toàn bộ sản phẩm trong phiếu."
            >
              <TextField
                id="warranty-deliveryDate"
                label="Ngày giao hàng/lắp đặt"
                type="date"
                value={values.deliveryDate}
                onChange={(value) => updateTopField("deliveryDate", value)}
                maxLength={10}
                required
                error={errors.deliveryDate}
                icon={CalendarDays}
              />
              <TextField
                id="warranty-warrantyMonths"
                label="Thời hạn bảo hành"
                type="number"
                value={values.warrantyMonths}
                onChange={(value) => updateTopField("warrantyMonths", value)}
                placeholder="12"
                maxLength={3}
                min={1}
                max={120}
                required
                error={errors.warrantyMonths}
                suffix="tháng"
              />
            </Section>

            <div id="warranty-products-section" className="scroll-mt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                    <Package className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                      Sản phẩm bảo hành
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Mặc định 1 sản phẩm. Thêm tối đa{" "}
                      {MAX_PRODUCTS_PER_TICKET} sản phẩm cho mỗi phiếu.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addProduct}
                  disabled={
                    isSaving ||
                    values.products.length >= MAX_PRODUCTS_PER_TICKET
                  }
                  title={
                    values.products.length >= MAX_PRODUCTS_PER_TICKET
                      ? `Mỗi phiếu chỉ hỗ trợ tối đa ${MAX_PRODUCTS_PER_TICKET} sản phẩm`
                      : "Thêm một dòng sản phẩm"
                  }
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm sản phẩm
                </button>
              </div>

              {errors.products && (
                <p className="mt-3 text-xs text-red-600">{errors.products}</p>
              )}

              <div className="mt-4 space-y-3">
                {values.products.map((product, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <span className="grid h-6 w-6 place-items-center rounded-lg bg-white text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                          {index + 1}
                        </span>
                        Sản phẩm {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeProduct(index)}
                        disabled={isSaving || values.products.length <= 1}
                        aria-label={`Xoá sản phẩm ${index + 1}`}
                        title={
                          values.products.length <= 1
                            ? "Phiếu phải có ít nhất 1 sản phẩm"
                            : "Xoá sản phẩm này"
                        }
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xoá
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField
                        id={`warranty-product-${index}-productName`}
                        label="Tên sản phẩm"
                        value={product.productName}
                        onChange={(value) =>
                          updateProduct(index, "productName", value)
                        }
                        placeholder="VD: Máy lọc nước FOTAMI A1"
                        maxLength={150}
                        required
                        error={errors[`products.${index}.productName`]}
                        className="sm:col-span-2"
                      />
                      <TextField
                        id={`warranty-product-${index}-model`}
                        label="Model"
                        value={product.model}
                        onChange={(value) =>
                          updateProduct(index, "model", value)
                        }
                        placeholder="VD: FTM-A1"
                        maxLength={100}
                        required
                        error={errors[`products.${index}.model`]}
                        autoComplete="off"
                      />
                      <TextField
                        id={`warranty-product-${index}-serial`}
                        label="Serial (S/N)"
                        value={product.serial}
                        onChange={(value) =>
                          updateProduct(index, "serial", value)
                        }
                        placeholder="VD: FT2026000123"
                        maxLength={100}
                        required
                        error={errors[`products.${index}.serial`]}
                        autoComplete="off"
                      />
                      <TextField
                        id={`warranty-product-${index}-saleDate`}
                        label="Ngày bán"
                        type="date"
                        value={product.saleDate}
                        onChange={(value) =>
                          updateProduct(index, "saleDate", value)
                        }
                        maxLength={10}
                        required
                        error={errors[`products.${index}.saleDate`]}
                        className="sm:col-span-2"
                        icon={CalendarDays}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </fieldset>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-[10px] leading-4 text-slate-400">
              <span className="font-semibold text-slate-500">Lưu ý:</span> dấu{" "}
              <span className="text-red-500">*</span> là trường bắt buộc. Phiếu
              chỉ được gửi khi tất cả thông tin bắt buộc đã hợp lệ.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <BadgeCheck className="h-4 w-4" />
                    Lưu phiếu ({values.products.length} sản phẩm)
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required,
  optional,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-1 text-xs font-semibold text-slate-700"
    >
      {label}
      {required ? (
        <span className="text-red-500" aria-hidden="true">
          *
        </span>
      ) : optional ? (
        <span className="font-normal text-slate-400">(tùy chọn)</span>
      ) : null}
    </label>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  min,
  max,
  required,
  optional,
  error,
  autoComplete,
  autoFocus,
  icon: Icon,
  suffix,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "tel" | "date" | "number";
  maxLength?: number;
  min?: number;
  max?: number;
  required?: boolean;
  optional?: boolean;
  error?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  icon?: LucideIcon;
  suffix?: string;
  className?: string;
}) {
  const errorId = `${id}-error`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <FieldLabel
        htmlFor={id}
        label={label}
        required={required}
        optional={optional}
      />
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        )}
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          min={min}
          max={max}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            inputClass(Boolean(error)),
            Icon && "pl-10",
            suffix && "pr-16",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function TextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  error,
  optional,
  icon: Icon,
  autoComplete,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  error?: string;
  optional?: boolean;
  icon?: LucideIcon;
  autoComplete?: string;
  className?: string;
}) {
  const errorId = `${id}-error`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
        )}
        <textarea
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            inputBase,
            "min-h-[84px] resize-y py-3",
            Icon && "pl-10",
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
              : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/10",
          )}
        />
      </div>
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
