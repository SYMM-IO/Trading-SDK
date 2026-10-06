import { PoolsShell } from "@/features/pools/pools-shell";

export const metadata = {
  title: "Pools",
  description: "Browse the permissionless-listing market catalog through the React SDK.",
};

export default function PoolsPage() {
  return <PoolsShell />;
}
