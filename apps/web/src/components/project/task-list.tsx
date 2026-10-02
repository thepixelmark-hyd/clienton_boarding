"use client";

import { useState } from "react";
import { ListTodo } from "lucide-react";
import { useTasks, type TaskStatus } from "@/lib/projects";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { TaskDetailDialog } from "./task-detail-dialog";

const STATUS_FILTERS: { value: "ALL" | TaskStatus; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DONE", label: "Done" },
];

export function TaskList({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading, isError, refetch } = useTasks(projectId);
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  if (isLoading) {
    return <SkeletonTable rows={6} cols={6} />;
  }

  if (isError) {
    return <ErrorState description="We couldn't load tasks for this project." onRetry={() => refetch()} />;
  }

  const filtered = (tasks ?? []).filter((task) => statusFilter === "ALL" || task.status === statusFilter);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "ALL" | TaskStatus)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks"
          description={
            statusFilter === "ALL" ? "This project doesn't have any tasks yet." : "No tasks match this status."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Waiting on client</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((task) => (
              <TableRow key={task.id} clickable onClick={() => setOpenTaskId(task.id)}>
                <TableCell className="font-medium text-text-primary">{task.title}</TableCell>
                <TableCell>
                  <StatusBadge status={task.status} />
                </TableCell>
                <TableCell className="text-xs text-text-secondary">{task.priority}</TableCell>
                <TableCell>
                  {task.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={task.assignee.fullName} imageUrl={task.assignee.avatarUrl} size="sm" />
                      <span className="text-sm text-text-secondary">{task.assignee.fullName}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-text-secondary">
                  {task.dueDate ? formatDate(task.dueDate) : "—"}
                </TableCell>
                <TableCell>
                  {task.waitingOnClient ? (
                    <Badge variant="warning">Waiting on client</Badge>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <TaskDetailDialog
        taskId={openTaskId}
        projectId={projectId}
        open={!!openTaskId}
        onOpenChange={(v) => !v && setOpenTaskId(null)}
      />
    </div>
  );
}
