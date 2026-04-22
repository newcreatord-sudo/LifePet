import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { AiChatWidget } from "@/components/AiChatWidget";
import { useAiPanelStore } from "@/stores/aiPanelStore";

function routeLabel(pathname: string) {
  if (pathname.startsWith("/app/dashboard")) return "Dashboard";
  if (pathname.startsWith("/app/notifications")) return "Notifiche";
  if (pathname.startsWith("/app/status")) return "Status";
  if (pathname.startsWith("/app/pets")) return "Profilo Pet";
  if (pathname.startsWith("/app/health")) return "Salute";
  if (pathname.startsWith("/app/records")) return "Cartella clinica";
  if (pathname.startsWith("/app/documents")) return "Documenti";
  if (pathname.startsWith("/app/medications")) return "Terapie";
  if (pathname.startsWith("/app/vaccines")) return "Vaccini";
  if (pathname.startsWith("/app/nutrition")) return "Alimentazione";
  if (pathname.startsWith("/app/wellness")) return "Benessere";
  if (pathname.startsWith("/app/agenda")) return "Agenda";
  if (pathname.startsWith("/app/planner")) return "Planner";
  if (pathname.startsWith("/app/training")) return "Training";
  if (pathname.startsWith("/app/bookings")) return "Prenotazioni";
  if (pathname.startsWith("/app/provider")) return "Console pro";
  if (pathname.startsWith("/app/gps")) return "GPS";
  if (pathname.startsWith("/app/expenses")) return "Spese";
  if (pathname.startsWith("/app/community")) return "Community";
  if (pathname.startsWith("/app/marketplace")) return "Marketplace";
  if (pathname.startsWith("/app/settings")) return "Impostazioni";
  return "App";
}

export function AiAssistFab() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const location = useLocation();
  const navigate = useNavigate();

  const pet = useMemo(() => pets.find((p) => p.id === activePetId) ?? pets[0] ?? null, [activePetId, pets]);
  const section = useMemo(() => routeLabel(location.pathname), [location.pathname]);

  const open = useAiPanelStore((s) => s.open);
  const openPanel = useAiPanelStore((s) => s.openPanel);
  const closePanel = useAiPanelStore((s) => s.closePanel);
  const draft = useAiPanelStore((s) => s.draft);
  const consumeDraft = useAiPanelStore((s) => s.consumeDraft);

  const canUse = Boolean(user && pet && activePetId);
  const quick = useMemo(() => {
    const items: Array<{ label: string; text: string }> = [
      { label: "Consigli rapidi", text: "Dammi consigli rapidi e sicuri per migliorare oggi." },
      { label: "Checklist 24h", text: "Crea una checklist per le prossime 24 ore." },
      { label: "Domande da fare", text: "Quali domande devo preparare per il veterinario?" },
    ];
    if (section === "Alimentazione") items.unshift({ label: "Piano pasti", text: "Suggerisci un piano pasti e quantità indicative." });
    if (section === "Training") items.unshift({ label: "Piano step-by-step", text: "Crea un piano training step-by-step." });
    if (section === "Spese") items.unshift({ label: "Budget", text: "Suggerisci come ottimizzare il budget mensile senza rischi." });
    return items;
  }, [section]);

  return (
    <>
      <button
        type="button"
        onClick={() => openPanel()}
        aria-label="Apri assistente AI"
        data-testid="ai-fab"
        className="fixed right-4 bottom-32 lg:bottom-6 z-[56] lp-btn-primary rounded-full px-4 py-3 inline-flex items-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        AI
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => closePanel()} />
          <div className="absolute right-3 left-3 bottom-3 lg:right-6 lg:left-auto lg:bottom-6 lg:w-[480px]">
            <div className="rounded-2xl border border-slate-200/70 bg-white/95 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/70">
                <div>
                  <div className="text-sm font-semibold">AI · {section}</div>
                  <div className="text-xs text-slate-600">{pet ? `Pet: ${pet.name}` : "Seleziona un pet"}</div>
                </div>
                <button type="button" className="p-2 rounded-xl hover:bg-slate-100" onClick={() => closePanel()}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!canUse ? (
                <div className="p-4">
                  <div className="text-sm font-semibold">Per usare l’AI serve login e pet attivo</div>
                  <div className="text-xs text-slate-600 mt-1">Apri “Profilo Pet”, seleziona un pet, poi riprova.</div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="lp-btn-primary" onClick={() => navigate("/app/pets")}>
                      Apri profilo pet
                    </button>
                    <button type="button" className="lp-btn-secondary" onClick={() => closePanel()}>
                      Chiudi
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <AiChatWidget
                    petId={activePetId!}
                    petName={pet!.name}
                    section={section}
                    scopeKey={location.pathname}
                    quickPrompts={quick}
                    navigateOnSave
                    draft={draft}
                    onDraftConsumed={consumeDraft}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
