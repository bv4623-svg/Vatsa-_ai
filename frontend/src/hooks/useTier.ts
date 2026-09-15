import { useAuth } from "@/context/AuthContext";

export function useTier() {
  const { user } = useAuth();
  const tier = (user?.tier as string) || "free";

  return {
    tier,
    isPremium: tier === "premium" || tier === "pro",
    isPro: tier === "pro",
    isFree: tier === "free",
  };
}
