"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isFieldVisible, computeReadiness } from "@clientos/shared";
import { usePortalSubmission, usePortalSaveResponses, usePortalSubmitForm } from "@/lib/portal";
import type { FormFieldItem } from "@/lib/forms";
import { FormFieldControl } from "@/components/forms/field-control";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

function initialAnswers(fields: FormFieldItem[], responses: { fieldId: string; valueText: string | null; valueJson: unknown }[]) {
  const byFieldId = new Map(responses.map((r) => [r.fieldId, r.valueJson ?? r.valueText]));
  const answers: Record<string, unknown> = {};
  for (const field of fields) {
    if (byFieldId.has(field.id)) answers[field.key] = byFieldId.get(field.id);
  }
  return answers;
}

export default function PortalRequirementFillPage() {
  const params = useParams<{ formId: string; submissionId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: submission, isLoading, isError, refetch } = usePortalSubmission(params.formId, params.submissionId);
  const saveResponses = usePortalSaveResponses(params.formId, params.submissionId);
  const submitForm = usePortalSubmitForm(params.formId, params.submissionId);

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [savingFieldKey, setSavingFieldKey] = useState<string | null>(null);

  useEffect(() => {
    if (submission) setAnswers(initialAnswers(submission.form.fields, submission.responses));
  }, [submission]);

  const visibleFields = useMemo(
    () => (submission?.form.fields ?? []).filter((f) => isFieldVisible(f.conditionalRule, answers)),
    [submission, answers],
  );

  const readiness = useMemo(() => {
    if (!submission) return null;
    return computeReadiness(
      submission.form.fields.map((f) => ({ key: f.key, label: f.label, required: f.required, conditionalRule: f.conditionalRule })),
      answers,
    );
  }, [submission, answers]);

  function commitField(field: FormFieldItem, value: unknown) {
    setAnswers((prev) => ({ ...prev, [field.key]: value }));
    setSavingFieldKey(field.key);
    saveResponses.mutate([{ fieldId: field.id, value }], {
      onSettled: () => setSavingFieldKey((k) => (k === field.key ? null : k)),
    });
  }

  function handleSubmit() {
    submitForm.mutate(undefined, {
      onSuccess: () => {
        toast.show({ title: "Submitted — thank you!", variant: "success" });
        router.push("/portal");
      },
      onError: () => toast.show({ title: "Couldn't submit", description: "Try again in a moment.", variant: "danger" }),
    });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !submission) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ErrorState description="We couldn't load this form." onRetry={() => refetch()} />
      </div>
    );
  }

  const alreadySubmitted = submission.status === "SUBMITTED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <h1 className="text-xl font-semibold text-text-primary">{submission.form.name}</h1>
      {submission.form.description && <p className="mt-1 text-sm text-text-secondary">{submission.form.description}</p>}

      {readiness && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>{readiness.completionPercent}% complete</span>
            {readiness.missingFields.length > 0 && (
              <span>{readiness.missingFields.length} required field{readiness.missingFields.length === 1 ? "" : "s"} remaining</span>
            )}
          </div>
          <Progress value={readiness.completionPercent} className="mt-1.5" variant={readiness.completionPercent === 100 ? "success" : "accent"} />
        </div>
      )}

      {alreadySubmitted && (
        <p className="mt-4 rounded-md bg-info/10 px-3 py-2 text-sm text-info">
          This has been submitted. Your agency will reach out if they need anything else.
        </p>
      )}

      <div className="mt-6 space-y-5">
        {visibleFields.map((field) => (
          <FormFieldControl
            key={field.id}
            field={field}
            value={answers[field.key]}
            disabled={alreadySubmitted}
            saving={savingFieldKey === field.key}
            onCommit={(value) => commitField(field, value)}
            formId={params.formId}
            submissionId={params.submissionId}
            basePath="/portal"
          />
        ))}
      </div>

      {!alreadySubmitted && (
        <div className="mt-8 flex justify-end border-t border-border pt-6">
          <Button onClick={handleSubmit} loading={submitForm.isPending}>
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}
