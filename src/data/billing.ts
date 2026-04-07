import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";

export type BillingStatus = {
  billingEnabled: boolean;
  betaProEnabled: boolean;
  betaProUntilMs: number | null;
  plan: "free" | "pro";
  effectivePlan: "free" | "pro";
};

export async function getBillingStatus() {
  if (shouldUseDemoData()) {
    return {
      billingEnabled: false,
      betaProEnabled: true,
      betaProUntilMs: null,
      plan: "pro",
      effectivePlan: "pro",
    } satisfies BillingStatus;
  }
  const fn = httpsCallable(getFirebase().functions, "billingStatus");
  const res = await fn({});
  return res.data as BillingStatus;
}

export async function billingCreateCheckoutSession() {
  const fn = httpsCallable(getFirebase().functions, "billingCreateCheckoutSession");
  const res = await fn({});
  return res.data as { url: string };
}

export async function billingCreatePortalSession() {
  const fn = httpsCallable(getFirebase().functions, "billingCreatePortalSession");
  const res = await fn({});
  return res.data as { url: string };
}

