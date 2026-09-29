import type { Metadata } from "next";
import { ReviewWall } from "@/components/reviews/ReviewWall";

export const metadata: Metadata = {
  title: "Reviews",
  description: "What people say about Vatsa AI: ratings, pros and cons from real users.",
};

export default function ReviewsWallPage() {
  return <ReviewWall />;
}
