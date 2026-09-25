import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const logoDataUri = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public", "logo.png"))
  .toString("base64")}`;

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", borderRadius: 7 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} width={26} height={26} style={{ objectFit: "contain" }} alt="" />
      </div>
    ),
    { ...size }
  );
}
