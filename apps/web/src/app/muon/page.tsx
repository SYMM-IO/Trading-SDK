import { MuonShell } from "@/features/muon/muon-shell";

export const metadata = {
  title: "Muon API · Symmio",
  description: "Fetch SYMMIO Muon oracle attestations — uPnL, price, and settlement signatures — via the React SDK.",
};

export default function MuonPage() {
  return <MuonShell />;
}
