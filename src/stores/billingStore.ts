import { create } from "zustand";
import { getBillingStatus, type BillingStatus } from "@/data/billing";

type BillingState = {
  status: BillingStatus | null;
  loading: boolean;
  error: string | null;
  lastLoadedAt: number;
  refresh: (opts?: { force?: boolean }) => Promise<BillingStatus | null>;
  clear: () => void;
};

export const useBillingStore = create<BillingState>((set, get) => ({
  status: null,
  loading: false,
  error: null,
  lastLoadedAt: 0,
  refresh: async (opts) => {
    const force = Boolean(opts?.force);
    const { loading, lastLoadedAt } = get();
    if (loading) return get().status;
    if (!force && lastLoadedAt && Date.now() - lastLoadedAt < 30_000) return get().status;
    set({ loading: true, error: null });
    try {
      const status = await getBillingStatus();
      set({ status, loading: false, lastLoadedAt: Date.now() });
      return status;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Billing status failed";
      set({ loading: false, error: message, lastLoadedAt: Date.now() });
      return get().status;
    }
  },
  clear: () => set({ status: null, loading: false, error: null, lastLoadedAt: 0 }),
}));

