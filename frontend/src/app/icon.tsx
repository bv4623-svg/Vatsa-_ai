import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0f172a", borderRadius: 7 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="g" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <line x1="5.5" y1="5.5" x2="12" y2="18.5" stroke="url(#g)" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="18.5" y1="5.5" x2="12" y2="18.5" stroke="url(#g)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="5.5" cy="5.5" r="2.75" fill="url(#g)" />
          <circle cx="18.5" cy="5.5" r="2.75" fill="url(#g)" />
          <circle cx="12" cy="18.5" r="3.25" fill="url(#g)" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
