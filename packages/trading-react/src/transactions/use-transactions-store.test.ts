import type { Hash } from "viem";
import { afterEach, describe, expect, it } from "vitest";
import { useTransactionsStore } from "./use-transactions-store";

const HASH_A: Hash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B: Hash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

afterEach(() => {
  useTransactionsStore.getState().clear();
});

describe("useTransactionsStore", () => {
  it("adds a tx in 'pending' status with a createdAt timestamp", () => {
    useTransactionsStore.getState().add({ hash: HASH_A, chainId: 999, label: "Rename" });
    const txs = useTransactionsStore.getState().txs;
    expect(txs).toHaveLength(1);
    expect(txs[0]?.hash).toBe(HASH_A);
    expect(txs[0]?.status).toBe("pending");
    expect(typeof txs[0]?.createdAt).toBe("number");
  });

  it("ignores duplicate hashes on add", () => {
    useTransactionsStore.getState().add({ hash: HASH_A, chainId: 999, label: "Rename" });
    useTransactionsStore.getState().add({ hash: HASH_A, chainId: 999, label: "Rename again" });
    expect(useTransactionsStore.getState().txs).toHaveLength(1);
  });

  it("promotes a tracked tx to 'confirmed'", () => {
    useTransactionsStore.getState().add({ hash: HASH_A, chainId: 999, label: "Rename" });
    useTransactionsStore.getState().markConfirmed(HASH_A);
    expect(useTransactionsStore.getState().txs[0]?.status).toBe("confirmed");
  });

  it("promotes a tracked tx to 'failed'", () => {
    useTransactionsStore.getState().add({ hash: HASH_A, chainId: 999, label: "Rename" });
    useTransactionsStore.getState().markFailed(HASH_A);
    expect(useTransactionsStore.getState().txs[0]?.status).toBe("failed");
  });

  it("is a no-op when marking an unknown hash", () => {
    useTransactionsStore.getState().add({ hash: HASH_A, chainId: 999, label: "Rename" });
    useTransactionsStore.getState().markConfirmed(HASH_B);
    expect(useTransactionsStore.getState().txs[0]?.status).toBe("pending");
  });

  it("clears every tx", () => {
    useTransactionsStore.getState().add({ hash: HASH_A, chainId: 999, label: "A" });
    useTransactionsStore.getState().add({ hash: HASH_B, chainId: 999, label: "B" });
    useTransactionsStore.getState().clear();
    expect(useTransactionsStore.getState().txs).toEqual([]);
  });
});
