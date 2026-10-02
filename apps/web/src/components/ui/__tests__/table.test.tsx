import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Table, TableBody, TableRow, TableCell } from "../table";

/** Same bug class as Card (see card.test.tsx), for the table-row list
 * pattern used by clients/projects/forms/templates list pages. */
describe("TableRow (clickable accessibility)", () => {
  function renderRow(props: { clickable?: boolean; onClick?: () => void }) {
    render(
      <Table>
        <TableBody>
          <TableRow {...props}>
            <TableCell>Row content</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
  }

  it("a non-clickable row has no interactive role", () => {
    renderRow({});
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("a clickable row is keyboard-focusable and exposed as a button", () => {
    const onClick = vi.fn();
    renderRow({ clickable: true, onClick });
    const row = screen.getByRole("button");
    expect(row).toHaveAttribute("tabindex", "0");

    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("activates onClick via Enter and Space", () => {
    const onClick = vi.fn();
    renderRow({ clickable: true, onClick });
    const row = screen.getByRole("button");

    fireEvent.keyDown(row, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("clickable=true with no onClick does not falsely claim to be interactive", () => {
    renderRow({ clickable: true });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
