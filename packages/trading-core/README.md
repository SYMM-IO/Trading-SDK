# @symmio/trading-core

> Framework-agnostic SYMMIO SDK. Contract calls, calculations, and transformations with no framework assumptions.

`@symmio/trading-core` is the base layer of the SYMMIO SDK: contract reads and writes (via viem), REST and GraphQL calls, and the calculations and transformations that turn raw protocol data into typed results. It has no framework dependency, so React (`@symmio/trading-react`) and other framework bindings build on top of it.

**[Documentation](https://doc.trading-sdk.symm.io/core) · [Live SDK console](https://console.trading-sdk.symm.io/)**

## Installation

```sh
npm install @symmio/trading-core viem
```

viem is a peer dependency.

## Usage

```ts
import { createConfig, getMarkets } from "@symmio/trading-core";
import { createPublicClient, http } from "viem";
import { hyperEvm } from "viem/chains";

const publicClient = createPublicClient({ chain: hyperEvm, transport: http() });

const config = createConfig({
  getClient: () => publicClient,
});

const markets = await getMarkets(config, {});
console.log(markets[0]?.name);
```

Every action ships a matching TanStack Query / Mutation options factory (e.g. `getMarketsQueryOptions`) for wiring into a query client.

See the [full API reference](https://doc.trading-sdk.symm.io/core) for every action, options factory, and type.

## License

[MIT](./LICENSE)
