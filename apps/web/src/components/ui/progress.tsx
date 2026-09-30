import { cn } from "@/lib/utils";

export function Progress({ value, className, variant = "accent" }: { value: number; className?: string; variant?: "accent" | "success" | "warning" | "danger" }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary", className)}>
      <div
        className={cn("h-full rounded-full transition-all", {
          "bg-accent": variant === "accent",
          "bg-success": variant === "success",
          "bg-warning": variant === "warning",
          "bg-danger": variant === "danger",
        })}
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
