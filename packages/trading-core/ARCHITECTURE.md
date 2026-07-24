# Architecture: Absorbing Vendor Change

> **Status**: proposal — approved in principle, not yet implemented.
> **Scope**: `@symmio/trading-core` (with knock-on effects in `@symmio/trading-react`).
> **Target release**: `v2.0.0` (breaking).

This document is the deeper companion to the `## Architecture` section of [`AGENTS.md`](./AGENTS.md), which describes the SDK's _present_ shape (immutable wagmi-style config, `fn(config, params)` actions, injected client resolvers). That shape is not changing. What this document addresses is a different question: **how the SDK absorbs change coming from the vendors underneath it.**

---

## 1. The problem

SYMMIO is not one system. It is contracts, solvers, oracles, price feeds, notification streams, and subgraphs — built by different teams, on different release cadences, with different (or absent) versioning policies. The SDK exists to hide that from application developers.

Today it does not hide it. It _hard-codes_ it:

| Vendor surface | Current handling                                                                                 | What breaks when it changes                |
| -------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Contracts      | `v0.8.5` hard-coded as an **import path** in **59** non-test files                               | Every one of those files, by hand          |
| Solvers        | Exactly **one** per chain (`SymmioChainConfig.solver`), read at **22** sites across **14** files | Cannot express a second solver at all      |
| Subgraph       | Unpinned Goldsky `/latest/gn`                                                                    | Schema drifts silently under fixed queries |

The version is not modelled as data anywhere — there is no version enum, no chain→version mapping, and no `version` field in config. Likewise there is no solver identity, no solver selection parameter, and no way to express that one solver exposes a method another lacks. The only concession to multiple hedgers is an ad-hoc `baseUrl?` override on 5 actions, which does not solve the problem — it hands it to the consumer.

The goal of this architecture is to turn each axis of vendor change into a **first-class, config-driven dimension**, so that supporting contract `v2` or a second solver is an _additive change to a registry_ rather than a sweep across the codebase.

### 1.1 Three axes, three mechanisms

The axes look similar but differ in **binding time**, and that difference is what dictates three distinct mechanisms. Getting this wrong is the root of most bad designs in this space.

| Axis                 | Nature                                     | Bound at                      | Mechanism                              |
| -------------------- | ------------------------------------------ | ----------------------------- | -------------------------------------- |
| **Contract version** | Deployment version; breaking across majors | **Per chain** — config data   | Version-pack registry (§2)             |
| **Solver**           | Runtime multiplicity + schema divergence   | **Per operation** — call time | Solver registry + `kind` dispatch (§3) |
| **Subgraph**         | Tracks contracts, deploys independently    | Per chain                     | **Deferred** (§6)                      |

The load-bearing insight:

> A chain runs **one** contract version at a time, but a trader may interact with **several solvers at once on the same chain**.

Contract version is therefore a property _of the chain_ and belongs in per-chain config. Solver selection is a property _of the individual call_ and must be a parameter. Putting solver selection in per-chain config — which is what we have now — makes multi-solver structurally impossible, not merely inconvenient.

---

## 2. Axis 1 — Contract version

### 2.1 Version as data

Introduce a version enum and put it on the chain config:

```ts
/** Contract-protocol version selecting the ABI/encoder pack for a chain. */
export enum SymmioProtocolVersion {
  V0_8_5 = "v0.8.5",
  /** V0_8_6 = "v0.8.6", */
  /** V2 = "v2", */
}
```

`SymmioChainConfig` gains a `protocolVersion` field, and `Config` gains a resolver that mirrors the existing `getChainConfig`:

```ts
config.resolveVersionModule(chainId); /** → ContractVersionModule */
```

### 2.2 Config-driven, not auto-detected — a deliberate rejection

The SDK will **not** discover the on-chain version at runtime. This is a considered decision, not an omission:

- perps-core is an **EIP-2535 Diamond**. There is no `version()` view to call.
- Detecting it would mean probing `DiamondLoupe.facetAddress(selector)` or `try`/`catch`-ing a version-exclusive selector — brittle, and an extra RPC round-trip on a path that runs constantly.
- Version is a deployment fact the integrator already knows. Making it configuration is honest and deterministic.

