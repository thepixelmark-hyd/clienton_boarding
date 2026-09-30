import { describe, expect, it } from "vitest";
import { computeProjectHealth } from "../projects";

describe("computeProjectHealth", () => {
  it("is HEALTHY with no evidence of trouble", () => {
    const result = computeProjectHealth({
      overdueTaskCount: 0,
      overdueMilestoneCount: 0,
      blockedTaskCount: 0,
      tasksBlockedByOverdueApproval: 0,
      oldestOverdueApprovalDays: null,
    });
    expect(result.status).toBe("HEALTHY");
  });

  it("is WATCH with a single overdue task", () => {
    const result = computeProjectHealth({
      overdueTaskCount: 1,
      overdueMilestoneCount: 0,
      blockedTaskCount: 0,
      tasksBlockedByOverdueApproval: 0,
      oldestOverdueApprovalDays: null,
    });
    expect(result.status).toBe("WATCH");
  });

  it("is AT_RISK with an overdue milestone and explains why", () => {
    const result = computeProjectHealth({
      overdueTaskCount: 0,
      overdueMilestoneCount: 1,
      blockedTaskCount: 0,
      tasksBlockedByOverdueApproval: 0,
      oldestOverdueApprovalDays: null,
    });
    expect(result.status).toBe("AT_RISK");
    expect(result.reason).toMatch(/milestone/i);
  });

  it("is CRITICAL when an overdue approval blocks dependent tasks, with evidence in the reason", () => {
    const result = computeProjectHealth({
      overdueTaskCount: 0,
      overdueMilestoneCount: 0,
      blockedTaskCount: 4,
      tasksBlockedByOverdueApproval: 4,
      oldestOverdueApprovalDays: 3,
    });
    expect(result.status).toBe("CRITICAL");
    expect(result.reason).toContain("3 day");
    expect(result.reason).toContain("4");
  });
});
