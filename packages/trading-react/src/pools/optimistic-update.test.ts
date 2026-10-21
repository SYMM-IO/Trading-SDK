import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { beginPoolOptimisticUpdate } from "./optimistic-update";

describe("independent pool optimistic operations", () => {
  it("rolls back one operation without removing a concurrently accepted operation", () => {
    const client = new QueryClient();
    const queryKey = ["balance"];
    client.setQueryData(queryKey, 100);
    const first = beginPoolOptimisticUpdate(client, [{ queryKey, apply: (value) => Number(value) - 20 }]);
    const second = beginPoolOptimisticUpdate(client, [{ queryKey, apply: (value) => Number(value) - 30 }]);
    expect(client.getQueryData(queryKey)).toBe(50);
    second.commit();
    first.rollback();
    expect(client.getQueryData(queryKey)).toBe(70);
    first.rollback();
    expect(client.getQueryData(queryKey)).toBe(70);
  });
  it("does not overwrite a newer server snapshot when an old request fails", () => {
    const client = new QueryClient();
    const queryKey = ["balance"];
    client.setQueryData(queryKey, 100);
    const pending = beginPoolOptimisticUpdate(client, [{ queryKey, apply: (value) => Number(value) - 20 }]);
    client.setQueryData(queryKey, 75);
    pending.rollback();
    expect(client.getQueryData(queryKey)).toBe(75);
  });
});
