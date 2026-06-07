import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DateTimePicker } from "./date-time-picker";

const meta = {
  title: "UI/DateTimePicker",
  component: DateTimePicker,
  parameters: { layout: "centered" },
} satisfies Meta<typeof DateTimePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UnixTimestamp: Story = {
  args: {
    idPrefix: "story-dtp",
    value: "",
    onValueChange: () => undefined,
    onDateChange: () => undefined,
  },
  render: () => <DateTimePickerStory />,
};

function DateTimePickerStory() {
  const [value, setValue] = useState("");
  const seconds = /^[0-9]+$/.test(value) ? Number(value) : undefined;
  return (
    <div className="w-[380px]">
      <DateTimePicker
        idPrefix="story-dtp"
        value={value}
        onValueChange={setValue}
        date={seconds ? new Date(seconds * 1000) : undefined}
        onDateChange={(next) => setValue(Math.floor(next.getTime() / 1000).toString())}
        placeholder="1767225600"
        inputMode="numeric"
        mono
      />
    </div>
  );
}
