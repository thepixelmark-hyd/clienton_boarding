"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginSchema } from "@clientos/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLogin } from "@/lib/auth";
import { ApiClientError } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [form, setForm] = useState({ email: "", password: "" });
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setFormError("Enter a valid email and password.");
      return;
    }
    login.mutate(parsed.data, {
      onSuccess: () => router.push("/"),
      onError: (err) => {
        setFormError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
      },
    });
  }

  return (
    <Card>
      <CardHeader className="block">
        <CardTitle className="text-lg">Sign in</CardTitle>
        <p className="mt-1 text-sm text-text-secondary">Welcome back to ClientOS.</p>
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
      <div className="border-t border-border px-5 py-4 text-center text-sm text-text-secondary">
        New to ClientOS?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an organization
        </Link>
      </div>
    </Card>
  );
}
