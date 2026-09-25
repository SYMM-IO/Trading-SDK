import { afterEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../core/chains";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";
import { GaslessRequestStatus } from "./types";

const waitForGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("./wait-for-gasless-request/wait-for-gasless-request", () => ({ waitForGaslessRequest }));

import {
  blocksGaslessNonceStream,
  clearGaslessPendingNonce,
  gaslessInstantNonceStreamKey,
  gaslessWalletNonceStreamKey,
  readGaslessStreamNonce,
  submitOnGaslessNonceStream,
  submitOnGaslessNonceStreams,
  withGaslessNonceLock,
  withGaslessNonceLocks,
} from "./nonce-lock";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "./test/config";
import { operationRequestFixture } from "./test/records";
import { requireGaslessRequestId } from "./to-gasless-submit-receipt";
import { GASLESS_SUBMIT_UNCONFIRMED_CODE, type GaslessUnconfirmedSubmit } from "./unconfirmed-submit";

const ACCOUNT = "0x3333333333333333333333333333333333333333";
const OTHER_ACCOUNT = "0x4444444444444444444444444444444444444444";
const OWNER = "0x1111111111111111111111111111111111111111";
const OTHER_OWNER = "0x2222222222222222222222222222222222222222";
const STREAM = gaslessInstantNonceStreamKey(GASLESS_TEST_CHAIN, ACCOUNT);

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

/** A deadline `seconds` from now, in the `bigint` seconds the signed header carries. */
function deadlineIn(seconds: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + seconds);
}

describe("gasless nonce stream keys", () => {
  it("keys InstantLayer nonces per chain and signer account, case-insensitively", () => {
    expect(gaslessInstantNonceStreamKey(GASLESS_TEST_CHAIN, ACCOUNT.toUpperCase())).toBe(STREAM);
    expect(gaslessInstantNonceStreamKey(SymmioSupportedChainId.BASE, ACCOUNT)).not.toBe(STREAM);
    expect(gaslessInstantNonceStreamKey(GASLESS_TEST_CHAIN, OTHER_ACCOUNT)).not.toBe(STREAM);
  });

  it("keys wallet 0 on the signer account alone, and positive ids on the wallet too", () => {
    /** Wallet 0 counts in `_legacyWalletOperationNonces[signerAccount]` — one stream across every owner. */
    expect(gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 0n, OWNER, ACCOUNT)).toBe(
      gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 0n, OTHER_OWNER, ACCOUNT),
    );
    /** A positive id counts in `walletNonces[wallet][signerAccount]`, so the owner selects the wallet. */
    expect(gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 1n, OWNER, ACCOUNT)).not.toBe(
      gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 1n, OTHER_OWNER, ACCOUNT),
    );
    expect(gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 1n, OWNER, ACCOUNT)).not.toBe(
      gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 2n, OWNER, ACCOUNT),
    );
    /** The InstantLayer stream is never the wallet stream, however the ids line up. */
    expect(gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 0n, OWNER, ACCOUNT)).not.toBe(STREAM);
  });
});

