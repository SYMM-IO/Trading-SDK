import { describe, expect, it, vi } from "vitest";
import { createPositionReader } from "./read-positions";

describe("portfolio request queue", () => {
  it.each([401, 403])("stops queued reads after authentication failure %s", async (status) => {
    const read = createPositionReader([]);
    const error = Object.assign(new Error("expired"), { status });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const request = vi.fn(async (index: number) => {
      if (index === 0) throw error;
      await pending;
      return index;
    });
    const reads = Array.from({ length: 12 }, (_, index) => read(() => request(index), "profit", String(index)));
    const settled = Promise.allSettled(reads);
    await expect(Promise.all(reads)).rejects.toBe(error);
    release();
    await settled;
    expect(request).toHaveBeenCalledTimes(5);
    await expect(createPositionReader([])(async () => 1, "profit", "new-session")).resolves.toBe(1);
  });
  it("stops the queue when authentication fails during a retry", async () => {
    const read = createPositionReader([]);
    const error = Object.assign(new Error("expired"), { status: 401 });
    const request = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockRejectedValue(error);
    await expect(read(request, "profit", "pool")).rejects.toBe(error);
    const queued = vi.fn(async () => 1);
    await expect(read(queued, "profit", "next-pool")).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(2);
    expect(queued).not.toHaveBeenCalled();
  });
});
