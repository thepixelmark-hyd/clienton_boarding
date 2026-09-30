"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Search } from "lucide-react";
import { useClients, useCreateClient } from "@/lib/clients";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

export default function ClientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, refetch } = useClients(search || undefined);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Clients"
        description="Every client your agency works with, in one place."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New client
          </Button>
        }
      />

      <div className="mt-6 flex items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search clients…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : isError ? (
          <ErrorState description="We couldn't load your clients." onRetry={() => refetch()} />
        ) : data!.data.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={search ? "No clients match your search" : "No clients yet"}
            description={
              search
                ? "Try a different search term."
                : "Clients created for this organization will appear here."
            }
            action={
              !search && (
                <Button variant="secondary" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Create client
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Projects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.data.map((client) => (
                <TableRow key={client.id} clickable onClick={() => router.push(`/clients/${client.id}`)}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-text-secondary">{client.industry ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={client.status} />
                  </TableCell>
                  <TableCell className="text-text-secondary">{client._count.projects}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateClientDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createClient = useCreateClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Client name is required.");
      return;
    }
    createClient.mutate(
      { name, industry: industry || undefined },
      {
        onSuccess: () => {
          toast.show({ title: "Client created", variant: "success" });
          setName("");
          setIndustry("");
          setError(null);
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New client" description="Add a client to start tracking their projects and requirements.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Client name" htmlFor="client-name" required>
            <Input id="client-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Industry" htmlFor="client-industry">
            <Input id="client-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createClient.isPending}>
              Create client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
