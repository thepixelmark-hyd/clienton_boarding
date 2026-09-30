import { z } from "zod";

export const clientStatusSchema = z.enum(["PROSPECT", "ACTIVE", "PAUSED", "OFFBOARDED"]);

export const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().url().max(300).optional().or(z.literal("")),
  industry: z.string().max(120).optional(),
  description: z.string().max(4000).optional(),
  timezone: z.string().max(80).optional(),
  status: clientStatusSchema.optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial().extend({
  version: z.number().int().positive(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const createContactSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  title: z.string().max(120).optional(),
  isPrimary: z.boolean().optional(),
  isDecisionMaker: z.boolean().optional(),
  isBillingContact: z.boolean().optional(),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;
