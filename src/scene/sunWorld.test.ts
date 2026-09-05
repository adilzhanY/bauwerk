import { describe, expect, it } from "vitest";
import { sunWorldPosition } from "./sunWorld";

describe("sunWorldPosition", () => {
  it("puts a southern sun on the plan -y side and an eastern sun on +x when the plan is not rotated", () => {
    const south = sunWorldPosition(180, 45, { x: 0, y: 0 }, 10, 0);
    expect(south[2]).toBeLessThan(0); // world z is plan y; south is -y
    expect(south[1]).toBeCloseTo(10 * Math.sin(Math.PI / 4));
    const east = sunWorldPosition(90, 10, { x: 0, y: 0 }, 10, 0);
    expect(east[0]).toBeGreaterThan(9);
    // Plan rotated 90 degrees clockwise: plan +y points east, so an eastern sun is on +z.
    const eastRotated = sunWorldPosition(90, 10, { x: 0, y: 0 }, 10, 90);
    expect(eastRotated[2]).toBeGreaterThan(9);
  });
});
