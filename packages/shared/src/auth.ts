import { z } from "zod";
import { ORG_ROLES } from "./roles";

/**
 * Email is a uniqueness/lookup key in half a dozen places (User, Invitation,
 * ClientPortalUser, ClientInvitation, Contact) but Postgres's `@unique` is
 * case-sensitive — "Jane@Co.com" and "jane@co.com" are different strings to
 * the database. Without normalizing at the validation boundary, the same
 * person could end up with two accounts (one per casing they happened to
 * type), an invite could silently fail to match an already-existing user,
 * and login could fail for a user whose casing doesn't exactly match what
 * they signed up with. Normalizing once, here, means every schema that
 * reuses this type gets the fix for free rather than each call site having
 * to remember to lowercase its own input.
 */
export const emailSchema = z.string().trim().toLowerCase().email().max(255);

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(200)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v), {
    message: "Password must include an uppercase letter, a lowercase letter, and a number.",
  });

export const signupSchema = z.object({
  organizationName: z.string().min(2).max(120),
  fullName: z.string().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(ORG_ROLES),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(10),
  fullName: z.string().min(2).max(120),
  password: passwordSchema,
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
