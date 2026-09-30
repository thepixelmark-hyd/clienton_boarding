"use client";

import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { ORG_ROLES } from "@clientos/shared";
import { useMembers, useInviteMember } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonTable } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api-client";

export default function TeamPage() {
  const { data: members, isLoading, isError, refetch } = useMembers();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Team"
        description="Everyone with access to your organization."
        action={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Invite member
          </Button>
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <SkeletonTable rows={4} cols={3} />
        ) : isError ? (
          <ErrorState description="We couldn't load your team." onRetry={() => refetch()} />
        ) : members!.length === 0 ? (
          <EmptyState icon={Users} title="No team members yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members!.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.user.fullName} imageUrl={member.user.avatarUrl} size="sm" />
                      <span className="font-medium">{member.user.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-text-secondary">{member.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="neutral">{member.role.replace(/_/g, " ")}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const invite = useInviteMember();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("EMPLOYEE");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    invite.mutate(
      { email, role },
      {
        onSuccess: () => {
          toast.show({ title: "Invitation sent", description: email, variant: "success" });
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
      <DialogContent title="Invite a team member" description="They'll get access with the role you choose below.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email" htmlFor="invite-email" required>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Field label="Role" htmlFor="invite-role" required>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_ROLES.filter((r) => r !== "OWNER").map((r) => (
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
            <Button type="submit" loading={invite.isPending}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
