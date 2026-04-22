import { useEffect } from "react";
import { usePetStore } from "@/stores/petStore";
import { ContentPageTemplate } from "@/components/ContentPageTemplate";
import { usePetCreateStore } from "@/stores/petCreateStore";

export function RequireActivePet({ children }: { children: React.ReactNode }) {
  const activePetId = usePetStore((s) => s.activePetId);
  const setActivePetId = usePetStore((s) => s.setActivePetId);
  const openCreatePet = usePetCreateStore((s) => s.openDialog);

  let stored: string | null = null;
  try {
    stored = localStorage.getItem("lifepet:activePetId");
  } catch {
    stored = null;
  }

  useEffect(() => {
    if (activePetId) return;
    if (stored) setActivePetId(stored);
  }, [activePetId, setActivePetId, stored]);

  if (activePetId) return <>{children}</>;

  if (stored) {
    return (
      <div className="lp-surface p-5">
        <div className="text-sm text-slate-700">Caricamento pet…</div>
      </div>
    );
  }

  return (
    <ContentPageTemplate
      title="Serve un pet attivo"
      description="Questa sezione usa dati e promemoria del tuo animale. Crealo o selezionalo e riprova."
      imageSeed="pets"
      primaryAction={{
        label: "Crea pet",
        onClick: openCreatePet,
        variant: "primary",
      }}
      secondaryAction={{ label: "Gestisci pet", to: "/app/pets", variant: "secondary" }}
      whatYouCanDo={["Creare un profilo pet", "Aggiungere peso, età e note", "Sbloccare salute, agenda, AI e promemoria"]}
      quickSteps={[
        { title: "Crea o seleziona", detail: "Apri la lista pet e scegli quello attivo." },
        { title: "Completa i dati base", detail: "Peso e data di nascita migliorano stime e reminder." },
        { title: "Torna qui", detail: "Le pagine non saranno più vuote: vedrai contenuti e azioni." },
      ]}
    >
    </ContentPageTemplate>
  );
}
