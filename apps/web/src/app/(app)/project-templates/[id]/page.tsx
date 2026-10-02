"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { TemplateMilestone, TemplatePhase, TemplateTask } from "@clientos/shared";
import {
  useDeleteProjectTemplate,
  useInstantiateProjectTemplate,
  useProjectTemplate,
  useUpdateProjectTemplate,
} from "@/lib/projectTemplates";
import { useClients } from "@/lib/clients";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

function slugKey(label: string, existing: Set<string>) {
  const base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
  let candidate = base;
  let i = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}

const NONE = "__none__";

export default function ProjectTemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: template, isLoading, isError, refetch } = useProjectTemplate(params.id);
  const updateTemplate = useUpdateProjectTemplate(params.id);
  const deleteTemplate = useDeleteProjectTemplate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phases, setPhases] = useState<TemplatePhase[]>([]);
  const [milestones, setMilestones] = useState<TemplateMilestone[]>([]);
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [instantiateOpen, setInstantiateOpen] = useState(false);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TemplateTask | null>(null);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setDescription(template.description ?? "");
    setPhases(template.phases);
    setMilestones(template.milestones);
    setTasks(template.tasks);
    setDirty(false);
  }, [template]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !template) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ErrorState description="We couldn't load this template." onRetry={() => refetch()} />
      </div>
    );
  }

  const allKeys = new Set([...phases.map((p) => p.key), ...milestones.map((m) => m.key), ...tasks.map((t) => t.key)]);

  function markDirty() {
    setDirty(true);
    setErrors([]);
  }

  function handleSave() {
    updateTemplate.mutate(
      { name, description: description || undefined, phases, milestones, tasks },
      {
        onSuccess: () => {
          toast.show({ title: "Template saved", variant: "success" });
          setDirty(false);
        },
        onError: (err) => {
          if (err instanceof ApiClientError && Array.isArray(err.details?.errors)) {
            setErrors(err.details.errors as string[]);
          } else {
            toast.show({ title: "Couldn't save template", variant: "danger" });
          }
        },
      },
    );
  }

  function removePhase(key: string) {
    setPhases((prev) => prev.filter((p) => p.key !== key));
    setMilestones((prev) => prev.map((m) => (m.phaseKey === key ? { ...m, phaseKey: undefined } : m)));
    setTasks((prev) => prev.map((t) => (t.phaseKey === key ? { ...t, phaseKey: undefined } : t)));
    markDirty();
  }

  function removeMilestone(key: string) {
    setMilestones((prev) => prev.filter((m) => m.key !== key));
    setTasks((prev) => prev.map((t) => (t.milestoneKey === key ? { ...t, milestoneKey: undefined } : t)));
    markDirty();
  }

  function removeTask(key: string) {
    setTasks((prev) =>
      prev
        .filter((t) => t.key !== key)
        .map((t) => ({
          ...t,
          parentKey: t.parentKey === key ? undefined : t.parentKey,
          dependsOnKeys: t.dependsOnKeys?.filter((k) => k !== key),
        })),
    );
    markDirty();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title={template.name}
        description="A reusable blueprint — dates below are offsets in days from a project's start date, resolved when you instantiate it."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => router.push("/project-templates")}>
              Back
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button onClick={() => setInstantiateOpen(true)}>Use this template</Button>
          </div>
        }
      />

      <Card className="mt-6">
        <CardContent className="space-y-4 py-4">
          <Field label="Name" htmlFor="tpl-name" required>
            <Input id="tpl-name" value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} />
          </Field>
          <Field label="Description" htmlFor="tpl-description">
            <Textarea
              id="tpl-description"
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty(); }}
            />
          </Field>
        </CardContent>
      </Card>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Phases</h3>
          <Button size="sm" variant="secondary" onClick={() => setPhaseDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add phase
          </Button>
        </div>
        {phases.length === 0 ? (
          <p className="text-sm text-text-muted">No phases yet.</p>
        ) : (
          <div className="space-y-2">
            {[...phases].sort((a, b) => a.order - b.order).map((phase) => (
              <Card key={phase.key}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{phase.name}</p>
                    <p className="text-xs text-text-muted">
                      Day {phase.startOffsetDays ?? "—"} to day {phase.endOffsetDays ?? "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePhase(phase.key)}
                    className="rounded-sm p-1.5 text-text-muted hover:bg-surface-secondary hover:text-danger"
                    aria-label={`Remove phase ${phase.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Milestones</h3>
          <Button size="sm" variant="secondary" onClick={() => setMilestoneDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add milestone
          </Button>
        </div>
        {milestones.length === 0 ? (
          <p className="text-sm text-text-muted">No milestones yet.</p>
        ) : (
          <div className="space-y-2">
            {milestones.map((milestone) => (
              <Card key={milestone.key}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{milestone.name}</p>
                    <p className="text-xs text-text-muted">
                      {milestone.phaseKey ? `Phase: ${phases.find((p) => p.key === milestone.phaseKey)?.name ?? milestone.phaseKey} · ` : ""}
                      Due day {milestone.dueOffsetDays ?? "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMilestone(milestone.key)}
                    className="rounded-sm p-1.5 text-text-muted hover:bg-surface-secondary hover:text-danger"
                    aria-label={`Remove milestone ${milestone.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tasks</h3>
          <Button size="sm" variant="secondary" onClick={() => { setEditingTask(null); setTaskDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add task
          </Button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-text-muted">No tasks yet.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <Card
                key={task.key}
                className="cursor-pointer transition-colors hover:border-border-strong"
                onClick={() => { setEditingTask(task); setTaskDialogOpen(true); }}
              >
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{task.title}</p>
                    <p className="text-xs text-text-muted">
                      {task.parentKey ? `Subtask of ${tasks.find((t) => t.key === task.parentKey)?.title ?? task.parentKey} · ` : ""}
                      {task.dependsOnKeys?.length ? `Depends on ${task.dependsOnKeys.length} task(s) · ` : ""}
                      Due day {task.dueOffsetDays ?? "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeTask(task.key); }}
                    className="rounded-sm p-1.5 text-text-muted hover:bg-surface-secondary hover:text-danger"
                    aria-label={`Remove task ${task.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {errors.length > 0 && (
        <Card className="mt-6 border-danger">
          <CardContent className="py-3">
            <p className="text-sm font-medium text-danger">This blueprint has errors:</p>
            <ul className="mt-1 list-inside list-disc text-sm text-danger">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {dirty && (
        <div className="sticky bottom-4 mt-6 flex justify-end gap-2 rounded-md border border-border bg-surface p-3 shadow-elevated">
          <Button variant="secondary" onClick={() => refetch()}>
            Discard changes
          </Button>
          <Button onClick={handleSave} loading={updateTemplate.isPending}>
            Save changes
          </Button>
        </div>
      )}

      <PhaseDialog
        open={phaseDialogOpen}
        onOpenChange={setPhaseDialogOpen}
        onAdd={(phase) => { setPhases((prev) => [...prev, phase]); markDirty(); }}
        existingKeys={allKeys}
        order={phases.length}
      />
      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        onAdd={(milestone) => { setMilestones((prev) => [...prev, milestone]); markDirty(); }}
        existingKeys={allKeys}
        phases={phases}
      />
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={(v) => { setTaskDialogOpen(v); if (!v) setEditingTask(null); }}
        onSave={(task, isNew) => {
          setTasks((prev) => (isNew ? [...prev, task] : prev.map((t) => (t.key === task.key ? task : t))));
          markDirty();
        }}
        existingKeys={allKeys}
        phases={phases}
        milestones={milestones}
        tasks={tasks}
        editingTask={editingTask}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this template?"
        description="Projects already created from it keep their phases, milestones, and tasks — only the reusable template itself is removed."
        confirmLabel="Delete template"
        destructive
        loading={deleteTemplate.isPending}
        onConfirm={() =>
          deleteTemplate.mutate(template.id, {
            onSuccess: () => {
              toast.show({ title: "Template deleted", variant: "success" });
              router.push("/project-templates");
            },
          })
        }
      />
      <InstantiateDialog templateId={template.id} open={instantiateOpen} onOpenChange={setInstantiateOpen} />
    </div>
  );
}

function PhaseDialog({
  open,
  onOpenChange,
  onAdd,
  existingKeys,
  order,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (phase: TemplatePhase) => void;
  existingKeys: Set<string>;
  order: number;
}) {
  const [name, setName] = useState("");
  const [startOffsetDays, setStartOffsetDays] = useState("");
  const [endOffsetDays, setEndOffsetDays] = useState("");

  function reset() {
    setName("");
    setStartOffsetDays("");
    setEndOffsetDays("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      key: slugKey(name, existingKeys),
      name,
      order,
      startOffsetDays: startOffsetDays ? Number(startOffsetDays) : undefined,
      endOffsetDays: endOffsetDays ? Number(endOffsetDays) : undefined,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent title="Add phase">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name" htmlFor="phase-name" required>
            <Input id="phase-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts on day" htmlFor="phase-start" help="Offset from project start">
              <Input id="phase-start" type="number" value={startOffsetDays} onChange={(e) => setStartOffsetDays(e.target.value)} />
            </Field>
            <Field label="Ends on day" htmlFor="phase-end">
              <Input id="phase-end" type="number" value={endOffsetDays} onChange={(e) => setEndOffsetDays(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add phase</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MilestoneDialog({
  open,
  onOpenChange,
  onAdd,
  existingKeys,
  phases,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (milestone: TemplateMilestone) => void;
  existingKeys: Set<string>;
  phases: TemplatePhase[];
}) {
  const [name, setName] = useState("");
  const [phaseKey, setPhaseKey] = useState<string>(NONE);
  const [dueOffsetDays, setDueOffsetDays] = useState("");

  function reset() {
    setName("");
    setPhaseKey(NONE);
    setDueOffsetDays("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      key: slugKey(name, existingKeys),
      name,
      phaseKey: phaseKey === NONE ? undefined : phaseKey,
      dueOffsetDays: dueOffsetDays ? Number(dueOffsetDays) : undefined,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent title="Add milestone">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name" htmlFor="milestone-name" required>
            <Input id="milestone-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Phase" htmlFor="milestone-phase">
            <Select value={phaseKey} onValueChange={setPhaseKey}>
              <SelectTrigger id="milestone-phase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No phase</SelectItem>
                {phases.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Due on day" htmlFor="milestone-due" help="Offset from project start">
            <Input id="milestone-due" type="number" value={dueOffsetDays} onChange={(e) => setDueOffsetDays(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add milestone</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  onSave,
  existingKeys,
  phases,
  milestones,
  tasks,
  editingTask,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (task: TemplateTask, isNew: boolean) => void;
  existingKeys: Set<string>;
  phases: TemplatePhase[];
  milestones: TemplateMilestone[];
  tasks: TemplateTask[];
  editingTask: TemplateTask | null;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phaseKey, setPhaseKey] = useState<string>(NONE);
  const [milestoneKey, setMilestoneKey] = useState<string>(NONE);
  const [parentKey, setParentKey] = useState<string>(NONE);
  const [priority, setPriority] = useState("MEDIUM");
  const [dueOffsetDays, setDueOffsetDays] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [dependsOnKeys, setDependsOnKeys] = useState<string[]>([]);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description ?? "");
      setPhaseKey(editingTask.phaseKey ?? NONE);
      setMilestoneKey(editingTask.milestoneKey ?? NONE);
      setParentKey(editingTask.parentKey ?? NONE);
      setPriority(editingTask.priority ?? "MEDIUM");
      setDueOffsetDays(editingTask.dueOffsetDays?.toString() ?? "");
      setEstimatedHours(editingTask.estimatedHours?.toString() ?? "");
      setDependsOnKeys(editingTask.dependsOnKeys ?? []);
    } else {
      setTitle("");
      setDescription("");
      setPhaseKey(NONE);
      setMilestoneKey(NONE);
      setParentKey(NONE);
      setPriority("MEDIUM");
      setDueOffsetDays("");
      setEstimatedHours("");
      setDependsOnKeys([]);
    }
  }, [editingTask, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const key = editingTask?.key ?? slugKey(title, existingKeys);
    onSave(
      {
        key,
        title,
        description: description || undefined,
        phaseKey: phaseKey === NONE ? undefined : phaseKey,
        milestoneKey: milestoneKey === NONE ? undefined : milestoneKey,
        parentKey: parentKey === NONE ? undefined : parentKey,
        priority: priority as TemplateTask["priority"],
        dueOffsetDays: dueOffsetDays ? Number(dueOffsetDays) : undefined,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        dependsOnKeys: dependsOnKeys.length ? dependsOnKeys : undefined,
      },
      !editingTask,
    );
    onOpenChange(false);
  }

  const otherTasks = tasks.filter((t) => t.key !== editingTask?.key);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editingTask ? "Edit task" : "Add task"} className="max-h-[85vh] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title" htmlFor="task-title" required>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label="Description" htmlFor="task-description">
            <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phase" htmlFor="task-phase">
              <Select value={phaseKey} onValueChange={setPhaseKey}>
                <SelectTrigger id="task-phase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No phase</SelectItem>
                  {phases.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Milestone" htmlFor="task-milestone">
              <Select value={milestoneKey} onValueChange={setMilestoneKey}>
                <SelectTrigger id="task-milestone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No milestone</SelectItem>
                  {milestones.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="Parent task" htmlFor="task-parent" help="Makes this a subtask">
              <Select value={parentKey} onValueChange={setParentKey}>
                <SelectTrigger id="task-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {otherTasks.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due on day" htmlFor="task-due" help="Offset from project start">
              <Input id="task-due" type="number" value={dueOffsetDays} onChange={(e) => setDueOffsetDays(e.target.value)} />
            </Field>
            <Field label="Estimated hours" htmlFor="task-hours">
              <Input id="task-hours" type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
            </Field>
          </div>
          {otherTasks.length > 0 && (
            <Field label="Depends on" htmlFor="task-depends" help="This task won't be blocked by these in the template — dependencies carry over when instantiated">
              <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                {otherTasks.map((t) => (
                  <label key={t.key} className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={dependsOnKeys.includes(t.key)}
                      onChange={(e) =>
                        setDependsOnKeys((prev) => (e.target.checked ? [...prev, t.key] : prev.filter((k) => k !== t.key)))
                      }
                    />
                    {t.title}
                  </label>
                ))}
              </div>
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingTask ? "Save task" : "Add task"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InstantiateDialog({
  templateId,
  open,
  onOpenChange,
}: {
  templateId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: clientsPage, isLoading } = useClients();
  const instantiate = useInstantiateProjectTemplate(templateId);
  const router = useRouter();
  const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !name.trim()) {
      setError("A client and project name are required.");
      return;
    }
    instantiate.mutate(
      { clientId, name, startDate: startDate ? new Date(startDate).toISOString() : undefined },
      {
        onSuccess: (project) => {
          toast.show({ title: "Project created from template", variant: "success" });
          onOpenChange(false);
          router.push(`/projects/${project.id}`);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Use this template" description="Creates a new project with this blueprint's phases, milestones, and tasks.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Client" htmlFor="instantiate-client" required>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="instantiate-client">
                <SelectValue placeholder={isLoading ? "Loading…" : "Select a client"} />
              </SelectTrigger>
              <SelectContent>
                {(clientsPage?.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project name" htmlFor="instantiate-name" required>
            <Input id="instantiate-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Start date" htmlFor="instantiate-start" help="Defaults to today">
            <Input id="instantiate-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={instantiate.isPending}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
