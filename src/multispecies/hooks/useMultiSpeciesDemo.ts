import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { ensureMultiSpeciesDemoSeed } from "@/multispecies/demo/seedMultiSpeciesDemo";
import { runMultiSpeciesDemoTick } from "@/multispecies/demo/simulator";
import { useMsUiStore } from "@/multispecies/stores/msUiStore";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { ensureSeed, simTick } from "@/multispecies/data/msData";

export function useMultiSpeciesDemo() {
  const user = useAuthStore((s) => s.user);
  const simRunning = useMsUiStore((s) => s.simRunning);
  const simIntensity = useMsUiStore((s) => s.simIntensity);

  useEffect(() => {
    if (shouldUseDemoData()) {
      const uid = user?.uid || "demo";
      ensureMultiSpeciesDemoSeed(uid);
      return;
    }
    if (!user?.uid) return;
    void ensureSeed(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    if (!simRunning) return;
    const tick = () => {
      if (shouldUseDemoData()) {
        runMultiSpeciesDemoTick({ intensity: simIntensity });
        return;
      }
      if (!user?.uid) return;
      void simTick(user.uid, simIntensity);
    };
    tick();
    const id = window.setInterval(tick, shouldUseDemoData() ? 2400 : 5000);
    return () => window.clearInterval(id);
  }, [simIntensity, simRunning, user?.uid]);
}
