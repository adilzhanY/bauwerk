import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BuildingNameEditor } from "./BuildingName";

describe("BuildingNameEditor", () => {
  it("opens on a double click and commits the new name", () => {
    const rename = vi.fn();
    render(<BuildingNameEditor name="Bauwerk" onRename={rename} />);
    fireEvent.doubleClick(screen.getByRole("button", { name: "Rename building Bauwerk" }));
    const input = screen.getByLabelText("Building name");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "Garden house" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(rename).toHaveBeenCalledWith("Garden house");
  });

  it("opens from a keyboard generated click", () => {
    render(<BuildingNameEditor name="Bauwerk" onRename={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename building Bauwerk" }), { detail: 0 });
    expect(screen.getByLabelText("Building name")).toBeTruthy();
  });

  it("keeps a long building name inside one bounded chip", () => {
    render(<BuildingNameEditor name="Altbau Kreuzberg, Baujahr 1905" onRename={() => undefined} />);
    const button = screen.getByRole("button", {
      name: "Rename building Altbau Kreuzberg, Baujahr 1905",
    });
    expect(button.className).toContain("max-w-80");
    expect(button.className).toContain("whitespace-nowrap");
    expect(button.querySelector("span")?.className).toContain("truncate");
    expect(button.title).toContain("Altbau Kreuzberg, Baujahr 1905");
  });
});
