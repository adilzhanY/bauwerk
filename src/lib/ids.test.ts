import { describe, expect, it } from "vitest";
import { createId, resetIds } from "./ids";

describe("createId", () => {
  it("is deterministic under test and restarts after resetIds", () => {
    resetIds();
    const a = createId("x");
    const b = createId("x");
    expect(a).not.toBe(b);
    resetIds();
    expect(createId("x")).toBe(a);
  });
});
