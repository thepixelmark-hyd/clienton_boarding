import { z } from "zod";
import { CLIENT_PORTAL_ROLES } from "./roles";

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(200)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v), {
    message: "Password must include an uppercase letter, a lowercase letter, and a number.",
  });

export const portalLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type PortalLoginInput = z.infer<typeof portalLoginSchema>;

export const inviteClientPortalUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(CLIENT_PORTAL_ROLES),
  contactId: z.string().min(1).optional(),
});
export type InviteClientPortalUserInput = z.infer<typeof inviteClientPortalUserSchema>;

export const acceptClientInvitationSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});
export type AcceptClientInvitationInput = z.infer<typeof acceptClientInvitationSchema>;
