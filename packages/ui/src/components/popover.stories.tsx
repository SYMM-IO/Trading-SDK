import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta = {
  title: "UI/Popover",
  component: Popover,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Dimensions</p>
            <p className="text-muted-foreground text-xs">Set the panel size.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="width">Width</Label>
            <Input id="width" defaultValue="320px" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
