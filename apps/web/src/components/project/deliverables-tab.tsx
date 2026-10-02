"use client";

import { useEffect, useState } from "react";
import { Package, Plus, Trash2, Link2 } from "lucide-react";
import {
  useDeliverables,
  useDeliverable,
  useProjectTraceability,
  useCreateDeliverable,
  useUpdateDeliverable,
  useDeleteDeliverable,
  useLinkRequirement,
  useUnlinkRequirement,
  type DeliverableItem,
} from "@/lib/deliverables";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

const DELIVERABLE_STATUSES: DeliverableItem["status"][] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "APPROVED",
  "DELIVERED",
];

function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function toIsoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function DeliverablesTab({ projectId }: { projectId: string }) {
  const { data: deliverables, isLoading, isError, refetch } = useDeliverables(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New deliverable
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <ErrorState description="We couldn't load deliverables." onRetry={() => refetch()} />
      ) : deliverables!.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No deliverables yet"
          description="Break this project's scope into deliverables clients can see progress on."
          action={
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New deliverable
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {deliverables!.map((deliverable) => (
            <DeliverableCard key={deliverable.id} deliverable={deliverable} onClick={() => setSelectedId(deliverable.id)} />
          ))}
        </div>
      )}

      <CreateDeliverableDialog projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />

      {selectedId && (
        <DeliverableDetailDialog
          projectId={projectId}
          deliverableId={selectedId}
          open={!!selectedId}
          onOpenChange={(v) => !v && setSelectedId(null)}
        />
      )}
    </div>
  );
}

