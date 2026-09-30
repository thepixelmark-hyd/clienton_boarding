"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isFieldVisible, computeReadiness } from "@clientos/shared";
import { useSubmission, useSaveResponses, useSubmitForm, type FormFieldItem } from "@/lib/forms";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function FormSubmissionPage() {
  const params = useParams<{ formId: string; submissionId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: submission, isLoading, isError, refetch } = useSubmission(params.formId, params.submissionId);
  const saveResponses = useSaveResponses(params.formId, params.submissionId);
  const submitForm = useSubmitForm(params.formId, params.submissionId);

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
      onSuccess: (requirement) => {
        toast.show({ title: "Requirement submitted", variant: "success" });
        router.push(`/requirements/${requirement.id}`);
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
      <PageHeader title={submission.form.name} description={submission.form.description ?? undefined} />

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
          This requirement has been submitted and can no longer be edited here.
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
          />
        ))}
      </div>

      {!alreadySubmitted && (
        <div className="mt-8 flex justify-end border-t border-border pt-6">
          <Button onClick={handleSubmit} loading={submitForm.isPending}>
            Submit requirement
          </Button>
        </div>
      )}
    </div>
  );
}

function FormFieldControl({
  field,
  value,
  disabled,
  saving,
  onCommit,
}: {
  field: FormFieldItem;
  value: unknown;
  disabled?: boolean;
  saving?: boolean;
  onCommit: (value: unknown) => void;
}) {
  const [localText, setLocalText] = useState(typeof value === "string" ? value : "");

  useEffect(() => {
    setLocalText(typeof value === "string" ? value : "");
  }, [value]);

  const help = saving ? "Saving…" : field.helpText ?? undefined;

  switch (field.type) {
    case "SHORT_TEXT":
    case "URL":
      return (
        <Field label={field.label} htmlFor={field.id} required={field.required} help={help}>
          <Input
            id={field.id}
            value={localText}
            disabled={disabled}
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={() => onCommit(localText)}
          />
        </Field>
      );
    case "NUMBER":
      return (
        <Field label={field.label} htmlFor={field.id} required={field.required} help={help}>
          <Input
            id={field.id}
            type="number"
            value={localText}
            disabled={disabled}
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={() => onCommit(localText === "" ? undefined : Number(localText))}
          />
        </Field>
      );
    case "LONG_TEXT":
    case "RICH_TEXT":
      return (
        <Field label={field.label} htmlFor={field.id} required={field.required} help={help}>
          <Textarea
            id={field.id}
            value={localText}
            disabled={disabled}
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={() => onCommit(localText)}
          />
        </Field>
      );
    case "SINGLE_SELECT":
      return (
        <Field label={field.label} htmlFor={field.id} required={field.required} help={help}>
          <Select value={typeof value === "string" ? value : undefined} onValueChange={(v) => onCommit(v)} disabled={disabled}>
            <SelectTrigger id={field.id}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      );
    case "MULTI_SELECT": {
      const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Field label={field.label} htmlFor={field.id} required={field.required} help={help}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-border p-3">
            {(field.options ?? []).map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label key={opt.value} className="flex items-center gap-2 text-sm text-text-primary">
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(next) => {
                      const nextSelected = next ? [...selected, opt.value] : selected.filter((v) => v !== opt.value);
                      onCommit(nextSelected);
                    }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </Field>
      );
    }
    default:
      return (
        <Field label={field.label} htmlFor={field.id} help="This question type isn't available in this phase yet.">
          <Input id={field.id} disabled placeholder="Not yet supported" />
        </Field>
      );
  }
}
