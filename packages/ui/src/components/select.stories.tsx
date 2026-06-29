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

/**
 * Each item carries a `description` line that explains what it does. The
 * description renders only in the open dropdown — the trigger reflects the
 * selected item's label alone.
 */
export const WithDescriptions: Story = {
  render: (args) => (
    <div className="w-[320px]">
      <Select {...args} defaultValue="exclude">
        <SelectTrigger>
          <SelectValue placeholder="Margin legs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="exclude"
            description="Default. Show only real deposits and withdrawals."
            className="max-w-xs"
          >
            Hide margin legs
          </SelectItem>
          <SelectItem
            value="include"
            description="Include the margin-transfer legs alongside real movements."
            className="max-w-xs"
          >
            Show margin legs
          </SelectItem>
          <SelectItem
            value="only"
            description="Show just the margin-transfer legs between a subaccount and its virtual accounts."
            className="max-w-xs"
          >
            Only margin legs
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