Should a future contract expose a version getter, it should be added as an **optional development-time assertion** (verify config matches chain, warn on mismatch), never as the mechanism that selects behaviour.

### 2.3 The version pack

A version pack is a self-contained folder holding everything that changes together when contracts change:

```
src/protocol/
  supported-versions.ts        SymmioProtocolVersion enum
  version-contract.ts          interface ContractVersionModule
  registry.ts                  Record<SymmioProtocolVersion, ContractVersionModule>
  versions/
    v0.8.5/
      abi/                     account-layer.ts, symmio.ts, instant-layer.ts
      encoders/                calldata builders
      selectors.ts             4-byte selectors + required-selector set
      eip712.ts                domain descriptor + typed-data structs
      types.ts                 on-chain struct mirrors
      index.ts                 the ContractVersionModule
    v2/                        ← a sibling folder; nothing else moves
```

These artefacts genuinely co-vary today — [`solvers/instant-open/shared/calldata.ts`](./src/solvers/instant-open/shared/calldata.ts) and [`selectors.ts`](./src/solvers/instant-open/shared/selectors.ts) already hard-code `v0.8.5` — so grouping them is recognising existing cohesion, not inventing structure.

New deep paths need **no `package.json` change**: [`vite.config.ts`](./vite.config.ts) builds with `preserveModules`, and the exports map is a `./*` wildcard, so `dist/protocol/versions/v2/...` is importable the moment it exists.

### 2.4 The type-safety decision — the highest-risk part of this design

This section exists because the _obvious_ implementation is **wrong**, and wrong in a way that produces green CI and broken transactions.

Every write action today gets its type safety from viem's call-site inference over an `as const` ABI. From [`deposit-for-account.ts`](./src/symmio-contracts/account-layer/actions/deposit-for-account.ts):

```ts
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";

return walletClient.writeContract({
  address: addresses.accountLayerAddress,
  abi: accountLayerAbi,
  functionName: "depositForAccount",
  args: [account, amount] /** ← viem checks this tuple against THIS abi const */,
});
```

The tempting move is to resolve the ABI value from the registry while keeping the old type:

```ts
/** ⚠️ DO NOT DO THIS */
abi: module.accountLayerAbi as typeof accountLayerAbi,
```

**This is unsound precisely when it matters.** The cast asserts "this is v0.8.5's ABI" while v2's ABI executes. The compiler validates `args` against **v0.8.5's** signature; the runtime encodes against **v2's**. Since backward compatibility is expected but explicitly **not guaranteed**, the first divergent signature yields a silently mis-encoded transaction that type-checks cleanly. The cast disables the safety net exactly where the safety net was the entire point.

**The strategy instead — four rules:**

1. **Public signatures are the stable contract.** `DepositForAccountParameters` / `DepositForAccountReturnType` are already hand-written and version-agnostic. They are the real consumer-facing boundary and depend on no ABI inference at all. They do not change.

2. **Divergence is handled by per-version typed wrappers.** Where a function's signature actually differs between versions, each pack supplies its own thin implementation, type-checked against **its own** `as const` ABI — so full viem inference is preserved _inside_ the pack:

   ```ts
   /** protocol/versions/v0.8.5/writes/deposit-for-account.ts */
   export function depositForAccount(
     wc: SymmioWalletClient,
     addresses: SymmioContractAddresses,
     params: DepositForAccountParameters,
   ) {
     return wc.writeContract({
       address: addresses.accountLayerAddress,
       abi: accountLayerAbi /** ← v0.8.5's const; fully inferred, fully checked */,
       functionName: "depositForAccount",
       args: [params.account, params.amount],
     });
   }
   ```

   The generic action becomes dispatch-only: `module.writes.depositForAccount(wc, addresses, params)`. Each pack is independently type-checked against reality.

3. **Non-diverging functions are not duplicated.** The overwhelmingly common case — a function whose signature is unchanged across versions — re-exports one shared implementation. Duplication is paid only where divergence is real.

4. **The cast is permitted only under proof.** Where a function is asserted arg-identical across versions, guard it with a runtime identity assertion (`module.accountLayerAbi === accountLayerAbi`) so the cast is demonstrably not a lie.

