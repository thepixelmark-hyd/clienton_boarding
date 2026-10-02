"use client";

import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { usePortalProjects } from "@/lib/portal";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export default function PortalProjectsPage() {
  const router = useRouter();
  const { data: projects, isLoading, isError, refetch } = usePortalProjects();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="text-xl font-semibold text-text-primary">Your projects</h1>

      <div className="mt-6">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : isError ? (
          <ErrorState description="We couldn't load your projects." onRetry={() => refetch()} />
        ) : !projects || projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects yet" description="Projects your agency starts with you will appear here." />
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-colors hover:border-border-strong"
                onClick={() => router.push(`/portal/projects/${project.id}`)}
              >
                <CardContent className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{project.name}</p>
                    <p className="text-xs text-text-muted">
                      {project.startDate ? `Started ${formatDate(project.startDate)}` : "Not started yet"}
                      {project.targetEndDate ? ` · Target ${formatDate(project.targetEndDate)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={project.status} />
                    <StatusBadge status={project.health.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
