import { ChevronDown, Plus, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { usePetStore } from "@/stores/petStore";
import { usePetCreateStore } from "@/stores/petCreateStore";
import type { Pet } from "@/types";
import { cn } from "@/lib/utils";
import { PetAvatar } from "@/components/PetAvatar";

export function PetSwitcher({ pets, activePet }: { pets: Pet[]; activePet: Pet | null }) {
  const setActivePetId = usePetStore((s) => s.setActivePetId);
  const openCreatePet = usePetCreateStore((s) => s.openDialog);
  const [open, setOpen] = useState(false);
  const label = useMemo(() => activePet?.name ?? "Seleziona un pet", [activePet]);
  const protectedEnabled = Boolean(activePet?.petProtection?.enabled);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-2xl px-3 py-2 bg-white/70 border border-slate-200/70 hover:bg-white"
      >
        <div className="flex items-center gap-3 text-left">
          <PetAvatar photoPath={activePet?.photoPath} name={activePet?.name} className="w-9 h-9 rounded-xl" />
          <div>
            <div className="text-xs text-slate-400">Pet attivo</div>
            <div className="text-sm font-medium flex items-center gap-2">
              {label}
              {protectedEnabled ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: "rgba(var(--lp-primary),0.10)", border: "1px solid rgba(var(--lp-primary),0.18)", color: "rgb(var(--lp-primary-700))" }}>
                  <Shield className="w-3 h-3" />
                  Protetto
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-600" />
      </button>

      {open ? (
        <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slate-200/70 bg-white shadow-xl overflow-hidden">
          <div className="max-h-72 overflow-auto">
            {pets.length === 0 ? (
              <div className="p-3 text-sm text-slate-400">Nessun pet ancora. Creane uno in 30 secondi.</div>
            ) : (
              pets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePetId(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-slate-100",
                    activePet?.id === p.id ? "bg-slate-100" : ""
                  )}
                >
                  <div className="flex items-center gap-3">
                    <PetAvatar photoPath={p.photoPath} name={p.name} className="w-9 h-9 rounded-xl" />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {p.name}
                        {p.petProtection?.enabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: "rgba(var(--lp-primary),0.10)", border: "1px solid rgba(var(--lp-primary),0.18)", color: "rgb(var(--lp-primary-700))" }}>
                            <Shield className="w-3 h-3" />
                            Protetto
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-400">{p.species}{p.breed ? ` · ${p.breed}` : ""}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-slate-200/70 p-2">
            <button
              type="button"
              className="w-full rounded-xl px-3 py-2 text-sm font-medium flex items-center justify-center gap-2"
              style={{ backgroundColor: "rgba(var(--lp-primary),0.10)", border: "1px solid rgba(var(--lp-primary),0.18)", color: "rgb(var(--lp-primary-700))" }}
              onClick={() => {
                setOpen(false);
                openCreatePet();
              }}
            >
              <Plus className="w-4 h-4" />
              Crea pet
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
