import { ImageResponse } from "next/og";

/**
 * iOS home-screen icon — the Symmio brand mark on a warm near-black tile,
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
        background: "#0a0505",
      }}
    >
      <svg width="118" height="85" viewBox="0 0 880 633" fill="none">
        <path
          d="M0 498.172V633H712.968V576.873C712.968 484.621 787.75 409.836 880 409.836V223.866H694.408V493.522L0 498.172Z"
          fill="#ffffff"
        />
        <path
          d="M880 134.828V0H167.032V56.127C167.032 148.379 92.2495 223.164 0 223.164V409.134H185.592V139.478L880 134.828Z"
          fill="#ffffff"
        />
        <path d="M270.175 223.866H609.825V409.134H270.175V223.866Z" fill="#ED4A3F" />
      </svg>
    </div>,
    { ...size },
  );
}
