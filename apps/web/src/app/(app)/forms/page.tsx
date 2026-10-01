"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { useForms, useCreateForm } from "@/lib/forms";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

/**
 * The form builder's home: org-level reusable templates (isTemplate=true)
 * built here, alongside the hardcoded FORM_TEMPLATES catalog (Logo Design,
 * Website Discovery) a PM picks from when adding a requirement to a
 * project — see requirements-tab.tsx. A non-template row here is a
 * project/client-scoped form someone built directly rather than from a
 * catalog entry.
 */
export default function FormsPage() {
  const router = useRouter();
  const { data: forms, isLoading, isError, refetch } = useForms();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Forms"
        description="Build reusable requirement-gathering forms beyond the built-in templates."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New form
          </Button>
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <SkeletonTable rows={4} cols={3} />
        ) : isError ? (
          <ErrorState description="We couldn't load your forms." onRetry={() => refetch()} />
        ) : !forms || forms.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No custom forms yet"
            description="Build a form from scratch, or use a built-in template from a project's Requirements tab."
            action={
              <Button variant="secondary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Build a form
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Submissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form) => (
                <TableRow key={form.id} clickable onClick={() => router.push(`/forms/builder/${form.id}`)}>
                  <TableCell className="font-medium">{form.name}</TableCell>
                  <TableCell>
                    <Badge variant={form.isTemplate ? "accent" : "neutral"}>
                      {form.isTemplate ? "Template" : "Project form"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-secondary">{form._count.fields}</TableCell>
                  <TableCell className="text-text-secondary">{form._count.submissions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createForm = useCreateForm();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Form name is required.");
      return;
    }
    createForm.mutate(
      { name },
      {
        onSuccess: (form) => {
          toast.show({ title: "Form created", variant: "success" });
          onOpenChange(false);
          router.push(`/forms/builder/${form.id}`);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New form" description="Creates a reusable org-level template you can instantiate on any project.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Form name" htmlFor="form-name" required>
            <Input id="form-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createForm.isPending}>
              Create and add fields
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
