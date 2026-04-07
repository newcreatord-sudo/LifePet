import { ChevronDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { usePetStore } from "@/stores/petStore";
import type { Pet } from "@/types";
import { cn } from "@/lib/utils";
import { PetAvatar } from "@/components/PetAvatar";

export function PetSwitcher({ pets, activePet }: { pets: Pet[]; activePet: Pet | null }) {
  const setActivePetId = usePetStore((s) => s.setActivePetId);
  const [open, setOpen] = useState(false);
  const label = useMemo(() => activePet?.name ?? "Select a pet", [activePet]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-2xl px-3 py-2 bg-slate-900/60 border border-slate-800 hover:bg-slate-900"
      >
        <div className="flex items-center gap-3 text-left">
          <PetAvatar photoPath={activePet?.photoPath} name={activePet?.name} className="w-9 h-9 rounded-xl" />
          <div>
            <div className="text-xs text-slate-400">Active pet</div>
            <div className="text-sm font-medium">{label}</div>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-300" />
      </button>

      {open ? (
        <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 shadow-xl overflow-hidden">
          <div className="max-h-72 overflow-auto">
            {pets.length === 0 ? (
              <div className="p-3 text-sm text-slate-400">No pets yet. Create one from Dashboard.</div>
            ) : (
              pets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePetId(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-slate-900",
                    activePet?.id === p.id ? "bg-slate-900" : ""
                  )}
                >
                  <div className="flex items-center gap-3">
                    <PetAvatar photoPath={p.photoPath} name={p.name} className="w-9 h-9 rounded-xl" />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.species}{p.breed ? ` · ${p.breed}` : ""}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-slate-800 p-2">
            <div className="flex items-center gap-2 text-xs text-slate-400 px-2 py-1">
              <Plus className="w-3 h-3" />
              Create pets from Dashboard
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
