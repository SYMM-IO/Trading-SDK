import { SubgraphPage } from "@/features/subgraph/subgraph-page";

export const metadata = {
  title: "Subgraph Reads · Symmio",
  description: "Run the SDK's subgraph reads through @symmio/trading-react with any filters and params.",
};

export default function SubgraphRoute() {
  return <SubgraphPage />;
}
