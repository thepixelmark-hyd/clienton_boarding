"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signupSchema } from "@clientos/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSignup } from "@/lib/auth";
import { ApiClientError } from "@/lib/api-client";

export default function SignupPage() {
  const router = useRouter();
  const signup = useSignup();
  const [form, setForm] = useState({ organizationName: "", fullName: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[issue.path.join(".")] = issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    signup.mutate(parsed.data, {
      onSuccess: () => router.push("/"),
      onError: (err) => {
        if (err instanceof ApiClientError) {
          setFormError(err.message);
          if (err.details?.fieldErrors) setFieldErrors(err.details.fieldErrors as Record<string, string>);
        } else {
          setFormError("Something went wrong. Try again.");
        }
      },
    });
  }

  return (
    <Card>
      <CardHeader className="block">
        <CardTitle className="text-lg">Create your organization</CardTitle>
        <p className="mt-1 text-sm text-text-secondary">Set up ClientOS for your team in a minute.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field label="Organization name" htmlFor="organizationName" required error={fieldErrors.organizationName}>
            <Input
              id="organizationName"
              placeholder="Meridian Digital"
              value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Your name" htmlFor="fullName" required error={fieldErrors.fullName}>
            <Input
              id="fullName"
              placeholder="Alex Rivera"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <Field label="Work email" htmlFor="email" required error={fieldErrors.email}>
            <Input
              id="email"
              type="email"
              placeholder="alex@meridian.agency"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            required
            error={fieldErrors.password}
            help="At least 10 characters, with uppercase, lowercase, and a number."
          >
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
          <Button type="submit" className="w-full" loading={signup.isPending}>
            Create organization
          </Button>
        </form>
      </CardContent>
      <div className="border-t border-border px-5 py-4 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </div>
    </Card>
  );
}
