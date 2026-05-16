import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TODO: change @symm-frontier/ui to an buildable package
  transpilePackages: ["@symm-frontier/ui", "@symm-frontier/react"],
};

export default nextConfig;
