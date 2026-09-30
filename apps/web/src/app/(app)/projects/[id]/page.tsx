"use client";

import { useParams } from "next/navigation";
import { useProject } from "@/lib/projects";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { AvatarGroup } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TaskBoard } from "@/components/project/task-board";
import { RequirementsTab } from "@/components/project/requirements-tab";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: project, isLoading, isError, refetch } = useProject(params.id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ErrorState description="We couldn't load this project." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title={project.name}
        description={project.client.name}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status} />
            <StatusBadge status={project.health.status} />
          </div>
        }
      />

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Health</p>
              <p className="mt-1 text-sm text-text-primary">{project.health.reason}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-text-muted">Contract value</p>
                <p className="mt-1 text-lg font-semibold text-text-primary">
                  {formatCurrency(project.contractValue)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-text-muted">Target end date</p>
                <p className="mt-1 text-lg font-semibold text-text-primary">{formatDate(project.targetEndDate)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-text-muted">Team</p>
                <div className="mt-2">
                  <AvatarGroup people={project.members.map((m) => ({ name: m.user.fullName, imageUrl: m.user.avatarUrl }))} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Milestones</h3>
            {project.milestones.length === 0 ? (
              <EmptyState title="No milestones yet" />
            ) : (
              <div className="space-y-2">
                {project.milestones.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="flex items-center justify-between py-3">
                      <span className="text-sm text-text-primary">{m.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-text-muted">Due {formatDate(m.dueDate)}</span>
                        <StatusBadge status={m.status} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Deliverables</h3>
            {project.deliverables.length === 0 ? (
              <EmptyState title="No deliverables yet" />
            ) : (
              <div className="space-y-2">
                {project.deliverables.map((d) => (
                  <Card key={d.id}>
                    <CardContent className="flex items-center justify-between py-3">
                      <span className="text-sm text-text-primary">{d.name}</span>
                      <StatusBadge status={d.status} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TaskBoard projectId={project.id} />
        </TabsContent>

        <TabsContent value="requirements" className="mt-4">
          <RequirementsTab projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
