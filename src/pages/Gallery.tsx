import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ContentPageTemplate } from "@/components/ContentPageTemplate";
import { Modal } from "@/components/ui/Modal";
import { SmartImage } from "@/components/ui/SmartImage";
import { getFeatureImage, getLocalFallbackImageFromSeed, type FeatureImageKey } from "@/lib/marketingImages";

type Item = { key: FeatureImageKey; title: string; description: string };

export default function Gallery() {
  const items = useMemo<Item[]>(
    () => [
      { key: "dashboard", title: "Dashboard", description: "Panoramica e azioni rapide." },
      { key: "planner", title: "Planner", description: "Task e routine." },
      { key: "agenda", title: "Agenda", description: "Eventi e appuntamenti." },
      { key: "health", title: "Salute", description: "Eventi, note e checklist." },
      { key: "records", title: "Cartella clinica", description: "Timeline e condivisione." },
      { key: "documents", title: "Documenti", description: "Upload e gestione allegati." },
      { key: "gps", title: "GPS", description: "Posizione e zone." },
      { key: "nearby", title: "Vicino a te", description: "Mappa e luoghi utili." },
      { key: "expenses", title: "Spese", description: "Budget e trend." },
      { key: "community", title: "Community", description: "Post e gruppi." },
      { key: "marketplace", title: "Marketplace", description: "Annunci e scambi." },
      { key: "training", title: "Training", description: "Percorsi e progressi." },
      { key: "ai", title: "AI", description: "Chat e strumenti." },
      { key: "notifications", title: "Notifiche", description: "Centro notifiche." },
      { key: "settings", title: "Impostazioni", description: "Preferenze e profilo." },
      { key: "vaccines", title: "Vaccini", description: "Scadenze e richiami." },
      { key: "nutrition", title: "Nutrizione", description: "Pasti e stime." },
      { key: "medications", title: "Terapie", description: "Farmaci e promemoria." },
      { key: "explore", title: "Esplora", description: "Indice funzioni." },
      { key: "insights", title: "Insight", description: "Riepiloghi e trend." },
      { key: "vision", title: "Foto", description: "Analisi immagini." },
      { key: "video", title: "Video", description: "Analisi video." },
      { key: "pets", title: "Pet", description: "Profilo e dati." },
      { key: "bookings", title: "Prenotazioni", description: "Appuntamenti e servizi." },
      { key: "adoptions", title: "Adozioni", description: "Cerca e pubblica." },
      { key: "moderation", title: "Moderazione", description: "Segnalazioni." },
      { key: "provider", title: "Professionisti", description: "Console e servizi." },
    ],
    []
  );

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);

  return (
    <div className="space-y-6">
      <ContentPageTemplate
        title="Galleria"
        description="Immagini reali con fallback e caricamento progressivo."
        imageSeed="Galleria"
        whatYouCanDo={["Verificare che le immagini siano visibili", "Aprire un dettaglio", "Vedere fallback quando serve"]}
        quickSteps={[
          { title: "Scorri la griglia", detail: "Le immagini caricano con skeleton e poi cover." },
          { title: "Apri un dettaglio", detail: "Click su una card per vedere l’immagine in grande." },
          { title: "Test fallback", detail: "Se un provider blocca l’immagine, compare un fallback locale." },
        ]}
      >
        <Card>
          <CardHeader>
            <CardTitle>Immagini</CardTitle>
            <CardDescription>Seleziona una sezione per vedere un’anteprima.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((it) => {
                const src = getFeatureImage(it.key);
                const fallback = getLocalFallbackImageFromSeed(it.key);
                return (
                  <button
                    key={it.key}
                    type="button"
                    className="text-left group"
                    onClick={() => {
                      setSelected(it);
                      setOpen(true);
                    }}
                  >
                    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
                      <SmartImage
                        src={src}
                        fallbackSrc={fallback}
                        alt={it.title}
                        className="w-full aspect-[16/9]"
                        imgClassName="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                      <div className="p-4">
                        <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{it.title}</div>
                        <div className="text-xs mt-1" style={{ color: "rgb(var(--lp-muted))" }}>{it.description}</div>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </ContentPageTemplate>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setSelected(null);
        }}
        title={selected?.title ?? "Dettaglio"}
      >
        {selected ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(var(--lp-ink),0.10)" }}>
              <SmartImage
                src={getFeatureImage(selected.key)}
                fallbackSrc={getLocalFallbackImageFromSeed(selected.key)}
                alt={selected.title}
                className="w-full aspect-[16/9]"
                imgClassName="w-full h-full object-cover"
                loading="eager"
              />
            </div>
            <div className="text-sm" style={{ color: "rgb(var(--lp-muted))" }}>{selected.description}</div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

