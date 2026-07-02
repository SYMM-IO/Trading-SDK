import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTpSlConfirmingSide,
  EMPTY_TPSL_CONFIRMING,
  getTpSlConfirmingQueryKey,
  markTpSlConfirming,
  type TpSlConfirming,
} from "./tpsl-confirming";

describe("tpsl-confirming", () => {
  let queryClient: QueryClient;
  const key = getTpSlConfirmingQueryKey({ chainId: 999, quoteId: 42n, configKey: "cfg" });

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it("builds a stable, serializable query key including chainId + configKey", () => {
    const other = getTpSlConfirmingQueryKey({ chainId: 999, quoteId: 42n, configKey: "cfg" });
    expect(key).toEqual(other);
    expect(key[0]).toBe("tpsl-confirming");
    expect(key[1]).toEqual({ chainId: 999, quoteId: "42", configKey: "cfg" });
  });

  it("marks only the sides that are explicitly submitted", () => {
    markTpSlConfirming(queryClient, key, { tp: true, sl: false });
    expect(queryClient.getQueryData<TpSlConfirming>(key)).toEqual({ tp: true, sl: false });
  });

  it("merges partial updates without clobbering an existing flag", () => {
    markTpSlConfirming(queryClient, key, { tp: true });
    markTpSlConfirming(queryClient, key, { sl: true });
    expect(queryClient.getQueryData<TpSlConfirming>(key)).toEqual({ tp: true, sl: true });
  });

  it("clears one side while leaving the other alone", () => {
    markTpSlConfirming(queryClient, key, { tp: true, sl: true });
    clearTpSlConfirmingSide(queryClient, key, "sl");
    expect(queryClient.getQueryData<TpSlConfirming>(key)).toEqual({ tp: true, sl: false });
  });

  it("is idempotent when clearing a side that was never set", () => {
    clearTpSlConfirmingSide(queryClient, key, "tp");
    expect(queryClient.getQueryData<TpSlConfirming>(key)).toEqual(EMPTY_TPSL_CONFIRMING);
  });
});
