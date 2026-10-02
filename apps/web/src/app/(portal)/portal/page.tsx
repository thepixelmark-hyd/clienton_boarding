"use client";

import { useRouter } from "next/navigation";
import { LogOut, CheckCircle2, Circle, FileText, FolderKanban } from "lucide-react";
import { usePortalMe, usePortalLogout, usePortalOnboarding, usePortalProjects, usePortalRequirements } from "@/lib/portal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function PortalDashboardPage() {
  const router = useRouter();
  const { data: me, isLoading: loadingMe } = usePortalMe();
  const { data: projects, isLoading: loadingProjects } = usePortalProjects();
  const { data: onboarding, isLoading: loadingOnboarding } = usePortalOnboarding();
  const { data: requirements, isLoading: loadingRequirements } = usePortalRequirements();
  const logout = usePortalLogout();

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => router.push("/portal/login") });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Client portal</p>
          <h1 className="text-xl font-semibold text-text-primary">{loadingMe ? "…" : me?.client.name}</h1>
        </div>
        <Button size="sm" variant="ghost" onClick={handleLogout} loading={logout.isPending}>
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </Button>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-text-secondary">Projects</h2>
        {loadingProjects ? (
          <Skeleton className="h-24 w-full" />
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
                    <p className="text-xs text-text-muted">{project.health.reason}</p>
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
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-text-secondary">Onboarding</h2>
        {loadingOnboarding ? (
          <Skeleton className="h-24 w-full" />
        ) : !onboarding || onboarding.length === 0 ? (
          <p className="text-sm text-text-muted">Your onboarding checklist hasn&apos;t started yet.</p>
        ) : (
          <div className="space-y-2">
            {onboarding.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center gap-3 py-3">
                  {item.status === "DONE" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-text-muted" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm ${item.status === "DONE" ? "text-text-muted line-through" : "text-text-primary"}`}>
                      {item.title}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-text-secondary">Requirement forms</h2>
        {loadingRequirements ? (
          <Skeleton className="h-32 w-full" />
        ) : !requirements || requirements.length === 0 ? (
          <EmptyState icon={FileText} title="Nothing assigned yet" description="Forms your agency assigns to you will appear here." />
        ) : (
          <div className="space-y-2">
            {requirements.map((r) => (
              <Card
                key={r.id}
                className="cursor-pointer transition-colors hover:border-border-strong"
                onClick={() => router.push(`/portal/requirements/${r.form.id}/${r.id}`)}
              >
                <CardContent className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{r.form.name}</p>
                    <p className="text-xs text-text-muted">{r.status === "DRAFT" ? "Not yet submitted" : "Submitted"}</p>
                  </div>
                  <StatusBadge status={r.requirement?.readiness ?? r.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
