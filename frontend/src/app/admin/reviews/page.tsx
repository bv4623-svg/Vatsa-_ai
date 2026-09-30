import type { Metadata } from "next";
import { ReviewsAdmin } from "@/components/reviews/ReviewsAdmin";

export const metadata: Metadata = { title: "Review moderation", robots: { index: false, follow: false } };

export default function AdminReviewsPage() {
  return <ReviewsAdmin />;
}