function DeliverableCard({ deliverable, onClick }: { deliverable: DeliverableItem; onClick: () => void }) {
  return (
    <Card className="cursor-pointer transition-colors hover:border-border-strong" onClick={onClick}>
      <CardContent className="py-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-text-primary">{deliverable.name}</p>
          <StatusBadge status={deliverable.status} />
        </div>
        {deliverable.acceptanceCriteria && (
          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{deliverable.acceptanceCriteria}</p>
        )}
        <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
          <span>Due {formatDate(deliverable.dueDate)}</span>
          <span>
            {deliverable.tasks.length} task{deliverable.tasks.length === 1 ? "" : "s"} ·{" "}
            {deliverable.requirementLinks.length} requirement{deliverable.requirementLinks.length === 1 ? "" : "s"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateDeliverableDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createDeliverable = useCreateDeliverable(projectId);
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setAcceptanceCriteria("");
    setDueDate("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    createDeliverable.mutate(
      {
        name,
        description: description || undefined,
        acceptanceCriteria: acceptanceCriteria || undefined,
        dueDate: toIsoDateTime(dueDate),
      },
      {
        onSuccess: () => {
          toast.show({ title: "Deliverable created", variant: "success" });
          reset();
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New deliverable" description="Add a deliverable clients can track progress on.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name" htmlFor="deliverable-name" required>
            <Input id="deliverable-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Description" htmlFor="deliverable-description">
            <Textarea id="deliverable-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <Field label="Acceptance criteria" htmlFor="deliverable-acceptance">
            <Textarea
              id="deliverable-acceptance"
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              rows={3}
            />
          </Field>
          <Field label="Due date" htmlFor="deliverable-due-date">
            <Input id="deliverable-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createDeliverable.isPending}>
              Create deliverable
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeliverableDetailDialog({
  projectId,
  deliverableId,
  open,
  onOpenChange,
}: {
  projectId: string;
  deliverableId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: deliverable, isLoading, isError } = useDeliverable(deliverableId);
  const { data: traceability } = useProjectTraceability(projectId);
  const updateDeliverable = useUpdateDeliverable(projectId);
  const deleteDeliverable = useDeleteDeliverable(projectId);
  const linkRequirement = useLinkRequirement(projectId, deliverableId);
  const unlinkRequirement = useUnlinkRequirement(projectId, deliverableId);
  const toast = useToast();

  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("NOT_STARTED");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkRequirementId, setLinkRequirementId] = useState<string>("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!deliverable) return;
    setName(deliverable.name);
    setStatus(deliverable.status);
    setDescription(deliverable.description ?? "");
    setAcceptanceCriteria(deliverable.acceptanceCriteria ?? "");
    setDueDate(toDateInputValue(deliverable.dueDate));
  }, [deliverable]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!deliverable) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    updateDeliverable.mutate(
      {
        id: deliverable.id,
        input: {
          name,
          status: status as DeliverableItem["status"],
          description: description || undefined,
          acceptanceCriteria: acceptanceCriteria || undefined,
          dueDate: toIsoDateTime(dueDate),
          version: deliverable.version,
        },
      },
      {
        onSuccess: () => {
          toast.show({ title: "Deliverable updated", variant: "success" });
          setError(null);
        },
        onError: (err) =>
          setError(
            err instanceof ApiClientError
              ? err.code === "CONFLICT_VERSION"
                ? "This deliverable was changed elsewhere. Reload and try again."
                : err.message
              : "Something went wrong.",
          ),
      },
    );
  }

  function handleLink() {
    if (!linkRequirementId) return;
    linkRequirement.mutate(
      { requirementId: linkRequirementId },
      {
        onSuccess: () => {
          toast.show({ title: "Requirement linked", variant: "success" });
          setLinkRequirementId("");
        },
        onError: (err) =>
          toast.show({ title: err instanceof ApiClientError ? err.message : "Something went wrong.", variant: "danger" }),
      },
    );
  }

  function handleUnlink(requirementId: string) {
    unlinkRequirement.mutate(requirementId, {
      onSuccess: () => toast.show({ title: "Requirement unlinked", variant: "success" }),
      onError: (err) =>
        toast.show({ title: err instanceof ApiClientError ? err.message : "Something went wrong.", variant: "danger" }),
    });
  }

  const unlinkedRequirements = traceability?.unlinkedRequirements ?? [];

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={deliverable?.name ?? "Deliverable"}
        description="Review progress, link requirements, and update this deliverable."
        className="max-w-lg max-h-[85vh] overflow-y-auto"
      >
        {isLoading || !deliverable ? (
          <Skeleton className="h-56 w-full" />
        ) : isError ? (
          <ErrorState description="We couldn't load this deliverable." />
        ) : (
          <div className="space-y-5">
            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Name" htmlFor="detail-deliverable-name" required>
                <Input id="detail-deliverable-name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Status" htmlFor="detail-deliverable-status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="detail-deliverable-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Description" htmlFor="detail-deliverable-description">
                <Textarea
                  id="detail-deliverable-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </Field>
              <Field label="Acceptance criteria" htmlFor="detail-deliverable-acceptance">
                <Textarea
                  id="detail-deliverable-acceptance"
                  value={acceptanceCriteria}
                  onChange={(e) => setAcceptanceCriteria(e.target.value)}
                  rows={3}
                />
              </Field>
              <Field label="Due date" htmlFor="detail-deliverable-due-date">
                <Input
                  id="detail-deliverable-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex items-center justify-between">
                <Button type="button" variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button type="submit" loading={updateDeliverable.isPending}>
                  Save changes
                </Button>
              </div>
            </form>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Tasks</h4>
              {deliverable.tasks.length === 0 ? (
                <p className="text-sm text-text-muted">No tasks linked yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {deliverable.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="text-text-primary">{task.title}</span>
                      <StatusBadge status={task.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Linked requirements</h4>
              {deliverable.requirementLinks.length === 0 ? (
                <p className="text-sm text-text-muted">No requirements linked yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {deliverable.requirementLinks.map((link) => (
                    <li
                      key={link.requirementId}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary">{link.requirement.title}</span>
                        <StatusBadge status={link.requirement.readiness} />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnlink(link.requirementId)}
                        loading={unlinkRequirement.isPending}
                      >
                        Unlink
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {unlinkedRequirements.length > 0 ? (
                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="link-requirement">Link a requirement</Label>
                    <div className="mt-1.5">
                      <Select value={linkRequirementId} onValueChange={setLinkRequirementId}>
                        <SelectTrigger id="link-requirement">
                          <SelectValue placeholder="Choose a requirement" />
                        </SelectTrigger>
                        <SelectContent>
                          {unlinkedRequirements.map((req) => (
                            <SelectItem key={req.id} value={req.id}>
                              {req.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleLink} loading={linkRequirement.isPending} disabled={!linkRequirementId}>
                    <Link2 className="h-3.5 w-3.5" /> Link
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-text-muted">
                  Every requirement in this project is already linked to a deliverable.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title="Delete this deliverable?"
      description="This deliverable and its links to tasks and requirements will be removed. This can't be undone."
      confirmLabel="Delete deliverable"
      destructive
      loading={deleteDeliverable.isPending}
      onConfirm={() => {
        if (!deliverable) return;
        deleteDeliverable.mutate(deliverable.id, {
          onSuccess: () => {
            toast.show({ title: "Deliverable deleted", variant: "success" });
            setDeleteOpen(false);
            onOpenChange(false);
          },
        });
      }}
    />
    </>
  );
}
