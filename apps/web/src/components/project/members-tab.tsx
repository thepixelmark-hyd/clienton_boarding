"use client";

import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import {
  useProjectMembers,
  useAddProjectMember,
  useUpdateProjectMember,
  useRemoveProjectMember,
  type ProjectMemberItem,
} from "@/lib/projects";
import { useMembers } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

const MEMBER_ROLES: ProjectMemberItem["role"][] = ["LEAD", "CONTRIBUTOR", "OBSERVER"];

export function MembersTab({ projectId }: { projectId: string }) {
  const { data: members, isLoading, isError, refetch } = useProjectMembers(projectId);
  const { data: orgMembers } = useMembers();
  const updateMember = useUpdateProjectMember(projectId);
  const removeMember = useRemoveProjectMember(projectId);
  const toast = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<ProjectMemberItem | null>(null);

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (isError) {
    return <ErrorState description="We couldn't load this project's members." onRetry={() => refetch()} />;
  }

  const memberUserIds = new Set((members ?? []).map((m) => m.userId));
  const availableOrgMembers = (orgMembers ?? []).filter((m) => !memberUserIds.has(m.user.id));
  const everyoneAdded = (orgMembers ?? []).length > 0 && availableOrgMembers.length === 0;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={everyoneAdded}>
          <Plus className="h-3.5 w-3.5" /> Add member
        </Button>
      </div>

      {everyoneAdded && (
        <p className="mb-3 text-xs text-text-muted">Everyone in your organization is already on this project.</p>
      )}

      {!members || members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Add teammates to this project so they can see and work on it."
          action={
            !everyoneAdded && (
              <Button variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add member
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <Card key={member.id}>
              <CardContent className="flex items-center gap-3 py-3.5">
                <Avatar name={member.user.fullName} imageUrl={member.user.avatarUrl} size="md" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{member.user.fullName}</p>
                </div>
                <Select
                  value={member.role}
                  onValueChange={(role) =>
                    updateMember.mutate(
                      { userId: member.userId, input: { role: role as ProjectMemberItem["role"] } },
                      {
                        onSuccess: () => toast.show({ title: "Role updated", variant: "success" }),
                        onError: (err) =>
                          toast.show({
                            title: err instanceof ApiClientError ? err.message : "Something went wrong.",
                            variant: "danger",
                          }),
                      },
                    )
                  }
                >
                  <SelectTrigger className="w-40" aria-label={`Role for ${member.user.fullName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.charAt(0) + role.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${member.user.fullName}`}
                  onClick={() => setRemovingMember(member)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddMemberDialog
        projectId={projectId}
        availableMembers={availableOrgMembers}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <ConfirmDialog
        open={!!removingMember}
        onOpenChange={(v) => !v && setRemovingMember(null)}
        title={removingMember ? `Remove ${removingMember.user.fullName}?` : "Remove this member?"}
        description="They'll lose access to this project. This doesn't affect their organization account."
        confirmLabel="Remove member"
        destructive
        loading={removeMember.isPending}
        onConfirm={() => {
          if (!removingMember) return;
          removeMember.mutate(removingMember.userId, {
            onSuccess: () => {
              toast.show({ title: "Member removed", variant: "success" });
              setRemovingMember(null);
            },
            onError: (err) =>
              toast.show({ title: err instanceof ApiClientError ? err.message : "Something went wrong.", variant: "danger" }),
          });
        }}
      />
    </div>
  );
}

function AddMemberDialog({
  projectId,
  availableMembers,
  open,
  onOpenChange,
}: {
  projectId: string;
  availableMembers: { id: string; role: string; user: { id: string; fullName: string; email: string; avatarUrl: string | null } }[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const addMember = useAddProjectMember(projectId);
  const toast = useToast();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<string>("CONTRIBUTOR");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setError("Choose a teammate to add.");
      return;
    }
    addMember.mutate(
      { userId, role: role as ProjectMemberItem["role"] },
      {
        onSuccess: () => {
          toast.show({ title: "Member added", variant: "success" });
          setUserId("");
          setRole("CONTRIBUTOR");
          setError(null);
          onOpenChange(false);
        },
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "Something went wrong."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add member" description="Give a teammate access to this project.">
        {availableMembers.length === 0 ? (
          <p className="text-sm text-text-muted">Everyone in your organization is already on this project.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Teammate" htmlFor="member-user" required>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="member-user">
                  <SelectValue placeholder="Choose a teammate" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((m) => (
                    <SelectItem key={m.user.id} value={m.user.id}>
                      {m.user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Role" htmlFor="member-role">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="member-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.charAt(0) + r.slice(1).toLowerCase()}
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
              <Button type="submit" loading={addMember.isPending}>
                Add member
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
