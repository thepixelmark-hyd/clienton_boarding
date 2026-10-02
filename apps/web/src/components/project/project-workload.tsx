"use client";

import { Users } from "lucide-react";
import { useTasks, type TaskItem, type TaskStatus } from "@/lib/projects";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  BLOCKED: "Blocked",
  DONE: "Done",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "bg-text-muted",
  IN_PROGRESS: "bg-info",
  IN_REVIEW: "bg-warning",
  BLOCKED: "bg-danger",
  DONE: "bg-success",
};

interface AssigneeGroup {
  id: string;
  name: string;
  avatarUrl: string | null;
  tasks: TaskItem[];
  statusCounts: Record<TaskStatus, number>;
  estimatedHours: number;
}

function parseHours(value: string | null | undefined): number {
  if (!value) return 0;
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function formatHours(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}h`;
}

export function ProjectWorkload({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading, isError, refetch } = useTasks(projectId);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError) {
    return <ErrorState description="We couldn't load workload for this project." onRetry={() => refetch()} />;
  }

  const allTasks = tasks ?? [];

  if (allTasks.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No tasks yet"
        description="Workload breaks down by assignee once tasks are added to this project."
      />
    );
  }

  const groups = new Map<string, AssigneeGroup>();

  for (const task of allTasks) {
    const key = task.assignee?.id ?? "unassigned";
    let group = groups.get(key);
    if (!group) {
      group = {
        id: key,
        name: task.assignee?.fullName ?? "Unassigned",
        avatarUrl: task.assignee?.avatarUrl ?? null,
        tasks: [],
        statusCounts: { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, BLOCKED: 0, DONE: 0 },
        estimatedHours: 0,
      };
      groups.set(key, group);
    }
    group.tasks.push(task);
    group.statusCounts[task.status] += 1;
    group.estimatedHours += parseHours(task.estimatedHours);
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => b.tasks.length - a.tasks.length);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assignee</TableHead>
              <TableHead>Total tasks</TableHead>
              <TableHead>By status</TableHead>
              <TableHead>Est. hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGroups.map((group) => (
              <TableRow key={group.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar name={group.name} imageUrl={group.avatarUrl} size="sm" />
                    <span className="text-sm font-medium text-text-primary">{group.name}</span>
                  </div>
                </TableCell>
                <TableCell>{group.tasks.length}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    {STATUS_ORDER.filter((status) => group.statusCounts[status] > 0).map((status) => (
                      <span key={status} className="flex items-center gap-1 text-xs text-text-muted">
                        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLOR[status])} />
                        {STATUS_LABEL[status]} {group.statusCounts[status]}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{formatHours(group.estimatedHours)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
