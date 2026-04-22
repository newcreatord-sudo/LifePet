import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiChatWidget } from "@/components/AiChatWidget";
import { AiTopNav } from "@/components/ai/AiTopNav";
import { AiSafetyBanner } from "@/components/ai/AiSafetyBanner";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";

export default function AiChat() {
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
        <AiTopNav active="chat" />
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
      <PageHeader title="AI" description={activePet ? `Chat per ${activePet.name}` : "Chat"} imageAlt="AI" />
      <AiTopNav active="chat" />

      <AiSafetyBanner mode="general" />

      {lastError ? (
        <Alert variant="danger" title="Errore AI">
          {lastError}
          {authMisconfigured ? "\n\nAuth non configurata sul server: imposta su Vercel la variabile FIREBASE_PROJECT_ID (es. lifepet-3c2195d42c1e), poi ridisponi." : ""}
          {missingKey ? "\n\nManca la configurazione della chiave AI sul server. Aggiungi su Vercel una variabile AI_GATEWAY_API_KEY oppure OPENAI_API_KEY, poi ridisponi." : ""}
          {quotaExceeded ? "\n\nQuota esaurita o billing non attivo sul provider AI. Attiva credito/billing, poi riprova." : ""}
          {missingKey || authMisconfigured ? (
            <div className="mt-3">
              <Link to="/app/system" className="lp-btn-secondary">Apri stato sistema</Link>
            </div>
          ) : null}
        </Alert>
      ) : null}

      <Card className="p-4">
        <AiChatWidget
          petId={activePetId}
          petName={activePet?.name || "Pet"}
          section="AI"
          scopeKey={`ai:chat:${activePetId}`}
          quickPrompts={[
            { label: "Visita", text: "Crea un riepilogo per la visita: cosa dire e cosa chiedere." },
            { label: "Documenti", text: "Quali documenti essenziali dovrei caricare per essere pronto in emergenza?" },
            { label: "Routine", text: "Suggeriscimi una routine semplice per i prossimi 7 giorni (promemoria, scadenze, visite)." },
          ]}
          enableAttachments={false}
          enableInsights
          onLastErrorChange={setLastError}
        />
      </Card>
    </div>
  );
}
