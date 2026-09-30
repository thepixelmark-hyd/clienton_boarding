import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @testing-library/react does not auto-register cleanup outside of
// Jest's global afterEach hook, so Vitest needs it wired explicitly —
// otherwise each test's rendered DOM leaks into the next one.
afterEach(() => {
  cleanup();
});
