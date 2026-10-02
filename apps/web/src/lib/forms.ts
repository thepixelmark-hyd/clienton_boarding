"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

export interface FormTemplateSummary {
  templateKey: string;
  name: string;
  description: string;
  fieldCount: number;
}

export interface FormFieldItem {
  id: string;
  key: string;
  label: string;
  helpText: string | null;
  type: string;
  required: boolean;
  order: number;
  options: { value: string; label: string }[] | null;
  minSelections: number | null;
  maxSelections: number | null;
  conditionalRule: unknown;
}

export interface FormResponseItem {
  id: string;
  fieldId: string;
  valueText: string | null;
  valueJson: unknown;
}

export interface SubmissionDetail {
  id: string;
  status: "DRAFT" | "SUBMITTED";
  responses: FormResponseItem[];
  form: { id: string; name: string; description: string | null; projectId: string; fields: FormFieldItem[] };
}

export interface RequirementSummary {
  id: string;
  title: string;
  summary: string | null;
  readiness: "MISSING" | "NEEDS_CLARIFICATION" | "READY" | "CONFLICTING";
  missingFields: { key: string; label: string }[] | null;
  conflicts: { fieldAKey: string; fieldBKey: string; note: string }[] | null;
  reviewNote: string | null;
  version: number;
  createdAt: string;
  submission: { form: { name: string; templateKey: string | null } };
}

export interface RequirementDetail extends RequirementSummary {
  submission: SubmissionDetail & { form: { name: string; templateKey: string | null } };
}

export function useFormTemplates() {
  return useQuery({
    queryKey: ["form-templates"],
    queryFn: () => api.get<FormTemplateSummary[]>("/forms/templates"),
  });
}

export function useInstantiateForm(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateKey: string) =>
      api.post<{ form: { id: string }; submission: { id: string } }>(`/projects/${projectId}/requirements`, {
        templateKey,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["requirements", "project", projectId] }),
  });
}

export function useProjectRequirements(projectId: string) {
  return useQuery({
    queryKey: ["requirements", "project", projectId],
    queryFn: () => api.get<RequirementSummary[]>(`/requirements?projectId=${projectId}`),
    enabled: !!projectId,
  });
}

export function useRequirement(id: string) {
  return useQuery({
    queryKey: ["requirements", id],
    queryFn: () => api.get<RequirementDetail>(`/requirements/${id}`),
    enabled: !!id,
  });
}

export function useSubmission(formId: string, submissionId: string) {
  return useQuery({
    queryKey: ["submissions", formId, submissionId],
    queryFn: () => api.get<SubmissionDetail>(`/forms/${formId}/submissions/${submissionId}`),
    enabled: !!formId && !!submissionId,
  });
}

export function useSaveResponses(formId: string, submissionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (responses: { fieldId: string; value: unknown }[]) =>
      api.put<SubmissionDetail>(`/forms/${formId}/submissions/${submissionId}/responses`, { responses }),
    onSuccess: (data) => queryClient.setQueryData(["submissions", formId, submissionId], data),
  });
}

export function useSubmitForm(formId: string, submissionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<RequirementDetail>(`/forms/${formId}/submissions/${submissionId}/submit`),
    onSuccess: (data) => {
      queryClient.setQueryData(["requirements", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
    },
  });
}

// -------------------------------------------------------------------
// File uploads
// -------------------------------------------------------------------

export interface UploadedFileItem {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export function fileDownloadUrl(fileId: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9004/api/v1"}/files/${fileId}`;
}

export function useFieldFiles(formId: string, submissionId: string, fieldId: string, basePath = "") {
  return useQuery({
    queryKey: ["submission-files", formId, submissionId, fieldId],
    queryFn: () =>
      api.get<UploadedFileItem[]>(`${basePath}/forms/${formId}/submissions/${submissionId}/fields/${fieldId}/files`),
    enabled: !!fieldId,
  });
}

export function useUploadFieldFile(formId: string, submissionId: string, fieldId: string, basePath = "") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9004/api/v1"}${basePath}/forms/${formId}/submissions/${submissionId}/fields/${fieldId}/files`,
        { method: "POST", credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" }, body: form },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to upload file.");
      }
      return res.json() as Promise<UploadedFileItem>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["submission-files", formId, submissionId, fieldId] }),
  });
}

