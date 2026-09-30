"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, SignupInput } from "@clientos/shared";
import { api } from "./api-client";

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  memberships: { organizationId: string; organizationName: string; role: string }[];
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/auth/me"),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post("/auth/login", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) => api.post("/auth/signup", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export interface OrgMember {
  id: string;
  role: string;
  user: { id: string; fullName: string; email: string; avatarUrl: string | null };
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: () => api.get<OrgMember[]>("/auth/members"),
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: string }) => api.post("/auth/invitations", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => queryClient.setQueryData(["me"], undefined),
  });
}
