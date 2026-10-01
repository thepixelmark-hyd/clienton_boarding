"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientPortalRole,
  CreateClientInput,
  CreateContactInput,
  InviteClientPortalUserInput,
  OnboardingItemStatus,
  UpdateClientInput,
  UpdateContactInput,
} from "@clientos/shared";
import { api } from "./api-client";

export interface ClientSummary {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  status: string;
  onboardingStatus: string;
  logoUrl: string | null;
  createdAt: string;
  version: number;
  _count: { projects: number; contacts: number };
}

export interface ContactItem {
  id: string;
  fullName: string;
  email: string;
  title: string | null;
  role: string;
  isPrimary: boolean;
  isDecisionMaker: boolean;
  isBillingContact: boolean;
  version: number;
}

export interface ClientDetail extends ClientSummary {
  description: string | null;
  timezone: string;
  contacts: ContactItem[];
  projects: { id: string; name: string; status: string; type: string | null }[];
  timelineEvents: { id: string; type: string; title: string; description: string | null; occurredAt: string }[];
}

export interface OnboardingItem {
  id: string;
  key: string;
  title: string;
  description: string | null;
  order: number;
  isRequired: boolean;
  status: OnboardingItemStatus;
  completedAt: string | null;
}

export interface ClientInvitationItem {
  id: string;
  email: string;
  role: ClientPortalRole;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  createdAt: string;
}

export interface PortalUserItem {
  id: string;
  email: string;
  role: ClientPortalRole;
  lastLoginAt: string | null;
  createdAt: string;
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

export function useUpdateClient(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateClientInput) => api.patch<ClientDetail>(`/clients/${clientId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => api.delete(`/clients/${clientId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateContact(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, input }: { contactId: string; input: UpdateContactInput }) =>
      api.patch(`/clients/${clientId}/contacts/${contactId}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", clientId] }),
  });
}

export function useDeleteContact(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => api.delete(`/clients/${clientId}/contacts/${contactId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", clientId] }),
  });
}

export function useUploadLogo(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/clients/${clientId}/logo`, {
        method: "POST",
        credentials: "include",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to upload logo.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function logoUrl(clientId: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/clients/${clientId}/logo`;
}

// -------------------------------------------------------------------
// Onboarding checklist
// -------------------------------------------------------------------

export function useOnboarding(clientId: string) {
  return useQuery({
    queryKey: ["clients", clientId, "onboarding"],
    queryFn: () => api.get<OnboardingItem[]>(`/clients/${clientId}/onboarding`),
    enabled: !!clientId,
  });
}

export function useStartOnboarding(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<OnboardingItem[]>(`/clients/${clientId}/onboarding/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", clientId, "onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clients", clientId] });
    },
  });
}

export function useUpdateOnboardingItem(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: OnboardingItemStatus }) =>
      api.patch(`/clients/${clientId}/onboarding/${itemId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", clientId, "onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["clients", clientId] });
    },
  });
}

// -------------------------------------------------------------------
// Client portal invitations
// -------------------------------------------------------------------

export function usePortalInvitations(clientId: string) {
  return useQuery({
    queryKey: ["clients", clientId, "invitations"],
    queryFn: () => api.get<ClientInvitationItem[]>(`/clients/${clientId}/invitations`),
    enabled: !!clientId,
  });
}

export function usePortalUsers(clientId: string) {
  return useQuery({
    queryKey: ["clients", clientId, "portal-users"],
    queryFn: () => api.get<PortalUserItem[]>(`/clients/${clientId}/portal-users`),
    enabled: !!clientId,
  });
}

export function useInvitePortalUser(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteClientPortalUserInput) => api.post(`/clients/${clientId}/invitations`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", clientId, "invitations"] }),
  });
}

export function useRevokePortalInvitation(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => api.delete(`/clients/${clientId}/invitations/${invitationId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", clientId, "invitations"] }),
  });
}