describe("withGaslessNonceLock", () => {
  it("runs one stream's tasks one at a time, in submission order", async () => {
    const { config } = gaslessTestConfig();
    const first = deferred<string>();
    const started: string[] = [];

    const a = withGaslessNonceLock(config, STREAM, () => {
      started.push("a");
      return first.promise;
    });
    const b = withGaslessNonceLock(config, STREAM, async () => {
      started.push("b");
      return "b";
    });
    const c = withGaslessNonceLock(config, STREAM, async () => {
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

    const rejected = withGaslessNonceLock(config, STREAM, () => Promise.reject(rejection));
    const threw = withGaslessNonceLock(config, STREAM, () => {
      throw thrown;
    });
    const next = withGaslessNonceLock(config, STREAM, async () => "next");

    /** Each caller still sees its own outcome. */
    await expect(rejected).rejects.toBe(rejection);
    await expect(threw).rejects.toBe(thrown);
    await expect(next).resolves.toBe("next");
  });

  it("keeps different streams and configs independent", async () => {
    const { config } = gaslessTestConfig();
    const { config: otherConfig } = gaslessTestConfig();
    const blocker = deferred();
    const started: string[] = [];

    const blocked = withGaslessNonceLock(config, STREAM, () => blocker.promise);
    const independent = [
      withGaslessNonceLock(config, gaslessInstantNonceStreamKey(GASLESS_TEST_CHAIN, OTHER_ACCOUNT), async () => {
        started.push("other account");
      }),
      withGaslessNonceLock(config, gaslessInstantNonceStreamKey(SymmioSupportedChainId.BASE, ACCOUNT), async () => {
        started.push("other chain");
      }),
      withGaslessNonceLock(config, gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 0n, OWNER, ACCOUNT), async () => {
        started.push("wallet stream");
      }),
      withGaslessNonceLock(otherConfig, STREAM, async () => {
        started.push("other config");
      }),
    ];

    await flush();
    /** None of these shares the held `(config, stream)` key, so none waits on it. */
    expect([...started].sort()).toEqual(["other account", "other chain", "other config", "wallet stream"]);

    blocker.resolve();
    await Promise.all([blocked, ...independent]);
  });

  it("queues behind a still-running task even after an earlier task has cleaned up", async () => {
    const { config } = gaslessTestConfig();
    const first = deferred();
    const second = deferred();
    const started: string[] = [];

    const a = withGaslessNonceLock(config, STREAM, () => {
      started.push("a");
      return first.promise;
    });
    const b = withGaslessNonceLock(config, STREAM, () => {
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
    const c = withGaslessNonceLock(config, STREAM, async () => {
      started.push("c");
    });
    await flush();
    expect(started).toEqual(["a", "b"]);

    second.resolve();
    await Promise.all([b, c]);
    expect(started).toEqual(["a", "b", "c"]);
  });
});

describe("withGaslessNonceLocks", () => {
  const WALLET_STREAM = gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 2n, OWNER, ACCOUNT);

  it("holds every listed stream for the whole task", async () => {
    const { config } = gaslessTestConfig();
    const blocker = deferred();
    const started: string[] = [];

    const batch = withGaslessNonceLocks(config, [WALLET_STREAM, STREAM], async () => {
      started.push("batch");
      await blocker.promise;
    });
    const instant = withGaslessNonceLock(config, STREAM, async () => {
      started.push("instant");
    });
    const wallet = withGaslessNonceLock(config, WALLET_STREAM, async () => {
      started.push("wallet");
    });
    const unrelated = withGaslessNonceLock(
      config,
      gaslessInstantNonceStreamKey(GASLESS_TEST_CHAIN, OTHER_ACCOUNT),
      async () => {
        started.push("unrelated");
      },
    );

    await flush();
    /** The batch signs on both streams, so neither single-stream relay may read a nonce it is about to consume. */
    expect([...started].sort()).toEqual(["batch", "unrelated"]);

    blocker.resolve();
    await Promise.all([batch, instant, wallet, unrelated]);
    expect(started.slice(2).sort()).toEqual(["instant", "wallet"]);
  });

  it("cannot deadlock two batches that list shared streams in opposite orders", async () => {
    const { config } = gaslessTestConfig();
    const blocker = deferred();
    const started: string[] = [];

    const first = withGaslessNonceLocks(config, [STREAM, WALLET_STREAM], async () => {
      started.push("first");
      await blocker.promise;
    });
    /**
     * Taken one stream at a time in the listed order, this batch could hold the
     * wallet stream while the first held the InstantLayer one, each waiting on
     * the other forever. Joining every queue at once, it only waits on the
     * batch queued before it.
     */
    const second = withGaslessNonceLocks(config, [WALLET_STREAM, STREAM], async () => {
      started.push("second");
    });

    await flush();
    expect(started).toEqual(["first"]);

    blocker.resolve();
    await Promise.all([first, second]);
    expect(started).toEqual(["first", "second"]);
  });

  it("takes a stream listed twice only once", async () => {
    const { config } = gaslessTestConfig();
    await expect(withGaslessNonceLocks(config, [STREAM, STREAM], async () => "ran")).resolves.toBe("ran");
  });
});

describe("gasless pending-nonce guard", () => {
  afterEach(() => {
    vi.useRealTimers();
    waitForGaslessRequest.mockReset();
  });

  /** Record a 202 on the stream, as a relay would after submitting. */
  async function submitAccepted(
    config: Parameters<typeof submitOnGaslessNonceStream>[0],
    options: { signedNonce: bigint; deadline: bigint; requestId?: string },
  ) {
    await submitOnGaslessNonceStream(
      config,
      STREAM,
      {
        signedNonce: options.signedNonce,
        service: "operations",
        chainId: GASLESS_TEST_CHAIN,
        deadline: options.deadline,
      },
      async () => ({ requestId: options.requestId ?? "req-1" }),
      () => true,
    );
  }

  it("reads the nonce straight through when nothing is pending", async () => {
    const { config } = gaslessTestConfig();
    await expect(readGaslessStreamNonce(config, STREAM, async () => 5n)).resolves.toBe(5n);
    expect(waitForGaslessRequest).not.toHaveBeenCalled();
  });

  it("waits for a pending request to finish, then re-reads the consumed nonce", async () => {
    const { config } = gaslessTestConfig();
    await submitAccepted(config, { signedNonce: 6n, deadline: deadlineIn(600) });
    waitForGaslessRequest.mockResolvedValue(operationRequestFixture({ status: GaslessRequestStatus.SUCCEEDED }));

    const reads = [5n, 6n];
    const nonce = await readGaslessStreamNonce(config, STREAM, async () => reads.shift() ?? 6n);

    expect(nonce).toBe(6n);
    expect(waitForGaslessRequest).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ requestId: "req-1", service: "operations", until: "terminal" }),
    );
  });

  it("clears the stream after a failed terminal, so the next relay signs the same nonce again", async () => {
    const { config } = gaslessTestConfig();
    await submitAccepted(config, { signedNonce: 6n, deadline: deadlineIn(600) });
    waitForGaslessRequest.mockResolvedValue(operationRequestFixture({ status: GaslessRequestStatus.REJECTED }));

    /** A rejected request consumed nothing on-chain, so the nonce is still 5. */
    await expect(readGaslessStreamNonce(config, STREAM, async () => 5n)).resolves.toBe(5n);
    await expect(readGaslessStreamNonce(config, STREAM, async () => 5n)).resolves.toBe(5n);
    expect(waitForGaslessRequest).toHaveBeenCalledTimes(1);
  });

  it("does not wait when the pending nonce is already consumed on-chain", async () => {
    const { config } = gaslessTestConfig();
    await submitAccepted(config, { signedNonce: 6n, deadline: deadlineIn(600) });

    await expect(readGaslessStreamNonce(config, STREAM, async () => 6n)).resolves.toBe(6n);
    expect(waitForGaslessRequest).not.toHaveBeenCalled();
  });

  it("frees the stream once the signed deadline has passed", async () => {
    const { config } = gaslessTestConfig();
    await submitAccepted(config, { signedNonce: 6n, deadline: deadlineIn(-1) });

    /** An expired signature can never land, so its nonce is available again. */
    await expect(readGaslessStreamNonce(config, STREAM, async () => 5n)).resolves.toBe(5n);
    expect(waitForGaslessRequest).not.toHaveBeenCalled();
  });

  it("records nothing when a submit fails definitively", async () => {
    const { config } = gaslessTestConfig();
    const rejection = new Error("422 schema");

    await expect(
      submitOnGaslessNonceStream(
        config,
        STREAM,
        { signedNonce: 6n, service: "operations", chainId: GASLESS_TEST_CHAIN, deadline: deadlineIn(600) },
        () => Promise.reject(rejection),
        () => false,
      ),
    ).rejects.toBe(rejection);

    await expect(readGaslessStreamNonce(config, STREAM, async () => 5n)).resolves.toBe(5n);
    expect(waitForGaslessRequest).not.toHaveBeenCalled();
  });

  it("blocks the stream when a 202 carried no request id", async () => {
    vi.useFakeTimers();
    const { config } = gaslessTestConfig();

    await expect(
      submitOnGaslessNonceStream(
        config,
        STREAM,
        { signedNonce: 6n, service: "operations", chainId: GASLESS_TEST_CHAIN, deadline: deadlineIn(3) },
        /** The acceptance parse runs inside the submit: a 202 without an id throws from here. */
        async () => ({ requestId: requireGaslessRequestId(undefined) }),
        blocksGaslessNonceStream,
      ),
    ).rejects.toMatchObject({ code: "GASLESS_ACCEPTANCE_INVALID" });

    /** Acceptance is certain, so the signed nonce is more likely consumed, not less. */
    const pending = readGaslessStreamNonce(config, STREAM, async () => 5n);
    const assertion = expect(pending).rejects.toMatchObject({ code: "GASLESS_NONCE_STREAM_BUSY" });
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    expect(waitForGaslessRequest).not.toHaveBeenCalled();

    clearGaslessPendingNonce(config, STREAM);
  });

  it("records one request on every stream a batch signed on, each with its own nonce", async () => {
    const { config } = gaslessTestConfig();
    const walletStream = gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 2n, OWNER, ACCOUNT);
    await submitOnGaslessNonceStreams(
      config,
      [
        { key: STREAM, signedNonce: 7n },
        { key: walletStream, signedNonce: 3n },
      ],
      { service: "operations", chainId: GASLESS_TEST_CHAIN, deadline: deadlineIn(600) },
      async () => ({ requestId: "req-batch" }),
      () => true,
    );
    waitForGaslessRequest.mockResolvedValue(operationRequestFixture({ status: GaslessRequestStatus.SUCCEEDED }));

    /** The InstantLayer stream already consumed its signed nonce, so it reads straight through. */
    await expect(readGaslessStreamNonce(config, STREAM, async () => 7n)).resolves.toBe(7n);
    expect(waitForGaslessRequest).not.toHaveBeenCalled();

    /** The wallet stream has not, so it waits for the batch's one request before re-reading. */
    const walletReads = [2n, 3n];
    await expect(readGaslessStreamNonce(config, walletStream, async () => walletReads.shift() ?? 3n)).resolves.toBe(3n);
    expect(waitForGaslessRequest).toHaveBeenCalledWith(config, expect.objectContaining({ requestId: "req-batch" }));
  });

  it("blocks every stream a batch signed on when its outcome is unknown", async () => {
    vi.useFakeTimers();
    const { config } = gaslessTestConfig();
    const walletStream = gaslessWalletNonceStreamKey(GASLESS_TEST_CHAIN, 2n, OWNER, ACCOUNT);
    const rejection = new Error("socket hang up");

    await expect(
      submitOnGaslessNonceStreams(
        config,
        [
          { key: STREAM, signedNonce: 7n },
          { key: walletStream, signedNonce: 3n },
        ],
        { service: "operations", chainId: GASLESS_TEST_CHAIN, deadline: deadlineIn(3) },
        () => Promise.reject(rejection),
        () => true,
      ),
    ).rejects.toBe(rejection);

    const pending = Promise.all([
      readGaslessStreamNonce(config, STREAM, async () => 6n),
      readGaslessStreamNonce(config, walletStream, async () => 2n),
    ]);
    const assertion = expect(pending).rejects.toMatchObject({ code: "GASLESS_NONCE_STREAM_BUSY" });
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;

    clearGaslessPendingNonce(config, STREAM);
    clearGaslessPendingNonce(config, walletStream);
  });

  it("throws GASLESS_NONCE_STREAM_BUSY when an unconfirmed submit never lands", async () => {
    vi.useFakeTimers();
    const { config } = gaslessTestConfig();
    const rejection = new Error("socket hang up");

    await expect(
      submitOnGaslessNonceStream(
        config,
        STREAM,
        { signedNonce: 6n, service: "operations", chainId: GASLESS_TEST_CHAIN, deadline: deadlineIn(3) },
        () => Promise.reject(rejection),
        () => true,
      ),
    ).rejects.toBe(rejection);

    const pending = readGaslessStreamNonce(config, STREAM, async () => 5n);
    const assertion = expect(pending).rejects.toMatchObject({ code: "GASLESS_NONCE_STREAM_BUSY" });
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    /** An outcome-unknown submit has no request id to watch, so the nonce itself is the only evidence. */
    expect(waitForGaslessRequest).not.toHaveBeenCalled();

    clearGaslessPendingNonce(config, STREAM);
    await expect(readGaslessStreamNonce(config, STREAM, async () => 5n)).resolves.toBe(5n);
  });
});

