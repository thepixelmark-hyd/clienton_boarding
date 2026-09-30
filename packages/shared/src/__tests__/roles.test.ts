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
  it("lets APPROVER approve but not manage billing", () => {
    expect(clientPortalCan("APPROVER", "approve")).toBe(true);
    expect(clientPortalCan("APPROVER", "billing")).toBe(false);
  });

  it("restricts VIEWER to read-only", () => {
    expect(clientPortalCan("VIEWER", "view")).toBe(true);
    expect(clientPortalCan("VIEWER", "comment")).toBe(false);
  });
});
