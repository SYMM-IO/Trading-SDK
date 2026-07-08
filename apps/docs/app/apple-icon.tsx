import { ImageResponse } from "next/og";

/**
 * iOS home-screen icon — the brand mark (stacked up-chevrons) on a cobalt tile,
 * generated as a 180×180 PNG. Mirrors the SVG favicon (`icon.svg`) and the
 * in-app `LogoMark`. Apple touch icons must be raster, so this renders one at
 * build time rather than shipping a binary asset.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "linear-gradient(135deg, #4b78ff, #2f5fe6)",
      }}
    >
      <svg width="112" height="112" viewBox="0 0 24 24" fill="none">
        <path d="M5 13.5 12 7l7 6.5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M5 18 12 11.5 19 18"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />
      </svg>
    </div>,
    { ...size },
  );
}
