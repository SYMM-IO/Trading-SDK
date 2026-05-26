import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Connect a wallet</CardTitle>
        <CardDescription>Pick a connector to start a session on HyperEVM.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          You can switch connectors at any time. Disconnecting clears local session state but does not revoke on-chain
          allowances.
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2 border-t pt-4">
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button size="sm">Connect</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Account balance</CardTitle>
        <CardDescription>USDC on Hyperliquid</CardDescription>
        <CardAction>
          <Button variant="ghost" size="xs">
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-foreground text-2xl font-semibold">12,480.55</p>
        <p className="text-muted-foreground text-sm">last synced 12s ago</p>
      </CardContent>
    </Card>
  ),
};

export const Small: Story = {
  render: () => (
    <Card size="sm" className="w-[320px]">
      <CardHeader>
        <CardTitle className="text-sm">Compact card</CardTitle>
        <CardDescription>Tighter padding for dense layouts.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">Use `size=&quot;sm&quot;` when stacking many cards in a list.</p>
      </CardContent>
    </Card>
  ),
};
