import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { CustomSegmented } from "./CustomSegmented";

const options = [
  { value: "current", label: "Current" },
  { value: "renovated", label: "Renovated" },
  { value: "plan", label: "Plan" },
] as const;

function Harness({ iconsOnly = false }: { iconsOnly?: boolean }) {
  const [v, setV] = useState<(typeof options)[number]["value"]>("current");
  return (
    <CustomSegmented
      label="Scenario"
      value={v}
      options={options}
      onChange={setV}
      iconsOnly={iconsOnly}
    />
  );
}

describe("CustomSegmented", () => {
  it("is a radiogroup with one checked radio and arrow keys move the selection", () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup", { name: "Scenario" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]?.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(radios[0]!, { key: "ArrowRight" });
    expect(
      within(group).getByRole("radio", { name: "Renovated" }).getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.keyDown(within(group).getByRole("radio", { name: "Renovated" }), {
      key: "ArrowLeft",
    });
    fireEvent.keyDown(within(group).getByRole("radio", { name: "Current" }), { key: "ArrowLeft" });
    expect(within(group).getByRole("radio", { name: "Plan" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    fireEvent.click(within(group).getByRole("radio", { name: "Current" }));
    expect(within(group).getByRole("radio", { name: "Current" }).getAttribute("tabindex")).toBe(
      "0",
    );
  });

  it("icon-only mode keeps the accessible name", () => {
    render(<Harness iconsOnly />);
    expect(screen.getByRole("radio", { name: "Renovated" })).toBeTruthy();
  });

  it("segments may shrink and dense groups use the small size so the track never overflows", () => {
    render(
      <CustomSegmented
        label="Roof"
        value="solid"
        options={[
          { value: "hidden", label: "Hidden" },
          { value: "outline", label: "Outline" },
          { value: "ghost", label: "Ghost" },
          { value: "solid", label: "Solid" },
        ]}
        onChange={() => undefined}
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    for (const r of radios) {
      expect(r.className).toContain("min-w-0");
      expect(r.className).toContain("text-xs");
    }
  });

  it("lays long text options out in two readable columns when wrapping is requested", () => {
    const onChange = vi.fn();
    render(
      <CustomSegmented
        label="Scenario"
        value="current"
        options={[
          { value: "current", label: "Current" },
          { value: "renovated", label: "Renovated" },
          { value: "windows", label: "Windows and roof" },
          { value: "facade", label: "Insulate the facade" },
        ]}
        onChange={onChange}
        wrap
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Scenario" });
    expect(group.className).toContain("grid-cols-2");
    for (const radio of within(group).getAllByRole("radio")) {
      expect(radio.className).toContain("text-sm");
      expect(radio.title).toBe(radio.textContent);
    }
    fireEvent.keyDown(within(group).getByRole("radio", { name: "Current" }), {
      key: "ArrowDown",
    });
    expect(onChange).toHaveBeenCalledWith("windows");
  });
});
