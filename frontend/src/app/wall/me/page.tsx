import type { Metadata } from "next";
import { MyWall } from "@/components/reviews/MyWall";

export const metadata: Metadata = { title: "My wall", robots: { index: false, follow: false } };

export default function MyWallPage() {
  return <MyWall />;
}
