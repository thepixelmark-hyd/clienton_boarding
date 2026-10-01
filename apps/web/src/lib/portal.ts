"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PortalLoginInput } from "@clientos/shared";
import { api } from "./api-client";
import type { FormFieldItem, FormResponseItem } from "./forms";

export interface PortalMe {
  id: string;
  email: string;
  role: string;
  client: { id: string; name: string; logoUrl: string | null };
}

export interface PortalOnboardingItem {
  id: string;
  key: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  status: string;
}

export interface PortalRequirementSummary {
  id: string;
  status: "DRAFT" | "SUBMITTED";
  createdAt: string;
  form: { id: string; name: string; templateKey: string | null };
  requirement: { id: string; readiness: string; version: number; summary: string | null } | null;
}

export interface PortalSubmissionDetail {
  id: string;
  status: "DRAFT" | "SUBMITTED";
  responses: FormResponseItem[];
  form: { id: string; name: string; description: string | null; fields: FormFieldItem[] };
}

export function usePortalLogin() {
  return useMutation({
    mutationFn: (input: PortalLoginInput) => api.post<{ portalUser: { id: string } }>("/portal/auth/login", input),
  });
}

export function usePortalLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/portal/auth/logout"),
    onSuccess: () => queryClient.clear(),
  });
}

export function usePortalMe() {
  return useQuery({
    queryKey: ["portal", "me"],
    queryFn: () => api.get<PortalMe>("/portal/auth/me"),
    retry: false,
  });
}

export function usePortalAcceptInvite() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      api.post<{ portalUser: { id: string } }>(`/portal/auth/invitations/${token}/accept`, { password }),
  });
}

export function usePortalOnboarding() {
  return useQuery({
    queryKey: ["portal", "onboarding"],
    queryFn: () => api.get<PortalOnboardingItem[]>("/portal/onboarding"),
  });
}

export function usePortalRequirements() {
  return useQuery({
    queryKey: ["portal", "requirements"],
    queryFn: () => api.get<PortalRequirementSummary[]>("/portal/requirements"),
  });
}

export function usePortalSubmission(formId: string, submissionId: string) {
  return useQuery({
    queryKey: ["portal", "submissions", formId, submissionId],
    queryFn: () => api.get<PortalSubmissionDetail>(`/portal/forms/${formId}/submissions/${submissionId}`),
    enabled: !!formId && !!submissionId,
  });
}

export function usePortalSaveResponses(formId: string, submissionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (responses: { fieldId: string; value: unknown }[]) =>
      api.put<PortalSubmissionDetail>(`/portal/forms/${formId}/submissions/${submissionId}/responses`, { responses }),
    onSuccess: (data) => queryClient.setQueryData(["portal", "submissions", formId, submissionId], data),
  });
}

export function usePortalSubmitForm(formId: string, submissionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/portal/forms/${formId}/submissions/${submissionId}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "submissions", formId, submissionId] });
      queryClient.invalidateQueries({ queryKey: ["portal", "requirements"] });
    },
  });
}
