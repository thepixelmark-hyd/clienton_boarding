import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../badge";

describe("StatusBadge", () => {
  it("renders a friendly label for a known status", () => {
    render(<StatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("renders READY as a success-styled badge", () => {
    render(<StatusBadge status="READY" />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("falls back to the raw status string for an unrecognized status rather than crashing", () => {
    render(<StatusBadge status="SOME_UNKNOWN_STATUS" />);
    expect(screen.getByText("SOME_UNKNOWN_STATUS")).toBeInTheDocument();
  });
});
