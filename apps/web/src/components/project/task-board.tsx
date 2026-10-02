"use client";

import { useState } from "react";
import { Link2, ListChecks, MessageSquare, Plus } from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask, type TaskItem } from "@/lib/projects";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";
import { TaskDetailDialog } from "./task-detail-dialog";

const COLUMNS: { status: TaskItem["status"]; label: string }[] = [
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "IN_REVIEW", label: "In review" },
  { status: "BLOCKED", label: "Blocked" },
  { status: "DONE", label: "Done" },
];

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "bg-text-muted",
  MEDIUM: "bg-info",
  HIGH: "bg-warning",
  URGENT: "bg-danger",
};

export function TaskBoard({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading, isError, refetch } = useTasks(projectId);
  const updateTask = useUpdateTask(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-flow-col auto-cols-[80%] gap-3 overflow-x-auto sm:auto-cols-auto sm:grid-cols-5 sm:overflow-visible">
        {COLUMNS.map((c) => (
          <Skeleton key={c.status} className="h-64" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState description="We couldn't load tasks for this project." onRetry={() => refetch()} />;
  }

  function moveTask(task: TaskItem, status: TaskItem["status"]) {
    updateTask.mutate({ id: task.id, input: { status, version: task.version } });
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New task
        </Button>
      </div>
      <div className="grid grid-flow-col auto-cols-[80%] gap-3 overflow-x-auto pb-2 sm:auto-cols-auto sm:grid-cols-5 sm:overflow-visible sm:pb-0">
        {COLUMNS.map((column) => {
          const columnTasks = (tasks ?? []).filter((t) => t.status === column.status);
          return (
            <div key={column.status} className="min-w-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {column.label}
                </span>
                <span className="text-xs text-text-muted">{columnTasks.length}</span>
              </div>
              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <Card key={task.id} className="shadow-none transition-colors hover:border-border-strong">
                    <CardContent className="space-y-2 py-3">
                      {/* Only this inner region opens the task detail dialog — kept
                          separate from the Card itself (rather than putting onClick
                          directly on the Card, which would make it a focusable
                          role="button" ancestor) so the quick-move buttons below
                          aren't nested inside another interactive element, which
                          screen readers treat as a broken/ambiguous control. */}
                      <div
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer space-y-2"
                        onClick={() => setOpenTaskId(task.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenTaskId(task.id);
                          }
                        }}
                      >
                        <div className="flex items-start gap-1.5">
                          <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_COLOR[task.priority])} />
                          <p className="text-sm font-medium leading-snug text-text-primary">{task.title}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-muted">{task.dueDate ? formatDate(task.dueDate) : ""}</span>
                          {task.assignee && <Avatar name={task.assignee.fullName} imageUrl={task.assignee.avatarUrl} size="sm" />}
                        </div>
                        {(task.subtasks.length > 0 || task.dependenciesFrom.length > 0 || task._count.comments > 0) && (
                          <div className="flex items-center gap-2 text-[10px] text-text-muted">
                            {task.subtasks.length > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <ListChecks className="h-3 w-3" /> {task.subtasks.length}
                              </span>
                            )}
                            {task.dependenciesFrom.length > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <Link2 className="h-3 w-3" /> {task.dependenciesFrom.length}
                              </span>
                            )}
                            {task._count.comments > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <MessageSquare className="h-3 w-3" /> {task._count.comments}
                              </span>
                            )}
                          </div>
                        )}
                        {task.waitingOnClient && (
                          <Badge variant="warning" className="w-fit">
                            Waiting on client
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {COLUMNS.filter((c) => c.status !== task.status).map((c) => (
                          <button
                            key={c.status}
                            onClick={() => moveTask(task, c.status)}
                            className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-text-muted hover:border-border-strong hover:text-text-primary"
                          >
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <CreateTaskDialog projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetailDialog
        taskId={openTaskId}
        projectId={projectId}
        open={!!openTaskId}
        onOpenChange={(v) => !v && setOpenTaskId(null)}
      />
    </div>
  );
}

function CreateTaskDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createTask = useCreateTask(projectId);
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    createTask.mutate(
      { title, priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT" },
      {
        onSuccess: () => {
          toast.show({ title: "Task created", variant: "success" });
          setTitle("");
          setError(null);
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New task" description="Add a task to this project's board.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title" htmlFor="task-title" required>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label="Priority" htmlFor="task-priority">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="task-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createTask.isPending}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
