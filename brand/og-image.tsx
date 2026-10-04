import { readFileSync } from "node:fs";
import { ImageResponse } from "next/og";

const FONTS = process.env.OLM_OG_FONTS ?? "";

// Source for web/app/opengraph-image.png, the preview shown when a link to the
// site is shared. Not part of the build: static export would publish the
// generated image without a .png extension. To regenerate, copy this file to
// web/app/opengraph-image.tsx (removing the .png), run the build with
// OLM_OG_FONTS pointing at a folder containing inter-700.ttf and
// inter-500.ttf (Inter, SIL Open Font License), and copy web/out/opengraph-image
// back to web/app/opengraph-image.png.
export const dynamic = "force-static";
export const alt = "OpenLifeModel: the life expectancy calculator that shows its work";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CURVE = "M0 30 C 130 30, 165 52, 205 160 S 285 270, 360 270";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0a0f1c 0%, #0b2a2b 100%)",
          color: "#e8edf5",
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        <svg width="360" height="300" viewBox="0 0 360 300" style={{ position: "absolute", right: 0, bottom: 0 }}>
          <path d={`${CURVE} L 360 300 L 0 300 Z`} fill="#2dd4bf" fillOpacity="0.10" />
          <path d={CURVE} fill="none" stroke="#2dd4bf" strokeWidth="7" strokeLinecap="round" />
          <circle cx="205" cy="160" r="12" fill="#0a0f1c" stroke="#2dd4bf" strokeWidth="7" />
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="15" fill="#0d9488" />
            <path d="M12 18 C 26 18, 31 20, 36 31 S 44 46, 52 46 L 52 50 L 12 50 Z" fill="#ffffff" fillOpacity="0.24" />
            <path d="M12 18 C 26 18, 31 20, 36 31 S 44 46, 52 46" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
            <circle cx="36" cy="31" r="5" fill="#ffffff" />
          </svg>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>OpenLifeModel</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 66, fontWeight: 700, lineHeight: 1.06, letterSpacing: -2 }}>
            <span>The life expectancy</span>
            <span>calculator that</span>
            <span style={{ color: "#2dd4bf" }}>shows its work</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 500, color: "#9aa6ba", marginTop: 24 }}>
            Open models · Cited evidence · Runs in your browser
          </div>
        </div>
        <div style={{ fontSize: 26, color: "#2dd4bf", fontWeight: 600 }}>openlifemodel.com</div>
      </div>
    ),
    {
      ...size,
      fonts: FONTS
        ? [
            { name: "Inter", data: readFileSync(`${FONTS}/inter-700.ttf`), weight: 700 },
            { name: "Inter", data: readFileSync(`${FONTS}/inter-500.ttf`), weight: 500 },
          ]
        : [],
    },
  );
}
