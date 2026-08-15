import { describe, expect, it } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../core/chains";
import { SymmError } from "../shared/errors/symm-error";
import { assertSolverKind } from "./assert-solver-kind";

describe("assertSolverKind", () => {
  it("passes silently when the kinds match", () => {
    const rasa = getDefaultSolver(SymmioSupportedChainId.BASE);
    expect(() => assertSolverKind(rasa, "rasa", "someAction")).not.toThrow();
  });

  it("throws UNSUPPORTED_BY_SOLVER naming the action and both kinds", () => {
    const enigma = getDefaultSolver(SymmioSupportedChainId.HYPER_EVM);
    const error = (() => {
      try {
        assertSolverKind(enigma, "rasa", "someAction");
        return undefined;
      } catch (err) {
        return err;
      }
    })();
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).code).toBe("UNSUPPORTED_BY_SOLVER");
    expect((error as SymmError).message).toMatch(/someAction/);
    expect((error as SymmError).message).toMatch(/"enigma"/);
    expect((error as SymmError).message).toMatch(/"rasa"/);
  });
});
