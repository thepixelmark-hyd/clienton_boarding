"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Flag, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useProject,
  usePhases,
  useAddPhase,
  useUpdatePhase,
  useDeletePhase,
  useReorderPhases,
  useAddMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  type PhaseItem,
  type MilestoneItem,
} from "@/lib/projects";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

const NO_PHASE_VALUE = "__none__";

function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function toIsoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function milestonesForPhase(phase: PhaseItem, allMilestones: MilestoneItem[]): MilestoneItem[] {
  if (phase.milestones) return phase.milestones;
  return allMilestones.filter((m) => m.phaseId === phase.id);
}

export function PhasesTab({ projectId }: { projectId: string }) {
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: phases, isLoading, isError, refetch } = usePhases(projectId);
  const reorderPhases = useReorderPhases(projectId);
  const deletePhase = useDeletePhase(projectId);
  const deleteMilestone = useDeleteMilestone(projectId);
  const toast = useToast();

  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<PhaseItem | null>(null);
  const [deletingPhase, setDeletingPhase] = useState<PhaseItem | null>(null);
  const [deletingMilestone, setDeletingMilestone] = useState<MilestoneItem | null>(null);

  if (isLoading || projectLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (isError) {
    return <ErrorState description="We couldn't load phases for this project." onRetry={() => refetch()} />;
  }

  const sortedPhases = [...(phases ?? [])].sort((a, b) => a.order - b.order);
  const allMilestones = project?.milestones ?? [];
  const unassignedMilestones = allMilestones.filter((m) => !m.phaseId);

  function reorder(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedPhases.length) return;
    const next = [...sortedPhases];
    const temp = next[index]!;
    next[index] = next[targetIndex]!;
    next[targetIndex] = temp;
    reorderPhases.mutate(
      { orderedIds: next.map((p) => p.id) },
      { onError: () => toast.show({ title: "Couldn't reorder phases.", variant: "danger" }) },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setAddMilestoneOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add milestone
        </Button>
        <Button size="sm" onClick={() => setAddPhaseOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add phase
        </Button>
      </div>

      {sortedPhases.length === 0 && unassignedMilestones.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No phases yet"
          description="Break this project into phases to track progress and milestones over time."
          action={
            <Button variant="secondary" onClick={() => setAddPhaseOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add phase
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {sortedPhases.map((phase, index) => (
            <PhaseCard
              key={phase.id}
              projectId={projectId}
              phase={phase}
              milestones={milestonesForPhase(phase, allMilestones)}
              canMoveUp={index > 0}
              canMoveDown={index < sortedPhases.length - 1}
              onMoveUp={() => reorder(index, "up")}
              onMoveDown={() => reorder(index, "down")}
              onEdit={() => setEditingPhase(phase)}
              onDelete={() => setDeletingPhase(phase)}
              onDeleteMilestone={setDeletingMilestone}
            />
          ))}

          {unassignedMilestones.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <h3 className="mb-3 text-sm font-semibold text-text-primary">No phase</h3>
                <MilestoneList
                  projectId={projectId}
                  milestones={unassignedMilestones}
                  onDeleteMilestone={setDeletingMilestone}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AddPhaseDialog projectId={projectId} open={addPhaseOpen} onOpenChange={setAddPhaseOpen} />
      <AddMilestoneDialog
        projectId={projectId}
        phases={sortedPhases}
        open={addMilestoneOpen}
        onOpenChange={setAddMilestoneOpen}
      />

      {editingPhase && (
        <EditPhaseDialog
          projectId={projectId}
          phase={editingPhase}
          open={!!editingPhase}
          onOpenChange={(v) => !v && setEditingPhase(null)}
        />
      )}

      <ConfirmDialog
        open={!!deletingPhase}
        onOpenChange={(v) => !v && setDeletingPhase(null)}
        title={deletingPhase ? `Delete "${deletingPhase.name}"?` : "Delete this phase?"}
        description="This phase will be removed. Milestones inside it are kept and simply unassigned from it, not deleted."
        confirmLabel="Delete phase"
        destructive
        loading={deletePhase.isPending}
        onConfirm={() => {
          if (!deletingPhase) return;
          deletePhase.mutate(deletingPhase.id, {
            onSuccess: () => {
              toast.show({ title: "Phase deleted", variant: "success" });
              setDeletingPhase(null);
            },
            onError: (err) =>
              toast.show({ title: err instanceof ApiClientError ? err.message : "Something went wrong.", variant: "danger" }),
          });
        }}
      />

      <ConfirmDialog
        open={!!deletingMilestone}
        onOpenChange={(v) => !v && setDeletingMilestone(null)}
        title={deletingMilestone ? `Delete "${deletingMilestone.name}"?` : "Delete this milestone?"}
        description="This milestone will be permanently removed from the project."
        confirmLabel="Delete milestone"
        destructive
        loading={deleteMilestone.isPending}
        onConfirm={() => {
          if (!deletingMilestone) return;
          deleteMilestone.mutate(deletingMilestone.id, {
            onSuccess: () => {
              toast.show({ title: "Milestone deleted", variant: "success" });
              setDeletingMilestone(null);
            },
            onError: (err) =>
              toast.show({ title: err instanceof ApiClientError ? err.message : "Something went wrong.", variant: "danger" }),
          });
        }}
      />
    </div>
  );
}

function PhaseCard({
  projectId,
  phase,
  milestones,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onDeleteMilestone,
}: {
  projectId: string;
  phase: PhaseItem;
  milestones: MilestoneItem[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteMilestone: (milestone: MilestoneItem) => void;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-0.5 pt-0.5">
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={onMoveUp}
                className="rounded p-0.5 text-text-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Move phase up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] font-medium text-text-muted">{phase.order}</span>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={onMoveDown}
                className="rounded p-0.5 text-text-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Move phase down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{phase.name}</p>
              <p className="text-xs text-text-muted">
                {formatDate(phase.startDate)} – {formatDate(phase.endDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit phase">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete phase">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <MilestoneList projectId={projectId} milestones={milestones} onDeleteMilestone={onDeleteMilestone} />
        </div>
      </CardContent>
    </Card>
  );
}

function MilestoneList({
  projectId,
  milestones,
  onDeleteMilestone,
}: {
  projectId: string;
  milestones: MilestoneItem[];
  onDeleteMilestone: (milestone: MilestoneItem) => void;
}) {
  const updateMilestone = useUpdateMilestone(projectId);
  const toast = useToast();

  if (milestones.length === 0) {
    return <p className="text-xs text-text-muted">No milestones yet.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {milestones.map((milestone) => (
        <li
          key={milestone.id}
          className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-2">
            <Flag className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <span className="text-text-primary">{milestone.name}</span>
            <span className="text-xs text-text-muted">{formatDate(milestone.dueDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={milestone.status} />
            {milestone.status !== "COMPLETED" && (
              <Button
                size="sm"
                variant="ghost"
                loading={updateMilestone.isPending}
                onClick={() =>
                  updateMilestone.mutate(
                    { id: milestone.id, input: { status: "COMPLETED" } },
                    {
                      onSuccess: () => toast.show({ title: "Milestone completed", variant: "success" }),
                      onError: (err) =>
                        toast.show({
                          title: err instanceof ApiClientError ? err.message : "Something went wrong.",
                          variant: "danger",
                        }),
                    },
                  )
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark complete
              </Button>
            )}
            <Button size="icon" variant="ghost" aria-label="Delete milestone" onClick={() => onDeleteMilestone(milestone)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AddPhaseDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const addPhase = useAddPhase(projectId);
  const toast = useToast();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    addPhase.mutate(
      { name, startDate: toIsoDateTime(startDate), endDate: toIsoDateTime(endDate) },
      {
        onSuccess: () => {
          toast.show({ title: "Phase added", variant: "success" });
          setName("");
          setStartDate("");
          setEndDate("");
          setError(null);
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add phase" description="Phases group milestones and give the project a timeline.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name" htmlFor="phase-name" required>
            <Input id="phase-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" htmlFor="phase-start-date">
              <Input id="phase-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End date" htmlFor="phase-end-date">
              <Input id="phase-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={addPhase.isPending}>
              Add phase
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPhaseDialog({
  projectId,
  phase,
  open,
  onOpenChange,
}: {
  projectId: string;
  phase: PhaseItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const updatePhase = useUpdatePhase(projectId);
  const toast = useToast();
  const [name, setName] = useState(phase.name);
  const [startDate, setStartDate] = useState(toDateInputValue(phase.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(phase.endDate));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    updatePhase.mutate(
      { id: phase.id, input: { name, startDate: toIsoDateTime(startDate), endDate: toIsoDateTime(endDate) } },
      {
        onSuccess: () => {
          toast.show({ title: "Phase updated", variant: "success" });
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit phase" description="Update this phase's name and timeline.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name" htmlFor="edit-phase-name" required>
            <Input id="edit-phase-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" htmlFor="edit-phase-start-date">
              <Input id="edit-phase-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End date" htmlFor="edit-phase-end-date">
              <Input id="edit-phase-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updatePhase.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddMilestoneDialog({
  projectId,
  phases,
  open,
  onOpenChange,
}: {
  projectId: string;
  phases: PhaseItem[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const addMilestone = useAddMilestone(projectId);
  const toast = useToast();
  const [name, setName] = useState("");
  const [phaseId, setPhaseId] = useState<string>(NO_PHASE_VALUE);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    addMilestone.mutate(
      {
        name,
        phaseId: phaseId === NO_PHASE_VALUE ? undefined : phaseId,
        dueDate: toIsoDateTime(dueDate),
      },
      {
        onSuccess: () => {
          toast.show({ title: "Milestone added", variant: "success" });
          setName("");
          setPhaseId(NO_PHASE_VALUE);
          setDueDate("");
          setError(null);
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add milestone" description="Milestones mark key dates in the project, optionally inside a phase.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name" htmlFor="milestone-name" required>
            <Input id="milestone-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Phase" htmlFor="milestone-phase">
            <Select value={phaseId} onValueChange={setPhaseId}>
              <SelectTrigger id="milestone-phase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PHASE_VALUE}>No phase</SelectItem>
                {phases.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Due date" htmlFor="milestone-due-date">
            <Input id="milestone-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={addMilestone.isPending}>
              Add milestone
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
