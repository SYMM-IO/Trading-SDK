import { describe, expect, it } from "vitest";
import { safeDivide } from "./safe-divide";

describe("safeDivide", () => {
  it("divides two numbers", () => {
    expect(safeDivide(10, 2).toString()).toBe("5");
  });

  it("returns 0 when dividing by zero", () => {
    expect(safeDivide(10, 0).toString()).toBe("0");
  });

  it("returns 0 when divisor is null", () => {
    expect(safeDivide(10, null).toString()).toBe("0");
  });

  it("returns 0 when divisor is undefined", () => {
    expect(safeDivide(10, undefined).toString()).toBe("0");
  });

  it("handles decimal inputs", () => {
    expect(safeDivide("1.5", "0.5").toString()).toBe("3");
  });
});
