# Lowcap candles: backend questions and verified evidence

**Updated:** 2026-11-06  
**Backend follow-up:** 2026-11-07  
**Status:** First SDK slice implemented. Backend contract questions below remain pending.

This is an internal handoff for the price-service candle integration described in backend tickets VIBE-1969 and VIBE-2015. It separates questions the current public contract does not answer from behavior verified in the service and the reference app.

## Approved first SDK slice

The first slice implements the verified pieces while the backend answers the questions below:

- Generate an internal Axios client for staging `/ohlcv` only, without changing the production client's other routes or configured runtime hosts.
- Add a bounded single-request transport with `version=2`, an explicit boolean `flat_enable` defaulting to true, input validation, cancellation, and typed errors. Its dates remain in the service's inclusive units; it does not yet implement the SDK's exclusive range-end conversion or pagination.
- Parse candle timestamps from seconds to milliseconds, preserve OHLC values and USD volume, and leave empty and gapped responses unchanged. Fetch again on repeated calls; do not cache candle history as final.
- Resolve symbol listings by their complete market names, preserve address case, and map only the service's declared resolutions.
- Add `10m` to the shared candle vocabulary and TradingView mapping. Binance does not gain a `10m` interval.
- Add optional volume unit/currency metadata and preserve `::` market names in TradingView symbol resolution, with regression tests and public documentation for these shared changes.

No public lowcap source, React source hook, or inspector card is exposed in this slice. Reliable `noMoreData`, lossless time-window pagination, automatic refresh/correction handling, final price-basis labeling, and live acceptance tests still depend on the answers below. SDK release and reference-app migration follow the complete source integration.

Regenerate the scoped client from the repository root with:

```sh
pnpm --filter @symmio/trading-core exec orval --project enigmaPriceServiceOhlcv
```

The scoped generation removes unused authentication components with invalid OpenAPI names containing spaces; it retains the public OHLCV operation and its published schemas. The deprecated `/ohlc` operation is excluded.

### Validation of this slice

- `pnpm lint`: passed across the monorepo.
- `pnpm check-types`: passed, including the required SDK and docs production builds.
- `pnpm test`: passed, 5,053 tests across the workspace (3,808 core and 969 React tests).
- Prettier checks on all changed files and `git diff --check`: passed.

The first full-check attempts encountered sandbox restrictions on Google Fonts downloads and localhost HTTP test servers. The same checks passed after rerunning with the required access. The new OHLCV tests use mocked HTTP responses; they do not replace the pending backend acceptance fixtures or browser integration tests.

## Questions for the backend team

### 1. How should a client determine that no older history exists?

The staging OpenAPI response contains only `result`. Its symbol and metadata schemas do not expose a history-start timestamp, and the published routes do not include a dedicated history-boundary endpoint. A successful empty range can mean a gap, a range before the first sample, or a market with no stored history.

Please confirm:

- Is there an authoritative first-history timestamp, an explicit exhaustion indicator, or an efficient supported discovery request?
- Is that boundary specific to `version=2`, and can it differ by resolution?
- How should the SDK distinguish a listed market with no history from an empty interval inside existing history?
- Can backfills or retention changes move the boundary after it has been read? How long may the SDK cache it?

If none exists, please agree on a discovery mechanism or expose the boundary. A nullable first-sample timestamp is one possible API design, not an existing field. Inferring exhaustion from an empty/short page, a token's creation time, or an arbitrary calendar cutoff would not satisfy the proposed SDK contract.

**Backend answer:** Pending.

### 2. Is there an authoritative candle stream, and what polling rate is supported?

The reference app refreshes OHLCV through HTTP every 30 seconds. It separately receives live mark prices, but its chart runtime does not overlay those prices onto the price-service candles. The inspected older backend source exposes a price-tick WebSocket; that does not establish whether the current staging release also has a candle stream.

Please confirm:

- Does the current service publish complete OHLCV candles over WebSocket or SSE, or only individual price updates?
- If candles are streamed, provide the endpoint, payload, timestamp units, supported resolutions, subscription protocol, correction events, and reconnect/backfill rules.
- If HTTP polling is expected, is a 30-second cadence per visible market/resolution supported? What are the per-client/IP limits and recommended behavior after HTTP 429?
- What cadence should clients use to refresh completed bars that can still be corrected?

**Backend answer:** Pending.

