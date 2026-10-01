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

// Contact schemas moved to ./contacts.ts (now that contacts have their own
// update/delete lifecycle, role enum, and optimistic-concurrency version —
// they outgrew being an appendage of the client schema file).
export { createContactSchema, updateContactSchema, CONTACT_ROLES } from "./contacts";
export type { CreateContactInput, UpdateContactInput, ContactRole } from "./contacts";
