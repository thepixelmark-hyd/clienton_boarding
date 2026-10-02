"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { useProject } from "@/lib/projects";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { AvatarGroup } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { TaskBoard } from "@/components/project/task-board";
import { TaskList } from "@/components/project/task-list";
import { RequirementsTab } from "@/components/project/requirements-tab";
import { PhasesTab } from "@/components/project/phases-tab";
import { DeliverablesTab } from "@/components/project/deliverables-tab";
import { MembersTab } from "@/components/project/members-tab";
import { ProjectTimeline } from "@/components/project/project-timeline";
import { ProjectCalendar } from "@/components/project/project-calendar";
import { ProjectWorkload } from "@/components/project/project-workload";
import { ProjectActivity } from "@/components/project/project-activity";
import { ProjectDashboard } from "@/components/project/project-dashboard";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: project, isLoading, isError, refetch } = useProject(params.id);
  const [taskView, setTaskView] = useState<"board" | "list">("board");

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
        <TabsList className="flex-nowrap overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
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

          <ProjectDashboard projectId={project.id} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <div className="mb-3 flex justify-end gap-1">
            <Button
              size="sm"
              variant={taskView === "board" ? "secondary" : "ghost"}
              onClick={() => setTaskView("board")}
              className={cn(taskView === "board" && "border border-border-strong")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Board
            </Button>
            <Button
              size="sm"
              variant={taskView === "list" ? "secondary" : "ghost"}
              onClick={() => setTaskView("list")}
              className={cn(taskView === "list" && "border border-border-strong")}
            >
              <ListIcon className="h-3.5 w-3.5" /> List
            </Button>
          </div>
          {taskView === "board" ? <TaskBoard projectId={project.id} /> : <TaskList projectId={project.id} />}
        </TabsContent>

        <TabsContent value="phases" className="mt-4">
          <PhasesTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="deliverables" className="mt-4">
          <DeliverablesTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <ProjectTimeline projectId={project.id} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ProjectCalendar projectId={project.id} />
        </TabsContent>

        <TabsContent value="workload" className="mt-4">
          <ProjectWorkload projectId={project.id} />
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <MembersTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ProjectActivity projectId={project.id} />
        </TabsContent>

        <TabsContent value="requirements" className="mt-4">
          <RequirementsTab projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
