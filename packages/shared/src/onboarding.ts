import { z } from "zod";

export const ONBOARDING_ITEM_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"] as const;
export type OnboardingItemStatus = (typeof ONBOARDING_ITEM_STATUSES)[number];

export interface OnboardingChecklistStepDefinition {
  key: string;
  title: string;
  description?: string;
  isRequired: boolean;
}

/**
 * The default client-onboarding checklist, same "catalog in code, instances
 * in the database" pattern as FORM_TEMPLATES (see
 * packages/shared/src/forms/templates/index.ts) — starting onboarding for a
 * client copies this list into ClientOnboardingItem rows keyed by `key`, so
 * editing this catalog later never reorders or orphans an already-started
 * client's checklist.
 */
export const DEFAULT_ONBOARDING_CHECKLIST: OnboardingChecklistStepDefinition[] = [
  {
    key: "welcome-sent",
    title: "Send welcome message",
    description: "Introduce the account team and set expectations for the engagement.",
    isRequired: true,
  },
  {
    key: "contract-signed",
    title: "Signed contract / SOW on file",
    isRequired: true,
  },
  {
    key: "primary-contact-confirmed",
    title: "Confirm primary contact and decision maker",
    description: "At least one Contact marked as the primary / decision maker stakeholder.",
    isRequired: true,
  },
  {
    key: "portal-access-granted",
    title: "Invite client to the client portal",
    isRequired: true,
  },
  {
    key: "requirements-collected",
    title: "Collect initial project requirements",
    description: "At least one requirement form submitted and reviewed.",
    isRequired: true,
  },
  {
    key: "kickoff-scheduled",
    title: "Schedule kickoff call",
    isRequired: false,
  },
  {
    key: "billing-details-confirmed",
    title: "Confirm billing details and invoicing contact",
    isRequired: false,
  },
];

export function getOnboardingChecklistStep(key: string): OnboardingChecklistStepDefinition | undefined {
  return DEFAULT_ONBOARDING_CHECKLIST.find((s) => s.key === key);
}

export const updateOnboardingItemSchema = z.object({
  status: z.enum(ONBOARDING_ITEM_STATUSES),
});
export type UpdateOnboardingItemInput = z.infer<typeof updateOnboardingItemSchema>;
