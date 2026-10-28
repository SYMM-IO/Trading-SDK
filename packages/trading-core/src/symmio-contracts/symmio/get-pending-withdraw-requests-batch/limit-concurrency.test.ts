import { describe, expect, it } from "vitest";
import { createConcurrencyLimiter } from "./limit-concurrency";

async function hops(count: number) {
  for (let hop = 0; hop < count; hop += 1) await Promise.resolve();
}

describe("concurrency limiter", () => {
  /**
   * A newcomer that arrives while a finished task hands its slot to a waiting
   * one must queue, not run beside it. Which microtask that lands on depends on
   * the engine, so the newcomer is tried at several delays after the release.
   */
  it.each([0, 1, 2, 3, 4, 5, 6])(
    "never runs past its limit when a newcomer arrives %i microtasks after a release",
    async (delay) => {
      const run = createConcurrencyLimiter(1);
      let inFlight = 0;
      let peak = 0;
      function task(onDone?: () => void) {
        return async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await hops(3);
          inFlight -= 1;
          onDone?.();
        };
      }

      let newcomer: Promise<void> | undefined;
      const first = run(task(() => void hops(delay).then(() => (newcomer = run(task())))));
      const waiting = run(task());
      await Promise.all([first, waiting]);
      await hops(20);
      await newcomer;

      expect(newcomer).toBeDefined();
      expect(peak).toBe(1);
    },
  );

  it("rejects tasks that have not started once one task fails", async () => {
    const run = createConcurrencyLimiter(1);
    const failure = new Error("RPC unavailable");
    let laterRan = false;

    const failing = run(async () => {
      throw failure;
    });
    const later = run(async () => {
      laterRan = true;
    });

    await expect(failing).rejects.toBe(failure);
    await expect(later).rejects.toBe(failure);
    expect(laterRan).toBe(false);
  });
});
