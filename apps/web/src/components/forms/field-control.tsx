"use client";

import { useEffect, useState } from "react";
import { Star, Upload, X, FileText, Loader2 } from "lucide-react";
import type { FormFieldItem } from "@/lib/forms";
import { useFieldFiles, useUploadFieldFile, useDeleteFieldFile, fileDownloadUrl } from "@/lib/forms";
import { Field, FieldHelp } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const UPLOAD_ACCEPT: Record<string, string> = {
  IMAGE_UPLOAD: "image/png,image/jpeg,image/gif,image/webp",
  FILE_UPLOAD: "application/pdf",
  VIDEO_UPLOAD: "video/mp4,video/quicktime",
};

export interface FormFieldControlProps {
  field: FormFieldItem;
  value: unknown;
  disabled?: boolean;
  saving?: boolean;
  onCommit: (value: unknown) => void;
  /** The form/submission this field belongs to — only needed for upload
   * field types, which manage their own files independently of onCommit. */
  formId: string;
  submissionId: string;
  /** "" for the internal app (apps/forms/...), "/portal" for the client
   * portal — both hit the same shape of endpoint under a different prefix. */
  basePath?: string;
}

export function FormFieldControl({
  field,
  value,
  disabled,
  saving,
  onCommit,
  formId,
  submissionId,
  basePath = "",
}: FormFieldControlProps) {
  const [localText, setLocalText] = useState(typeof value === "string" ? value : "");

  useEffect(() => {
    setLocalText(typeof value === "string" ? value : "");
  }, [value]);

  const help = saving ? "Saving…" : field.helpText ?? undefined;

  switch (field.type) {
    case "SHORT_TEXT":
    case "URL":
    case "EMAIL":
    case "PHONE":
      return (
        <Field label={field.label} htmlFor={field.id} required={field.required} help={help}>
          <Input
            id={field.id}
            type={field.type === "EMAIL" ? "email" : field.type === "URL" ? "url" : "text"}
            value={localText}
            disabled={disabled}
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={() => onCommit(localText)}
          />
        </Field>
      );
    case "DATE":
      return (
        <Field label={field.label} htmlFor={field.id} required={field.required} help={help}>
          <Input
            id={field.id}
            type="date"
            value={localText}
            disabled={disabled}
            onChange={(e) => {
              setLocalText(e.target.value);
              onCommit(e.target.value);
            }}
          />
        </Field>
      );
    case "NUMBER":
    case "CURRENCY":
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
    case "CONSENT":
      return (
        <div>
          <label className="flex items-start gap-2 text-sm text-text-primary">
            <Checkbox
              id={field.id}
              checked={value === true}
              disabled={disabled}
              onCheckedChange={(next) => onCommit(next === true)}
            />
            <span>
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </span>
          </label>
          <FieldHelp>{help}</FieldHelp>
        </div>
      );
    case "RATING": {
      const rating = typeof value === "number" ? value : 0;
      return (
        <Field label={field.label} htmlFor={field.id} required={field.required} help={help}>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onCommit(n)}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                className="disabled:opacity-50"
              >
                <Star className={`h-5 w-5 ${n <= rating ? "fill-warning text-warning" : "text-border-strong"}`} />
              </button>
            ))}
          </div>
        </Field>
      );
    }
    case "IMAGE_UPLOAD":
    case "FILE_UPLOAD":
    case "VIDEO_UPLOAD":
      return (
        <Field label={field.label} htmlFor={field.id} required={field.required} help={help}>
          <FileUploadControl
            field={field}
            formId={formId}
            submissionId={submissionId}
            basePath={basePath}
            disabled={disabled}
          />
        </Field>
      );
    default:
      return (
        <Field label={field.label} htmlFor={field.id} help="This question type isn't available in this phase yet.">
          <Input id={field.id} disabled placeholder="Not yet supported" />
        </Field>
      );
  }
}

function FileUploadControl({
  field,
  formId,
  submissionId,
  basePath,
  disabled,
}: {
  field: FormFieldItem;
  formId: string;
  submissionId: string;
  basePath: string;
  disabled?: boolean;
}) {
  const { data: files, isLoading } = useFieldFiles(formId, submissionId, field.id, basePath);
  const upload = useUploadFieldFile(formId, submissionId, field.id, basePath);
  const del = useDeleteFieldFile(formId, submissionId, field.id);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    upload.mutate(file, { onError: (err) => setError(err instanceof Error ? err.message : "Upload failed.") });
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
      ) : (
        (files ?? []).map((f) => (
          <div key={f.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-text-muted" />
            <a href={fileDownloadUrl(f.id)} target="_blank" rel="noreferrer" className="flex-1 truncate text-accent hover:underline">
              {f.originalName}
            </a>
            <span className="text-xs text-text-muted">{Math.round(f.sizeBytes / 1024)}KB</span>
            {!disabled && (
              <button type="button" onClick={() => del.mutate(f.id)} aria-label="Remove file">
                <X className="h-3.5 w-3.5 text-text-muted hover:text-danger" />
              </button>
            )}
          </div>
        ))
      )}
      {!disabled && (
        <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border-strong px-3 py-2 text-sm text-text-secondary hover:border-accent hover:text-accent">
          <Upload className="h-3.5 w-3.5" />
          {upload.isPending ? "Uploading…" : "Upload file"}
          <input
            type="file"
            accept={UPLOAD_ACCEPT[field.type]}
            className="hidden"
            disabled={upload.isPending}
            onChange={handleChange}
          />
        </label>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
