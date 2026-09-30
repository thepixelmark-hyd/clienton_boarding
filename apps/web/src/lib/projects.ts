"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput, CreateTaskInput, UpdateTaskInput } from "@clientos/shared";
import { api } from "./api-client";

export interface ProjectHealth {
  status: "HEALTHY" | "WATCH" | "AT_RISK" | "BLOCKED" | "CRITICAL";
  reason: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  type: string | null;
  client: { id: string; name: string };
  health: ProjectHealth;
  _count: { tasks: number };
}

export interface ProjectDetail extends ProjectSummary {
  description: string | null;
  startDate: string | null;
  targetEndDate: string | null;
  contractValue: string | null;
  version: number;
  milestones: { id: string; name: string; dueDate: string | null; status: string }[];
  deliverables: { id: string; name: string; status: string }[];
  members: { user: { id: string; fullName: string; avatarUrl: string | null } }[];
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE";

export interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  version: number;
  assignee: { id: string; fullName: string; avatarUrl: string | null } | null;
  dependenciesFrom: { blockingTaskId: string }[];
}

interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function useProjects(clientId?: string) {
  return useQuery({
    queryKey: ["projects", clientId ?? "all"],
    queryFn: () => api.get<Paginated<ProjectSummary>>(`/projects${clientId ? `?clientId=${clientId}` : ""}`),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.post<ProjectSummary>("/projects", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "tasks"],
    queryFn: () => api.get<TaskItem[]>(`/projects/${projectId}/tasks`),
    enabled: !!projectId,
  });
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.post<TaskItem>(`/projects/${projectId}/tasks`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) => api.patch<TaskItem>(`/tasks/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}
