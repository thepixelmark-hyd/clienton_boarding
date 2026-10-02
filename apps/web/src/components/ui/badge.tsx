import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-surface-secondary text-text-secondary",
        accent: "bg-accent/10 text-accent",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        danger: "bg-danger/10 text-danger",
        info: "bg-info/10 text-info",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Semantic status dot + label — used for task/project/approval states so the
 * same status always reads the same way across the app (docs/design-system.md). */
const STATUS_CONFIG: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  TODO: { label: "To do", variant: "neutral" },
  IN_PROGRESS: { label: "In progress", variant: "info" },
  IN_REVIEW: { label: "In review", variant: "warning" },
  BLOCKED: { label: "Blocked", variant: "danger" },
  DONE: { label: "Done", variant: "success" },
  PLANNING: { label: "Planning", variant: "neutral" },
  ACTIVE: { label: "Active", variant: "info" },
  ON_HOLD: { label: "On hold", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "danger" },
  HEALTHY: { label: "Healthy", variant: "success" },
  WATCH: { label: "Watch", variant: "warning" },
  AT_RISK: { label: "At risk", variant: "warning" },
  CRITICAL: { label: "Critical", variant: "danger" },
  MISSING: { label: "Missing info", variant: "danger" },
  NEEDS_CLARIFICATION: { label: "Needs clarification", variant: "warning" },
  READY: { label: "Ready", variant: "success" },
  CONFLICTING: { label: "Conflicting", variant: "danger" },
  DRAFT: { label: "Draft", variant: "neutral" },
  SUBMITTED: { label: "Submitted", variant: "info" },
  DECISION_MAKER: { label: "Decision maker", variant: "accent" },
  CHAMPION: { label: "Champion", variant: "accent" },
  INFLUENCER: { label: "Influencer", variant: "neutral" },
  TECHNICAL_CONTACT: { label: "Technical contact", variant: "info" },
  END_USER: { label: "End user", variant: "neutral" },
  LEGAL: { label: "Legal", variant: "neutral" },
  APPROVER: { label: "Approver", variant: "accent" },
  OTHER: { label: "Other", variant: "neutral" },
  BILLING: { label: "Billing contact", variant: "neutral" },
  NOT_STARTED: { label: "Not started", variant: "neutral" },
  PENDING: { label: "Pending", variant: "neutral" },
  SKIPPED: { label: "Skipped", variant: "neutral" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  EXPIRED: { label: "Expired", variant: "neutral" },
  REVOKED: { label: "Revoked", variant: "danger" },
  CLIENT_ADMIN: { label: "Client admin", variant: "accent" },
  CLIENT_MANAGER: { label: "Client manager", variant: "accent" },
  STAKEHOLDER: { label: "Stakeholder", variant: "neutral" },
  VIEWER: { label: "Viewer", variant: "neutral" },
  BILLING_CONTACT: { label: "Billing contact", variant: "neutral" },
  APPROVED: { label: "Approved", variant: "success" },
  DELIVERED: { label: "Delivered", variant: "success" },
  MISSED: { label: "Missed", variant: "danger" },
  LEAD: { label: "Lead", variant: "accent" },
  CONTRIBUTOR: { label: "Contributor", variant: "neutral" },
  OBSERVER: { label: "Observer", variant: "neutral" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "neutral" as const };
  return (
    <Badge variant={config.variant} className={className}>
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-text-muted": config.variant === "neutral",
          "bg-accent": config.variant === "accent",
          "bg-success": config.variant === "success",
          "bg-warning": config.variant === "warning",
          "bg-danger": config.variant === "danger",
          "bg-info": config.variant === "info",
        })}
      />
      {config.label}
    </Badge>
  );
}
