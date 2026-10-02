import { describe, expect, it } from "vitest";
import { validateTemplateBlueprint, type TemplatePhase, type TemplateMilestone, type TemplateTask } from "../projectTemplates";

const phase: TemplatePhase = { key: "discovery", name: "Discovery", order: 0 };
const milestone: TemplateMilestone = { key: "kickoff", name: "Kickoff", phaseKey: "discovery" };

function task(overrides: Partial<TemplateTask> & Pick<TemplateTask, "key" | "title">): TemplateTask {
  return { ...overrides };
}

describe("validateTemplateBlueprint", () => {
  it("accepts a well-formed blueprint", () => {
    const tasks: TemplateTask[] = [
      task({ key: "brief", title: "Collect brief", phaseKey: "discovery", milestoneKey: "kickoff" }),
      task({ key: "wireframes", title: "Wireframes", dependsOnKeys: ["brief"] }),
    ];
    expect(validateTemplateBlueprint([phase], [milestone], tasks)).toEqual([]);
  });

  it("rejects duplicate keys within each array", () => {
    const errors = validateTemplateBlueprint(
      [phase, { ...phase }],
      [],
      [task({ key: "a", title: "A" }), task({ key: "a", title: "A again" })],
    );
    expect(errors).toContain("Phase keys must be unique.");
    expect(errors).toContain("Task keys must be unique.");
  });

  it("rejects a milestone referencing an unknown phase", () => {
    const errors = validateTemplateBlueprint([], [{ key: "m1", name: "M1", phaseKey: "ghost" }], []);
    expect(errors.some((e) => e.includes("unknown phase key"))).toBe(true);
  });

  it("rejects a task referencing an unknown milestone, phase, or parent", () => {
    const errors = validateTemplateBlueprint(
      [],
      [],
      [task({ key: "t1", title: "T1", milestoneKey: "ghost", phaseKey: "ghost2", parentKey: "ghost3" })],
    );
    expect(errors.some((e) => e.includes("unknown milestone key"))).toBe(true);
    expect(errors.some((e) => e.includes("unknown phase key"))).toBe(true);
    expect(errors.some((e) => e.includes("unknown parent task key"))).toBe(true);
  });

  it("rejects a task that is its own parent or depends on itself", () => {
    const errors = validateTemplateBlueprint(
      [],
      [],
      [task({ key: "t1", title: "T1", parentKey: "t1", dependsOnKeys: ["t1"] })],
    );
    expect(errors.some((e) => e.includes("cannot be its own parent"))).toBe(true);
    expect(errors.some((e) => e.includes("cannot depend on itself"))).toBe(true);
  });

  it("rejects a dependency cycle", () => {
    const tasks: TemplateTask[] = [
      task({ key: "a", title: "A", dependsOnKeys: ["b"] }),
      task({ key: "b", title: "B", dependsOnKeys: ["c"] }),
      task({ key: "c", title: "C", dependsOnKeys: ["a"] }),
    ];
    const errors = validateTemplateBlueprint([], [], tasks);
    expect(errors.some((e) => e.includes("Circular dependency"))).toBe(true);
  });

  it("rejects an unknown dependency key", () => {
    const errors = validateTemplateBlueprint([], [], [task({ key: "a", title: "A", dependsOnKeys: ["ghost"] })]);
    expect(errors.some((e) => e.includes("unknown task key"))).toBe(true);
  });
});
