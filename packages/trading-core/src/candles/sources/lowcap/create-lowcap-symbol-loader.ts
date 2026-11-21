import {
  fetchEnigmaPriceServiceSymbolsInfo,
  type EnigmaSymbolInfo,
} from "../../../price-service/enigma/symbols-info/get-enigma-price-service-symbols-info";

interface Pending {
  controller: AbortController;
  promise: Promise<EnigmaSymbolInfo[]>;
  readers: number;
}

/** Source-local metadata reuse. Cancelling one reader never cancels another reader's request. @internal */
export function createLowcapSymbolLoader(baseURL: string) {
  let cached: { symbols: EnigmaSymbolInfo[]; expires: number } | undefined;
  let pending: Pending | undefined;

  return function loadSymbols(signal?: AbortSignal): Promise<EnigmaSymbolInfo[]> {
    signal?.throwIfAborted();
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.symbols);
    if (!pending) {
      const controller = new AbortController();
      const request: Pending = {
        controller,
        readers: 0,
        promise: fetchEnigmaPriceServiceSymbolsInfo(baseURL, controller.signal)
          .then((symbols) => {
            controller.signal.throwIfAborted();
            cached = { symbols, expires: Date.now() + 60_000 };
            return symbols;
          })
          .finally(() => {
            if (pending === request) pending = undefined;
          }),
      };
      pending = request;
    }
    const request = pending;
    request.readers++;
    return new Promise((resolve, reject) => {
      let settled = false;
      function finish() {
        if (settled) return false;
        settled = true;
        signal?.removeEventListener("abort", abort);
        request.readers--;
        if (request.readers === 0 && pending === request) {
          pending = undefined;
          request.controller.abort();
        }
        return true;
      }
      function abort() {
        if (finish()) reject(signal?.reason);
      }
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      request.promise.then(
        (symbols) => {
          if (finish()) resolve(symbols);
        },
        (error: unknown) => {
          if (finish()) reject(error);
        },
      );
    });
  };
}
