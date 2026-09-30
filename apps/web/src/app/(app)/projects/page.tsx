"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { useProjects, useCreateProject } from "@/lib/projects";
import { useClients } from "@/lib/clients";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

export default function ProjectsPage() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Projects"
        description="Every active and past engagement across your clients."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New project
          </Button>
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : isError ? (
          <ErrorState description="We couldn't load your projects." onRetry={() => refetch()} />
        ) : data!.data.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Projects created for this organization will appear here."
            action={
              <Button variant="secondary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create project
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.data.map((project) => (
                <TableRow key={project.id} clickable onClick={() => router.push(`/projects/${project.id}`)}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="text-text-secondary">{project.client.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={project.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.health.status} />
                  </TableCell>
                  <TableCell className="text-text-secondary">{project._count.tasks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { data: clients } = useClients();
  const createProject = useCreateProject();
  const toast = useToast();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [type, setType] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !clientId) {
      setError("Project name and client are required.");
      return;
    }
    createProject.mutate(
      { name, clientId, type: type || undefined },
      {
        onSuccess: (project) => {
          toast.show({ title: "Project created", variant: "success" });
          onOpenChange(false);
          router.push(`/projects/${project.id}`);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New project" description="Start a new engagement for a client.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Client" htmlFor="project-client" required>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="project-client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {(clients?.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Project name" htmlFor="project-name" required>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Project type" htmlFor="project-type" help="e.g. Website, Brand Identity, Mobile App Development">
            <Input id="project-type" value={type} onChange={(e) => setType(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createProject.isPending}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
