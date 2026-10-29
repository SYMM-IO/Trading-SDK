import { describe, expect, it } from "vitest";
import { parseTimelockErrorDetails, TimelockSolverError } from "./errors";

describe("timelock errors", () => {
  it.each(Array.from({ length: 14 }, (_, index) => 3700 + index))(
    "preserves typed code %s and diagnostic fields",
    (code) => {
      const body = { code, error_category: "account_state", error_message: "Blocked", error_detail: "diagnostic" };
      const error = new TimelockSolverError({
        code: "HTTP_ERROR",
        message: "failed",
        status: 400,
        statusText: "Bad Request",
        url: "https://provider.example",
        method: "POST",
        responseData: body,
      });
      expect(error.details).toMatchObject({
        code,
        knownCode: code,
        errorCategory: "account_state",
        errorMessage: "Blocked",
        errorDetail: "diagnostic",
      });
      expect(error.responseData).toBe(body);
    },
  );
  it("exposes the first selector only as a best-effort diagnostic", () => {
    expect(
      parseTimelockErrorDetails({ error_code: 3711, error_detail: "selector 0x205c2878 has delay 0, requires 600" }),
    ).toMatchObject({ knownCode: 3711, firstMissingSelector: "0x205c2878" });
  });
  it.each([{}, { code: 0 }, { code: 9999, error_category: "unavailable" }])(
    "retains unknown error bodies without treating them as success: %j",
    (body) => {
      const details = parseTimelockErrorDetails(body);
      expect(details.knownCode).toBeUndefined();
      expect(details.errorCategory).toBe("error_category" in body ? body.error_category : "unknown");
    },
  );
});
