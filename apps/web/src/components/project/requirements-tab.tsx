"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { useProjectRequirements, useFormTemplates, useInstantiateForm } from "@/lib/forms";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

export function RequirementsTab({ projectId }: { projectId: string }) {
  const { data: requirements, isLoading, isError, refetch } = useProjectRequirements(projectId);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add requirement
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <ErrorState description="We couldn't load requirements." onRetry={() => refetch()} />
      ) : requirements!.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No requirements captured yet"
          description="Send a structured questionnaire to gather what this project needs before work starts."
          action={
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add requirement
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {requirements!.map((req) => (
            <RequirementRow key={req.id} requirement={req} />
          ))}
        </div>
      )}

      <AddRequirementDialog projectId={projectId} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function RequirementRow({
  requirement,
}: {
  requirement: {
    id: string;
    title: string;
    readiness: string;
    missingFields: { key: string; label: string }[] | null;
    createdAt: string;
  };
}) {
  const router = useRouter();
  return (
    <Card className="cursor-pointer transition-colors hover:border-border-strong" onClick={() => router.push(`/requirements/${requirement.id}`)}>
      <CardContent className="py-3.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-text-primary">{requirement.title}</p>
          <StatusBadge status={requirement.readiness} />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Submitted {formatDate(requirement.createdAt)}
          {requirement.missingFields && requirement.missingFields.length > 0
            ? ` · ${requirement.missingFields.length} field${requirement.missingFields.length === 1 ? "" : "s"} missing`
            : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function AddRequirementDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { data: templates, isLoading } = useFormTemplates();
  const instantiate = useInstantiateForm(projectId);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    if (!selected) {
      setError("Choose a template to continue.");
      return;
    }
    instantiate.mutate(selected, {
      onSuccess: (result) => {
        onOpenChange(false);
        router.push(`/forms/${result.form.id}/submissions/${result.submission.id}`);
      },
      onError: () => setError("Something went wrong creating this requirement."),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a requirement" description="Choose a template to start gathering what this project needs.">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-2">
            {(templates ?? []).map((template) => (
              <button
                key={template.templateKey}
                type="button"
                onClick={() => setSelected(template.templateKey)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  selected === template.templateKey ? "border-accent bg-accent/5" : "border-border hover:border-border-strong"
                }`}
              >
                <p className="text-sm font-medium text-text-primary">{template.name}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{template.description}</p>
                <p className="mt-1 text-[11px] text-text-muted">{template.fieldCount} questions</p>
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleContinue} loading={instantiate.isPending}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
