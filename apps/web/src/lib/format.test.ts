import { describe, expect, it } from "vitest";
import { percent, whole } from "./format.js";

describe("format helpers", () => {
  it("formats missing values consistently", () => {
    expect(whole(null)).toBe("n/a");
    expect(percent(undefined)).toBe("n/a");
  });

  it("formats retention ratios as percentages", () => {
    expect(percent(0.51)).toBe("51%");
  });
});
