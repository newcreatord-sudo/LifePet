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

export default function AiSymptoms() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const pets = usePetStore((s) => s.pets);
  const navigate = useNavigate();

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const [lastError, setLastError] = useState<string | null>(null);

  const missingKey = Boolean(lastError && /AI_GATEWAY_API_KEY|OPENAI_API_KEY|missing/i.test(lastError));
  const authMisconfigured = Boolean(lastError && (/FIREBASE_PROJECT_ID/i.test(lastError) || /Auth\s+non\s+configurata/i.test(lastError)));
  const quotaExceeded = Boolean(lastError && (/\b429\b/.test(lastError) || /exceeded\s+your\s+current\s+quota/i.test(lastError) || /billing/i.test(lastError)));

  if (!user || !activePetId) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI" description={activePet ? `Pet attivo: ${activePet.name}` : "Seleziona un pet"} imageAlt="AI" />
        <AiTopNav active="symptoms" />
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
      <PageHeader title="AI Sintomi" description={activePet ? `Checklist e domande per ${activePet.name}` : "Checklist e domande"} imageAlt="AI Sintomi" />
      <AiTopNav active="symptoms" />

      <AiSafetyBanner mode="symptoms" />

      {lastError ? (
        <Alert variant="danger" title="Errore AI">
          {lastError}
          {authMisconfigured ? "\n\nAuth non configurata sul server: imposta su Vercel la variabile FIREBASE_PROJECT_ID, poi ridisponi." : ""}
          {missingKey ? "\n\nManca la chiave AI sul server (AI_GATEWAY_API_KEY oppure OPENAI_API_KEY)." : ""}
          {quotaExceeded ? "\n\nQuota esaurita o billing non attivo sul provider AI." : ""}
        </Alert>
      ) : null}

      <Card className="p-4">
        <AiChatWidget
          petId={activePetId}
          petName={activePet?.name || "Pet"}
          section="Sintomi"
          scopeKey={`ai:symptoms:${activePetId}`}
          quickPrompts={[
            { label: "Checklist", text: "Crea una checklist per le prossime 24 ore: cosa osservare e quali domande annotare." },
            { label: "Urgenza", text: "Aiutami a capire se è urgente: fammi domande mirate e dimmi quando è meglio chiamare subito un veterinario." },
            { label: "Visita", text: "Preparami un riepilogo da dire al veterinario: sintomi, durata, frequenza, cosa ho già osservato." },
          ]}
          enableAttachments={false}
          enableInsights
          onLastErrorChange={setLastError}
        />
      </Card>
    </div>
  );
}
