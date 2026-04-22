import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Utensils } from "lucide-react";

export function PetFoodCard({
  foodLabel,
  setFoodLabel,
  foodKcalPerG,
  setFoodKcalPerG,
  foodNotes,
  setFoodNotes,
  dietNotes,
  setDietNotes,
}: {
  foodLabel: string;
  setFoodLabel: (v: string) => void;
  foodKcalPerG: string;
  setFoodKcalPerG: (v: string) => void;
  foodNotes: string;
  setFoodNotes: (v: string) => void;
  dietNotes: string;
  setDietNotes: (v: string) => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="lp-card-accent" aria-hidden="true" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Alimentazione</CardTitle>
            <CardDescription>Serve per quantità, reminder e storico.</CardDescription>
          </div>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(var(--lp-accent-2),0.10)", border: "1px solid rgba(var(--lp-accent-2),0.22)" }}>
            <Utensils className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs lp-muted mb-1">Cibo (nome)</div>
            <input value={foodLabel} onChange={(e) => setFoodLabel(e.target.value)} className="lp-input" placeholder="Marca / linea" />
          </label>
          <label className="block">
            <div className="text-xs lp-muted mb-1">Kcal per grammo</div>
            <input value={foodKcalPerG} onChange={(e) => setFoodKcalPerG(e.target.value)} inputMode="decimal" className="lp-input" placeholder="Es. 3,6" />
          </label>
          <label className="block md:col-span-2">
            <div className="text-xs lp-muted mb-1">Note cibo</div>
            <input value={foodNotes} onChange={(e) => setFoodNotes(e.target.value)} className="lp-input" placeholder="Es. senza cereali" />
          </label>
          <label className="block md:col-span-2">
            <div className="text-xs lp-muted mb-1">Note alimentazione</div>
            <textarea value={dietNotes} onChange={(e) => setDietNotes(e.target.value)} rows={4} className="lp-textarea" placeholder="Quantità, orari, intolleranze…" />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

