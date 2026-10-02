import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, onClick, onKeyDown, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Across the app, a whole Card is commonly used as a row-level navigation
  // target (`<Card onClick={() => router.push(...)}>`) — the click handler
  // alone makes it mouse-only: unreachable with Tab and inert on Enter/
  // Space, the same WCAG 2.1.1 gap TableRow had. Since `onClick` on a plain
  // `<div>` is never meaningful for anything *but* this "the whole card is
  // a button" pattern, applying the fix whenever `onClick` is present (no
  // separate `clickable` prop to remember to pass) fixes every existing and
  // future call site for free.
  const interactive = Boolean(onClick);
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface shadow-subtle", className)}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
        onKeyDown?.(e);
      }}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between border-b border-border px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-text-primary", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}
