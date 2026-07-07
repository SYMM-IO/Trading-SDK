import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TODO: change @symmio/ui to a buildable package
  transpilePackages: ["@symmio/ui"],
};

export default nextConfig;