export function useDeleteFieldFile(formId: string, submissionId: string, fieldId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => api.delete(`/files/${fileId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["submission-files", formId, submissionId, fieldId] }),
  });
}

// -------------------------------------------------------------------
// Requirement review, reopen, summary, versions
// -------------------------------------------------------------------

export interface RequirementVersionItem {
  id: string;
  version: number;
  summary: string | null;
  readiness: string;
  missingFields: { key: string; label: string }[] | null;
  conflicts: { fieldAKey: string; fieldBKey: string; note: string }[] | null;
  changeNote: string | null;
  createdAt: string;
}

export function useReviewRequirement(requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { decision: "READY" | "NEEDS_CLARIFICATION"; note?: string }) =>
      api.post<RequirementDetail>(`/requirements/${requirementId}/review`, input),
    onSuccess: (data) => {
      queryClient.setQueryData(["requirements", requirementId], data);
      queryClient.invalidateQueries({ queryKey: ["requirements", requirementId, "versions"] });
    },
  });
}

export function useReopenRequirement(requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/requirements/${requirementId}/reopen`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["requirements", requirementId] }),
  });
}

export function useUpdateRequirementSummary(requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (summary: string) => api.patch<RequirementDetail>(`/requirements/${requirementId}/summary`, { summary }),
    onSuccess: (data) => {
      queryClient.setQueryData(["requirements", requirementId], data);
      queryClient.invalidateQueries({ queryKey: ["requirements", requirementId, "versions"] });
    },
  });
}

export function useRequirementVersions(requirementId: string) {
  return useQuery({
    queryKey: ["requirements", requirementId, "versions"],
    queryFn: () => api.get<RequirementVersionItem[]>(`/requirements/${requirementId}/versions`),
    enabled: !!requirementId,
  });
}

// -------------------------------------------------------------------
// Form builder
// -------------------------------------------------------------------

export interface FormSummary {
  id: string;
  name: string;
  description: string | null;
  isTemplate: boolean;
  templateKey: string | null;
  createdAt: string;
  _count: { fields: number; submissions: number };
}

export interface FormFieldInput {
  key: string;
  label: string;
  helpText?: string;
  type: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  minSelections?: number;
  maxSelections?: number;
}

export function useForms(isTemplate?: boolean) {
  return useQuery({
    queryKey: ["forms", isTemplate ?? "all"],
    queryFn: () => api.get<FormSummary[]>(`/forms${isTemplate === undefined ? "" : `?isTemplate=${isTemplate}`}`),
  });
}

export function useCreateForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; clientId?: string; projectId?: string }) =>
      api.post<FormSummary>("/forms", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  });
}

export interface FormWithFields {
  id: string;
  name: string;
  description: string | null;
  isTemplate: boolean;
  fields: FormFieldItem[];
  _count: { submissions: number };
}

export function useFormWithFields(formId: string) {
  return useQuery({
    queryKey: ["forms", formId, "fields"],
    queryFn: () => api.get<FormWithFields>(`/forms/${formId}`),
    enabled: !!formId,
  });
}

export function useAddField(formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FormFieldInput) => api.post<FormFieldItem>(`/forms/${formId}/fields`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", formId, "fields"] });
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
  });
}

export function useUpdateField(formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fieldId, input }: { fieldId: string; input: Partial<FormFieldInput> }) =>
      api.patch<FormFieldItem>(`/forms/${formId}/fields/${fieldId}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms", formId, "fields"] }),
  });
}

export function useDeleteField(formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fieldId: string) => api.delete(`/forms/${formId}/fields/${fieldId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", formId, "fields"] });
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
  });
}

export function useReorderFields(formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fieldIds: string[]) => api.patch<FormFieldItem[]>(`/forms/${formId}/fields-order`, { fieldIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms", formId, "fields"] }),
  });
}

export function useCreateSubmissionForForm(formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      api.post<{ form: { id: string }; submission: { id: string } }>(`/forms/${formId}/submissions`, { projectId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["requirements"] }),
  });
}
