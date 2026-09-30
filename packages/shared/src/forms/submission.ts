import { z } from "zod";

export const saveResponsesSchema = z.object({
  responses: z
    .array(
      z.object({
        fieldId: z.string().min(1),
        value: z.unknown(),
      }),
    )
    .min(1),
});
export type SaveResponsesInput = z.infer<typeof saveResponsesSchema>;

export const instantiateFormSchema = z.object({
  templateKey: z.string().min(1),
});
export type InstantiateFormInput = z.infer<typeof instantiateFormSchema>;
