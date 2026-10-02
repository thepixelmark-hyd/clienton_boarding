"use client";

import { Activity } from "lucide-react";
import { useProjectActivity } from "@/lib/projects";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { cn, formatDate } from "@/lib/utils";

const TYPE_DOT: Record<string, string> = {
  PROJECT_CREATED: "bg-accent",
  PROJECT_STATUS_CHANGED: "bg-info",
  PROJECT_TEMPLATE_INSTANTIATED: "bg-accent",
  PHASE_CREATED: "bg-accent",
  MILESTONE_CREATED: "bg-accent",
  MILESTONE_COMPLETED: "bg-success",
  MEMBER_ADDED: "bg-info",
  MEMBER_REMOVED: "bg-danger",
  TASK_CREATED: "bg-accent",
  TASK_STATUS_CHANGED: "bg-info",
  TASK_COMMENT_ADDED: "bg-text-muted",
  DELIVERABLE_CREATED: "bg-accent",
  DELIVERABLE_STATUS_CHANGED: "bg-info",
  REQUIREMENT_LINKED: "bg-accent",
};

export function ProjectActivity({ projectId }: { projectId: string }) {
  const { data: activity, isLoading, isError, refetch } = useProjectActivity(projectId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !activity) {
    return <ErrorState description="We couldn't load this project's activity." onRetry={() => refetch()} />;
  }

  if (activity.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Activity will show up here as this project moves — status changes, tasks, milestones and more."
      />
    );
  }

  return (
    <div className="space-y-2">
      {activity.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex items-start gap-3 py-3.5">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", TYPE_DOT[item.type] ?? "bg-text-muted")} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-text-primary">{item.title}</p>
                <span className="shrink-0 text-xs text-text-muted">{formatDate(item.occurredAt)}</span>
              </div>
              {item.description && <p className="mt-1 text-xs text-text-muted">{item.description}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
