import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState, ErrorState } from "../empty-state";

describe("EmptyState", () => {
  it("renders title, description, and action", () => {
    render(
      <EmptyState
        title="No projects yet"
        description="Projects created for this organization will appear here."
        action={<button>Create Project</button>}
      />,
    );
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText(/will appear here/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("calls onRetry when the retry action is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorState description="We couldn't load this." onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render a retry action when onRetry is not provided", () => {
    render(<ErrorState description="We couldn't load this." />);
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
  });
});
