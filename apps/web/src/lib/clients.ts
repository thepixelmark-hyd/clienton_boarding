"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateClientInput, CreateContactInput } from "@clientos/shared";
import { api } from "./api-client";

export interface ClientSummary {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  status: string;
  onboardingStatus: string;
  createdAt: string;
  version: number;
  _count: { projects: number; contacts: number };
}

export interface ClientDetail extends ClientSummary {
  description: string | null;
  timezone: string;
  contacts: { id: string; fullName: string; email: string; title: string | null; isPrimary: boolean; isDecisionMaker: boolean; isBillingContact: boolean }[];
  projects: { id: string; name: string; status: string; type: string | null }[];
  timelineEvents: { id: string; type: string; title: string; description: string | null; occurredAt: string }[];
}

interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function useClients(search?: string) {
  return useQuery({
    queryKey: ["clients", search ?? ""],
    queryFn: () => api.get<Paginated<ClientSummary>>(`/clients${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: () => api.get<ClientDetail>(`/clients/${id}`),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientInput) => api.post<ClientSummary>("/clients", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useAddContact(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContactInput) => api.post(`/clients/${clientId}/contacts`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", clientId] }),
  });
}
