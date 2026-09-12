import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains";
import { withGaslessNonceLock } from "./nonce-lock";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "./test/config";

const ACCOUNT = "0x3333333333333333333333333333333333333333";
const OTHER_ACCOUNT = "0x4444444444444444444444444444444444444444";

/** A promise the test settles by hand, to hold a task inside the lock. */
function deferred<value = void>() {
  let resolve!: (result: value) => void;
  const promise = new Promise<value>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

/** Let every pending continuation run, so a task that could start has started. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("withGaslessNonceLock", () => {
  it("runs one account's tasks one at a time, in submission order", async () => {
    const { config } = gaslessTestConfig();
    const first = deferred<string>();
    const started: string[] = [];

    const a = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, ACCOUNT, () => {
      started.push("a");
      return first.promise;
    });
    const b = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, ACCOUNT, async () => {
      started.push("b");
      return "b";
    });
    const c = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, ACCOUNT, async () => {
      started.push("c");
      return "c";
    });

    await flush();
    /** `b` and `c` would read the nonce `a` is about to consume — neither may start while `a` holds the lock. */
    expect(started).toEqual(["a"]);

    first.resolve("a");
    await expect(Promise.all([a, b, c])).resolves.toEqual(["a", "b", "c"]);
    expect(started).toEqual(["a", "b", "c"]);
  });

  it("does not let a failed task block the next one", async () => {
    const { config } = gaslessTestConfig();
    const rejection = new Error("relay rejected");
    const thrown = new Error("signature refused");

    const rejected = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, ACCOUNT, () => Promise.reject(rejection));
    const threw = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, ACCOUNT, () => {
      throw thrown;
    });
    const next = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, ACCOUNT, async () => "next");

    /** Each caller still sees its own outcome. */
    await expect(rejected).rejects.toBe(rejection);
    await expect(threw).rejects.toBe(thrown);
    await expect(next).resolves.toBe("next");
  });

  it("keys the lock case-insensitively on the account", async () => {
    const { config } = gaslessTestConfig();
    const mixedCase = "0xAbCdEf0000000000000000000000000000000001";
    const first = deferred();
    let secondStarted = false;

    const a = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, mixedCase, () => first.promise);
    const b = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, mixedCase.toLowerCase(), async () => {
      secondStarted = true;
    });

    await flush();
    expect(secondStarted).toBe(false);

    first.resolve();
    await Promise.all([a, b]);
    expect(secondStarted).toBe(true);
  });

  it("keeps different accounts, chains, and configs independent", async () => {
    const { config } = gaslessTestConfig();
    const { config: otherConfig } = gaslessTestConfig();
    const blocker = deferred();
    const started: string[] = [];

    const blocked = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, ACCOUNT, () => blocker.promise);
    const independent = [
      withGaslessNonceLock(config, GASLESS_TEST_CHAIN, OTHER_ACCOUNT, async () => {
        started.push("other account");
      }),
      withGaslessNonceLock(config, SymmioSupportedChainId.BASE, ACCOUNT, async () => {
        started.push("other chain");
      }),
      withGaslessNonceLock(otherConfig, GASLESS_TEST_CHAIN, ACCOUNT, async () => {
        started.push("other config");
      }),
    ];

    await flush();
    /** None of these shares the held `(config, chainId, account)` key, so none waits on it. */
    expect([...started].sort()).toEqual(["other account", "other chain", "other config"]);

    blocker.resolve();
    await Promise.all([blocked, ...independent]);
  });

  it("queues behind a still-running task even after an earlier task has cleaned up", async () => {
    const { config } = gaslessTestConfig();
    const first = deferred();
    const second = deferred();
    const started: string[] = [];

    const a = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, ACCOUNT, () => {
      started.push("a");
      return first.promise;
    });
    const b = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, ACCOUNT, () => {
      started.push("b");
      return second.promise;
    });

    first.resolve();
    await a;
    await flush();
    expect(started).toEqual(["a", "b"]);

    /**
     * `a` has settled and run its cleanup while `b` still holds the lock. The
     * cleanup must not drop `b`'s queue entry, or `c` would run beside `b` and
     * sign the same nonce.
     */
    const c = withGaslessNonceLock(config, GASLESS_TEST_CHAIN, ACCOUNT, async () => {
      started.push("c");
    });
    await flush();
    expect(started).toEqual(["a", "b"]);

    second.resolve();
    await Promise.all([b, c]);
    expect(started).toEqual(["a", "b", "c"]);
  });
});
