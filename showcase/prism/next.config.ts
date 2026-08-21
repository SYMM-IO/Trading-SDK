import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Prism is its own pnpm root nested inside the SYMM-Frontier repo, so Next
   * sees two lockfiles and cannot infer which folder is the project. Pin it to
   * this one: pointing it at the repo above makes the bundler walk every app
   * and package in the monorepo, which exhausts memory before it finishes.
   */
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
