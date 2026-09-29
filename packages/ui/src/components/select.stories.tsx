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

/**
 * Descriptions longer than the screen — a full ABI signature, a bare address —
 * wrap inside the viewport instead of widening the list past it.
 */
export const WithLongDescriptions: Story = {
  render: (args) => (
    <div className="w-[320px]">
      <Select {...args}>
        <SelectTrigger>
          <SelectValue placeholder="Pick a write" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="forceClosePosition"
            description="forceClosePosition(uint256 quoteId, (bytes reqId, uint256 timestamp, uint256 symbolId, uint256 highest, uint256 lowest, uint256 averagePrice, uint256 startTime, uint256 endTime, int256 upnlPartyB, int256 upnlPartyA, uint256 currentPrice, bytes gatewaySignature, (uint256 signature, address owner, address nonce)) sig)"
          >
            forceClosePosition
          </SelectItem>
          <SelectItem value="account" description="0x3333333333333333333333333333333333333333">
            Main
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
