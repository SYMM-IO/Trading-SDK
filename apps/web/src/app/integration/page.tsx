import { IntegrationPanel } from "@/features/integration/integration-panel";

export const metadata = {
  title: "Integration · Symmio",
  description:
    "Set up an account — gasless, session key, or neither — then deposit, trade, protect, and exit. End-to-end flows built on the SYMMIO React SDK.",
};

export default function IntegrationPage() {
  return <IntegrationPanel />;
}
