import { describe, expect, it } from "vitest";
import { uValueColor } from "./uValueColor";

describe("uValueColor", () => {
  it("is green for good and red for poor U-values, clamped", () => {
    expect(uValueColor(0.1)).toBe("rgb(60, 200, 70)");
    expect(uValueColor(0.2)).toBe("rgb(60, 200, 70)");
    expect(uValueColor(1.5)).toBe("rgb(240, 50, 70)");
    expect(uValueColor(5)).toBe("rgb(240, 50, 70)");
    expect(uValueColor(0.85)).toBe("rgb(150, 125, 70)");
  });
});
