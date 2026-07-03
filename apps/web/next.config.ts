import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TODO: change @symmio/ui to an buildable package
  transpilePackages: ["@symmio/ui", "@symmio/trading-react"],
};

export default nextConfig;
