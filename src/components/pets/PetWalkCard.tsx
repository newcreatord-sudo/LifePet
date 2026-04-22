import type { Pet } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { MapPinned } from "lucide-react";

function badgeStyle(badge: NonNullable<Pet["walkBadge"]>) {
  if (badge === "red") return { border: "1px solid rgba(var(--lp-danger),0.28)", backgroundColor: "rgba(var(--lp-danger),0.10)" };
  if (badge === "yellow") return { border: "1px solid rgba(var(--lp-warn),0.30)", backgroundColor: "rgba(var(--lp-warn),0.12)" };
  return { border: "1px solid rgba(var(--lp-accent-2),0.28)", backgroundColor: "rgba(var(--lp-accent-2),0.12)" };
}

export function PetWalkCard({
  walkBadge,
  setWalkBadge,
  walkVisible,
  setWalkVisible,
}: {
  walkBadge: NonNullable<Pet["walkBadge"]>;
  setWalkBadge: (v: NonNullable<Pet["walkBadge"]>) => void;
  walkVisible: boolean;
  setWalkVisible: (v: boolean) => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="lp-card-accent" aria-hidden="true" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Passeggiate</CardTitle>
            <CardDescription>Bollino + visibilità durante le uscite in mappa.</CardDescription>
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(var(--lp-accent-1),0.10)", border: "1px solid rgba(var(--lp-accent-1),0.22)" }}>
            <MapPinned className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <label className="block">
            <div className="text-xs lp-muted mb-1">Bollino temperamento</div>
            <select value={walkBadge} onChange={(e) => setWalkBadge(e.target.value as NonNullable<Pet["walkBadge"]>)} className="lp-select">
              <option value="green">Verde (socievole)</option>
              <option value="yellow">Giallo (prudenza)</option>
              <option value="red">Rosso (spazio)</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 lp-panel px-3 py-2 text-sm">
            <div>
              Visibile in mappa durante passeggiata
              <div className="text-[11px]" style={{ color: "rgb(var(--lp-muted))" }}>Solo quando sei in passeggiata.</div>
            </div>
            <input type="checkbox" checked={walkVisible} onChange={(e) => setWalkVisible(e.target.checked)} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="lp-badge" style={badgeStyle(walkBadge)}>
            {walkBadge === "green" ? "Verde" : walkBadge === "yellow" ? "Giallo" : "Rosso"}
          </span>
          <span className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
            {walkBadge === "green"
              ? "Ok con altri cani/persone"
              : walkBadge === "yellow"
                ? "Avvicinarsi con cautela"
                : "Serve spazio"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
