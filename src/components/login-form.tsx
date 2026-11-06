"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  User,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type LoginApiResponse = {
  ok?: boolean;
  error?: string;
  fields?: Record<string, string>;
};

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!username.trim() || !password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as LoginApiResponse | null;

      if (!response.ok) {
        if (data?.fields) setFieldErrors(data.fields);
        setError(
          data?.error ??
            "Không thể đăng nhập lúc này. Vui lòng thử lại sau.",
        );
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError(
        "Không kết nối được tới server. Kiểm tra kết nối mạng rồi thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8" noValidate>
      <FieldGroup className="gap-5">
        {error && (
          <Alert
            variant="destructive"
            className="border-red-200 bg-red-50 text-red-700"
          >
            <AlertCircle />
            <AlertDescription className="text-xs leading-5 text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <Field
          data-invalid={Boolean(fieldErrors.username)}
          className="gap-1.5"
        >
          <FieldLabel
            htmlFor="username"
            className={cn(
              "text-xs font-semibold text-slate-700",
              fieldErrors.username && "text-red-600",
            )}
          >
            Tên đăng nhập
          </FieldLabel>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                if (fieldErrors.username) {
                  setFieldErrors((current) => ({ ...current, username: "" }));
                }
              }}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={
                fieldErrors.username ? "username-error" : undefined
              }
              placeholder="vd: admin"
              className={cn(
                "h-11 bg-white pl-10 text-foreground shadow-sm",
                fieldErrors.username && "border-red-300",
              )}
            />
          </div>
          <FieldError id="username-error" className="text-xs">
            {fieldErrors.username}
          </FieldError>
        </Field>

        <Field
          data-invalid={Boolean(fieldErrors.password)}
          className="gap-1.5"
        >
          <FieldLabel
            htmlFor="password"
            className={cn(
              "text-xs font-semibold text-slate-700",
              fieldErrors.password && "text-red-600",
            )}
          >
            Mật khẩu
          </FieldLabel>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((current) => ({ ...current, password: "" }));
                }
              }}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
              placeholder="Nhập mật khẩu"
              className={cn(
                "h-11 bg-white pl-10 pr-11 text-foreground shadow-sm",
                fieldErrors.password && "border-red-300",
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:-translate-y-1/2"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <FieldError id="password-error" className="text-xs">
            {fieldErrors.password}
          </FieldError>
        </Field>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="group h-11 w-full gap-2 text-sm font-semibold shadow-sm shadow-emerald-600/20"
        >
          {isSubmitting ? (
            <>
              <Spinner className="h-4 w-4" />
              Đang đăng nhập...
            </>
          ) : (
            <>
              Đăng nhập
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
