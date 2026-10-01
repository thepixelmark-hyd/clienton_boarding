import { describe, expect, it } from "vitest";
import { can, clientPortalCan } from "../roles";

describe("organization permission matrix", () => {
  it("grants OWNER full access", () => {
    expect(can("OWNER", "delete", "client")).toBe(true);
    expect(can("OWNER", "billing", "financial")).toBe(true);
  });

  it("denies VIEWER any mutating action", () => {
    expect(can("VIEWER", "create", "project")).toBe(false);
    expect(can("VIEWER", "delete", "task")).toBe(false);
    expect(can("VIEWER", "view", "project")).toBe(true);
  });

  it("restricts FINANCE to financial data plus read access elsewhere", () => {
    expect(can("FINANCE", "billing", "financial")).toBe(true);
    expect(can("FINANCE", "edit", "project")).toBe(false);
    expect(can("FINANCE", "view", "project")).toBe(true);
  });

  it("lets EMPLOYEE edit tasks but not delete them", () => {
    expect(can("EMPLOYEE", "edit", "task")).toBe(true);
    expect(can("EMPLOYEE", "delete", "task")).toBe(false);
  });
});

describe("client portal permission matrix", () => {
  it("lets APPROVER approve a deliverable but not manage billing", () => {
    expect(clientPortalCan("APPROVER", "approve", "deliverable")).toBe(true);
    expect(clientPortalCan("APPROVER", "billing", "invoice")).toBe(false);
  });

  it("restricts VIEWER to read-only", () => {
    expect(clientPortalCan("VIEWER", "view", "requirement")).toBe(true);
    expect(clientPortalCan("VIEWER", "comment", "requirement")).toBe(false);
  });

  it("only lets CLIENT_ADMIN/CLIENT_MANAGER fill in and submit a requirement form", () => {
    expect(clientPortalCan("CLIENT_ADMIN", "edit", "requirement")).toBe(true);
    expect(clientPortalCan("CLIENT_MANAGER", "upload", "requirement")).toBe(true);
    expect(clientPortalCan("STAKEHOLDER", "edit", "requirement")).toBe(false);
    expect(clientPortalCan("APPROVER", "edit", "requirement")).toBe(false);
  });

  it("scopes billing to BILLING_CONTACT and CLIENT_ADMIN only", () => {
    expect(clientPortalCan("BILLING_CONTACT", "billing", "invoice")).toBe(true);
    expect(clientPortalCan("CLIENT_ADMIN", "billing", "invoice")).toBe(true);
    expect(clientPortalCan("STAKEHOLDER", "billing", "invoice")).toBe(false);
  });

  it("only lets CLIENT_ADMIN invite other portal users", () => {
    expect(clientPortalCan("CLIENT_ADMIN", "invite", "team")).toBe(true);
    expect(clientPortalCan("CLIENT_MANAGER", "invite", "team")).toBe(false);
  });
});