The net effect: **the compiler keeps checking encodings, per version.** That property is non-negotiable and it is the reason this design rejects the simpler-looking alternative.

### 2.5 EIP-712 domain version is a separate axis — do not conflate it

[`eip712.ts`](./src/solvers/instant-open/shared/eip712.ts) hard-codes:

```ts
export const INSTANT_LAYER_EIP712_DOMAIN_NAME = "SymmioInstantLayer" as const;
export const INSTANT_LAYER_EIP712_DOMAIN_VERSION = "1" as const;
```

That `"1"` is the **InstantLayer contract's on-chain EIP-712 domain version**. It is orthogonal to `"v0.8.5"` and moves on its own schedule.

If the domain version were derived from `SymmioProtocolVersion`, then a contract `v2` that legitimately keeps domain version `"1"` would sign against domain `"v2"` — and **every signature would fail to verify**, with no local error to explain it. The domain name and version are therefore **explicit, independently-settable fields** of the version pack.

The same applies to `SIGNED_OPERATION_TYPES` in that file, whose own comment states the constraint plainly: it "mirrors the InstantLayer contract struct exactly — order, names, and solidity types here must match the contract or signatures will not verify." It is version-bound and belongs in the pack.

### 2.6 Known sharp edge

Individual selectors are **derived** from the ABI, so they self-correct when a signature changes. But `INSTANT_TRADE_REQUIRED_SELECTORS` is a **hand-listed array**. A version that adds a required selector will not be caught automatically; adding a pack requires a manual review of that set. Flagged here so it is a checklist item, not a surprise.

---

## 3. Axis 2 — Solvers

### 3.1 Identity and selection

Replace the single solver with a keyed registry plus a default, and make selection a per-call parameter:

```ts
solvers: Record<SolverId, SymmioSolverConfig>;
defaultSolverId: SolverId;
```

Every solver action gains `solverId?`, defaulting to `defaultSolverId`:

```ts
const solver = config.resolveSolver(parameters.chainId, parameters.solverId);
const markets = await getContractSymbols({ baseURL: solver.url });
```

This subsumes and replaces the inconsistent `baseUrl?` overrides currently on `get-instant-opens`, `get-instant-closes`, `get-instant-open-quote-id`, and `get-sub-account-quotes` — an escape hatch that existed only because there was no way to name a solver.

### 3.2 Open identity, closed schema — the key distinction

Two different things are being modelled, and they need different type treatments:

```ts
/** WHICH deployment. Open — integrators may register their own. */
export type SolverId = string;

/** WHAT API schema it speaks. Closed — drives typed dispatch. */
export type SymmioSolverKind = "enigma" | "rasa";
```

`id` answers _"which solver instance?"_ and must stay **open**, because integrators run their own solver deployments and the SDK cannot enumerate them. `kind` answers _"what shape is its API?"_ and must be **closed**, because the SDK ships a generated client per schema family and dispatch must be exhaustive.

Three deployments of Enigma's software are three `id`s with one `kind`.

### 3.3 Schema divergence via `kind`, not a capability `Set`

The requirement is that one solver may expose a method another lacks. The intuitive answer is a runtime capability set:

```ts
/** ⚠️ Rejected */
capabilities: Set<SolverCapability>;
```

This is rejected for two reasons:

- **It yields no compile-time narrowing.** Calling code still cannot know at build time that Rasa lacks a method; every call site degrades to a runtime check that is easy to forget.
- **It can drift.** A hand-maintained set in config can disagree with what the generated client actually contains, and nothing detects the divergence.

Instead, `kind` is a **discriminated union**, so a `switch` narrows to the correct generated client type and the compiler enforces exhaustiveness:

```ts
switch (solver.kind) {
  case "enigma":
    return enigma.getContractSymbols({ baseURL: solver.url });
  case "rasa":
    return rasa.listSymbols({ baseURL: solver.url });
  /** A new kind fails to compile here until it is handled. */
}
```

Capabilities remain useful for **UI gating** ("hide the TP/SL tab for this solver"), but they are **derived statically from `kind`**, not stored in config — so they cannot drift:

