import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils";

/**
 * Thin range slider — a slim horizontal rail with a small bar-shaped thumb,
 * sized to sit inside an input-style box. Built on Radix `Slider`, so it is
 * keyboard-accessible and renders identically across browsers without the
 * native `<input type="range">` pseudo-element styling.
 *
 * Use it controlled with `value` + `onValueChange`, or uncontrolled with
 * `defaultValue`. Both take an array with one entry per thumb (Radix's API);
 * a single-thumb slider passes `[n]`.
 *
 * @example
 * <Slider min={1} max={20} step={1} value={[leverage]} onValueChange={([next]) => setLeverage(next)} />
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const thumbValues = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex h-[18px] w-full cursor-pointer touch-none items-center select-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="bg-foreground/15 relative h-1 w-full grow overflow-hidden rounded-full"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="bg-primary absolute h-full" />
      </SliderPrimitive.Track>
      {thumbValues.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="bg-foreground focus-visible:ring-ring/50 block h-[18px] w-1.5 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.5)] transition-shadow outline-none focus-visible:ring-3"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
