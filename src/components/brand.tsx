import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "onDark";
}) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
        tone === "onDark"
          ? "bg-white/10 text-emerald-100 ring-1 ring-white/15 backdrop-blur"
          : "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25",
        className,
      )}
    >
      <FileSpreadsheet className="h-5 w-5" strokeWidth={2.2} />
    </span>
  );
}

export function Brand({
  className,
  tone = "default",
  subtitle,
}: {
  className?: string;
  tone?: "default" | "onDark";
  subtitle?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark tone={tone} />
      <div className="min-w-0">
        <p
          className={cn(
            "text-[15px] font-bold tracking-tight",
            tone === "onDark" ? "text-white" : "text-slate-900",
          )}
        >
          FOTAMI Care
        </p>
        <p
          className={cn(
            "truncate text-[11px]",
            tone === "onDark" ? "text-emerald-100/60" : "text-slate-400",
          )}
        >
          {subtitle ?? "Warranty console"}
        </p>
      </div>
    </div>
  );
}
