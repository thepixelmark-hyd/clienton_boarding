"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usePortalProject } from "@/lib/portal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

/**
 * The client-facing project dashboard (see architecture.md "Client portal").
 * Deliberately narrower than the internal project detail page: no task
 * titles unless a task is explicitly CLIENT_VISIBLE, no phases/activity/
 * workload — just what a client needs to answer "how is my project going,
 * and what (if anything) is waiting on me." Every number here comes from
 * ProjectsService.getPortalDetail's real aggregates, same "no fake
 * dashboard statistics" rule as the internal dashboard.
 */
export default function PortalProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = usePortalProject(params.id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ErrorState description="We couldn't load this project." onRetry={() => refetch()} />
      </div>
    );
  }

  const { project, health, milestones, deliverables, visibleTasks, progress, waitingOnYou } = data;
  const progressPct = progress.totalTasks === 0 ? 0 : Math.round((progress.doneTasks / progress.totalTasks) * 100);
  const waitingCount = waitingOnYou.deliverablesInReview.length + waitingOnYou.openRequirementCount;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/portal/projects")}>
        <ArrowLeft className="h-3.5 w-3.5" /> All projects
      </Button>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">{project.name}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          <StatusBadge status={health.status} />
        </div>
      </div>
      {project.description && <p className="mt-1 text-sm text-text-secondary">{project.description}</p>}

      <Card className="mt-4">
        <CardContent className="py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Status</p>
          <p className="mt-1 text-sm text-text-primary">{health.reason}</p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Progress</p>
            <p className="text-xs text-text-muted">
              {progress.doneTasks} of {progress.totalTasks} tasks complete
            </p>
          </div>
          <Progress value={progressPct} className="mt-2" variant="success" />
        </CardContent>
      </Card>

      {waitingCount > 0 && (
        <Card className="mt-4 border-warning/40">
          <CardContent className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-warning">Waiting on you</p>
            <ul className="mt-2 space-y-1.5 text-sm text-text-primary">
              {waitingOnYou.deliverablesInReview.map((d) => (
                <li key={d.id}>&ldquo;{d.name}&rdquo; is ready for your review.</li>
              ))}
              {waitingOnYou.openRequirementCount > 0 && (
                <li>
                  {waitingOnYou.openRequirementCount} requirement{waitingOnYou.openRequirementCount === 1 ? "" : "s"} still
                  need{waitingOnYou.openRequirementCount === 1 ? "s" : ""} your input.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-text-secondary">Milestones</h2>
        {milestones.length === 0 ? (
          <p className="text-sm text-text-muted">No milestones yet.</p>
        ) : (
          <div className="space-y-2">
            {milestones.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <span className="text-sm text-text-primary">{m.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">{m.dueDate ? `Due ${formatDate(m.dueDate)}` : ""}</span>
                    <StatusBadge status={m.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-text-secondary">Deliverables</h2>
        {deliverables.length === 0 ? (
          <EmptyState title="No deliverables yet" />
        ) : (
          <div className="space-y-2">
            {deliverables.map((d) => (
              <Card key={d.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <span className="text-sm text-text-primary">{d.name}</span>
                  <div className="flex items-center gap-3">
                    {d.dueDate && <span className="text-xs text-text-muted">Due {formatDate(d.dueDate)}</span>}
                    <StatusBadge status={d.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {visibleTasks.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-text-secondary">Shared with you</h2>
          <div className="space-y-2">
            {visibleTasks.map((t) => (
              <Card key={t.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <span className="text-sm text-text-primary">{t.title}</span>
                  <div className="flex items-center gap-3">
                    {t.dueDate && <span className="text-xs text-text-muted">Due {formatDate(t.dueDate)}</span>}
                    <StatusBadge status={t.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
