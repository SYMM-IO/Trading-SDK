import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Switch } from "./switch";

const meta = {
  title: "UI/Switch",
  component: Switch,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const Disabled: Story = { args: { disabled: true, defaultChecked: true } };

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Switch id="single-va" {...args} />
      <Label htmlFor="single-va">singleVAMode</Label>
    </div>
  ),
};
