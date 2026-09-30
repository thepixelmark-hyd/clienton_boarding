"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, FolderKanban } from "lucide-react";
import { useMe } from "@/lib/auth";
import { useProjects } from "@/lib/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data: projects, isLoading } = useProjects();

  const needsAttention = (projects?.data ?? []).filter((p) => p.health.status !== "HEALTHY");
  const firstName = me?.fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader title={firstName ? `Welcome back, ${firstName}` : "Welcome back"} description="Here's what needs your attention today." />

      <section className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Needs attention</h2>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : needsAttention.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-6 text-sm text-text-secondary">
              Every project is healthy. Nothing is overdue or blocked right now.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {needsAttention.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="transition-colors hover:border-border-strong">
                  <CardContent className="flex items-center gap-4 py-4">
                    <AlertTriangle
                      className={
                        project.health.status === "CRITICAL" || project.health.status === "BLOCKED"
                          ? "h-4 w-4 shrink-0 text-danger"
                          : "h-4 w-4 shrink-0 text-warning"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{project.name}</p>
                      <p className="truncate text-sm text-text-secondary">{project.health.reason}</p>
                    </div>
                    <StatusBadge status={project.health.status} />
                    <ArrowRight className="h-4 w-4 shrink-0 text-text-muted" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Your projects</h2>
          <Link href="/projects" className="text-sm font-medium text-accent hover:underline">
            View all
          </Link>
        </div>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (projects?.data.length ?? 0) === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Projects created for this organization will appear here."
            action={
              <Link href="/projects" className="text-sm font-medium text-accent hover:underline">
                Create your first project
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(projects?.data ?? []).slice(0, 4).map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full transition-colors hover:border-border-strong">
                  <CardContent className="py-4">
                    <p className="text-xs text-text-muted">{project.client.name}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-text-primary">{project.name}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge status={project.status} />
                      <StatusBadge status={project.health.status} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
