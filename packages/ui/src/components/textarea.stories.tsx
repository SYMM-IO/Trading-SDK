import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Textarea } from "./textarea";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  args: { placeholder: "0x…" },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[420px]">
      <Textarea {...args} />
    </div>
  ),
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="w-[420px] space-y-2">
      <Label htmlFor="calldata">calldata</Label>
      <Textarea id="calldata" rows={4} {...args} className="font-mono text-xs" />
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <div className="w-[420px]">
      <Textarea {...args} disabled value="0xa9059cbb000000000000000000000000…" />
    </div>
  ),
};
