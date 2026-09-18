import { SymmioSupportedChainId, type CreateConfigParameters, type SymmioGaslessConfig } from "@symmio/trading-core";
import type { Address } from "viem";

/**
 * A named, one-click set of chain overrides surfaced in the config panel.
 */
export interface ConfigPreset {
  /** Stable identifier used as the apply-action value. */
  id: string;
  /** Short label shown on the action button. */
  label: string;
  /** One-line explanation of what applying the preset does. */
  description: string;
  /** Per-chain overrides this preset writes onto the SDK defaults. */
  overrides: CreateConfigParameters["symmioConfig"];
}

/**
 * One GaslessQ deployment, as a single fact bundle.
 *
 * The gateway origin, the protocol-instance key, the GaslessLayer proxy and the
 * InstantLayer the gateway verifies operations against are provisioned
 * together — an operation signed for one deployment is rejected by the other —
 * so they are stated once, here, and never split across sources. The
 * InstantLayer doubles as the deployment's identity: it is how
 * `rebaseGaslessDeploymentFacts` recognises a persisted config's deployment and
 * re-applies the rest of these facts from code.
 */
export interface GaslessDeployment {
  /** Chain this deployment serves. */
  chainId: SymmioSupportedChainId;
  /** InstantLayer the gateway verifies relayed operations against — the deployment's identity. */
  instantLayerAddress: Address;
  /** Gateway facts written into the chain's `gasless` block. Deployment facts only: no `execution` preference. */
  gasless: Pick<SymmioGaslessConfig, "url" | "protocolInstance" | "gaslessLayerAddress" | "statusStream">;
}

/**
 * The GaslessQ deployments this app can point at, keyed by deployment name.
 *
 * `url` is the **vendor origin**: the browser calls the gateway directly. The
 * gateway serves anonymous clients by default — 10 requests per second per
 * caller IP and protocol instance, shared across the operations and deposits
 * services — so no `apiKey` is configured here and the SDK sends no
 * `Authorization` header at all. A partner key only raises those limits, and a
 * key in a browser bundle is a leaked key, so this app ships none; the
 * key-injecting `/api/gasless` proxy this app used to carry is gone with it.
 * Server-side consumers that do hold a key still have `gasless.apiKey`.
 *
 * Only **staging** is listed. The production gateway (protocol instance
 * `arbitrum-42161-vibe`, GaslessLayer `0x8347953D80037b8d82827246f37EC7442AD188B4`)
 * still runs the legacy pre-multi-wallet contract and the matching old gateway
 * schema, and refuses anonymous callers. It is unsupported until the vendor
 * upgrades it, and listing it would only let a persisted config point at a
 * deployment no call in this SDK generation can complete.
 */
export const GASLESS_DEPLOYMENTS = {
  staging: {
    chainId: SymmioSupportedChainId.ARBITRUM,
    instantLayerAddress: "0x38AaBc7A73523Cd47c710FcdEb3b20ae02310180",
    gasless: {
      url: "https://gaslessq-staging.symmio.foundation",
      protocolInstance: "arbitrum-42161-vibe-stage",
      gaslessLayerAddress: "0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca",
      /**
       * The status WebSocket is confirmed live on this instance (`ready` frame,
       * ~20 s heartbeat, unknown ids answered with `NOT_FOUND`), so status reads
       * stream and fall back to polling instead of only polling.
       */
      statusStream: { enabled: true },
    },
  },
} as const satisfies Record<string, GaslessDeployment>;

/** Name of a deployment in {@link GASLESS_DEPLOYMENTS}. */
export type GaslessDeploymentKey = keyof typeof GASLESS_DEPLOYMENTS;

/**
 * Find the deployment a chain config belongs to, by its InstantLayer address.
 *
 * The InstantLayer is the join key. It is the contract the gateway verifies
 * relayed operations against, so it is the one address that cannot be paired
 * with another deployment's gateway — matching on the gasless fields instead
 * would only confirm the values a persisted config already carries. This is how
 * both the config editor and the persisted-overrides rebase decide which
 * gateway a chain config is entitled to, without either restating the facts.
 *
 * @param chainId - Chain the config belongs to. An InstantLayer only names a
 *   deployment on its own chain: the same address on another chain is another
 *   contract, and pairing it with this gateway would be a guess.
 * @param instantLayerAddress - The InstantLayer a chain config names, if any.
 * @returns The matching deployment, or `undefined` when the address belongs to
 *   none of {@link GASLESS_DEPLOYMENTS} — a chain with no relayer, a retired
 *   gateway, or a config that simply does not name an InstantLayer.
 *
 * @example
 * ```ts
 * const chain = overrides?.[SymmioSupportedChainId.ARBITRUM];
 * const deployment = findGaslessDeployment(SymmioSupportedChainId.ARBITRUM, chain?.addresses?.instantLayerAddress);
 * const gasless = deployment ? { ...deployment.gasless, execution: { mode: "gasless" } } : undefined;
 * ```
 */
