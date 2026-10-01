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

/**
 * The client portal's own resource vocabulary — deliberately smaller and
 * different from the internal `Resource` type above, because a portal user
 * never sees internal-only resources like `task`/`asset`/`changeRequest`
 * (see architecture.md "Internal vs. client visibility"). `team` covers
 * managing *other* portal users for the same client (invite/view), separate
 * from `invoice`, which previously shared the generic `billing` action with
 * no resource to scope it to.
 */
export type PortalResource = "requirement" | "onboarding" | "project" | "deliverable" | "invoice" | "team";

const PORTAL_READ_ONLY: Record<PortalResource, Action[]> = {
  requirement: ["view"],
  onboarding: ["view"],
  project: ["view"],
  deliverable: ["view"],
  invoice: [],
  team: [],
};

/**
 * clientPortalPermissionMatrix[role][resource] = set of allowed actions,
 * mirroring organizationPermissionMatrix's shape so both sides of the app
 * read the same way. Only CLIENT_ADMIN/CLIENT_MANAGER can actually fill in
 * and submit a requirement form (`edit`+`upload`) — other roles can view and
 * comment on it, matching a real engagement where one or two named people
 * own the brief but the wider stakeholder group stays informed.
 */
export const clientPortalPermissionMatrix: Record<ClientPortalRole, Record<PortalResource, Action[]>> = {
  CLIENT_ADMIN: {
    requirement: ["view", "edit", "comment", "upload"],
    onboarding: ["view", "edit"],
    project: ["view", "comment"],
    deliverable: ["view", "comment", "approve"],
    invoice: ["view", "billing"],
    team: ["view", "invite"],
  },
  CLIENT_MANAGER: {
    requirement: ["view", "edit", "comment", "upload"],
    onboarding: ["view", "edit"],
    project: ["view", "comment"],
    deliverable: ["view", "comment", "approve"],
    invoice: ["view"],
    team: ["view"],
  },
  STAKEHOLDER: {
    ...PORTAL_READ_ONLY,
    requirement: ["view", "comment"],
    project: ["view", "comment"],
    deliverable: ["view", "comment"],
  },
  APPROVER: {
    ...PORTAL_READ_ONLY,
    requirement: ["view", "comment"],
    project: ["view", "comment"],
    deliverable: ["view", "comment", "approve"],
  },
  VIEWER: PORTAL_READ_ONLY,
  BILLING_CONTACT: {
    ...PORTAL_READ_ONLY,
    invoice: ["view", "billing"],
  },
};

export function clientPortalCan(role: ClientPortalRole, action: Action, resource: PortalResource): boolean {
  return clientPortalPermissionMatrix[role]?.[resource]?.includes(action) ?? false;
}
