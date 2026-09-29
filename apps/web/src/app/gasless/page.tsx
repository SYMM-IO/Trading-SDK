import { GaslessShell } from "@/features/gasless/gasless-shell";

export const metadata = {
  title: "Gasless · Symmio",
  description:
    "Relay SYMMIO account actions with no native gas — request polling, fee allowance, and deposit onboarding via the React SDK.",
};

export default function GaslessPage() {
  return <GaslessShell />;
}
