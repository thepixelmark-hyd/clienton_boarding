"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePortalAcceptInvite } from "@/lib/portal";
import { ApiClientError } from "@/lib/api-client";

export default function PortalAcceptInvitePage() {
  return (
    <Suspense>
      <PortalAcceptInviteForm />
    </Suspense>
  );
}

function PortalAcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const accept = usePortalAcceptInvite();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This invitation link is missing its token.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    accept.mutate(
      { token, password },
      {
        onSuccess: () => router.push("/portal"),
        onError: (err) => setError(err instanceof ApiClientError ? err.message : "This invitation link is invalid or has expired."),
      },
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
            C
          </div>
          <span className="text-base font-semibold text-text-primary">ClientOS Portal</span>
        </div>
        <Card>
          <CardHeader className="block">
            <CardTitle className="text-lg">Set your password</CardTitle>
            <p className="mt-1 text-sm text-text-secondary">Finish setting up your client portal account.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Field label="Password" htmlFor="password" required>
                <Input id="password" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label="Confirm password" htmlFor="confirm-password" required>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </Field>
              {error && (
                <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" loading={accept.isPending}>
                Set password and sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
