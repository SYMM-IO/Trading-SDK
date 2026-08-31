---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add inventory TVL and solver-revenue reads — the analytics behind a pools / solver dashboard.

**Inventory service** (`./inventory`) — the custody backend behind the lowcap Pools, a **separate vendor** from both the solver and the listing backend. `getInventoryTvl` reads the system-wide custodial TVL as a `bigint` at `INVENTORY_VALUE_DECIMALS` (18); `getInventoryTvlHistory` is its per-market twin, the TVL series behind one pool's chart (`InventoryTvlPoint`). `resolveInventoryService` returns the chain's configured backend and `supportsInventoryService` is its non-throwing boolean twin for gates.

This TVL is deliberately **not** the sum of the pool catalogue's per-pool `tvl`: the catalogue covers listed markets, the inventory service covers the whole custodial system. Treat them as different numbers.

**Solver revenue** — two reads off the chain's solver, Enigma-only:

- `getSolverRevenue` — aggregate revenue totals, protocol-wide by default or for one market via `symbolId`, split into a hedger-fee share and a funding share whose sum is `totalRevenue` (`SolverRevenue`, `SolverRevenueTimeRange`).
- `getRevenueRecords` — the itemized revenue rows behind that total (`SolverRevenueRecord`), for a table rather than a headline figure.

`@symmio/trading-react` adds `useInventoryTvl` / `useInventoryTvlHistory`, `useSolverRevenue`, and `useRevenueRecords`, each a thin TanStack-Query wrapper over its core read with the resolved chain/solver threaded through.
