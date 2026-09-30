/**
 * Organization and client-portal roles, and the permission matrix that
 * drives every authorization check in the API (apps/api/src/auth/permissions.guard.ts).
 *
 * This is data, not scattered `if (role === ...)` statements, so the full
 * set of who-can-do-what is auditable by reading one file (security.md).
 */

export const ORG_ROLES = [
  "OWNER",
  "ADMIN",
  "OPERATIONS_MANAGER",
  "PROJECT_MANAGER",
  "ACCOUNT_MANAGER",
  "TEAM_LEAD",
  "EMPLOYEE",
  "CONTRACTOR",
  "FINANCE",
  "VIEWER",
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const CLIENT_PORTAL_ROLES = [
  "CLIENT_ADMIN",
  "CLIENT_MANAGER",
  "STAKEHOLDER",
  "APPROVER",
  "VIEWER",
  "BILLING_CONTACT",
] as const;

export type ClientPortalRole = (typeof CLIENT_PORTAL_ROLES)[number];

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "comment"
  | "upload"
  | "approve"
  | "manage"
  | "invite"
  | "billing"
  | "export";

export type Resource =
  | "organization"
  | "member"
  | "client"
  | "project"
  | "task"
  | "requirement"
  | "deliverable"
  | "asset"
  | "changeRequest"
  | "financial";

/**
 * organizationPermissionMatrix[role][resource] = set of allowed actions.
 * A role/resource pair not listed here has no permissions on that resource.
 * OWNER and ADMIN are granted everything explicitly (not via a wildcard
 * bypass) so the matrix stays the single source of truth a reviewer can read
 * top to bottom.
 */
const ALL_ACTIONS: Action[] = [
  "view",
  "create",
  "edit",
  "delete",
  "comment",
  "upload",
  "approve",
  "manage",
  "invite",
  "billing",
  "export",
];

const FULL_ACCESS: Record<Resource, Action[]> = {
  organization: ALL_ACTIONS,
  member: ALL_ACTIONS,
  client: ALL_ACTIONS,
  project: ALL_ACTIONS,
  task: ALL_ACTIONS,
  requirement: ALL_ACTIONS,
  deliverable: ALL_ACTIONS,
  asset: ALL_ACTIONS,
  changeRequest: ALL_ACTIONS,
  financial: ALL_ACTIONS,
};

export const organizationPermissionMatrix: Record<OrgRole, Record<Resource, Action[]>> = {
  OWNER: FULL_ACCESS,
  ADMIN: FULL_ACCESS,
  OPERATIONS_MANAGER: {
    organization: ["view"],
    member: ["view", "invite"],
    client: ["view", "create", "edit", "comment"],
    project: ["view", "create", "edit", "manage", "comment"],
    task: ["view", "create", "edit", "delete", "comment"],
    requirement: ["view", "create", "edit", "comment"],
    deliverable: ["view", "create", "edit", "approve", "comment"],
    asset: ["view", "upload", "comment"],
    changeRequest: ["view", "create", "edit", "approve"],
    financial: ["view"],
  },
  PROJECT_MANAGER: {
    organization: ["view"],
    member: ["view"],
    client: ["view", "comment"],
    project: ["view", "create", "edit", "manage", "comment"],
    task: ["view", "create", "edit", "delete", "comment"],
    requirement: ["view", "create", "edit", "comment"],
    deliverable: ["view", "create", "edit", "approve", "comment"],
    asset: ["view", "upload", "comment"],
    changeRequest: ["view", "create", "edit"],
    financial: ["view"],
  },
  ACCOUNT_MANAGER: {
    organization: ["view"],
    member: ["view"],
    client: ["view", "create", "edit", "comment", "invite"],
    project: ["view", "comment"],
    task: ["view", "comment"],
    requirement: ["view", "comment"],
    deliverable: ["view", "comment"],
    asset: ["view", "comment"],
    changeRequest: ["view", "create", "comment"],
    financial: ["view"],
  },
  TEAM_LEAD: {
    organization: ["view"],
    member: ["view"],
    client: ["view"],
    project: ["view", "comment"],
    task: ["view", "create", "edit", "comment"],
    requirement: ["view", "comment"],
    deliverable: ["view", "comment"],
    asset: ["view", "upload", "comment"],
    changeRequest: ["view"],
    financial: [],
  },
  EMPLOYEE: {
    organization: ["view"],
    member: ["view"],
    client: ["view"],
    project: ["view", "comment"],
    task: ["view", "edit", "comment"],
    requirement: ["view", "comment"],
    deliverable: ["view", "comment"],
    asset: ["view", "upload", "comment"],
    changeRequest: ["view"],
    financial: [],
  },
  CONTRACTOR: {
    organization: [],
    member: [],
    client: ["view"],
    project: ["view", "comment"],
    task: ["view", "edit", "comment"],
    requirement: ["view"],
    deliverable: ["view", "comment"],
    asset: ["view", "upload", "comment"],
    changeRequest: [],
    financial: [],
  },
  FINANCE: {
    organization: ["view"],
    member: ["view"],
    client: ["view"],
    project: ["view"],
    task: ["view"],
    requirement: ["view"],
    deliverable: ["view"],
    asset: ["view"],
    changeRequest: ["view"],
    financial: ["view", "edit", "export", "billing"],
  },
  VIEWER: {
    organization: ["view"],
    member: ["view"],
    client: ["view"],
    project: ["view"],
    task: ["view"],
    requirement: ["view"],
    deliverable: ["view"],
    asset: ["view"],
    changeRequest: ["view"],
    financial: [],
  },
};

export function can(role: OrgRole, action: Action, resource: Resource): boolean {
  return organizationPermissionMatrix[role]?.[resource]?.includes(action) ?? false;
}

const CLIENT_PORTAL_FULL: Action[] = ["view", "comment", "upload", "approve"];

export const clientPortalPermissionMatrix: Record<ClientPortalRole, Action[]> = {
  CLIENT_ADMIN: ["view", "comment", "upload", "approve", "invite", "billing"],
  CLIENT_MANAGER: CLIENT_PORTAL_FULL,
  STAKEHOLDER: ["view", "comment"],
  APPROVER: ["view", "comment", "approve"],
  VIEWER: ["view"],
  BILLING_CONTACT: ["view", "billing"],
};

export function clientPortalCan(role: ClientPortalRole, action: Action): boolean {
  return clientPortalPermissionMatrix[role]?.includes(action) ?? false;
}
