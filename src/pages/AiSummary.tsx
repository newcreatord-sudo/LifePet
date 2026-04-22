import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiChatWidget } from "@/components/AiChatWidget";
import { AiTopNav } from "@/components/ai/AiTopNav";
import { AiSafetyBanner } from "@/components/ai/AiSafetyBanner";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";

export default function AiSummary() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const pets = usePetStore((s) => s.pets);
  const navigate = useNavigate();

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const [lastError, setLastError] = useState<string | null>(null);

  if (!user || !activePetId) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI" description={activePet ? `Pet attivo: ${activePet.name}` : "Seleziona un pet"} imageAlt="AI" />
        <AiTopNav active="summary" />
        <Card className="p-4">
          <div className="text-sm font-semibold">Per usare l’AI serve un pet selezionato</div>
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
      <PageHeader title="AI Riepilogo" description={activePet ? `Sintesi informativa per ${activePet.name}` : "Sintesi informativa"} imageAlt="AI Riepilogo" />
      <AiTopNav active="summary" />

      <AiSafetyBanner mode="general" />

      <div className="lp-panel px-3 py-2 text-sm">
        <span className="lp-badge lp-badge-info">Focus</span>
        <span className="ml-2">Riassunto pratico: cosa monitorare, cosa fare oggi, cosa preparare per il vet.</span>
      </div>

      {lastError ? <Alert variant="danger" title="Errore AI">{lastError}</Alert> : null}

      <Card className="p-4">
        <AiChatWidget
          petId={activePetId}
          petName={activePet?.name || "Pet"}
          section="Riepilogo"
          scopeKey={`ai:summary:${activePetId}`}
          quickPrompts={[
            { label: "Oggi", text: "Dammi 3 azioni pratiche e sicure per oggi (routine/salute/prevenzione)." },
            { label: "Settimana", text: "Crea un piano semplice per i prossimi 7 giorni (2-3 azioni al giorno)." },
            { label: "Vet", text: "Se dovessi chiamare il vet, cosa dovrei dire e quali dati portare?" },
          ]}
          enableAttachments={false}
          enableInsights
          onLastErrorChange={setLastError}
        />
      </Card>
    </div>
  );
}
