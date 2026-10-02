"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateDeliverableInput,
  LinkDeliverableRequirementInput,
  UpdateDeliverableInput,
} from "@clientos/shared";
import { api } from "./api-client";

export interface DeliverableTaskItem {
  id: string;
  title: string;
  status: string;
}

export interface DeliverableRequirementLink {
  requirementId: string;
  requirement: { id: string; title: string; readiness: string };
}

export interface DeliverableItem {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "IN_REVIEW" | "APPROVED" | "DELIVERED";
  acceptanceCriteria: string | null;
  dueDate: string | null;
  version: number;
  tasks: DeliverableTaskItem[];
  requirementLinks: DeliverableRequirementLink[];
}

export interface TraceabilityRequirement {
  id: string;
  title: string;
  readiness: string;
}

export interface ProjectTraceability {
  deliverables: DeliverableItem[];
  unlinkedRequirements: TraceabilityRequirement[];
}

export function useDeliverables(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "deliverables"],
    queryFn: () => api.get<DeliverableItem[]>(`/projects/${projectId}/deliverables`),
    enabled: !!projectId,
  });
}

export function useDeliverable(id: string) {
  return useQuery({
    queryKey: ["deliverables", id],
    queryFn: () => api.get<DeliverableItem>(`/deliverables/${id}`),
    enabled: !!id,
  });
}

export function useProjectTraceability(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "traceability"],
    queryFn: () => api.get<ProjectTraceability>(`/projects/${projectId}/traceability`),
    enabled: !!projectId,
  });
}

export function useCreateDeliverable(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDeliverableInput) => api.post<DeliverableItem>(`/projects/${projectId}/deliverables`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "traceability"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useUpdateDeliverable(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDeliverableInput }) =>
      api.patch<DeliverableItem>(`/deliverables/${id}`, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "traceability"] });
      queryClient.invalidateQueries({ queryKey: ["deliverables", variables.id] });
    },
  });
}

export function useDeleteDeliverable(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/deliverables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "traceability"] });
    },
  });
}

export function useLinkRequirement(projectId: string, deliverableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkDeliverableRequirementInput) =>
      api.post(`/deliverables/${deliverableId}/requirements`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliverables", deliverableId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "traceability"] });
    },
  });
}

export function useUnlinkRequirement(projectId: string, deliverableId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requirementId: string) => api.delete(`/deliverables/${deliverableId}/requirements/${requirementId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliverables", deliverableId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "traceability"] });
    },
  });
}
