"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { portalLoginSchema } from "@clientos/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePortalLogin } from "@/lib/portal";
import { ApiClientError } from "@/lib/api-client";

export default function PortalLoginPage() {
  const router = useRouter();
  const login = usePortalLogin();
  const [form, setForm] = useState({ email: "", password: "" });
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = portalLoginSchema.safeParse(form);
    if (!parsed.success) {
      setFormError("Enter a valid email and password.");
      return;
    }
    login.mutate(parsed.data, {
      onSuccess: () => router.push("/portal"),
      onError: (err) => setFormError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again."),
    });
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
            <CardTitle className="text-lg">Sign in</CardTitle>
            <p className="mt-1 text-sm text-text-secondary">Access your projects and requirements.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Field label="Email" htmlFor="email" required>
                <Input
                  id="email"
                  type="email"
                  autoFocus
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Password" htmlFor="password" required>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
              {formError && (
                <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                  {formError}
                </p>
              )}
              <Button type="submit" className="w-full" loading={login.isPending}>
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
