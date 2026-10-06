import { SolversShell } from "@/features/solvers/solvers-shell";

export const metadata = {
  title: "Solvers",
  description: "Fetch tradable markets from the SYMMIO solver via the React SDK.",
};

export default function SolversPage() {
  return <SolversShell />;
}