### 3. Confirm calendar alignment and partial-bucket boundaries

The live schema says `limit` counts intervals ending in the bucket containing inclusive `to_date`, including that partial bucket. Live samples show Monday 00:00 UTC weekly starts and first-of-month 00:00 UTC monthly starts.

Please confirm these as supported guarantees, including leap years and variable month lengths. Also clarify whether `from_date` and `to_date` filter individual samples before aggregation or select complete aggregated candles, and whether subsecond ISO-8601 boundaries are preserved. This determines how the SDK can serve `[from, to)` in milliseconds without truncating samples or overlapping adjacent pages.

**Backend answer:** Pending; calendar alignment observed on staging, exact edge semantics still to confirm.

### 4. Confirm the correction window and price basis

- Are corrections restricted to the preceding 24 hours, or can older price/volume data be backfilled or changed?
- Does a corrected hour update every containing daily, weekly, and monthly candle? Can a correction add or remove a returned candle, particularly with `flat_enable=false`?
- Does version 2 aggregate the same final mark-price series that trading consumes? Is `solver-mark` the correct SDK price-basis label?
- Is there a refresh timestamp or version marker a client can use to detect completed hourly refreshes?

The schema confirms USD volume and describes both versions as using the same minute-volume history, including partial-minute volumes and provider corrections. It does not define all of the above guarantees.

**Backend answer:** Pending.

### 5. Provide stable acceptance-test fixtures

Please provide market names, symbol addresses, resolutions, and date ranges for:

- A market with more than 200 intervals of version-2 history.
- A real gap with available history on both sides.
- A flat stretch that exercises the first-candle, nonzero-volume, and changed-price exceptions.
- A listed market with no version-2 history.
- A recent correction, if there is a reproducible fixture or backend test response.

The public route reads stored history without checking current symbol registration. Therefore, an arbitrary unknown address returning an empty result is not sufficient evidence for the listed-market acceptance case.

**Backend answer:** Pending.

## What was verified independently

### Public API access and the earlier HTTP 403

The initial Python requests were rejected by Cloudflare with HTTP 403 and the response body `error code: 1010`. This was not enough evidence to conclude that the public API required authentication.

A controlled retry against the same staging `/openapi.json` endpoint produced:

| Request headers                                           | Result                          |
| --------------------------------------------------------- | ------------------------------- |
| Default Python `urllib` User-Agent                        | HTTP 403, Cloudflare error 1010 |
| Default Python User-Agent plus `Accept: application/json` | HTTP 403, Cloudflare error 1010 |
| `User-Agent: SYMMIO-SDK-contract-check/1.0`               | HTTP 200, OpenAPI document      |

Changing only the User-Agent was sufficient for the schema request. Cloudflare documents error 1010 as a client-signature rejection and describes default Python clients as a possible trigger. See [Cloudflare error 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/).

The SDK's installed Axios client also fetched the staging schema successfully with its default headers (HTTP 200). The Python diagnostic failure therefore does not reproduce with the SDK's existing HTTP client.

The public symbol endpoint returned 69 markets, and real version-2 OHLCV requests succeeded without an API key. Requests carrying `Origin: http://localhost:3000` received a matching `Access-Control-Allow-Origin` header. These are HTTP observations, not a completed browser integration test or a guarantee for every origin.

### Current staging contract

