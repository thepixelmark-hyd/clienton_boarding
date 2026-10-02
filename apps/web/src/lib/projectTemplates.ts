"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateProjectTemplateInput,
  InstantiateProjectTemplateInput,
  TemplateMilestone,
  TemplatePhase,
  TemplateTask,
  UpdateProjectTemplateInput,
} from "@clientos/shared";
import { api } from "./api-client";
import type { ProjectSummary } from "./projects";

export interface ProjectTemplateItem {
  id: string;
  name: string;
  description: string | null;
  phases: TemplatePhase[];
  milestones: TemplateMilestone[];
  tasks: TemplateTask[];
  createdAt: string;
  updatedAt: string;
}

export function useProjectTemplates() {
  return useQuery({
    queryKey: ["project-templates"],
    queryFn: () => api.get<ProjectTemplateItem[]>("/project-templates"),
  });
}

export function useProjectTemplate(id: string) {
  return useQuery({
    queryKey: ["project-templates", id],
    queryFn: () => api.get<ProjectTemplateItem>(`/project-templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateProjectTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectTemplateInput) => api.post<ProjectTemplateItem>("/project-templates", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-templates"] }),
  });
}

export function useUpdateProjectTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectTemplateInput) => api.patch<ProjectTemplateItem>(`/project-templates/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-templates"] });
      queryClient.invalidateQueries({ queryKey: ["project-templates", id] });
    },
  });
}

export function useDeleteProjectTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/project-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-templates"] }),
  });
}

export function useInstantiateProjectTemplate(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InstantiateProjectTemplateInput) =>
      api.post<ProjectSummary>(`/project-templates/${templateId}/instantiate`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}
