"use client";

import { useAppStore } from "@/stores/app-store";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

const FEATURE_PERMISSIONS: Record<string, string[]> = {
  free: ["chat", "search", "research"],
  pro: ["chat", "search", "research", "code", "image", "video", "automation", "data", "business"],
  enterprise: ["chat", "search", "research", "code", "image", "video", "automation", "data", "business", "admin"],
};

interface FeatureGuardProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGuard({ feature, children, fallback }: FeatureGuardProps) {
  const userTier = useAppStore((state) => state.userTier) || "free";
  const router = useRouter();

  const allowedFeatures = FEATURE_PERMISSIONS[userTier] || FEATURE_PERMISSIONS.free;

  if (!allowedFeatures.includes(feature)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    // Redirect to pricing
    router.push("/pricing");
    return null;
  }

  return <>{children}</>;
}