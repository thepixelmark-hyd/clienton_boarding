"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Link2, ListChecks, MessageSquare, Plus, Trash2 } from "lucide-react";
import type { UpdateTaskInput } from "@clientos/shared";
import {
  useTask,
  useTasks,
  useUpdateTask,
  useDeleteTask,
  useTaskComments,
  useAddTaskComment,
  useDeleteTaskComment,
  useCreateTask,
  type TaskStatus,
} from "@/lib/projects";
import { useMembers } from "@/lib/auth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DONE", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

function toDateInputValue(value?: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function toIsoDateTime(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function TaskDetailDialog({
  taskId,
  projectId,
  open,
  onOpenChange,
}: {
  taskId: string | null;
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: task, isLoading, isError, refetch } = useTask(taskId ?? "");
  const { data: allTasks } = useTasks(projectId);
  const { data: members } = useMembers();
  const { data: comments, isLoading: commentsLoading } = useTaskComments(taskId ?? "");
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const addComment = useAddTaskComment(taskId ?? "");
  const deleteComment = useDeleteTaskComment(taskId ?? "");
  const createTask = useCreateTask(projectId);
  const toast = useToast();

  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [hoursDraft, setHoursDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (task) {
      setTitleDraft(task.title);
      setDescriptionDraft(task.description ?? "");
      setHoursDraft(task.estimatedHours ?? "");
      setNoteDraft(task.waitingOnClientNote ?? "");
      setSelectedDeps(task.dependenciesFrom.map((d) => d.blockingTaskId));
    }
  }, [task]);

  if (!taskId) return null;

  function handleError(err: unknown, fallback: string) {
    toast.show({
      title: err instanceof ApiClientError ? err.message : fallback,
      variant: "danger",
    });
  }

  function commitUpdate(input: Record<string, unknown>, successMessage?: string) {
    if (!task) return;
    updateTask.mutate(
      { id: task.id, input: { ...input, version: task.version } as UpdateTaskInput },
      {
        onSuccess: () => {
          if (successMessage) toast.show({ title: successMessage, variant: "success" });
        },
        onError: (err) => handleError(err, "Couldn't update the task."),
      },
    );
  }

  function handleAddSubtask(e: FormEvent) {
    e.preventDefault();
    if (!task || !subtaskTitle.trim()) return;
    createTask.mutate(
      { title: subtaskTitle.trim(), parentTaskId: task.id },
      {
        onSuccess: () => setSubtaskTitle(""),
        onError: (err) => handleError(err, "Couldn't add the subtask."),
      },
    );
  }

  function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    addComment.mutate(
      { body: commentBody.trim() },
      {
        onSuccess: () => setCommentBody(""),
        onError: (err) => handleError(err, "Couldn't add the comment."),
      },
    );
  }

  function handleDeleteComment(commentId: string) {
    deleteComment.mutate(commentId, {
      onError: (err) => {
        if (err instanceof ApiClientError && err.status === 403) {
          toast.show({ title: "You can only delete your own comments.", variant: "danger" });
        } else {
          handleError(err, "Couldn't delete the comment.");
        }
      },
    });
  }

  const subtaskTitles = new Map((allTasks ?? []).map((t) => [t.id, t.title]));
  const dependencyCandidates = (allTasks ?? []).filter((t) => t.id !== taskId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title={task?.title ?? "Task"} className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : isError || !task ? (
            <ErrorState description="We couldn't load this task." onRetry={() => refetch()} />
          ) : (
            <div className="space-y-5">
              <Field label="Title" htmlFor="task-detail-title">
                <Input
                  id="task-detail-title"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => {
                    const next = titleDraft.trim();
                    if (next && next !== task.title) commitUpdate({ title: next });
                  }}
                />
              </Field>

              <Field label="Description" htmlFor="task-detail-description">
                <Textarea
                  id="task-detail-description"
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  onBlur={() => {
                    if (descriptionDraft !== (task.description ?? "")) {
                      commitUpdate({ description: descriptionDraft });
                    }
                  }}
                />
              </Field>

              {(task.parentTask || task.deliverable || task.milestone) && (
                <div className="space-y-1 rounded-md border border-border bg-surface-secondary/40 p-3 text-xs text-text-muted">
                  {task.parentTask && (
                    <p>
                      Subtask of <span className="text-text-primary">{task.parentTask.title}</span>
                    </p>
                  )}
                  {task.deliverable && (
                    <p>
                      Deliverable: <span className="text-text-primary">{task.deliverable.name}</span>
                    </p>
                  )}
                  {task.milestone && (
                    <p>
                      Milestone: <span className="text-text-primary">{task.milestone.name}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Status" htmlFor="task-detail-status">
                  <Select value={task.status} onValueChange={(v) => commitUpdate({ status: v as TaskStatus })}>
                    <SelectTrigger id="task-detail-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Priority" htmlFor="task-detail-priority">
                  <Select value={task.priority} onValueChange={(v) => commitUpdate({ priority: v })}>
                    <SelectTrigger id="task-detail-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Assignee" htmlFor="task-detail-assignee">
                  <Select
                    value={task.assignee?.id ?? "unassigned"}
                    onValueChange={(v) => commitUpdate({ assigneeId: v === "unassigned" ? null : v })}
                  >
                    <SelectTrigger id="task-detail-assignee">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(members ?? []).map((m) => (
                        <SelectItem key={m.user.id} value={m.user.id}>
                          {m.user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Due date" htmlFor="task-detail-due-date">
                  <Input
                    id="task-detail-due-date"
                    type="date"
                    defaultValue={toDateInputValue(task.dueDate)}
                    key={`due-${task.id}-${task.dueDate ?? ""}`}
                    onChange={(e) => {
                      if (e.target.value) commitUpdate({ dueDate: toIsoDateTime(e.target.value) });
                    }}
                  />
                </Field>

                <Field label="Estimated hours" htmlFor="task-detail-hours">
                  <Input
                    id="task-detail-hours"
                    type="number"
                    min={0}
                    step="0.5"
                    value={hoursDraft}
                    onChange={(e) => setHoursDraft(e.target.value)}
                    onBlur={() => {
                      const current = task.estimatedHours ?? "";
                      if (hoursDraft !== current) {
                        commitUpdate({ estimatedHours: hoursDraft === "" ? undefined : Number(hoursDraft) });
                      }
                    }}
                  />
                </Field>
              </div>

              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">Waiting on client</span>
                  <Switch
                    checked={task.waitingOnClient}
                    onCheckedChange={(checked) => commitUpdate({ waitingOnClient: checked })}
                  />
                </div>
                {task.waitingOnClient && (
                  <Textarea
                    placeholder="What are we waiting on the client for?"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onBlur={() => {
                      if (noteDraft !== (task.waitingOnClientNote ?? "")) {
                        commitUpdate({ waitingOnClientNote: noteDraft });
                      }
                    }}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <Link2 className="h-3.5 w-3.5" /> Dependencies
                </div>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3">
                  {dependencyCandidates.length === 0 ? (
                    <p className="text-xs text-text-muted">No other tasks in this project yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {dependencyCandidates.map((candidate) => {
                        const checked = selectedDeps.includes(candidate.id);
                        return (
                          <label key={candidate.id} className="flex items-center gap-2 text-sm text-text-primary">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                setSelectedDeps((prev) =>
                                  next ? [...prev, candidate.id] : prev.filter((id) => id !== candidate.id),
                                );
                              }}
                            />
                            {candidate.title}
                            <StatusBadge status={candidate.status} className="ml-auto" />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => commitUpdate({ dependsOnTaskIds: selectedDeps }, "Dependencies updated")}
                  loading={updateTask.isPending}
                >
                  Save dependencies
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <ListChecks className="h-3.5 w-3.5" /> Subtasks
                </div>
                {task.subtasks.length > 0 && (
                  <div className="space-y-1.5">
                    {task.subtasks.map((subtask) => (
                      <div key={subtask.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <span className="text-sm text-text-primary">{subtaskTitles.get(subtask.id) ?? subtask.id}</span>
                        <StatusBadge status={subtask.status} />
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleAddSubtask} className="flex gap-2">
                  <Input
                    placeholder="Add a subtask"
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                  />
                  <Button type="submit" size="sm" variant="secondary" loading={createTask.isPending}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </form>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <MessageSquare className="h-3.5 w-3.5" /> Comments
                </div>
                {commentsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="space-y-2">
                    {(comments ?? []).map((comment) => (
                      <div key={comment.id} className="rounded-md border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Avatar name={comment.author?.fullName ?? "Unknown"} imageUrl={comment.author?.avatarUrl} size="sm" />
                            <div>
                              <p className="text-sm font-medium text-text-primary">{comment.author?.fullName ?? "Unknown"}</p>
                              <p className="text-[11px] text-text-muted">{formatDateTime(comment.createdAt)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-text-muted hover:text-danger"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{comment.body}</p>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleAddComment} className="space-y-2">
                  <Textarea
                    placeholder="Add a comment…"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" loading={addComment.isPending} disabled={!commentBody.trim()}>
                      Comment
                    </Button>
                  </div>
                </form>
              </div>

              <div className="flex justify-end border-t border-border pt-4">
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete task
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {task && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete this task?"
          description={`This permanently removes "${task.title}" and its comments. This can't be undone.`}
          confirmLabel="Delete task"
          destructive
          loading={deleteTask.isPending}
          onConfirm={() => {
            deleteTask.mutate(task.id, {
              onSuccess: () => {
                setDeleteOpen(false);
                onOpenChange(false);
                toast.show({ title: "Task deleted", variant: "success" });
              },
              onError: (err) => handleError(err, "Couldn't delete the task."),
            });
          }}
        />
      )}
    </>
  );
}
