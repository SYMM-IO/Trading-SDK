import { describe, expect, it } from "vitest";
import { PriceTimeframe } from "../../../price-service/enigma/ohlcv/generated/enigma-price-service-ohlcv";
import { CANDLE_RESOLUTION_MS } from "../../resolution";
import type { CandleResolution } from "../../types";
import { getLowcapSupportedResolutions, toLowcapTimeframe } from "./map-resolution";

describe("lowcap resolution mapping", () => {
  it("maps exactly the service's declared timeframes, including 10m and calendar codes", () => {
    expect(getLowcapSupportedResolutions()).toEqual([
      "1m",
      "5m",
      "10m",
      "15m",
      "30m",
      "1h",
      "4h",
      "6h",
      "12h",
      "1d",
      "1w",
      "1M",
    ]);
    expect(getLowcapSupportedResolutions().map(toLowcapTimeframe)).toEqual(Object.values(PriceTimeframe));
    expect(toLowcapTimeframe("1d")).toBe("1D");
    expect(toLowcapTimeframe("1w")).toBe("1W");
    expect(toLowcapTimeframe("1M")).toBe("1M");
  });

  it("declines SDK resolutions the service does not offer", () => {
    const unsupported = (Object.keys(CANDLE_RESOLUTION_MS) as CandleResolution[]).filter(
      (resolution) => !getLowcapSupportedResolutions().includes(resolution),
    );
    expect(unsupported).toEqual(["1s", "10s", "3m", "2h", "8h", "3d"]);
    for (const resolution of unsupported) expect(toLowcapTimeframe(resolution)).toBeUndefined();
  });
});
