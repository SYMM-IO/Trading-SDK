import { describe, expect, it } from "vitest";
import { SymmError } from "../shared/errors/symm-error";
import { assertGaslessUrlServes, parseGaslessUrl, type GaslessUrl } from "./gasless-url";
import { GASLESS_TEST_CHAIN, TEST_GASLESS } from "./test/config";

const CHAIN = GASLESS_TEST_CHAIN;
const ORIGIN = TEST_GASLESS.url;
const INSTANCE = "arbitrum-42161-test";

function parse(url: string, protocolInstance?: string): GaslessUrl {
  return parseGaslessUrl(CHAIN, { url, ...(protocolInstance !== undefined ? { protocolInstance } : {}) });
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof SymmError ? err.code : "not-a-symm-error";
  }
  return undefined;
}

describe("parseGaslessUrl — gateway forms", () => {
  it("classifies a bare origin, pinning the configured instance", () => {
    expect(parse(ORIGIN, INSTANCE)).toEqual({ form: "origin", url: ORIGIN, protocolInstance: INSTANCE });
  });

  it("trims whitespace and trailing slashes but otherwise keeps the url verbatim", () => {
    expect(parse(`  ${ORIGIN}//  `, INSTANCE)).toEqual({ form: "origin", url: ORIGIN, protocolInstance: INSTANCE });
  });

  it("requires protocolInstance for an origin", () => {
    expect(codeOf(() => parse(ORIGIN))).toBe("GASLESS_PROTOCOL_INSTANCE_REQUIRED");
    expect(codeOf(() => parse(ORIGIN, ""))).toBe("GASLESS_PROTOCOL_INSTANCE_REQUIRED");
  });

  it("classifies an instance root and reads the instance from the path", () => {
    const url = `${ORIGIN}/v1/instances/${INSTANCE}`;

    expect(parse(url)).toEqual({ form: "instance-root", url, protocolInstance: INSTANCE });
    expect(parse(url, INSTANCE)).toEqual({ form: "instance-root", url, protocolInstance: INSTANCE });
  });

  it("classifies an instance-pinned service base for either service", () => {
    const operations = `${ORIGIN}/v1/instances/${INSTANCE}/operations`;
    const deposits = `${ORIGIN}/v1/instances/${INSTANCE}/Deposits/`;

    expect(parse(operations)).toEqual({
      form: "service-base",
      url: operations,
      service: "operations",
      protocolInstance: INSTANCE,
    });
    expect(parse(deposits)).toMatchObject({ form: "service-base", service: "deposits", protocolInstance: INSTANCE });
  });

  it("recognizes gateway paths mounted under a prefix", () => {
    expect(parse(`https://app.example/relay/v1/instances/${INSTANCE}`)).toMatchObject({
      form: "instance-root",
      protocolInstance: INSTANCE,
    });
  });

  it("decodes a percent-encoded instance segment", () => {
    expect(parse(`${ORIGIN}/v1/instances/arbitrum%2D42161%2Dtest`)).toMatchObject({ protocolInstance: INSTANCE });
    expect(codeOf(() => parse(`${ORIGIN}/v1/instances/%E0%A4%A`))).toBe("GASLESS_URL_INVALID");
  });

  it("throws GASLESS_PROTOCOL_INSTANCE_CONFLICT when the path pins a different instance", () => {
    expect(codeOf(() => parse(`${ORIGIN}/v1/instances/${INSTANCE}`, "arbitrum-42161-other"))).toBe(
      "GASLESS_PROTOCOL_INSTANCE_CONFLICT",
    );
    expect(codeOf(() => parse(`${ORIGIN}/v1/instances/${INSTANCE}/deposits`, "arbitrum-42161-other"))).toBe(
      "GASLESS_PROTOCOL_INSTANCE_CONFLICT",
    );
  });
});

describe("parseGaslessUrl — legacy and proxy forms", () => {
  it.each(["/v1/operations", "/v1/deposits", "/V1/Operations/"])(
    "rejects the instance-less compatibility route %s",
    (path) => {
      expect(codeOf(() => parse(`${ORIGIN}${path}`, INSTANCE))).toBe("GASLESS_URL_LEGACY_ROUTE");
    },
  );

  it("classifies any other absolute path as a proxy root, carrying the configured instance", () => {
    const url = "https://app.example/api/gasless";

    expect(parse(url, INSTANCE)).toEqual({ form: "proxy-root", url, protocolInstance: INSTANCE });
    expect(parse(url)).toEqual({ form: "proxy-root", url, protocolInstance: null });
  });

  it("accepts relative and protocol-relative proxy roots", () => {
    expect(parse("/api/gasless/staging")).toEqual({
      form: "proxy-root",
      url: "/api/gasless/staging",
      protocolInstance: null,
    });
    expect(parse("//gasless.example", INSTANCE)).toEqual({
      form: "origin",
      url: "//gasless.example",
      protocolInstance: INSTANCE,
    });
  });
});

describe("parseGaslessUrl — invalid urls", () => {
  it.each([
    { label: "an empty url", url: "   " },
    { label: "a bare slash", url: "/" },
    { label: "an unparseable url", url: "https://[" },
    { label: "a websocket scheme", url: "wss://gasless.example" },
    { label: "a url missing its scheme", url: "localhost:3000/api/gasless" },
    { label: "a query string", url: "https://app.example/api/gasless?env=staging" },
    { label: "a fragment", url: "https://gasless.example#staging" },
    { label: "credentials in the url", url: "https://partner:s3cret-key@gasless.example" },
    { label: "credentials in a protocol-relative url", url: "//partner:s3cret-key@gasless.example/api/gasless" },
    { label: "a relative url without a path", url: "." },
  ])("rejects $label with GASLESS_URL_INVALID", ({ url }) => {
    expect(codeOf(() => parse(url, INSTANCE))).toBe("GASLESS_URL_INVALID");
  });

  it("never echoes the url, which may carry credentials, in the error message", () => {
    for (const url of [
      "https://partner:s3cret-key@app.example/api/gasless",
      "https://app.example/api/gasless?key=s3cret-key",
      "https://partner:s3cret-key@[bad",
    ]) {
      let caught: unknown;
      try {
        parse(url, INSTANCE);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(SymmError);
      expect((caught as SymmError).code).toBe("GASLESS_URL_INVALID");
      expect((caught as SymmError).message).not.toContain("s3cret-key");
    }
  });
});

describe("assertGaslessUrlServes", () => {
  it("rejects a service base pinned to the other service", () => {
    const url = parse(`${ORIGIN}/v1/instances/${INSTANCE}/deposits`);

    expect(codeOf(() => assertGaslessUrlServes(CHAIN, url, "operations"))).toBe("GASLESS_URL_SERVICE_MISMATCH");
    expect(() => assertGaslessUrlServes(CHAIN, url, "deposits")).not.toThrow();
  });

  it("lets every other form serve both services", () => {
    for (const url of [parse(ORIGIN, INSTANCE), parse(`${ORIGIN}/v1/instances/${INSTANCE}`), parse("/api/gasless")]) {
      expect(() => assertGaslessUrlServes(CHAIN, url, "operations")).not.toThrow();
      expect(() => assertGaslessUrlServes(CHAIN, url, "deposits")).not.toThrow();
    }
  });
});
