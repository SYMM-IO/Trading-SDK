import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  args: { children: "Badge" },
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "secondary", "destructive", "outline", "ghost", "link"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "view" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Wrong network" } };
export const Outline: Story = { args: { variant: "outline", children: "Symmio · Inspector" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Beta" } };
