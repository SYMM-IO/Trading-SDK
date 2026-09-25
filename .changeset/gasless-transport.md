---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add `Retry-After` delays to HTTP errors, and give the gasless slice a connection layer built for the gateway's anonymous access, with errors that never carry its credentials.

The GasLessQ gateway now serves anonymous clients by default, so a browser app whose Origin the deployment allows can call it directly with no key. Servers and backend-for-frontend proxies can still send a partner key.

**`@symmio/trading-core`** (all HTTP actions, additive)

- New `SymmApiError.retryAfterMs: number | null`: the `Retry-After` delay in milliseconds, parsed from delay-seconds or an HTTP-date. `SymmApiError.fromAxios` and subgraph queries fill it, and the constructor takes an optional `retryAfterMs` (default `null`). It is `null` when the response carried no usable header, which is the usual case for a cross-origin browser unless the server exposes the header. Nothing else about `fromAxios` changes: `cause` is still the axios error.

**`@symmio/trading-core`** (gasless, unreleased — breaking changes called out)

- **Anonymous access is the default.** Without `apiKey` the SDK sends no `Authorization` header at all; a blank key is treated as absent. `apiKey` stays optional, sent as `Authorization: Bearer <key>`, for servers and backend-for-frontend proxies that hold a partner key, and for deployments that turn anonymous access off. The JSDoc no longer says browser apps must use a proxy.
- **Gasless HTTP errors never carry the credentials or the request body.** A gasless HTTP failure is still a `SymmApiError`, but its `cause` is a sanitized `Error` with only the axios `name`, `message` and `code`, plus `status`, `method` and `url`, instead of the axios error, whose request config holds the `Authorization` header and the signed body. The error's `url`, message and cause drop any userinfo, query string and fragment. `responseData` stays the raw response body, which a `422` can fill with echoed request fields.
- One URL parser now classifies `gasless.url` as a gateway origin, an instance root, an instance-pinned service base or a proxy root.
  - **Breaking:** the instance-less `/v1/operations` and `/v1/deposits` compatibility bases throw `GASLESS_URL_LEGACY_ROUTE`. The gateway is retiring them, and they pin no instance to verify responses against.
  - **Breaking:** an instance root or service base whose path pins a different instance than `protocolInstance` throws `GASLESS_PROTOCOL_INSTANCE_CONFLICT`. The path used to win silently.
  - **Breaking:** a `url` with a query string, a fragment or a scheme other than `https` / `http` throws `GASLESS_URL_INVALID`. The SDK appends service paths to the URL, so such a URL could never route correctly. A `url` carrying credentials (`user:password@`) throws it too: pass a partner key as `apiKey`, which never reaches an error.
  - A proxy root with a `protocolInstance` now checks the `X-GasLessQ-Protocol-Instance` header of a successful response whenever the proxy forwards it, and fails with `GASLESS_INSTANCE_MISMATCH` on a mismatch. A proxy that does not forward the header still passes.
- New `execution.submitTimeoutMs` (default `30_000`) bounds every relay and deposit-settlement POST. A timed-out submit fails like a network error, with `status: 0`. Status reads are not bounded by it.
- New `statusStream?: SymmioGaslessStatusStreamConfig` (`{ enabled, origin? }`) on `SymmioGaslessConfig` declares whether a deployment serves the status WebSocket; `createConfig` deep-merges it, and an `origin` with no `enabled` to inherit throws `GASLESS_OVERRIDE_INCOMPLETE`. It is informational for now: status reads still poll over HTTP.
- `parseGaslessErrorDetail` also reads the gateway's own `{ "error": "…" }` envelope into the new `gatewayError` field, and a FastAPI `422` `detail` array into the new `validationErrors` field (`GaslessValidationIssue[]`, each with `loc`, `msg` and `type`, without the echoed `input` or `ctx`). Both are `null` for other errors, and a body carrying only one of them no longer parses to `null`.

**`@symmio/trading-react`**

- New `SymmioRequestError.retryAfterMs: number | null`. `normalizeSymmError` forwards it from `SymmApiError`; every other kind carries `null`.
