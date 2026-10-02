import { z } from "zod";
import { visibilitySchema } from "./projects";

/**
 * Shared by every comment thread this phase adds (task comments today; the
 * same shape would serve deliverable comments later) — see Comment's
 * `entityType`/`entityId` polymorphism in schema.prisma. `visibility`
 * defaults server-side to INTERNAL; a staff author can mark a comment
 * CLIENT_VISIBLE, but that only matters for entities the portal can
 * actually reach (see security.md "Internal vs. client visibility") — a
 * client-visible comment on an internal-only Task is still never served
 * through the portal boundary, since Task itself isn't a portal resource.
 */
export const createCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  visibility: visibilitySchema.optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
