"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddProjectMemberInput,
  CreateCommentInput,
  CreateMilestoneInput,
  CreatePhaseInput,
  CreateProjectInput,
  CreateTaskInput,
  ReorderPhasesInput,
  UpdateMilestoneInput,
  UpdatePhaseInput,
  UpdateProjectMemberInput,
  UpdateTaskInput,
} from "@clientos/shared";
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

export interface ProjectMemberItem {
  id: string;
  userId: string;
  role: "LEAD" | "CONTRIBUTOR" | "OBSERVER";
  user: { id: string; fullName: string; avatarUrl: string | null };
}

export interface PhaseItem {
  id: string;
  name: string;
  order: number;
  startDate: string | null;
  endDate: string | null;
  milestones?: MilestoneItem[];
}

export interface MilestoneItem {
  id: string;
  name: string;
  phaseId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "MISSED";
}

export interface DeliverableSummary {
  id: string;
  name: string;
  status: string;
}

export interface ProjectDetail extends ProjectSummary {
  description: string | null;
  startDate: string | null;
  targetEndDate: string | null;
  contractValue: string | null;
  sourceTemplateId: string | null;
  version: number;
  milestones: MilestoneItem[];
  deliverables: DeliverableSummary[];
  phases: PhaseItem[];
  members: ProjectMemberItem[];
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE";

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: string;
  visibility: "INTERNAL" | "CLIENT_VISIBLE";
  dueDate: string | null;
  startDate?: string | null;
  estimatedHours?: string | null;
  actualHours?: string | null;
  waitingOnClient: boolean;
  waitingOnClientNote: string | null;
  version: number;
  milestoneId?: string | null;
  deliverableId?: string | null;
  parentTaskId?: string | null;
  assignee: { id: string; fullName: string; avatarUrl: string | null } | null;
  dependenciesFrom: { blockingTaskId: string; blockingTask: { title: string; status: TaskStatus } }[];
  subtasks: { id: string; status: TaskStatus }[];
  _count: { comments: number };
}

export interface TaskDetail extends TaskItem {
  parentTask: { id: string; title: string } | null;
  deliverable: { id: string; name: string } | null;
  milestone: { id: string; name: string } | null;
}

export interface TaskCommentItem {
  id: string;
  body: string;
  visibility: "INTERNAL" | "CLIENT_VISIBLE";
  createdAt: string;
  author: { id: string; fullName: string; avatarUrl: string | null } | null;
}

export interface ProjectActivityItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
}

export interface ProjectDashboard {
  projectId: string;
  health: ProjectHealth;
  taskStatusBreakdown: Record<string, number>;
  totalTasks: number;
  overdueTasks: { id: string; title: string; dueDate: string; assignee: { fullName: string } | null }[];
  upcomingMilestones: MilestoneItem[];
  deliverableStatusBreakdown: Record<string, number>;
  waitingOnClient: {
    tasks: { id: string; title: string; waitingOnClientNote: string | null; dueDate: string | null }[];
    openRequirementCount: number;
  };
  recentActivity: ProjectActivityItem[];
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

export function useTask(taskId: string) {
  return useQuery({
    queryKey: ["tasks", taskId],
    queryFn: () => api.get<TaskDetail>(`/tasks/${taskId}`),
    enabled: !!taskId,
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.id] });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: ["tasks", taskId, "comments"],
    queryFn: () => api.get<TaskCommentItem[]>(`/tasks/${taskId}/comments`),
    enabled: !!taskId,
  });
}

export function useAddTaskComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) => api.post<TaskCommentItem>(`/tasks/${taskId}/comments`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
    },
  });
}

export function useDeleteTaskComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.delete(`/tasks/${taskId}/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
    },
  });
}

// -----------------------------------------------------------------------
// Phases
// -----------------------------------------------------------------------

export function usePhases(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "phases"],
    queryFn: () => api.get<PhaseItem[]>(`/projects/${projectId}/phases`),
    enabled: !!projectId,
  });
}

export function useAddPhase(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePhaseInput) => api.post<PhaseItem>(`/projects/${projectId}/phases`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "phases"] }),
  });
}

export function useUpdatePhase(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePhaseInput }) =>
      api.patch<PhaseItem>(`/projects/${projectId}/phases/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "phases"] }),
  });
}

export function useDeletePhase(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/phases/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "phases"] }),
  });
}

export function useReorderPhases(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReorderPhasesInput) => api.patch<PhaseItem[]>(`/projects/${projectId}/phases-order`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "phases"] }),
  });
}

// -----------------------------------------------------------------------
// Milestones
// -----------------------------------------------------------------------

export function useAddMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMilestoneInput) => api.post<MilestoneItem>(`/projects/${projectId}/milestones`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "phases"] });
    },
  });
}

export function useUpdateMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMilestoneInput }) =>
      api.patch<MilestoneItem>(`/projects/${projectId}/milestones/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "phases"] });
    },
  });
}

export function useDeleteMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/milestones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "phases"] });
    },
  });
}

// -----------------------------------------------------------------------
// Members (assignments)
// -----------------------------------------------------------------------

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "members"],
    queryFn: () => api.get<ProjectMemberItem[]>(`/projects/${projectId}/members`),
    enabled: !!projectId,
  });
}

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddProjectMemberInput) => api.post<ProjectMemberItem>(`/projects/${projectId}/members`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] }),
  });
}

export function useUpdateProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateProjectMemberInput }) =>
      api.patch<ProjectMemberItem>(`/projects/${projectId}/members/${userId}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] }),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/projects/${projectId}/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] }),
  });
}

// -----------------------------------------------------------------------
// Activity + dashboard
// -----------------------------------------------------------------------

export function useProjectActivity(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "activity"],
    queryFn: () => api.get<ProjectActivityItem[]>(`/projects/${projectId}/activity`),
    enabled: !!projectId,
  });
}

export function useProjectDashboard(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "dashboard"],
    queryFn: () => api.get<ProjectDashboard>(`/projects/${projectId}/dashboard`),
    enabled: !!projectId,
  });
}
