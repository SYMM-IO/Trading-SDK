import nextra from "nextra";

const withNextra = nextra({});

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  reactStrictMode: true,
  experimental: {
    // Force server-component renders to invalidate on every file change so
    // Nextra picks up MDX edits without a full dev-server restart.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default withNextra(nextConfig);
