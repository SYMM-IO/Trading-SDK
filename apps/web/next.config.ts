import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { fetchMockerConfig } from "./src/config/mocker-config";

const nextConfig: NextConfig = {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- standalone Playwright launcher, separate dev cache
  distDir: process.env.MOCKER_E2E === "1" ? ".next/mocker-e2e" : undefined,
  // TODO: change @symmio/ui to an buildable package
  transpilePackages: ["@symmio/ui", "@symmio/trading-react"],
};

export default async function configureNext(phase: string): Promise<NextConfig> {
  // Standalone Next dev can attach to a running MOCKER using the same config endpoint as the launcher.
  const panelUrl = process.env.NEXT_PUBLIC_MOCKER_URL;
  if (phase !== PHASE_DEVELOPMENT_SERVER || process.env.NEXT_PUBLIC_MOCKER_CONFIG !== undefined || !panelUrl) {
    return nextConfig;
  }
  const config = await fetchMockerConfig(panelUrl);
  if (!config) throw new Error(`MOCKER is unavailable at ${panelUrl}. Start it first or run pnpm dev:mocker.`);
  return { ...nextConfig, env: { NEXT_PUBLIC_MOCKER_CONFIG: JSON.stringify(config) } };
}