```ts
const SOLVER_CAPABILITIES: Record<SymmioSolverKind, ReadonlySet<SolverCapability>> = {
  /* … */
};
```

Where a `kind` genuinely cannot serve an action, it throws a typed `SymmError` (`UNSUPPORTED_BY_SOLVER`) rather than surfacing a vendor 404.

> **Open input.** The Rasa OpenAPI/Swagger URL is still needed. Enigma's is `https://solver.enigma.bz/api/swagger/doc.json` (see [`orval.config.ts`](./orval.config.ts)). Until Rasa's spec is supplied, the `"rasa"` branch and the capability matrix below are structural placeholders — repo rules forbid inventing vendor endpoints, and designing the union against a guessed shape is exactly the mistake this section is meant to prevent.

| Capability                       | `enigma`                    | `rasa`         |
| -------------------------------- | --------------------------- | -------------- |
| `markets`                        | ✅                          | _pending spec_ |
| `instant-open` / `instant-close` | ✅                          | _pending spec_ |
| `funding-info`                   | ✅                          | _pending spec_ |
| `notional-cap`                   | ✅                          | _pending spec_ |
| `tpsl`                           | ✅ (when `tpsl` configured) | _pending spec_ |

### 3.4 Satellite infrastructure — per-solver override, chain-level fallback

`notifications`, `muon`, and `priceService` sit on `SymmioChainConfig` today, but physically they are **solver infrastructure** — the defaults point at `notification.rasa.capital`, `muon-oracle{1..4}.rasa.capital`, and Enigma's price service. With two solvers on one chain, a single chain-level value cannot be right for both.

The precedent already exists in the codebase: **`tpsl` is already nested under the solver** ([`chains/types.ts`](./src/core/chains/types.ts)). This design generalises that.

These become **optional per-solver overrides that fall back to chain-level defaults**:

```ts
const infra = solver.notifications ?? chainConfig.notifications;
```

This is deliberately a hybrid rather than a forced move. Some infrastructure genuinely is shared across solvers (a Muon oracle set), and some genuinely is not (a notification stream). Forcing everything under the solver would duplicate shared endpoints and invent a taxonomy that does not match reality.

The single-value unions `SymmioPriceServiceType = "enigma"` and `SymmioNotificationsProtocol = "defilytics"` are the widening seams for a second solver's protocol; adding members is non-breaking.

### 3.5 Query plumbing — the real hazard is `queryFn`, not `queryKey`

This is the most important implementation detail in the solver axis, and it is the opposite of what one would assume.

**Query keys are safe.** Every solver query factory builds its key by spreading options:

```ts
queryKey: getMarketsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
```

and [`filterQueryOptions`](./src/shared/utils/query.ts) is a **blacklist** — it strips only `query`, `enabled`, `config`, functions, and `undefined`. So adding `solverId` to a `Parameters` type propagates into the cache key **automatically**, across all 11 factories. No manual work, no risk of a missed key.

**Query functions are the hazard.** Every `queryFn` enumerates its arguments explicitly:

```ts
queryFn: () => getMarkets(config, { chainId: options.chainId }),
/**                                  ^ solverId silently dropped */
```

Adding `solverId` to the parameters type therefore produces the **worst possible failure mode**: the cache key varies correctly by solver, so each solver gets its own cache entry and everything _looks_ right — but every entry is populated from the **default solver's** data. No error, no cache collision, no type error. Just wrong data attributed to the wrong solver.

**Mandate:** every one of the 11 solver query factories must have its `queryFn` argument list updated in the same change that introduces `solverId`. This is a correctness requirement, and it should be enforced by a test that asserts the `queryFn` forwards `solverId`, not left to review diligence.

### 3.6 Config merge needs per-key solver merging

[`mergeChainConfig`](./src/core/config/merge-chain-config.ts) merges a single fixed-shape `solver` via `mergeSolver`. A `Record<SolverId, SymmioSolverConfig>` needs **per-key merging**, so an integrator can override one solver's `url` without redeclaring every solver on the chain. `DeepPartial` over a `Record` does not give this for free — budget real work here, with tests for the partial-override case.

---

