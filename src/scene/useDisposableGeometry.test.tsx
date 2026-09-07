import { BufferGeometry } from "three";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDisposableGeometries, useDisposableGeometry } from "./useDisposableGeometry";

function Single({ geometry }: { geometry: BufferGeometry | null }) {
  useDisposableGeometry(geometry);
  return null;
}

function Many({ geometries }: { geometries: readonly BufferGeometry[] }) {
  useDisposableGeometries(geometries);
  return null;
}

describe("generated geometry lifecycle", () => {
  it("disposes a replaced geometry and the current geometry on unmount", () => {
    const first = new BufferGeometry();
    const second = new BufferGeometry();
    const disposeFirst = vi.spyOn(first, "dispose");
    const disposeSecond = vi.spyOn(second, "dispose");
    const view = render(<Single geometry={first} />);

    view.rerender(<Single geometry={second} />);
    expect(disposeFirst).toHaveBeenCalledOnce();
    expect(disposeSecond).not.toHaveBeenCalled();

    view.unmount();
    expect(disposeSecond).toHaveBeenCalledOnce();
  });

  it("disposes every geometry in a replaced collection", () => {
    const first = new BufferGeometry();
    const second = new BufferGeometry();
    const disposeFirst = vi.spyOn(first, "dispose");
    const disposeSecond = vi.spyOn(second, "dispose");
    const view = render(<Many geometries={[first, second]} />);

    view.rerender(<Many geometries={[]} />);
    expect(disposeFirst).toHaveBeenCalledOnce();
    expect(disposeSecond).toHaveBeenCalledOnce();
  });
});
