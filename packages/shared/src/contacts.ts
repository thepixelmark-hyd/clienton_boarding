import { z } from "zod";

export const CONTACT_ROLES = [
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

export type ContactRole = (typeof CONTACT_ROLES)[number];

export const createContactSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  title: z.string().max(120).optional(),
  role: z.enum(CONTACT_ROLES).optional(),
  isPrimary: z.boolean().optional(),
  isDecisionMaker: z.boolean().optional(),
  isBillingContact: z.boolean().optional(),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial().extend({
  version: z.number().int().positive(),
});
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
