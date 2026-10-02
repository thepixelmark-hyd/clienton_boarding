"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Globe, Plus, Pencil, Trash2, Image as ImageIcon, CheckCircle2, Circle } from "lucide-react";
import {
  useClient,
  useAddContact,
  useUpdateClient,
  useDeleteClient,
  useUpdateContact,
  useDeleteContact,
  useUploadLogo,
  logoUrl,
  useOnboarding,
  useStartOnboarding,
  useUpdateOnboardingItem,
  usePortalInvitations,
  usePortalUsers,
  useInvitePortalUser,
  useRevokePortalInvitation,
  type ContactItem,
} from "@/lib/clients";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

const CONTACT_ROLES = [
  "DECISION_MAKER",
  "CHAMPION",
  "INFLUENCER",
  "TECHNICAL_CONTACT",
  "END_USER",
  "BILLING",
  "LEGAL",
  "APPROVER",
  "OTHER",
] as const;

const PORTAL_ROLES = ["CLIENT_ADMIN", "CLIENT_MANAGER", "STAKEHOLDER", "APPROVER", "VIEWER", "BILLING_CONTACT"] as const;

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data: client, isLoading, isError, refetch } = useClient(params.id);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [deleteClientOpen, setDeleteClientOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const deleteClient = useDeleteClient();
  const deleteContact = useDeleteContact(params.id);
  const uploadLogo = useUploadLogo(params.id);
  const toast = useToast();

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

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadLogo.mutate(file, {
      onSuccess: () => toast.show({ title: "Logo updated", variant: "success" }),
      onError: (err) => toast.show({ title: err instanceof Error ? err.message : "Upload failed", variant: "danger" }),
    });
    e.target.value = "";
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title={client.name}
        description={client.industry ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={client.status} />
            <Button size="sm" variant="secondary" onClick={() => setEditClientOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => setDeleteClientOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        }
      />

      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-12 w-12 overflow-hidden rounded-md border border-border bg-surface-secondary">
          {client.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl(client.id)} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-muted">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>
        <label className="cursor-pointer text-xs font-medium text-accent hover:underline">
          {client.logoUrl ? "Replace logo" : "Upload logo"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} />
        </label>
        {client.website && (
          <a
            href={client.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <Globe className="h-3.5 w-3.5" /> {client.website}
          </a>
        )}
      </div>

      <Tabs defaultValue="projects" className="mt-6">
        <TabsList>
          <TabsTrigger value="projects">Projects ({client.projects.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({client.contacts.length})</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="portal">Portal access</TabsTrigger>
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
                      <p className="text-xs text-text-muted">{contact.title ?? contact.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={contact.role} />
                      {contact.isDecisionMaker && <StatusBadge status="DECISION_MAKER" />}
                      {contact.isBillingContact && <StatusBadge status="BILLING" />}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingContact(contact)}
                        aria-label={`Edit ${contact.fullName}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingContactId(contact.id)}
                        aria-label={`Delete ${contact.fullName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          <OnboardingTab clientId={client.id} />
        </TabsContent>

        <TabsContent value="portal" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Invite to portal
            </Button>
          </div>
          <PortalAccessTab clientId={client.id} />
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
      <EditClientDialog client={client} open={editClientOpen} onOpenChange={setEditClientOpen} />
      <InvitePortalUserDialog
        clientId={client.id}
        contacts={client.contacts}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />

      {editingContact && (
        <EditContactDialog
          clientId={client.id}
          contact={editingContact}
          open={!!editingContact}
          onOpenChange={(v) => !v && setEditingContact(null)}
        />
      )}

      <ConfirmDialog
        open={deleteClientOpen}
        onOpenChange={setDeleteClientOpen}
        title="Delete this client?"
        description={`${client.name} will be archived. Its projects and requirements are kept but the client will no longer appear in lists.`}
        confirmLabel="Delete client"
        destructive
        loading={deleteClient.isPending}
        onConfirm={() =>
          deleteClient.mutate(client.id, {
            onSuccess: () => {
              toast.show({ title: "Client deleted", variant: "success" });
              router.push("/clients");
            },
          })
        }
      />

      <ConfirmDialog
        open={!!deletingContactId}
        onOpenChange={(v) => !v && setDeletingContactId(null)}
        title="Delete this contact?"
        description="This contact will be removed from the client's record."
        confirmLabel="Delete contact"
        destructive
        loading={deleteContact.isPending}
        onConfirm={() => {
          if (!deletingContactId) return;
          deleteContact.mutate(deletingContactId, {
            onSuccess: () => {
              toast.show({ title: "Contact deleted", variant: "success" });
              setDeletingContactId(null);
            },
          });
        }}
      />
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
  const [role, setRole] = useState<string>("OTHER");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    addContact.mutate(
      { fullName, email, role: role as never },
      {
        onSuccess: () => {
          toast.show({ title: "Contact added", variant: "success" });
          setFullName("");
          setEmail("");
          setRole("OTHER");
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
          <Field label="Stakeholder role" htmlFor="contact-role">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="contact-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

function EditContactDialog({
  clientId,
  contact,
  open,
  onOpenChange,
}: {
  clientId: string;
  contact: ContactItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const updateContact = useUpdateContact(clientId);
  const toast = useToast();
  const [fullName, setFullName] = useState(contact.fullName);
  const [title, setTitle] = useState(contact.title ?? "");
  const [role, setRole] = useState(contact.role);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateContact.mutate(
      { contactId: contact.id, input: { fullName, title: title || undefined, role: role as never, version: contact.version } },
      {
        onSuccess: () => {
          toast.show({ title: "Contact updated", variant: "success" });
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit contact" description={contact.email}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name" htmlFor="edit-contact-name" required>
            <Input id="edit-contact-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </Field>
          <Field label="Title" htmlFor="edit-contact-title">
            <Input id="edit-contact-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Stakeholder role" htmlFor="edit-contact-role">
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger id="edit-contact-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateContact.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditClientDialog({
  client,
  open,
  onOpenChange,
}: {
  client: { id: string; name: string; website: string | null; industry: string | null; description: string | null; version: number };
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const updateClient = useUpdateClient(client.id);
  const toast = useToast();
  const [name, setName] = useState(client.name);
  const [website, setWebsite] = useState(client.website ?? "");
  const [industry, setIndustry] = useState(client.industry ?? "");
  const [description, setDescription] = useState(client.description ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateClient.mutate(
      { name, website, industry: industry || undefined, description: description || undefined, version: client.version },
      {
        onSuccess: () => {
          toast.show({ title: "Client updated", variant: "success" });
          onOpenChange(false);
        },
        onError: (err) =>
          setError(
            err instanceof ApiClientError
              ? err.code === "CONFLICT_VERSION"
                ? "This client was changed elsewhere. Reload and try again."
                : err.message
              : "Something went wrong.",
          ),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit client" description="Update this client's profile.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name" htmlFor="edit-client-name" required>
            <Input id="edit-client-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Website" htmlFor="edit-client-website">
            <Input id="edit-client-website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </Field>
          <Field label="Industry" htmlFor="edit-client-industry">
            <Input id="edit-client-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="edit-client-description">
            <Textarea id="edit-client-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateClient.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingTab({ clientId }: { clientId: string }) {
  const { data: items, isLoading } = useOnboarding(clientId);
  const startOnboarding = useStartOnboarding(clientId);
  const updateItem = useUpdateOnboardingItem(clientId);

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="Onboarding not started"
        description="Start the onboarding checklist to track welcome, contract, and kickoff steps for this client."
        action={
          <Button onClick={() => startOnboarding.mutate()} loading={startOnboarding.isPending}>
            Start onboarding
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const done = item.status === "DONE";
        return (
          <Card key={item.id}>
            <CardContent
              role="button"
              tabIndex={0}
              aria-disabled={updateItem.isPending}
              className="flex cursor-pointer items-start gap-3 py-3.5"
              onClick={() => !updateItem.isPending && updateItem.mutate({ itemId: item.id, status: done ? "PENDING" : "DONE" })}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !updateItem.isPending) {
                  e.preventDefault();
                  updateItem.mutate({ itemId: item.id, status: done ? "PENDING" : "DONE" });
                }
              }}
            >
              <span
                className="mt-0.5 shrink-0 text-text-muted"
                aria-label={done ? "Mark as not done" : "Mark as done"}
              >
                {done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5" />}
              </span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${done ? "text-text-muted line-through" : "text-text-primary"}`}>
                  {item.title}
                  {item.isRequired && <span className="ml-1.5 text-xs text-text-muted">(required)</span>}
                </p>
                {item.description && <p className="text-xs text-text-muted">{item.description}</p>}
              </div>
              <StatusBadge status={item.status} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PortalAccessTab({ clientId }: { clientId: string }) {
  const { data: invitations, isLoading: loadingInvites } = usePortalInvitations(clientId);
  const { data: portalUsers, isLoading: loadingUsers } = usePortalUsers(clientId);
  const revoke = useRevokePortalInvitation(clientId);
  const toast = useToast();

  if (loadingInvites || loadingUsers) return <Skeleton className="h-32 w-full" />;

  const pending = invitations?.filter((i) => i.status === "PENDING") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">Portal users</h3>
        {!portalUsers || portalUsers.length === 0 ? (
          <EmptyState title="No portal users yet" description="Invited people appear here once they accept." />
        ) : (
          <div className="space-y-2">
            {portalUsers.map((u) => (
              <Card key={u.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{u.email}</p>
                    <p className="text-xs text-text-muted">
                      {u.lastLoginAt ? `Last signed in ${formatDateTime(u.lastLoginAt)}` : "Never signed in"}
                    </p>
                  </div>
                  <StatusBadge status={u.role} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">Pending invitations</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-text-muted">No pending invitations.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((invite) => (
              <Card key={invite.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{invite.email}</p>
                    <p className="text-xs text-text-muted">Invited {formatDateTime(invite.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={invite.role} />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        revoke.mutate(invite.id, {
                          onSuccess: () => toast.show({ title: "Invitation revoked", variant: "success" }),
                        })
                      }
                    >
                      Revoke
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InvitePortalUserDialog({
  clientId,
  contacts,
  open,
  onOpenChange,
}: {
  clientId: string;
  contacts: ContactItem[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const invite = useInvitePortalUser(clientId);
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("STAKEHOLDER");
  const [contactId, setContactId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    invite.mutate(
      { email, role: role as never, contactId: contactId || undefined },
      {
        onSuccess: () => {
          toast.show({ title: "Invitation sent", variant: "success" });
          setEmail("");
          setContactId("");
          setError(null);
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Invite to client portal" description="They'll receive an email with a link to set a password.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email" htmlFor="invite-email" required>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Field label="Role" htmlFor="invite-role">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PORTAL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {contacts.length > 0 && (
            <Field label="Link to an existing contact (optional)" htmlFor="invite-contact">
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger id="invite-contact">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={invite.isPending}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
