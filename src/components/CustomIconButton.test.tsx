import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CustomIconButton } from "./CustomIconButton";

describe("CustomIconButton", () => {
  it("takes its accessible name from the label and shows the key hint in the tooltip", () => {
    render(
      <CustomIconButton label="Measure" hint="6">
        <svg />
      </CustomIconButton>,
    );
    const b = screen.getByRole("button", { name: "Measure" });
    expect(b.getAttribute("title")).toBe("Measure (6)");
  });

  it("is a toggle when pressed is given", () => {
    const onClick = vi.fn();
    render(
      <CustomIconButton label="Grid" pressed={false} onClick={onClick}>
        <svg />
      </CustomIconButton>,
    );
    const b = screen.getByRole("button", { name: "Grid" });
    expect(b.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalled();
  });
});
