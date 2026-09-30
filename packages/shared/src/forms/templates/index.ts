import { logoQuestionnaireTemplate } from "./logoQuestionnaire";
import { websiteDiscoveryTemplate } from "./websiteDiscovery";
import type { FormTemplateDefinition } from "./types";

export * from "./types";
export { logoQuestionnaireTemplate, websiteDiscoveryTemplate };

/**
 * Built-in form templates available to every organization. Only two are
 * fully built out this phase (Logo Design — required by product.md §18 —
 * and Website Discovery, demonstrating the other worked conditional-logic
 * example in §19). The remaining templates named in the product spec
 * (Brand Identity, Website Design/Development, UI/UX, Social Media, Digital
 * Marketing, SEO, Paid Ads, Video Production, Packaging Design, Presentation
 * Design, Mobile App Development, Software Development, Campaign Brief,
 * Product Launch, General Client Brief, Custom Requirement Form) reuse this
 * same `FormTemplateDefinition` shape — adding one is authoring a field
 * list, not new engine code — and are the next item on the requirements
 * engine backlog (see docs/architecture.md roadmap).
 */
export const FORM_TEMPLATES: FormTemplateDefinition[] = [
  logoQuestionnaireTemplate,
  websiteDiscoveryTemplate,
];

export function getFormTemplate(templateKey: string): FormTemplateDefinition | undefined {
  return FORM_TEMPLATES.find((t) => t.templateKey === templateKey);
}
