import type { Meta, StoryObj } from "@storybook/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const meta = {
  title: "UI/Select",
  component: Select,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[320px]">
      <Select {...args}>
        <SelectTrigger>
          <SelectValue placeholder="Select isolation type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">POSITION</SelectItem>
          <SelectItem value="1">MARKET</SelectItem>
          <SelectItem value="2">MARKET_DIRECTION</SelectItem>
          <SelectItem value="3">CUSTOM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Preselected: Story = {
  render: (args) => (
    <div className="w-[320px]">
      <Select {...args} defaultValue="2">
        <SelectTrigger>
          <SelectValue placeholder="Select isolation type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">POSITION</SelectItem>
          <SelectItem value="1">MARKET</SelectItem>
          <SelectItem value="2">MARKET_DIRECTION</SelectItem>
          <SelectItem value="3">CUSTOM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
