"use client";

import { useSymmioConfig } from "@symm-frontier/react";

function ConfigRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 py-3 last:border-b-0 dark:border-zinc-800">
      <dt className="shrink-0 text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="max-w-[70%] text-right font-mono text-sm break-all text-zinc-950 dark:text-zinc-50">
        {value ?? "Not configured"}
      </dd>
    </div>
  );
}

export function SymmioConfigDebug() {
  const config = useSymmioConfig();

  return (
    <section className="w-full max-w-5xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6">
        <p className="text-sm font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">Symmio Core</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Resolved VibeCaps Config
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          This page verifies that the web app initializes Wagmi and the Symmio core provider, then reads the resolved
          chain config from core.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">Runtime</h2>
          <dl className="rounded-md border border-zinc-200 px-4 dark:border-zinc-800">
            <ConfigRow label="Environment" value={config.environment} />
            <ConfigRow label="Chain ID" value={config.chainId} />
            <ConfigRow label="Input affiliate" value={config.input.affiliateAddress} />
            <ConfigRow label="Solver" value={`${config.solver.name} (${config.solver.address})`} />
          </dl>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">Addresses</h2>
          <dl className="rounded-md border border-zinc-200 px-4 dark:border-zinc-800">
            <ConfigRow label="Symmio" value={config.addresses.symmioAddress} />
            <ConfigRow label="Instant Layer" value={config.addresses.instantLayerAddress} />
            <ConfigRow label="Account Layer" value={config.addresses.accountLayerAddress} />
            <ConfigRow label="Affiliates" value={config.addresses.affiliatesAddress} />
            <ConfigRow label="Collateral" value={config.addresses.collateralAddress} />
            <ConfigRow label="Collateral Decimals" value={config.addresses.collateralDecimals} />
          </dl>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">Subgraphs</h2>
        <dl className="rounded-md border border-zinc-200 px-4 dark:border-zinc-800">
          <ConfigRow label="Analytics" value={config.subgraphs.analytics} />
        </dl>
      </div>
    </section>
  );
}
