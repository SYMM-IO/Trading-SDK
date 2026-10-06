import { ContractsPanel } from "@/features/contracts/contracts-panel";

export const metadata = {
  title: "Contract methods",
  description: "Browse the SYMMIO React SDK's contract methods by ABI or by flow.",
};

export default function ContractsPage() {
  return <ContractsPanel />;
}
