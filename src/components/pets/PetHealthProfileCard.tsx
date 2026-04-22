import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { HeartPulse } from "lucide-react";

export function PetHealthProfileCard({
  allergies,
  setAllergies,
  conditions,
  setConditions,
  medications,
  setMedications,
}: {
  allergies: string;
  setAllergies: (v: string) => void;
  conditions: string;
  setConditions: (v: string) => void;
  medications: string;
  setMedications: (v: string) => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="lp-card-accent" aria-hidden="true" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Profilo salute</CardTitle>
            <CardDescription>Allergie, condizioni e terapie in corso.</CardDescription>
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(var(--lp-primary),0.10)", border: "1px solid rgba(var(--lp-primary),0.22)" }}>
            <HeartPulse className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs lp-muted mb-1">Allergie (separate da virgola)</div>
            <input value={allergies} onChange={(e) => setAllergies(e.target.value)} className="lp-input" placeholder="pollo, polline" />
          </label>
          <label className="block">
            <div className="text-xs lp-muted mb-1">Condizioni (separate da virgola)</div>
            <input value={conditions} onChange={(e) => setConditions(e.target.value)} className="lp-input" placeholder="dermatite, artrite" />
          </label>
          <label className="block md:col-span-2">
            <div className="text-xs lp-muted mb-1">Farmaci (separati da virgola)</div>
            <input value={medications} onChange={(e) => setMedications(e.target.value)} className="lp-input" placeholder="nome farmaco, dose" />
          </label>
          <div className="md:col-span-2 lp-panel p-3">
            <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Consiglio</div>
            <div className="text-xs mt-1" style={{ color: "rgb(var(--lp-muted))" }}>
              Per terapie e richiami usa anche le sezioni Terapie/Vaccini: qui resta un riepilogo sempre visibile.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

