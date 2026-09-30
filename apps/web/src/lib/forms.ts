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
  readiness: "MISSING" | "NEEDS_CLARIFICATION" | "READY" | "CONFLICTING";
  missingFields: { key: string; label: string }[] | null;
  conflicts: { fieldAKey: string; fieldBKey: string; note: string }[] | null;
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
