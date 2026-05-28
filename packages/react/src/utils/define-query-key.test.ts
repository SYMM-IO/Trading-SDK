import { describe, expect, it } from "vitest";
import { defineQueryKey } from "./define-query-key";

interface SingleArg {
  chainId: number;
  user: string;
}

interface FirstArg {
  chainId: number;
}

interface SecondArg {
  user: string;
}

const ROOT = ["symmio", "account-layer"] as const;

describe("defineQueryKey", () => {
  it("exposes the literal prefix it was constructed with", () => {
    const builder = defineQueryKey<[SingleArg]>([...ROOT, "getUserSubAccounts"], (args) => [args]);
    expect(builder.prefix).toEqual(["symmio", "account-layer", "getUserSubAccounts"]);
  });

  it("preserves prefix identity (same reference, not a copy)", () => {
    const prefix = [...ROOT, "getUserSubAccounts"] as const;
    const builder = defineQueryKey<[SingleArg]>(prefix, (args) => [args]);
    expect(builder.prefix).toBe(prefix);
  });

  it("emits `[...prefix, ...buildTail(...args)]`", () => {
    const builder = defineQueryKey<[SingleArg]>([...ROOT, "getUserSubAccounts"], (args) => [
      { chainId: args.chainId, user: args.user },
    ]);
    const key = builder({ chainId: 1, user: "0xabc" });
    expect(key).toEqual(["symmio", "account-layer", "getUserSubAccounts", { chainId: 1, user: "0xabc" }]);
  });

  it("supports a multi-arg builder with one trailing segment per argument", () => {
    const builder = defineQueryKey<[FirstArg, SecondArg]>([...ROOT, "two"], (a, b) => [a, b]);
    expect(builder({ chainId: 1 }, { user: "0xabc" })).toEqual([
      "symmio",
      "account-layer",
      "two",
      { chainId: 1 },
      { user: "0xabc" },
    ]);
  });

  it("supports an empty tail (prefix-only key)", () => {
    const builder = defineQueryKey<[]>([...ROOT, "ping"], () => []);
    expect(builder()).toEqual(["symmio", "account-layer", "ping"]);
  });

  it("passes each call's arguments through to `buildTail` independently", () => {
    const builder = defineQueryKey<[SingleArg]>([...ROOT, "getUserSubAccounts"], (args) => [args]);
    const a = builder({ chainId: 1, user: "0xabc" });
    const b = builder({ chainId: 2, user: "0xdef" });
    expect(a).toEqual(["symmio", "account-layer", "getUserSubAccounts", { chainId: 1, user: "0xabc" }]);
    expect(b).toEqual(["symmio", "account-layer", "getUserSubAccounts", { chainId: 2, user: "0xdef" }]);
  });

  it("forwards whatever `buildTail` returns, including non-object segments", () => {
    const builder = defineQueryKey<[number]>([...ROOT, "scalar"], (n) => [n, `n=${n}`]);
    expect(builder(7)).toEqual(["symmio", "account-layer", "scalar", 7, "n=7"]);
  });
});
