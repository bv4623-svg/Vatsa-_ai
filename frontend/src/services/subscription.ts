import api from "./api";
import { API } from "@/config/api";

export const subscriptionApi = {
  getPlans: () => api.get(API.SUBSCRIPTION_PLANS),
  getMySub: () => api.get(API.SUBSCRIPTION_ME),
  createOrder: (tier: string) =>
    api.post(API.SUBSCRIPTION_CREATE_ORDER, null, { params: { tier } }),
  verify: (payload: any) => api.post(API.SUBSCRIPTION_VERIFY, payload),
};
