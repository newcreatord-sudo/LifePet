import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiTopNav } from "@/components/ai/AiTopNav";
import { AiSafetyBanner } from "@/components/ai/AiSafetyBanner";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { AiSavesPanel } from "@/pages/AiSaves";

export default function AiSavesPage() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const pets = usePetStore((s) => s.pets);
  const navigate = useNavigate();

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  if (!user || !activePetId) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI" description={activePet ? `Pet attivo: ${activePet.name}` : "Seleziona un pet"} imageAlt="AI" />
        <AiTopNav active="saves" />
        <Card className="p-4">
          <div className="text-sm font-semibold">Per vedere i salvataggi serve un pet selezionato</div>
          <div className="text-xs lp-muted mt-1">Apri “Profilo Pet”, crea o seleziona un pet, poi torna qui.</div>
          <div className="mt-3">
            <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/pets")}>Apri profilo pet</button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AI Salvataggi" description={activePet ? `Storico AI per ${activePet.name}` : "Storico AI"} imageAlt="AI Salvataggi" />
      <AiTopNav active="saves" />
      <AiSafetyBanner mode="general" />
      <AiSavesPanel embedded />
    </div>
  );
}
