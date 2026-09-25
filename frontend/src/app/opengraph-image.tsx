import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoDataUri = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public", "logo.png"))
  .toString("base64")}`;

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} width={140} height={140} style={{ objectFit: "contain" }} alt="" />
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#f8fafc" }}>
          Vatsa <span style={{ color: "#94a3b8", marginLeft: 16 }}>AI</span>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#94a3b8" }}>Intelligence, orchestrated</div>
      </div>
    ),
    { ...size }
  );
}
