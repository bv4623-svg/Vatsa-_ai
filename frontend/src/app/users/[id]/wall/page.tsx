import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserWall } from "@/components/reviews/UserWall";

export const metadata: Metadata = { title: "Wall" };

export default async function UserWallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) notFound();
  return <UserWall userId={userId} />;
}
