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

export default function AiPhoto() {
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
        <AiTopNav active="photo" />
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
      <PageHeader title="AI Foto" description={activePet ? `Analisi informativa immagini per ${activePet.name}` : "Analisi informativa"} imageAlt="AI Foto" />
      <AiTopNav active="photo" />

      <AiSafetyBanner mode="media" />

      <div className="lp-panel px-3 py-2 text-sm">
        <span className="lp-badge lp-badge-info">Privacy</span>
        <span className="ml-2">Carica solo immagini necessarie. Evita documenti personali o dati sensibili.</span>
      </div>

      {lastError ? <Alert variant="danger" title="Errore AI">{lastError}</Alert> : null}

      <Card className="p-4">
        <AiChatWidget
          petId={activePetId}
          petName={activePet?.name || "Pet"}
          section="Foto"
          scopeKey={`ai:photo:${activePetId}`}
          quickPrompts={[
            { label: "Cosa vedi", text: "Descrivi cosa vedi e indicami possibili segnali da monitorare. Se urgente, dimmelo chiaramente." },
            { label: "Domande", text: "Fammi 5 domande mirate per capire meglio il contesto." },
          ]}
          enableAttachments
          enableInsights
          onLastErrorChange={setLastError}
        />
      </Card>
    </div>
  );
}
