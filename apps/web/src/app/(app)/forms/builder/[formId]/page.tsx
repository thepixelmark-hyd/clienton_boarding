"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Pencil, Trash2, Lock } from "lucide-react";
import {
  useFormWithFields,
  useAddField,
  useUpdateField,
  useDeleteField,
  useReorderFields,
  type FormFieldItem,
  type FormFieldInput,
} from "@/lib/forms";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

const FIELD_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "RICH_TEXT",
  "NUMBER",
  "CURRENCY",
  "DATE",
  "URL",
  "EMAIL",
  "PHONE",
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "RATING",
  "FILE_UPLOAD",
  "IMAGE_UPLOAD",
  "VIDEO_UPLOAD",
  "CONSENT",
] as const;

const SELECT_TYPES = new Set(["SINGLE_SELECT", "MULTI_SELECT"]);

function parseOptions(text: string): { value: string; label: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.split("|").map((s) => s.trim());
      return { value: value || label, label: label || value };
    });
}

function optionsToText(options?: { value: string; label: string }[] | null): string {
  return (options ?? []).map((o) => (o.value === o.label ? o.label : `${o.value}|${o.label}`)).join("\n");
}

export default function FormBuilderPage() {
  const params = useParams<{ formId: string }>();
  const { data: form, isLoading, isError, refetch } = useFormWithFields(params.formId);
  const deleteField = useDeleteField(params.formId);
  const reorderFields = useReorderFields(params.formId);
  const toast = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormFieldItem | null>(null);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !form) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ErrorState description="We couldn't load this form." onRetry={() => refetch()} />
      </div>
    );
  }

  const locked = !form.isTemplate && form._count.submissions > 0;

  function move(index: number, direction: -1 | 1) {
    if (!form) return;
    const ids = form.fields.map((f) => f.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderFields.mutate(ids);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link href="/forms" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Forms
      </Link>
      <PageHeader
        title={form.name}
        description={form.description ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={form.isTemplate ? "accent" : "neutral"}>{form.isTemplate ? "Template" : "Project form"}</Badge>
            {!locked && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add field
              </Button>
            )}
          </div>
        }
      />

      {locked && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Fields are locked because a submission already exists against this form.
        </div>
      )}

      <div className="mt-6 space-y-2">
        {form.fields.length === 0 ? (
          <EmptyState title="No fields yet" description="Add the first question for this form." />
        ) : (
          form.fields.map((field, index) => (
            <Card key={field.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="flex flex-col">
                  <button disabled={locked || index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5 text-text-muted disabled:opacity-30" />
                  </button>
                  <button disabled={locked || index === form.fields.length - 1} onClick={() => move(index, 1)} aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5 text-text-muted disabled:opacity-30" />
                  </button>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    {field.label} {field.required && <span className="text-danger">*</span>}
                  </p>
                  <p className="text-xs text-text-muted">
                    {field.key} · {field.type.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                {!locked && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditingField(field)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeletingFieldId(field.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <FieldDialog formId={params.formId} open={addOpen} onOpenChange={setAddOpen} mode="create" />
      {editingField && (
        <FieldDialog
          formId={params.formId}
          open={!!editingField}
          onOpenChange={(v) => !v && setEditingField(null)}
          mode="edit"
          field={editingField}
        />
      )}

      <ConfirmDialog
        open={!!deletingFieldId}
        onOpenChange={(v) => !v && setDeletingFieldId(null)}
        title="Delete this field?"
        description="Any saved answers for this field are removed too."
        confirmLabel="Delete field"
        destructive
        loading={deleteField.isPending}
        onConfirm={() => {
          if (!deletingFieldId) return;
          deleteField.mutate(deletingFieldId, {
            onSuccess: () => {
              toast.show({ title: "Field deleted", variant: "success" });
              setDeletingFieldId(null);
            },
          });
        }}
      />
    </div>
  );
}

function FieldDialog({
  formId,
  open,
  onOpenChange,
  mode,
  field,
}: {
  formId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  field?: FormFieldItem;
}) {
  const addField = useAddField(formId);
  const updateField = useUpdateField(formId);
  const toast = useToast();

  const [key, setKey] = useState(field?.key ?? "");
  const [label, setLabel] = useState(field?.label ?? "");
  const [helpText, setHelpText] = useState(field?.helpText ?? "");
  const [type, setType] = useState<string>(field?.type ?? "SHORT_TEXT");
  const [required, setRequired] = useState(field?.required ?? false);
  const [optionsText, setOptionsText] = useState(optionsToText(field?.options));
  const [minSelections, setMinSelections] = useState(field?.minSelections?.toString() ?? "");
  const [maxSelections, setMaxSelections] = useState(field?.maxSelections?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);

  const pending = addField.isPending || updateField.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || (mode === "create" && !key.trim())) {
      setError("Key and label are required.");
      return;
    }

    const input: FormFieldInput = {
      key,
      label,
      helpText: helpText || undefined,
      type,
      required,
      options: SELECT_TYPES.has(type) ? parseOptions(optionsText) : undefined,
      minSelections: type === "MULTI_SELECT" && minSelections ? Number(minSelections) : undefined,
      maxSelections: type === "MULTI_SELECT" && maxSelections ? Number(maxSelections) : undefined,
    };

    const onSuccess = () => {
      toast.show({ title: mode === "create" ? "Field added" : "Field updated", variant: "success" });
      onOpenChange(false);
    };
    const onError = (err: unknown) => setError(err instanceof ApiClientError ? err.message : "Something went wrong.");

    if (mode === "create") {
      addField.mutate(input, { onSuccess, onError });
    } else if (field) {
      const { key: _key, ...rest } = input;
      updateField.mutate({ fieldId: field.id, input: rest }, { onSuccess, onError });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={mode === "create" ? "Add field" : "Edit field"} description="Questions on this form.">
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "create" && (
            <Field label="Key (stable identifier)" htmlFor="field-key" required>
              <Input id="field-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. businessName" autoFocus />
            </Field>
          )}
          <Field label="Label" htmlFor="field-label" required>
            <Input id="field-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label="Help text" htmlFor="field-help">
            <Input id="field-help" value={helpText} onChange={(e) => setHelpText(e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="field-type">
            <Select value={type} onValueChange={setType} disabled={mode === "edit"}>
              <SelectTrigger id="field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {SELECT_TYPES.has(type) && (
            <Field label="Options (one per line: value|Label, or just Label)" htmlFor="field-options">
              <Textarea id="field-options" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={4} />
            </Field>
          )}
          {type === "MULTI_SELECT" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min selections" htmlFor="field-min">
                <Input id="field-min" type="number" value={minSelections} onChange={(e) => setMinSelections(e.target.value)} />
              </Field>
              <Field label="Max selections" htmlFor="field-max">
                <Input id="field-max" type="number" value={maxSelections} onChange={(e) => setMaxSelections(e.target.value)} />
              </Field>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <Checkbox checked={required} onCheckedChange={(v) => setRequired(v === true)} />
            Required
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {mode === "create" ? "Add field" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
