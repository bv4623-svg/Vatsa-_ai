import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          gap: 28,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="g" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <line x1="5.5" y1="5.5" x2="12" y2="18.5" stroke="url(#g)" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="18.5" y1="5.5" x2="12" y2="18.5" stroke="url(#g)" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="5.5" cy="5.5" r="2.75" fill="url(#g)" />
          <circle cx="18.5" cy="5.5" r="2.75" fill="url(#g)" />
          <circle cx="12" cy="18.5" r="3.25" fill="url(#g)" />
        </svg>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#f8fafc" }}>
          Vatsa <span style={{ color: "#94a3b8", marginLeft: 16 }}>AI</span>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#94a3b8" }}>Intelligence, orchestrated</div>
      </div>
    ),
    { ...size }
  );
}
