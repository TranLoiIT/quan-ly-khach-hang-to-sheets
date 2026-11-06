"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Hash,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { CreatedRegistrationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  emptyProductValues,
  emptyWarrantyFormValues,
  MAX_PRODUCTS_PER_TICKET,
  type ProductFormValues,
  type WarrantyFormValues,
} from "@/lib/warranty";
import { fieldErrorsFromZod, productInputSchema, warrantyInputSchema } from "@/lib/validation";

type CreateResponse = {
  ok?: boolean;
  registrationCode?: string;
  count?: number;
  error?: string;
  fields?: Record<string, string>;
};

type TopFieldKey = Exclude<keyof WarrantyFormValues, "products">;

const VALIDATION_SUMMARY =
  "Vui lòng nhập đầy đủ các trường bắt buộc trước khi lưu hóa đơn.";

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

  function clearValidationSummary() {
    setFormError((current) =>
      current === VALIDATION_SUMMARY ? null : current,
    );
  }

  function setFieldError(key: string, message?: string) {
    setErrors((current) => {
      const next = { ...current };
      if (message) {
        next[key] = message;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  function validateTopFieldValue(key: TopFieldKey, value: string) {
    const result = warrantyInputSchema.shape[key].safeParse(value);
    setFieldError(
      key,
      result.success ? undefined : result.error.issues[0]?.message,
    );
  }

  function validateTopField(key: TopFieldKey) {
    validateTopFieldValue(key, values[key]);
  }

  function validateProductFieldValue(
    index: number,
    key: keyof ProductFormValues,
    value: string,
  ) {
    const result = productInputSchema.shape[key].safeParse(value);
    setFieldError(
      `products.${index}.${key}`,
      result.success ? undefined : result.error.issues[0]?.message,
    );
  }

  function validateProductField(
    index: number,
    key: keyof ProductFormValues,
  ) {
    validateProductFieldValue(index, key, values.products[index][key]);
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
    validateTopFieldValue(key, value);
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
    validateProductFieldValue(index, key, value);
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
          "Không thể lưu hóa đơn lúc này. Vui lòng thử lại.",
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="flex shrink-0 flex-row items-start justify-between gap-3 space-y-0 border-b border-border px-4 py-4 text-left sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 sm:size-10">
              <BadgeCheck className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
                Tạo hóa đơn bán hàng
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                Mỗi sản phẩm sẽ được ghi thành một dòng trong Google Sheet.
                Mã hóa đơn được tạo tự động sau khi lưu.
              </DialogDescription>
            </div>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              disabled={isSaving}
              aria-label="Đóng"
              className="shrink-0 text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-busy={isSaving}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <FieldSet
              disabled={isSaving}
              className="m-0 min-w-0 gap-6 border-0 p-0"
            >
              {formError && (
                <Alert
                  variant="destructive"
                  className="border-red-200 bg-red-50 text-red-700"
                >
                  <AlertCircle />
                  <AlertDescription className="text-xs leading-5 text-red-700">
                    {formError}
                  </AlertDescription>
                </Alert>
              )}

              <Section
                icon={Store}
                title="Thông tin đại lý"
                description="Thông tin đơn vị bán hàng."
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
                  onBlur={() => validateTopField("dealerName")}
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
                  onBlur={() => validateTopField("dealerCode")}
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
                  onBlur={() => validateTopField("dealerPhone")}
                />
              </Section>

              <Section
                icon={UserRound}
                title="Thông tin khách mua hàng"
                description="Người mua và nhận sản phẩm."
              >
                <TextField
                  id="warranty-customerName"
                  label="Họ và tên khách mua hàng"
                  value={values.customerName}
                  onChange={(value) => updateTopField("customerName", value)}
                  placeholder="VD: Nguyễn Văn A"
                  maxLength={150}
                  required
                  error={errors.customerName}
                  autoComplete="name"
                  onBlur={() => validateTopField("customerName")}
                />
                <TextField
                  id="warranty-customerPhone"
                  label="Số điện thoại khách mua hàng"
                  type="tel"
                  value={values.customerPhone}
                  onChange={(value) => updateTopField("customerPhone", value)}
                  placeholder="VD: 0901 234 567"
                  maxLength={30}
                  required
                  error={errors.customerPhone}
                  autoComplete="tel"
                  icon={Phone}
                  onBlur={() => validateTopField("customerPhone")}
                />
                <TextareaField
                  id="warranty-customerAddress"
                  label="Địa chỉ khách mua hàng"
                  value={values.customerAddress}
                  onChange={(value) => updateTopField("customerAddress", value)}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                  maxLength={300}
                  error={errors.customerAddress}
                  className="sm:col-span-2"
                  optional
                  icon={MapPin}
                  autoComplete="street-address"
                  onBlur={() => validateTopField("customerAddress")}
                />
              </Section>

              <Section
                icon={ShieldCheck}
                title="Thông tin bán hàng"
                description="Mốc thời gian áp dụng cho toàn bộ sản phẩm trong hóa đơn."
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
                  onBlur={() => validateTopField("deliveryDate")}
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
                  onBlur={() => validateTopField("warrantyMonths")}
                />
              </Section>

              <div id="warranty-products-section" className="scroll-mt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                      <Package className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold tracking-tight text-foreground">
                        Sản phẩm bán
                      </h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Mặc định 1 sản phẩm. Thêm tối đa{" "}
                        {MAX_PRODUCTS_PER_TICKET} sản phẩm cho mỗi hóa đơn.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addProduct}
                    disabled={
                      isSaving ||
                      values.products.length >= MAX_PRODUCTS_PER_TICKET
                    }
                    title={
                      values.products.length >= MAX_PRODUCTS_PER_TICKET
                        ? `Mỗi hóa đơn chỉ hỗ trợ tối đa ${MAX_PRODUCTS_PER_TICKET} sản phẩm`
                        : "Thêm một dòng sản phẩm"
                    }
                    className="h-9 gap-1.5 border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                  >
                    <Plus className="size-3.5" />
                    Thêm sản phẩm
                  </Button>
                </div>

                {errors.products && (
                  <FieldError className="mt-3 text-xs">
                    {errors.products}
                  </FieldError>
                )}

                <FieldGroup className="mt-4 gap-3">
                  {values.products.map((product, index) => (
                    <Card
                      key={index}
                      className="gap-3 bg-muted/40 p-4 shadow-none"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
                          <Badge
                            variant="secondary"
                            className="size-6 justify-center rounded-lg p-0 text-[10px] font-bold text-muted-foreground"
                          >
                            {index + 1}
                          </Badge>
                          Sản phẩm {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProduct(index)}
                          disabled={isSaving || values.products.length <= 1}
                          aria-label={`Xoá sản phẩm ${index + 1}`}
                          title={
                            values.products.length <= 1
                              ? "Hóa đơn phải có ít nhất 1 sản phẩm"
                              : "Xoá sản phẩm này"
                          }
                          className="gap-1.5 text-[11px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          Xoá
                        </Button>
                      </div>

                      <FieldGroup className="grid gap-3 sm:grid-cols-2">
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
                          onBlur={() =>
                            validateProductField(index, "productName")
                          }
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
                          onBlur={() => validateProductField(index, "model")}
                        />
                        <TextField
                          id={`warranty-product-${index}-serial`}
                          label="Serial (S/N)"
                          value={product.serial}
                          onChange={(value) =>
                            updateProduct(index, "serial", value)
                          }
                          placeholder="Không bắt buộc"
                          maxLength={100}
                          optional
                          error={errors[`products.${index}.serial`]}
                          autoComplete="off"
                          onBlur={() => validateProductField(index, "serial")}
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
                          onBlur={() => validateProductField(index, "saleDate")}
                        />
                      </FieldGroup>
                    </Card>
                  ))}
                </FieldGroup>
              </div>
            </FieldSet>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 flex-col-reverse gap-2.5 rounded-none border-t border-border bg-muted/50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs">
              <span className="font-semibold text-foreground/70">Lưu ý:</span>{" "}
              dấu <span className="text-red-500">*</span> là bắt buộc.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSaving}
                className="h-10 flex-1 px-4 text-sm font-medium sm:flex-initial"
              >
                Huỷ
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="h-10 flex-1 gap-2 px-4 text-sm font-semibold shadow-sm shadow-emerald-600/20 sm:flex-initial"
              >
                {isSaving ? (
                  <>
                    <Spinner className="size-4" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <BadgeCheck className="size-4" />
                    Lưu hóa đơn ({values.products.length})
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <Icon className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <FieldGroup className="mt-4 grid gap-3 sm:grid-cols-2">
        {children}
      </FieldGroup>
    </section>
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
  onBlur,
  icon: Icon,
  suffix,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
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
    <Field
      data-invalid={Boolean(error)}
      className={cn("gap-1.5", className)}
    >
      <FieldLabel
        htmlFor={id}
        className={cn(
          "gap-1 text-xs font-semibold text-slate-700",
          error && "text-destructive",
        )}
      >
        {label}
        {required ? (
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        ) : optional ? (
          <span className="font-normal text-muted-foreground">(tùy chọn)</span>
        ) : null}
      </FieldLabel>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
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
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-11 bg-card text-base text-foreground shadow-sm sm:text-sm",
            Icon && "pl-10",
            suffix && "pr-16",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      <FieldError id={errorId} className="text-xs">
        {error}
      </FieldError>
    </Field>
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
  onBlur,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
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
    <Field
      data-invalid={Boolean(error)}
      className={cn("gap-1.5", className)}
    >
      <FieldLabel
        htmlFor={id}
        className={cn(
          "gap-1 text-xs font-semibold text-slate-700",
          error && "text-destructive",
        )}
      >
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">(tùy chọn)</span>
        ) : null}
      </FieldLabel>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-muted-foreground" />
        )}
        <Textarea
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          autoComplete={autoComplete}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "min-h-[84px] resize-y bg-card py-3 text-base text-foreground sm:text-sm",
            Icon && "pl-10",
          )}
        />
      </div>
      <FieldError id={errorId} className="text-xs">
        {error}
      </FieldError>
    </Field>
  );
}
