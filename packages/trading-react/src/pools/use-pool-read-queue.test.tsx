import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { usePoolReadQueue } from "./use-pool-read-queue";

it("never starts a canceled queued read after the active requests complete", async () => {
  const { result, unmount } = renderHook(() => usePoolReadQueue());
  const releases: (() => void)[] = [];
  const active = Array.from({ length: 5 }, () =>
    result.current(() => new Promise<void>((resolve) => releases.push(resolve)), new AbortController().signal),
  );
  const read = vi.fn().mockResolvedValue("stale wallet");
  const controller = new AbortController();
  const pending = result.current(read, controller.signal);
  const rejected = expect(pending).rejects.toBeInstanceOf(Error);
  controller.abort();
  releases.forEach((resolve) => resolve());
  await Promise.all(active);
  await rejected;
  expect(read).not.toHaveBeenCalled();
  await expect(result.current(async () => "new wallet", new AbortController().signal)).resolves.toBe("new wallet");
  unmount();
});
