"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Globe, Plus } from "lucide-react";
import { useClient, useAddContact } from "@/lib/clients";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: client, isLoading, isError, refetch } = useClient(params.id);
  const [addContactOpen, setAddContactOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ErrorState description="We couldn't load this client." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title={client.name}
        description={client.industry ?? undefined}
        action={<StatusBadge status={client.status} />}
      />

      {client.website && (
        <a
          href={client.website}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <Globe className="h-3.5 w-3.5" /> {client.website}
        </a>
      )}

      <Tabs defaultValue="projects" className="mt-6">
        <TabsList>
          <TabsTrigger value="projects">Projects ({client.projects.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({client.contacts.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4">
          {client.projects.length === 0 ? (
            <EmptyState title="No projects yet" description="Projects for this client will appear here." />
          ) : (
            <div className="space-y-2">
              {client.projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="transition-colors hover:border-border-strong">
                    <CardContent className="flex items-center justify-between py-3.5">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{project.name}</p>
                        {project.type && <p className="text-xs text-text-muted">{project.type}</p>}
                      </div>
                      <StatusBadge status={project.status} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => setAddContactOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add contact
            </Button>
          </div>
          {client.contacts.length === 0 ? (
            <EmptyState title="No contacts yet" description="Add the people you work with at this client." />
          ) : (
            <div className="space-y-2">
              {client.contacts.map((contact) => (
                <Card key={contact.id}>
                  <CardContent className="flex items-center gap-3 py-3.5">
                    <Avatar name={contact.fullName} size="md" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{contact.fullName}</p>
                      <p className="text-xs text-text-muted">
                        {contact.title ?? contact.email}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {contact.isDecisionMaker && <StatusBadge status="DECISION_MAKER" />}
                      {contact.isBillingContact && <StatusBadge status="BILLING" />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          {client.timelineEvents.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ol className="space-y-4 border-l border-border pl-4">
              {client.timelineEvents.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-accent" />
                  <p className="text-sm font-medium text-text-primary">{event.title}</p>
                  <p className="text-xs text-text-muted">{formatDateTime(event.occurredAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>

      <AddContactDialog clientId={client.id} open={addContactOpen} onOpenChange={setAddContactOpen} />
    </div>
  );
}

function AddContactDialog({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const addContact = useAddContact(clientId);
  const toast = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    addContact.mutate(
      { fullName, email },
      {
        onSuccess: () => {
          toast.show({ title: "Contact added", variant: "success" });
          setFullName("");
          setEmail("");
          setError(null);
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add contact" description="Add a stakeholder at this client.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name" htmlFor="contact-name" required>
            <Input id="contact-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </Field>
          <Field label="Email" htmlFor="contact-email" required>
            <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={addContact.isPending}>
              Add contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
