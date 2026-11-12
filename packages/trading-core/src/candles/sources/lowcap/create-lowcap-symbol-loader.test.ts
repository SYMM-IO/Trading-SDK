import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLowcapSymbolLoader } from "./create-lowcap-symbol-loader";

const get = vi.spyOn(axios, "get");
const SYMBOLS = [{ name: "TOKEN::Ab_SFLOW", address: "AbCd", status: "ACTIVE" }];

describe("lowcap symbol metadata reuse", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: SYMBOLS });
  });
  afterEach(() => vi.useRealTimers());

  it("shares concurrent reads and reuses successful metadata for only 60 seconds", async () => {
    vi.useFakeTimers();
    const load = createLowcapSymbolLoader("https://prices.example");
    await Promise.all([load(), load()]);
    await load();
    expect(get).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60_000);
    await load();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed lookup", async () => {
    const load = createLowcapSymbolLoader("https://prices.example");
    get.mockRejectedValueOnce(new Error("offline"));
    await expect(load()).rejects.toThrow("offline");
    expect(await load()).toEqual(SYMBOLS);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("cancels one reader without cancelling another and aborts HTTP when the last reader leaves", async () => {
    let resolve!: (value: { data: typeof SYMBOLS }) => void;
    get.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const load = createLowcapSymbolLoader("https://prices.example");
    const a = new AbortController();
    const b = new AbortController();
    const first = load(a.signal);
    const second = load(b.signal);
    const firstRejected = expect(first).rejects.toMatchObject({ name: "AbortError" });
    a.abort();
    await firstRejected;
    expect(get.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    resolve({ data: SYMBOLS });
    expect(await second).toEqual(SYMBOLS);

    const another = createLowcapSymbolLoader("https://another.example");
    const pending = another(b.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    b.abort();
    await rejected;
    expect(get.mock.lastCall?.[1]?.signal?.aborted).toBe(true);
    resolve({ data: SYMBOLS });
    await Promise.resolve();
    get.mockResolvedValue({ data: SYMBOLS });
    expect(await another()).toEqual(SYMBOLS);
    expect(get).toHaveBeenCalledTimes(3);
  });
});
