"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate, Plus } from "lucide-react";
import { useCreateProjectTemplate, useProjectTemplates } from "@/lib/projectTemplates";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

/**
 * Reusable project blueprints (phases/milestones/tasks with relative due
 * dates) a PM can stand a new project up from in one step — see
 * product.md "project templates". Editing a blueprint's content happens on
 * the detail page; this is just the catalog + create entry point.
 */
export default function ProjectTemplatesPage() {
  const router = useRouter();
  const { data: templates, isLoading, isError, refetch } = useProjectTemplates();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Project templates"
        description="Stand up a new project's phases, milestones, and tasks in one step."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : isError ? (
          <ErrorState description="We couldn't load project templates." onRetry={() => refetch()} />
        ) : !templates || templates.length === 0 ? (
          <EmptyState
            icon={LayoutTemplate}
            title="No templates yet"
            description="Build a template once (phases, milestones, tasks) and reuse it for every similar engagement."
            action={
              <Button variant="secondary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Build a template
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Phases</TableHead>
                <TableHead>Milestones</TableHead>
                <TableHead>Tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow
                  key={template.id}
                  clickable
                  onClick={() => router.push(`/project-templates/${template.id}`)}
                >
                  <TableCell>
                    <p className="font-medium text-text-primary">{template.name}</p>
                    {template.description && <p className="text-xs text-text-muted">{template.description}</p>}
                  </TableCell>
                  <TableCell className="text-text-secondary">{template.phases.length}</TableCell>
                  <TableCell className="text-text-secondary">{template.milestones.length}</TableCell>
                  <TableCell className="text-text-secondary">{template.tasks.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createTemplate = useCreateProjectTemplate();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    createTemplate.mutate(
      { name, description: description || undefined, phases: [], milestones: [], tasks: [] },
      {
        onSuccess: (template) => {
          toast.show({ title: "Template created", variant: "success" });
          onOpenChange(false);
          router.push(`/project-templates/${template.id}`);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New template" description="Start blank, then add phases, milestones, and tasks.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Template name" htmlFor="template-name" required>
            <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Description" htmlFor="template-description">
            <Textarea id="template-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createTemplate.isPending}>
              Create and edit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
