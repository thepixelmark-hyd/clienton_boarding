import type { FormTemplateDefinition } from "./types";

/**
 * Demonstrates the second worked example of nested conditional logic from
 * product.md §19: the question set branches entirely depending on whether a
 * website already exists.
 */
export const websiteDiscoveryTemplate: FormTemplateDefinition = {
  templateKey: "website-discovery",
  name: "Website Discovery",
  description: "Establishes scope, technical constraints, and content readiness for a website project.",
  fields: [
    {
      key: "websiteExists",
      label: "Does a website already exist?",
      type: "SINGLE_SELECT",
      required: true,
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "currentUrl",
      label: "Current website URL",
      type: "URL",
      required: true,
      conditionalRule: { field: "websiteExists", operator: "equals", value: "yes" },
    },
    {
      key: "currentSiteProblems",
      label: "What isn't working about the current site?",
      type: "LONG_TEXT",
      required: true,
      conditionalRule: { field: "websiteExists", operator: "equals", value: "yes" },
    },
    {
      key: "whatShouldRemain",
      label: "What should stay the same?",
      type: "LONG_TEXT",
      required: false,
      conditionalRule: { field: "websiteExists", operator: "equals", value: "yes" },
    },
    {
      key: "whatShouldChange",
      label: "What needs to change?",
      type: "LONG_TEXT",
      required: true,
      conditionalRule: { field: "websiteExists", operator: "equals", value: "yes" },
    },
    {
      key: "desiredDomain",
      label: "Do you have a domain in mind?",
      type: "SHORT_TEXT",
      required: false,
      conditionalRule: { field: "websiteExists", operator: "equals", value: "no" },
    },
    {
      key: "hostingPreference",
      label: "Hosting preference, if any",
      type: "SHORT_TEXT",
      required: false,
      conditionalRule: { field: "websiteExists", operator: "equals", value: "no" },
    },
    {
      key: "contentAvailability",
      label: "Is written content ready?",
      type: "SINGLE_SELECT",
      required: true,
      options: [
        { value: "ready", label: "We have all content ready" },
        { value: "partial", label: "Partially ready" },
        { value: "need_help", label: "We need help writing content" },
      ],
      conditionalRule: { field: "websiteExists", operator: "equals", value: "no" },
    },
    {
      key: "sitemapRequirements",
      label: "What pages do you need?",
      type: "LONG_TEXT",
      required: false,
      conditionalRule: { field: "websiteExists", operator: "equals", value: "no" },
    },
    {
      key: "pageCount",
      label: "Estimated number of pages",
      type: "NUMBER",
      required: true,
    },
    {
      key: "cmsPreference",
      label: "CMS preference",
      type: "SINGLE_SELECT",
      required: false,
      options: [
        { value: "wordpress", label: "WordPress" },
        { value: "webflow", label: "Webflow" },
        { value: "custom", label: "Custom build" },
        { value: "no_preference", label: "No preference" },
      ],
    },
    {
      key: "ecommerceNeeded",
      label: "Do you need e-commerce / a payment gateway?",
      type: "SINGLE_SELECT",
      required: true,
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
};
