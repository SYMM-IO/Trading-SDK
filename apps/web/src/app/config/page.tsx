import { SymmioConfigDebug } from "@/features/config-debug/symmio-config-debug";

export const metadata = {
  title: "Resolved Config · Symmio",
  description: "Resolved VibeCaps chain config wired through @symm-frontier/react.",
};

export default function ConfigPage() {
  return <SymmioConfigDebug />;
}
