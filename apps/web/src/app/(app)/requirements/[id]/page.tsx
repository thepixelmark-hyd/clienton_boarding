"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useRequirement,
  useReviewRequirement,
  useReopenRequirement,
  useUpdateRequirementSummary,
  useRequirementVersions,
} from "@/lib/forms";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";
import { AlertTriangle, Pencil, History } from "lucide-react";
import { ApiClientError } from "@/lib/api-client";

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: requirement, isLoading, isError, refetch } = useRequirement(params.id);
  const reviewRequirement = useReviewRequirement(params.id);
  const reopenRequirement = useReopenRequirement(params.id);
  const toast = useToast();

  const [reviewOpen, setReviewOpen] = useState<"READY" | "NEEDS_CLARIFICATION" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !requirement) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ErrorState description="We couldn't load this requirement." onRetry={() => refetch()} />
      </div>
    );
  }

  const fieldsByKey = new Map(requirement.submission.form.fields.map((f) => [f.id, f]));
  const answers = new Map(requirement.submission.responses.map((r) => [r.fieldId, r.valueJson ?? r.valueText]));
  const canReopen = requirement.readiness === "NEEDS_CLARIFICATION";

  function submitReview() {
    if (!reviewOpen) return;
    reviewRequirement.mutate(
      { decision: reviewOpen, note: reviewNote || undefined },
      {
        onSuccess: () => {
          toast.show({ title: "Review recorded", variant: "success" });
          setReviewOpen(null);
          setReviewNote("");
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title={requirement.title}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={requirement.readiness} />
            <Button size="sm" variant="ghost" onClick={() => setVersionsOpen(true)}>
              <History className="h-3.5 w-3.5" /> v{requirement.version ?? 1}
            </Button>
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {requirement.readiness !== "READY" && (
          <Button size="sm" variant="secondary" onClick={() => setReviewOpen("READY")}>
            Mark ready
          </Button>
        )}
        {requirement.readiness !== "NEEDS_CLARIFICATION" && (
          <Button size="sm" variant="secondary" onClick={() => setReviewOpen("NEEDS_CLARIFICATION")}>
            Request clarification
          </Button>
        )}
        {canReopen && (
          <Button
            size="sm"
            variant="secondary"
            loading={reopenRequirement.isPending}
            onClick={() =>
              reopenRequirement.mutate(undefined, {
                onSuccess: () => toast.show({ title: "Reopened for editing", variant: "success" }),
              })
            }
          >
            Reopen for editing
          </Button>
        )}
      </div>

      <Card className="mt-4">
        <CardContent className="py-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-sm font-semibold text-text-secondary">Summary</p>
            <Button size="sm" variant="ghost" onClick={() => setSummaryOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          <p className="text-sm text-text-primary">{requirement.summary || "No summary yet."}</p>
        </CardContent>
      </Card>

      {requirement.reviewNote && (
        <Card className="mt-4 border-info/30 bg-info/5">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-text-primary">Reviewer note</p>
            <p className="mt-1 text-sm text-text-secondary">{requirement.reviewNote}</p>
          </CardContent>
        </Card>
      )}

      {requirement.missingFields && requirement.missingFields.length > 0 && (
        <Card className="mt-4 border-warning/30 bg-warning/5">
          <CardContent className="flex gap-3 py-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium text-text-primary">Missing information</p>
              <ul className="mt-1 list-inside list-disc text-sm text-text-secondary">
                {requirement.missingFields.map((f) => (
                  <li key={f.key}>{f.label}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {requirement.conflicts && requirement.conflicts.length > 0 && (
        <Card className="mt-4 border-danger/30 bg-danger/5">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-text-primary">Conflicting answers flagged for review</p>
            <ul className="mt-1 space-y-1 text-sm text-text-secondary">
              {requirement.conflicts.map((c, i) => (
                <li key={i}>{c.note}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 space-y-4">
        {requirement.submission.form.fields.map((field) => {
          const value = answers.get(field.id);
          return (
            <div key={field.id} className="border-b border-border pb-3">
              <p className="text-xs font-medium text-text-muted">{field.label}</p>
              <p className="mt-1 text-sm text-text-primary">{formatAnswer(value)}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-text-muted">
        These are the client&apos;s original answers, preserved exactly as submitted — {fieldsByKey.size} fields on this form.
      </p>

      <Dialog open={!!reviewOpen} onOpenChange={(v) => !v && setReviewOpen(null)}>
        <DialogContent
          title={reviewOpen === "READY" ? "Mark as ready" : "Request clarification"}
          description={
            reviewOpen === "READY"
              ? "Confirms this requirement is ready to inform scope."
              : "Sends this back to be reopened and edited."
          }
        >
          <div className="space-y-4">
            <Field label="Note (optional)" htmlFor="review-note">
              <Textarea id="review-note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} />
            </Field>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setReviewOpen(null)}>
                Cancel
              </Button>
              <Button onClick={submitReview} loading={reviewRequirement.isPending}>
                Confirm
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <EditSummaryDialog
        requirementId={requirement.id}
        currentSummary={requirement.summary}
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
      />

      <VersionsDialog requirementId={requirement.id} open={versionsOpen} onOpenChange={setVersionsOpen} />
    </div>
  );
}

function EditSummaryDialog({
  requirementId,
  currentSummary,
  open,
  onOpenChange,
}: {
  requirementId: string;
  currentSummary: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const updateSummary = useUpdateRequirementSummary(requirementId);
  const toast = useToast();
  const [value, setValue] = useState(currentSummary ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateSummary.mutate(value, {
      onSuccess: () => {
        toast.show({ title: "Summary updated", variant: "success" });
        onOpenChange(false);
      },
      onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit summary" description="A short, human-written summary for the team.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} autoFocus />
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateSummary.isPending}>
              Save summary
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VersionsDialog({
  requirementId,
  open,
  onOpenChange,
}: {
  requirementId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: versions, isLoading } = useRequirementVersions(requirementId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Version history" description="Every reviewed or resubmitted state of this requirement.">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {(versions ?? []).map((v) => (
              <div key={v.id} className="border-b border-border pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">Version {v.version}</span>
                  <StatusBadge status={v.readiness} />
                </div>
                {v.changeNote && <p className="mt-1 text-sm text-text-secondary">{v.changeNote}</p>}
                <p className="mt-1 text-xs text-text-muted">{formatDateTime(v.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
