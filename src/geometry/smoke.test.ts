import { describe, expect, it } from "vitest";

describe("test setup", () => {
  it("runs Vitest with globals and jsdom", () => {
    expect(typeof document).toBe("object");
    expect(1 + 1).toBe(2);
  });
});