Source: [staging OpenAPI](https://lowcap-price-staging.enigma.bz/openapi.json), fetched successfully on 2026-11-06.

- The current schema includes `/api/v1/prices/{symbol_address}/ohlcv`.
- The response schema has `result` only; no history-start, continuation, or exhaustion field was found in the published history, symbol, or metadata contract.
- `from_date` and `to_date` are required, inclusive, and accept Unix seconds or ISO-8601 datetimes.
- `limit` is optional, ranges from 1 to 200, counts time intervals, and includes the bucket containing `to_date`. An omitted limit returns the requested range.
- Version 2 uses final-price history without falling back to legacy prices.
- `flat_enable` defaults to false. The schema describes suppression when all four prices equal the previous close and volume is zero; the first candle is retained.
- Candle volume is USD, and missing volume is represented as zero.
- The declared timeframes are `1m`, `5m`, `10m`, `15m`, `30m`, `1h`, `4h`, `6h`, `12h`, `1D`, `1W`, and `1M`.

The SDK must still explicitly send `version=2` and `flat_enable=true` or `flat_enable=false`; its proposed flat-candle default is true.

### Small live candle probes

The listed market `VIRTUAL::0b..1b_SFLOW` maps to symbol address `0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b`. Three bounded requests used `from_date=2026-08-01T00:00:00Z`, `to_date=2026-11-06T00:00:00Z`, `limit=2`, `version=2`, and `flat_enable=true`.

| Timeframe | Returned candle starts, UTC        | HTTP status |
| --------- | ---------------------------------- | ----------- |
| `1h`      | 2026-11-05 23:00; 2026-11-06 00:00 | 200         |
| `1W`      | 2026-10-26 00:00; 2026-11-02 00:00 | 200         |
| `1M`      | 2026-10-01 00:00; 2026-11-01 00:00 | 200         |

The hourly result confirms that an exactly aligned inclusive `to_date` can include the candle starting at that instant. The weekly and monthly observations support calendar alignment; they are not a substitute for a guarantee covering all boundary cases.

## What the reference app test branch does

Inspected branch: `origin/fix/testnet-ohlc-cache-url`.  
Inspected commit: `f76e000bda8be3e22b3a607801edcc7e77306416`.  
Repository: `VibeTradingOrg/Vibe-ui-v2`. The branch was read locally; no remote refresh or app edits were performed.

| Concern           | Observed implementation                                                                                                                                                                                   | Implication for the SDK                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| History           | Browser calls a same-origin proxy; the proxy calls staging `/ohlcv` with version 2. It omits backend `limit` and `flat_enable`.                                                                           | Reuse the verified route behavior; implement the DoD's direct calls, explicit flat flag, and bounded interval windows.               |
| Candle refresh    | Both chart modes poll every 30 seconds, with an overlap guard. The refresh starts three intervals before the latest loaded candle and runs through the current time.                                      | Polling is an existing working approach, but this branch does not establish backend rate limits or full 24-hour correction coverage. |
| Live price        | The chart runtime updates a separate MARK line from the live price. It does not call the datafeed's live-price overlay method. A regression test asserts this.                                            | Price ticks and backend OHLCV are separate inputs. Do not assume the price socket is an authoritative candle stream.                 |
| Older corrections | Pro requests a history-cache reset and chart reload when a refreshed bar is older than the displayed latest bar; Fun replaces its merged snapshot.                                                        | Historical corrections need a history refresh path.                                                                                  |
| End of history    | Older-history searches use a hard-coded `2015-07-30T00:00:00Z` lower boundary. Initial expansion stops on an empty range; Pro can report `noData=true` for an empty older request to stop repeated loads. | This does not establish the market's actual first available history and does not meet the proposed gap/exhaustion guarantee.         |

Source locations in that commit:

- `src/widgets/vibecaps-chart/config/candle-constants.ts`: history floor, 30-second refresh, and three-interval lookback.
- `src/widgets/vibecaps-chart/api/vibecaps-candle-session.ts`: history expansion, backfill, and refresh range.
- `src/widgets/vibecaps-chart/api/vibecaps-pro-datafeed.ts`: polling, correction reset, and empty-load handling.
- `src/widgets/vibecaps-chart/model/use-fun-chart-datafeed.ts`: polling and snapshot replacement.
- `src/widgets/vibecaps-chart/model/use-pro-chart-runtime.ts`: MARK line and chart reset wiring.
- `src/widgets/vibecaps-chart/model/use-pro-chart-runtime.dom.test.ts`: live mark must not overwrite history candles.
- `app/api/token/ohlc/route.ts`: proxy request and response caching.

There is also a provider method named `subscribeCandle`, but its implementation constructs candles locally from price ticks with `CandleBuilder`. The inspected chart widgets do not use that path. Its existence does not establish a backend OHLCV stream.

## Local backend source limitation

A read-only inspection also found `/home/seyyed/dev/symmio/lowcap-price-service-develop`. This directory has no Git metadata and contains an older contract: `/ohlc` only, a different limit policy, and no `flat_enable` or version-2 OHLCV implementation. Its `/ws` DTO carries `name`, `markPrice`, `time`, and `address`, not OHLCV bars.

This copy helps explain the price-tick stream but cannot prove the capabilities of the current staging release. The current staging schema and the backend team's guarantees take precedence.
