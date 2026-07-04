# @symmio/utils

> Framework-agnostic utility helpers for SYMMIO SDK consumers: amount formatting, address helpers, Decimal.js bridge.

`@symmio/utils` is the shared helper layer of the SYMMIO SDK. It holds framework-neutral primitives — token amount formatting, display formatters, address shorteners, and a Decimal.js bridge — that any consumer of `@symmio/trading-core` or `@symmio/trading-react` can use, whether in React, another framework, or a plain Node script.

**[Documentation](https://symmio-frontier.vercel.app/utils) · [Live SDK console](https://symm-frontier-web.vercel.app/)**

## Installation

```sh
npm install @symmio/utils viem
```

viem is a peer dependency.

## Usage

```ts
import { formatTokenAmount, formatCurrency, shortenAddress } from "@symmio/utils";

const raw = 1_234_567_890n;

const amount = formatTokenAmount(raw, 6); // "1234.56789"
const price = formatCurrency(1234.567); // "$1,234.56"
const account = shortenAddress("0x46493c376758da47823d7e3ae5d417ea6546eeb3"); // "0x4649…eEB3"

console.log(amount, price, account);
```

See the [full API reference](https://symmio-frontier.vercel.app/utils) for every helper and its options.

## License

[MIT](./LICENSE)
