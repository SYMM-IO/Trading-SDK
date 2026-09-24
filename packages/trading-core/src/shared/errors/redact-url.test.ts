import { describe, expect, it } from "vitest";
import { redactUrl } from "./redact-url";

describe("redactUrl", () => {
  it("returns a URL with nothing to strip unchanged", () => {
    expect(redactUrl("https://fapi.binance.com/fapi/v1/depth")).toBe("https://fapi.binance.com/fapi/v1/depth");
    expect(redactUrl("https://gasless.test:8443")).toBe("https://gasless.test:8443");
  });

  it("strips userinfo, query string and fragment", () => {
    expect(redactUrl("https://partner:s3cret@gasless.test/v1/instances/x/operations?key=abc#frag")).toBe(
      "https://gasless.test/v1/instances/x/operations",
    );
  });

  it("cuts userinfo at the last @ of the authority, like the URL parser", () => {
    expect(redactUrl("https://user:p@ss@gasless.test/path")).toBe("https://gasless.test/path");
  });

  it("keeps the host when an @ appears only in the path or query", () => {
    expect(redactUrl("https://gasless.test/users/@me")).toBe("https://gasless.test/users/@me");
    expect(redactUrl("https://gasless.test?email=a@b.example")).toBe("https://gasless.test");
  });

  it("handles protocol-relative and relative URLs", () => {
    expect(redactUrl("//user:pw@gasless.test/x?y=1")).toBe("//gasless.test/x");
    expect(redactUrl("/api/gasless/operations/abc?token=1")).toBe("/api/gasless/operations/abc");
  });
});
