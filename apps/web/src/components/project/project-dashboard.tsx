"use client";

import { AlertTriangle, CheckCircle2, Clock, MessageSquareWarning } from "lucide-react";
import { useProjectDashboard } from "@/lib/projects";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const { data: dashboard, isLoading, isError, refetch } = useProjectDashboard(projectId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !dashboard) {
    return <ErrorState description="We couldn't load the project dashboard." onRetry={() => refetch()} />;
  }

  const {
    health,
    taskStatusBreakdown,
    totalTasks,
    overdueTasks,
    upcomingMilestones,
    deliverableStatusBreakdown,
    waitingOnClient,
    recentActivity,
  } = dashboard;

  const totalDeliverables = Object.values(deliverableStatusBreakdown).reduce((sum, n) => sum + n, 0);
  const waitingOnClientTotal = waitingOnClient.tasks.length + waitingOnClient.openRequirementCount;
  const activityPreview = recentActivity.slice(0, 5);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Health</p>
          <div className="mt-1.5">
            <StatusBadge status={health.status} />
          </div>
          <p className="mt-1.5 text-sm text-text-primary">{health.reason}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-text-muted">Total tasks</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{totalTasks}</p>
            <StatusBreakdown breakdown={taskStatusBreakdown} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-text-muted">Overdue tasks</p>
            <p
              className={`mt-1 text-lg font-semibold ${overdueTasks.length > 0 ? "text-danger" : "text-text-primary"}`}
            >
              {overdueTasks.length}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {overdueTasks.length > 0 ? "Need attention" : "Nothing overdue"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-text-muted">Deliverables</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{totalDeliverables}</p>
            <StatusBreakdown breakdown={deliverableStatusBreakdown} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-text-muted">Waiting on client</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{waitingOnClientTotal}</p>
            <p className="mt-2 text-xs text-text-muted">
              {waitingOnClient.tasks.length} task{waitingOnClient.tasks.length === 1 ? "" : "s"} ·{" "}
              {waitingOnClient.openRequirementCount} requirement{waitingOnClient.openRequirementCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      </div>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Overdue
        </h3>
        {overdueTasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-text-muted">
            Nothing overdue — nice.
          </p>
        ) : (
          <div className="space-y-2">
            {overdueTasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <span className="text-sm text-text-primary">{task.title}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-danger">Due {formatDate(task.dueDate)}</span>
                    <span className="text-xs text-text-muted">{task.assignee?.fullName ?? "Unassigned"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Upcoming milestones
        </h3>
        {upcomingMilestones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-text-muted">
            No upcoming milestones.
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingMilestones.map((milestone) => (
              <Card key={milestone.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <span className="text-sm text-text-primary">{milestone.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">Due {formatDate(milestone.dueDate)}</span>
                    <StatusBadge status={milestone.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
          <MessageSquareWarning className="h-3.5 w-3.5" aria-hidden /> Waiting on client
        </h3>
        {waitingOnClient.tasks.length === 0 && waitingOnClient.openRequirementCount === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-text-muted">
            Nothing is waiting on the client right now.
          </p>
        ) : (
          <div className="space-y-2">
            {waitingOnClient.tasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">{task.title}</span>
                    {task.dueDate && <span className="text-xs text-text-muted">Due {formatDate(task.dueDate)}</span>}
                  </div>
                  {task.waitingOnClientNote && (
                    <p className="mt-1 text-xs text-text-muted">{task.waitingOnClientNote}</p>
                  )}
                </CardContent>
              </Card>
            ))}
            {waitingOnClient.openRequirementCount > 0 && (
              <p className="px-1 text-xs text-text-muted">
                {waitingOnClient.openRequirementCount} requirement{waitingOnClient.openRequirementCount === 1 ? "" : "s"} still
                need{waitingOnClient.openRequirementCount === 1 ? "s" : ""} client input.
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Recent activity
        </h3>
        {activityPreview.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-text-muted">
            No activity recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {activityPreview.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <span className="text-sm text-text-primary">{item.title}</span>
                  <span className="text-xs text-text-muted">{formatDate(item.occurredAt)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-text-muted">See the Activity tab for the full history.</p>
      </section>
    </div>
  );
}

function StatusBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      {entries.map(([status, count]) => (
        <span key={status} className="inline-flex items-center gap-1">
          <StatusBadge status={status} />
          <span className="text-xs text-text-muted">{count}</span>
        </span>
      ))}
    </div>
  );
}
