import { PoolsShell } from "@/features/pools/pools-shell";

export const metadata = {
  title: "Pools · Symmio",
  description: "Browse the permissionless-listing market catalog through the React SDK.",
};

export default function PoolsPage() {
  return <PoolsShell />;
}
