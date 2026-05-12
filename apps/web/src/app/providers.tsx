"use client";

import { SymmioProvider } from "@symm-frontier/core";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { symmioConfig } from "@/config/symmio";
import { wagmiConfig } from "@/config/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <SymmioProvider config={symmioConfig}>{children}</SymmioProvider>
    </WagmiProvider>
  );
}
