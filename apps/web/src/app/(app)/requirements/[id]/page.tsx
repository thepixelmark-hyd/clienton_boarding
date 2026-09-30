"use client";

import { useParams } from "next/navigation";
import { useRequirement } from "@/lib/forms";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: requirement, isLoading, isError, refetch } = useRequirement(params.id);

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader title={requirement.title} action={<StatusBadge status={requirement.readiness} />} />

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
    </div>
  );
}