## 4. How the two registries compose

The two axes are **not** independent silos, and treating them as such is a design error worth naming.

`solvers/instant-open/shared/{calldata,eip712,selectors}.ts` import contract ABIs directly, yet they are invoked by **solver** actions. Encoding and EIP-712 domain construction belong to the **version pack**; the URL and `partyB` address belong to the **solver**. A single instant-open call touches both registries:

```ts
export async function instantOpen(config: Config, parameters: InstantOpenParameters) {
  const version = config.resolveVersionModule(parameters.chainId); /** encoding + domain */
  const solver = config.resolveSolver(parameters.chainId, parameters.solverId); /** url + partyB */

  const callData = version.encoders.sendQuote({ ...parameters, partyB: solver.address });
  const domain = version.eip712.instantLayerDomain(chainConfig);
  const signature = await signSignedOperation(operation, domain, walletClient);

  return dispatchBySolverKind(solver, { callData, signature });
}
```

Read this as the canonical shape: **the version pack decides _how_ to encode; the solver decides _where_ to send and _who_ is counterparty.** Any new action spanning both should follow it.

---

## 5. Proposed config shape

```ts
/** ---- Contract version ---- */

/** Contract-protocol version selecting the ABI/encoder pack for a chain. */
export enum SymmioProtocolVersion {
  V0_8_5 = "v0.8.5",
}

/** ---- Solver identity ---- */

/** Which solver deployment. Open — integrators may register their own. */
export type SolverId = string;

/** What API schema a solver speaks. Closed — drives exhaustive typed dispatch. */
export type SymmioSolverKind = "enigma" | "rasa";

export interface SymmioSolverConfig {
  /** Registry key and stable identity, e.g. "enigma", "rasa". */
  id: SolverId;
  /** Schema family; selects the generated client and derives capabilities. */
  kind: SymmioSolverKind;
  /** Human-readable name for UI. */
  name: string;
  /** Solver's on-chain address, used as `partyB`. */
  address: Address;
  /** Solver / hedger API base URL. */
  url: string;
  /** TP/SL handler — solver supports conditional orders only when set. */
  tpsl?: SymmioTpSlConfig;
  /** Per-solver infrastructure overrides; fall back to chain-level when absent. */
  notifications?: SymmioNotificationsConfig;
  muon?: SymmioMuonConfig;
  priceService?: SymmioPriceServiceConfig;
}

/** ---- Chain config ---- */

export interface SymmioChainConfig {
  chainId: number;
  /** Contract version this chain runs; selects the version pack. */
  protocolVersion: SymmioProtocolVersion;
  addresses: SymmioContractAddresses;
  subgraphs: SymmioSubgraphUrls;
  /** All solvers available on this chain, keyed by id. */
  solvers: Record<SolverId, SymmioSolverConfig>;
  /** Solver used when an action omits `solverId`. */
  defaultSolverId: SolverId;
  /** Chain-level infrastructure defaults; per-solver values win. */
  priceService: SymmioPriceServiceConfig;
  notifications: SymmioNotificationsConfig;
  muon: SymmioMuonConfig;
}
```

New `Config` resolvers, alongside the existing `getChainConfig` / `getChainConfigKey`:

```ts
export interface Config {
  /** Resolve the contract-version pack (abi, encoders, selectors, eip712) for a chain. */
  resolveVersionModule(chainId?: number): ContractVersionModule;
  /**
   * Resolve a solver's config, defaulting to the chain's `defaultSolverId`.
   * @throws {SymmError} `UNKNOWN_SOLVER` when the id is not configured.
   */
  resolveSolver(chainId: number | undefined, solverId?: SolverId): SymmioSolverConfig;
  /** Effective infrastructure for a solver: per-solver value ?? chain-level default. */
  resolveSolverInfra(chainId: number | undefined, solverId?: SolverId): SymmioSolverInfra;
}
```

Note that `getChainConfigKey` hashes the whole chain config, so `protocolVersion` and `solvers` fold into every query key automatically — a runtime config override correctly invalidates caches with no extra work.

---

## 6. Out of scope: subgraph versioning

Deliberately deferred, recorded here so the reasoning is not rediscovered.