describe("blocksGaslessNonceStream", () => {
  const SUBMIT: GaslessUnconfirmedSubmit = {
    chainId: GASLESS_TEST_CHAIN,
    service: "operations",
    path: "/gateway/relay-instant",
    body: {},
    idempotencyKey: "key-1",
  };

  function apiError(code: string, status: number, responseData?: unknown): SymmApiError {
    return new SymmApiError({
      code,
      message: "failed",
      status,
      statusText: "",
      responseData,
      url: "https://gasless.test/gateway/relay-instant",
      method: "POST",
    });
  }

  it.each([
    { label: "an unconfirmed submit", err: apiError(GASLESS_SUBMIT_UNCONFIRMED_CODE, 0, SUBMIT), blocks: true },
    {
      label: "a 202 with no request id",
      err: new SymmError("api", "GASLESS_ACCEPTANCE_INVALID", "no request_id"),
      blocks: true,
    },
    {
      label: "a 202 from the wrong protocol instance",
      err: apiError("GASLESS_INSTANCE_MISMATCH", 202, { request_id: "req-1" }),
      blocks: true,
    },
    { label: "a rate limit the gateway dropped", err: apiError("GASLESS_RELAY_SUBMIT_FAILED", 429), blocks: false },
    { label: "a service rejection", err: apiError("GASLESS_RELAY_SUBMIT_FAILED", 400), blocks: false },
    {
      label: "an instance mismatch on a status read",
      err: new SymmError("api", "GASLESS_INSTANCE_MISMATCH", "wrong instance"),
      blocks: false,
    },
    { label: "a plain error", err: new Error("boom"), blocks: false },
  ])("answers $blocks for $label", ({ err, blocks }) => {
    expect(blocksGaslessNonceStream(err)).toBe(blocks);
  });
});
