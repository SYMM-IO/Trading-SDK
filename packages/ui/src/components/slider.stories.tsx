import type { Meta, StoryObj } from "@storybook/react";
import { Slider } from "./slider";

const meta = {
  title: "UI/Slider",
  component: Slider,
  parameters: { layout: "centered" },
  args: { min: 0, max: 100, step: 1, defaultValue: [40], className: "w-72" },
} satisfies Meta<typeof Slider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Stepped: Story = { args: { min: 1, max: 20, step: 1, defaultValue: [8] } };
export const Disabled: Story = { args: { disabled: true, defaultValue: [40] } };
export const RangeSelection: Story = { args: { defaultValue: [25, 75] } };
