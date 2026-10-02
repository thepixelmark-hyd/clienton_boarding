import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Card } from "../card";

/**
 * Regression test for a real bug found during a QA audit: every "the whole
 * card navigates somewhere" usage across the app (requirements list, task
 * board, deliverables, portal project list, ...) passed `onClick` directly
 * to `Card` with no keyboard affordance at all — unreachable with Tab,
 * inert on Enter/Space. Fixed once in the shared component rather than at
 * each of the 7+ call sites; this test locks that fix in place.
 */
describe("Card (clickable accessibility)", () => {
  it("a Card with no onClick is a plain, non-interactive container", () => {
    render(<Card data-testid="card">Static content</Card>);
    const card = screen.getByTestId("card");
    expect(card).not.toHaveAttribute("role");
    expect(card).not.toHaveAttribute("tabindex");
  });

  it("a Card with onClick is keyboard-focusable and exposed as a button", () => {
    const onClick = vi.fn();
    render(
      <Card onClick={onClick} data-testid="card">
        Clickable row
      </Card>,
    );
    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("tabindex", "0");

    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("activates onClick via Enter and Space, not just a mouse click", () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Clickable row</Card>);
    const card = screen.getByRole("button");

    fireEvent.keyDown(card, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(card, { key: "Tab" });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
