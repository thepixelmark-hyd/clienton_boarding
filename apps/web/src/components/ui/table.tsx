import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  // tabIndex makes the scroll container itself reachable by keyboard when
  // the table is wider than its viewport (narrow screens) — without it, a
  // keyboard-only user has no way to scroll a horizontally-overflowing
  // table at all (WCAG 2.1.1 "scrollable-region-focusable").
  return (
    <div className="w-full overflow-auto" tabIndex={0}>
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-border", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableRow({
  className,
  clickable,
  onClick,
  onKeyDown,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }) {
  // A clickable row with only an onClick handler is a keyboard dead end — it
  // can't be reached with Tab and nothing happens on Enter/Space, which
  // fails WCAG 2.1.1 (every table-driven list in the app uses this
  // component for row navigation, so the fix belongs here once rather than
  // at each call site). Mirrors the row/card click pattern already used in
  // the onboarding checklist and task board for the same reason.
  const interactive = clickable && onClick;
  return (
    <tr
      className={cn("transition-colors", clickable && "cursor-pointer hover:bg-surface-secondary/60", className)}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.(e as unknown as React.MouseEvent<HTMLTableRowElement>);
        }
        onKeyDown?.(e);
      }}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("h-9 px-4 text-left align-middle text-xs font-medium text-text-muted", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle text-text-primary", className)} {...props} />;
}
