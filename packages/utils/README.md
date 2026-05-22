# @symm-frontier/utils

Framework-agnostic utility helpers for SYMMIO SDK consumers.

Has no React, no wagmi, no DOM — anything in this package can be imported from a Node script just as well as from a React app. Companion to [`@symm-frontier/core`](../core) (which holds contract/ABI/address logic) and [`@symm-frontier/react`](../react) (the React adapter).

## Install

```sh
pnpm add @symm-frontier/utils viem
```

`viem` is a peer dependency; `decimal.js` is a direct dependency.

## Usage

### Amount helpers

```ts
import { formatTokenAmount, parseTokenAmount, rawToDecimal } from "@symm-frontier/utils/amounts";

formatTokenAmount(1_234_567_890_000n, 6); // "1234567.89"
parseTokenAmount("1234.5", 6); //              1_234_500_000n

const balance = rawToDecimal(1_500_000n, 6); // Decimal("1.5")
balance.times("0.997"); //                       Decimal("1.4955")
```

### Address helpers

```ts
import { shortenAddress } from "@symm-frontier/utils/address";

shortenAddress("0x46493c376758Da47823D7E3Ae5d417eA6546eEB3"); // "0x4649…eEB3"
```

## Contributing

See [`AGENTS.md`](./AGENTS.md) for package rules and the repo-root [`AGENTS.md`](../../AGENTS.md) for monorepo conventions.
