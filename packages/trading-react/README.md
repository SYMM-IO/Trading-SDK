# @symmio/trading-react

> React adapter for the SYMMIO SDK. Hooks, providers, and React-bound ergonomics on top of @symmio/trading-core.

`@symmio/trading-react` is the React layer of the SYMMIO SDK. It wraps the framework-agnostic `@symmio/trading-core` in hooks and a provider, bridging the SDK to your app's wagmi and TanStack Query setup so you can read positions, quotes, balances, and prices and run trading flows without wiring contract calls yourself.

**[Documentation](https://doc.trading-sdk.symm.io/react) · [Live SDK console](https://console.trading-sdk.symm.io/)**

## Installation

```sh
npm install @symmio/trading-react react react-dom viem wagmi
```

react, react-dom, viem, and wagmi are peer dependencies you provide; @symmio/trading-core installs automatically.

## Usage

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SymmioProvider, useWalletAccount } from "@symmio/trading-react";
import { WagmiProvider, type Config } from "wagmi";

const queryClient = new QueryClient();

export function Providers({ wagmiConfig, children }: { wagmiConfig: Config; children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SymmioProvider>{children}</SymmioProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function Account() {
  const { address, isOnExpectedChain } = useWalletAccount();
  if (!address) return <span>Connect a wallet</span>;
  return <span>{isOnExpectedChain ? address : "Wrong network"}</span>;
}
```

For the full list of hooks and providers, see the [API reference](https://doc.trading-sdk.symm.io/react).

## License

[MIT](./LICENSE)