The subgraph tracks the contract version conceptually, but versioning it today would be **half a solution**:

1. **Endpoints are unpinned.** The registry points at Goldsky `/latest/gn`. Pinning a document set against a floating schema guarantees nothing — the schema can drift underneath it. Real subgraph versioning requires version-pinned deployments first, which is a Goldsky-side operational change.

2. **Codegen routes by file path.** [`codegen.ts`](./codegen.ts) separates the analytics and events schemas **purely by glob** (`src/**` minus `src/transfers/**` for analytics; `src/transfers/**` for events), and both targets emit a `graphql` identifier. Moving query documents under version folders **breaks codegen** unless both globs are reworked — it will fail with confusing "cannot query field" errors against the wrong schema.

**Preconditions for revisiting:** version-pinned Goldsky endpoints, and a codegen router keyed on something other than file path.

Until then the existing raw escape hatch — `querySubgraph(config, { document, variables, subgraph })` — remains the supported way to handle schema skew, since it accepts an arbitrary document.

---

## 7. Migration outline (v2.0.0)

Sequenced so each phase is independently reviewable. Phases 1–2 are internal and could ship without breaking anyone; the break is concentrated in phase 3.

| Phase                     | Work                                                                                                                                            | Consumer impact |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **1. Version seam**       | Add `SymmioProtocolVersion`, `protocolVersion` on chain config, `resolveVersionModule`, and the `v0.8.5` pack. Actions keep working unchanged.  | None            |
| **2. Pack consolidation** | Move ABIs, encoders, selectors, and the EIP-712 domain/type structs into the pack. Migrate the 59 importers (mechanical).                       | None            |
| **3. Solver registry**    | `solvers` + `defaultSolverId` replace `solver`; add `solverId?` to actions; **update all 11 `queryFn` arg lists** (§3.5); per-key merge (§3.6). | **Breaking**    |
| **4. Rasa client**        | Generate the client from Rasa's spec, add the `"rasa"` kind, implement dispatch, fill the capability matrix.                                    | Additive        |
| **5. React layer**        | Thread `solverId` through the corresponding hooks.                                                                                              | **Breaking**    |

**What breaks for consumers in v2.0.0:**

- `SymmioChainConfig.solver` is removed — replace with `solvers` + `defaultSolverId`.
- `createConfig({ symmioConfig })` entries that set `solver` must be rewritten.
- The `baseUrl?` overrides on `get-instant-opens`, `get-instant-closes`, `get-instant-open-quote-id`, and `get-sub-account-quotes` are removed in favour of `solverId`.
- Query-key shapes change, so caches cold-start on upgrade. Keys are opaque, so this is a release-note item rather than an API break.

**What does not break:** `getChainConfig`, the `fn(config, params)` action shape, injected client resolvers, and every public `XxxParameters` / `XxxReturnType` signature.

---

## 8. Summary of decisions

| #   | Decision                                                        | Rationale                                                                |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Contract version is **config data**, not auto-detected          | Diamond has no `version()`; probing is brittle and costs an RPC          |
| 2   | Version packs group ABI + encoders + selectors + EIP-712        | These already co-vary; grouping recognises existing cohesion             |
| 3   | **Reject** casting a registry ABI to the primary version's type | Unsound exactly on divergence — green types, wrong encoding              |
| 4   | Per-version typed wrappers **only at divergence points**        | Keeps compile-time encoding checks without duplicating everything        |
| 5   | EIP-712 domain version is **independent** of protocol version   | Conflating silently invalidates every signature                          |
| 6   | Solver `id` **open**, solver `kind` **closed**                  | Integrators run their own deployments; the SDK ships a client per schema |
| 7   | Divergence via `kind` union, **not** a capability `Set`         | A union narrows at compile time and cannot drift from the client         |
| 8   | Satellite infra: per-solver override, chain fallback            | Some infra is genuinely shared, some genuinely is not                    |
| 9   | `queryFn` arg lists are the migration hazard, not query keys    | Keys spread options; `queryFn`s enumerate them                           |
| 10  | Subgraph versioning **deferred**                                | Unpinned endpoints + path-based codegen routing make it half a solution  |
