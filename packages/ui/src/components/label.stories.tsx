import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "UI/Label",
  component: Label,
  parameters: { layout: "centered" },
  args: { children: "Wallet address" },
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PairedWithInput: Story = {
  render: () => (
    <div className="w-[320px] space-y-2">
      <Label htmlFor="paired">Subaccount name</Label>
      <Input id="paired" placeholder="My Trading Account" />
    </div>
  ),
};
