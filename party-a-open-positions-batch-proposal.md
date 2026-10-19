### Design Proposal: Batched open-positions read + PartyA liquidation flag

Status: **APPROVED 2026-10-19** (chat): name `getPartyAOpenPositionsBatch`, per-account `start`, React hook yes, default `batchSize` 10, standalone `isPartyALiquidated`.

**Goal**: read the open positions (and optionally the liquidation-in-progress flag) of many partyAs in one Multicall3 `eth_call` per chunk, with per-account failure isolation.

**Reference**:

- Vibe-ui-v2 `lib/trading/vibecaps/api.ts` `getActiveQuotesWithVAs` — hand-written `multicall({ allowFailure: true })` of `getPartyAOpenPositions(va, 0, 200)` + `isPartyALiquidated(va)` for every VA of a sub-account (the read VIBE-1898 moves onto the SDK).
- perps-core v0.8.6 `contracts/core/facets/ViewFacet/ViewFacet.sol:520` `isPartyALiquidated` → `MAStorage.liquidationStatus[partyA]`; set `true` in `LibPartyALiquidationShared.sol:48` (`startPartyALiquidation`), cleared in `LibPartyALiquidationProcess.sol:511` (`_finalizePartyALiquidation`) and `ClearingHouseFacetImpl.sol:395`.
- SDK precedent: `getPendingQuotes` (chunked `client.multicall`).

**Public API**

```ts
// @symmio/trading-core
/** One account to read: an address (reads from 0n) or an address with its own `start`. */
type PartyAOpenPositionsBatchAccount = Address | { partyA: Address; start?: bigint };

type GetPartyAOpenPositionsBatchParameters = ChainIdParameter & {
  partyAs: readonly PartyAOpenPositionsBatchAccount[];
  size?: bigint;                       // per account, default 200n
  includeLiquidationStatus?: boolean;  // default false
  batchSize?: number;                  // accounts per multicall, default 10
};

type PartyAOpenPositionsBatchResult =
  | { partyA: Address; start: bigint; status: "success"; quotes: readonly Quote[]; hasMore: boolean; isLiquidated?: boolean }
  | { partyA: Address; start: bigint; status: "failure"; error: Error };

function getPartyAOpenPositionsBatch(config, parameters): Promise<readonly PartyAOpenPositionsBatchResult[]>;
function getPartyAOpenPositionsBatchQueryKey(options);
function getPartyAOpenPositionsBatchQueryOptions(config, options); // disabled while partyAs is empty

function isPartyALiquidated(config, { chainId?, partyA }): Promise<boolean>;
function isPartyALiquidatedQueryKey(options);
function isPartyALiquidatedQueryOptions(config, options); // disabled until partyA

// @symmio/trading-react
function usePartyAOpenPositionsBatch(parameters): UseQueryResult<readonly PartyAOpenPositionsBatchResult[], SymmioRequestError>;
function useIsPartyALiquidated(parameters): UseQueryResult<boolean, SymmioRequestError>;
```

Semantics:

- One result per input entry, input order; `partyA` echoed **as passed** (no checksum rewrite). Same address + start read once.
- Revert of one account's positions call → that entry `failure`; others unaffected. Transport/RPC error → the whole call throws.
- Liquidation sub-call failure → `isLiquidated: undefined` (unknown, never `false`). Field absent when not requested.
- `hasMore` = `quotes.length === size` → page that account with `{ partyA, start: start + quotes.length }`.
- `start` greater than an account's position count reverts on-chain → that entry `failure`.
- Invalid `batchSize` (non-integer or < 1) → `SymmError("validation", "INVALID_BATCH_SIZE")`.

**Internal modules**

- `trading-core/src/symmio-contracts/symmio/actions/get-party-a-open-positions-batch.ts` (+ test)
- `trading-core/src/symmio-contracts/symmio/query/get-party-a-open-positions-batch.ts` (+ test)
- `trading-core/src/symmio-contracts/symmio/actions/is-party-a-liquidated.ts` (+ test)
- `trading-core/src/symmio-contracts/symmio/query/is-party-a-liquidated.ts` (+ test)
- `trading-react/src/quotes/use-party-a-open-positions-batch.ts` (+ test)
- `trading-react/src/quotes/use-is-party-a-liquidated.ts` (+ test)

**Package placement**: actions + query options in core (plain contract reads, no framework state). Hooks in react (TanStack `useQuery` wrappers, provider config/chain resolution). No live/WS invalidation in the batch hook — callers invalidate via the exported query key.

**Docs impact** (`apps/docs`):

- New `core/symmio-contract/get-party-a-open-positions-batch/page.mdx`, `core/symmio-contract/is-party-a-liquidated/page.mdx`; `_meta.ts` entries under "Quote reads".
- `core/symmio-contract/get-party-a-open-positions/page.mdx`: "many accounts → prefer the batch" pointer.
- `react/symmio-contract/page.mdx`: `usePartyAOpenPositionsBatch`, `useIsPartyALiquidated` sections + import list.

**Out of scope**: `live` notification wiring for the batch hook; using the batch inside `getSubAccountQuotes` / `useManagedQuotes`; `partyAStats` action.

**Open questions**: none.