export function findGaslessDeployment(chainId: number, instantLayerAddress?: string): GaslessDeployment | undefined {
  if (!instantLayerAddress) return undefined;
  const needle = instantLayerAddress.toLowerCase();
  return Object.values(GASLESS_DEPLOYMENTS).find(
    (deployment) => deployment.chainId === chainId && deployment.instantLayerAddress.toLowerCase() === needle,
  );
}

/**
 * Staging deployment overrides. Applying this points the SDK at the SYMMIO
 * Arbitrum staging contracts, the Enigma staging solver (partyB), the staging
 * subgraphs, the staging notifications WebSocket, Express Withdraw, and the staging GaslessQ relayer.
 */
export const STAGING_CHAIN_OVERRIDES = {
  [SymmioSupportedChainId.ARBITRUM]: {
    contractsVersion: "0.8.6",
    addresses: {
      symmioAddress: "0x573310dB6d160B26026B8706EBe9831c7dEF1D09",
      instantLayerAddress: GASLESS_DEPLOYMENTS.staging.instantLayerAddress,
      accountLayerAddress: "0x5733107211B2801Acd39933a54d482FE303c4907",
      affiliatesAddress: "0xe99c18CF3C62B9229f9251fd2562077a33e7600a",
      collateralAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      collateralDecimals: 6,
    },
    solvers: {
      enigma: {
        name: "Enigma (staging)",
        address: "0x9be79D4977D86D440F9e1Ea0d468A58104B9b932",
        url: "https://arb-staging.enigma.bz/api",
        tpsl: {
          url: "https://tpsl-stage.enigma.bz",
          wsUrl: "wss://notification-stage.rasa.capital/ws/v1/subscribe",
          appName: "ARB_COH_Low-Cap_Stage",
          cohWalletAddress: "0x5Cf3fC3722e1780220Ca94C04a6dc7Dfd7615661",
        },
        notifications: {
          url: "wss://notification-stage.rasa.capital/ws/v1/subscribe",
          channel: "Arbitrum_Solver-Low-Cap_Stage",
          protocol: "enigma",
          searchUrl: "https://notification-stage.rasa.capital",
        },
        capabilities: { groupClose: true, listingService: true },
      },
    },
    defaultSolverId: "enigma",
    subgraphs: {
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-analytics/latest/gn",
      events:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-events/latest/gn",
    },
    priceService: {
      type: "enigma",
      url: "https://lowcap-price-staging.enigma.bz",
      wsUrl: "wss://lowcap-price.rasa.capital/ws",
    },
    muon: {
      urls: [
        "https://muon-oracle1.rasa.capital/v1/",
        "https://muon-oracle2.rasa.capital/v1/",
        "https://muon-oracle3.rasa.capital/v1/",
        "https://muon-oracle4.rasa.capital/v1/",
      ],
    },
    listing: {
      url: "https://listing85.enigma.bz",
    },
    inventory: {
      url: "https://inventory85.enigma.bz",
    },
    /**
     * The staging GaslessQ relayer, paired with the staging InstantLayer above.
     * The built-in registry ships no gasless block, so every field is stated —
     * the endpoint facts come from {@link GASLESS_DEPLOYMENTS} so that this
     * preset and the persisted-config rebase can never name different gateways.
     *
     * The browser talks to the vendor origin directly and anonymously (see the
     * note on `GASLESS_DEPLOYMENTS`), so there is no proxy hop and no key.
     *
     * `execution.mode` — without it the dispatcher's `enabled` stays `false`
     * and every relayable write silently falls through to `writeContract`,
     * which is a dead end on a wallet holding no native token. `fallback` stays
     * at its default (`"error"`) so a refused relay surfaces its precise error
     * instead of an out-of-gas one. It is the one gasless field a user owns: the
     * rest are deployment facts, re-applied from code on every load.
     */
    gasless: {
      ...GASLESS_DEPLOYMENTS.staging.gasless,
      execution: { mode: "gasless" },
    },
  },
} satisfies CreateConfigParameters["symmioConfig"];

/** The staging preset, ready to render as a one-click action in the config panel. */
export const STAGING_PRESET: ConfigPreset = {
  id: "staging",
  label: "Staging",
  description: "Arbitrum staging contracts, Enigma services, Express Withdraw, notifications, and subgraphs.",
  overrides: STAGING_CHAIN_OVERRIDES,
};
