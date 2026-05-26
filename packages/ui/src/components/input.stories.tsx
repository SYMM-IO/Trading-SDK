import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  args: { placeholder: "0x…" },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[320px]">
      <Input {...args} />
    </div>
  ),
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="w-[320px] space-y-2">
      <Label htmlFor="account">account</Label>
      <Input id="account" {...args} className="font-mono" />
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <div className="w-[320px]">
      <Input {...args} disabled value="0xDEADBEEF…" />
    </div>
  ),
};
