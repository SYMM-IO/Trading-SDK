import { ImageResponse } from "next/og";

/**
 * iOS home-screen icon — the Prism mark on the app's base surface, generated
 * as a 180×180 PNG. Mirrors `icon.svg` and the in-app `PrismMark`; the
 * geometry and colours are baked in because this renders at build time with no
 * stylesheet in reach. Apple touch icons must be raster, so this is drawn rather
 * than shipped as a binary.
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
        background: "#191a21",
      }}
    >
      <svg width="124" height="124" viewBox="0 0 32 32" fill="none">
        <path d="M0 7.5 14.6 14.2 0 11Z" fill="#8be9fd" />
        <path d="M0 14.2 13.4 17.8 0 17.8Z" fill="#bd93f9" />
        <path d="M0 21 12.1 21.3 0 24.5Z" fill="#ff79c6" />
        <path
          d="M18 5 26 27H10L18 5Z"
          fill="#f8f8f2"
          fillOpacity="0.07"
          stroke="#f8f8f2"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M22 15.6 32 13v7.5l-9.1-1.7Z" fill="#f8f8f2" />
      </svg>
    </div>,
    { ...size },
  );
}
