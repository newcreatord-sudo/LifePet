import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { WalksSocialMap } from "@/components/WalksSocialMap";
import { NearbyPanel } from "@/components/nearby/NearbyPanel";

type Tab = "walks" | "nearby";

export function MapHubModal({ open, onClose, initialTab }: { open: boolean; onClose: () => void; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [initialTab, open]);

  return (
    <Modal
      open={open}
      title="Mappa"
      description="Passeggiate e servizi vicino a te."
      onClose={onClose}
      panelClassName="max-w-6xl"
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" className={cn(tab === "walks" ? "lp-chip lp-chip-active" : "lp-chip")} onClick={() => setTab("walks")}>
          Passeggiate
        </button>
        <button type="button" className={cn(tab === "nearby" ? "lp-chip lp-chip-active" : "lp-chip")} onClick={() => setTab("nearby")}>
          Servizi vicini
        </button>
      </div>

      <div className="mt-4 max-h-[72vh] overflow-auto pr-1">
        {tab === "walks" ? <WalksSocialMap /> : <NearbyPanel mapMode="inline" />}
      </div>
    </Modal>
  );
}
