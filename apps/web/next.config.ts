import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TODO: change @theoldvarorg/ui to an buildable package
  transpilePackages: ["@theoldvarorg/ui", "@theoldvarorg/react"],
};

export default nextConfig;
