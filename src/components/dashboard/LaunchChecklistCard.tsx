import type { Pet, PetDocument, PetVaccine } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUserProfile } from "@/hooks/useUserProfile";
import { trackEvent } from "@/lib/telemetryClient";

type ChecklistItem = {
  key: string;
  title: string;
  description: string;
  done: boolean;
  ctaLabel: string;
  ctaTo: string;
};

export function LaunchChecklistCard({
  pet,
  docs,
  vaccines,
}: {
  pet: Pet;
  docs: PetDocument[];
  vaccines: PetVaccine[];
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useUserProfile(user?.uid);

  const items = useMemo<ChecklistItem[]>(() => {
    const hasPhoto = Boolean(String(pet.photoPath || "").trim());
    const hasMicrochip = Boolean(String(pet.microchipId || "").trim());
    const hasVetPhone = Boolean(String(pet.vetContact?.phone || "").trim() || String(pet.vetContact?.emergencyPhone || "").trim());
    const hasDoc = docs.length > 0;
    const hasVax = vaccines.length > 0;
    const protection = Boolean(pet.petProtection?.enabled);

    return [
      {
        key: "photo",
        title: "Foto identificativa",
        description: "Aiuta riconoscimento e scheda pubblica.",
        done: hasPhoto,
        ctaLabel: "Aggiungi foto",
        ctaTo: "/app/pets",
      },
      {
        key: "microchip",
        title: "Microchip",
        description: "Dato essenziale per identificazione rapida.",
        done: hasMicrochip,
        ctaLabel: "Inserisci microchip",
        ctaTo: "/app/pets",
      },
      {
        key: "vet",
        title: "Contatto veterinario",
        description: "Telefono pronto per emergenza.",
        done: hasVetPhone,
        ctaLabel: "Aggiungi contatto",
        ctaTo: "/app/pets",
      },
      {
        key: "documents",
        title: "Documenti",
        description: "Referti, ricette, analisi, certificati.",
        done: hasDoc,
        ctaLabel: "Carica documento",
        ctaTo: "/app/documents",
      },
      {
        key: "vaccines",
        title: "Vaccini",
        description: "Scadenze chiare e promemoria automatici.",
        done: hasVax,
        ctaLabel: "Aggiungi vaccino",
        ctaTo: "/app/vaccines",
      },
      {
        key: "protection",
        title: "Pet Protetto",
        description: "Attiva QR/ID e scheda pubblica solo quando sei pronto.",
        done: protection,
        ctaLabel: "Attiva protezione",
        ctaTo: "/app/pets",
      },
    ];
  }, [docs.length, pet.microchipId, pet.petProtection?.enabled, pet.photoPath, pet.vetContact?.emergencyPhone, pet.vetContact?.phone, vaccines.length]);

  const doneCount = items.filter((i) => i.done).length;
  const percent = Math.round((doneCount / items.length) * 100);
  const next = items.find((i) => !i.done) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist lancio</CardTitle>
        <CardDescription>Metti in sicurezza il profilo: meno attrito, più fiducia.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{percent}%</div>
          <div className="text-xs lp-muted">{doneCount}/{items.length} completati</div>
        </div>
        <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(var(--lp-ink),0.10)" }}>
          <div className="h-full" style={{ width: `${percent}%`, background: "linear-gradient(90deg, rgb(var(--lp-primary)) 0%, rgb(var(--lp-accent-1)) 100%)" }} />
        </div>

        <div className="mt-4 grid gap-2">
          {items.slice(0, 5).map((i) => (
            <button
              key={i.key}
              type="button"
              className="lp-panel px-3 py-2 text-left flex items-start justify-between gap-3"
              onClick={() => {
                if (i.done) return;
                void trackEvent({ uid: user?.uid, profile, event: "dashboard_checklist_cta", route: "/app/dashboard", props: { key: i.key, to: i.ctaTo } });
                navigate(i.ctaTo);
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {i.done ? (
                    <CheckCircle2 className="w-4 h-4" style={{ color: "rgb(var(--lp-accent-2))" }} />
                  ) : (
                    <Circle className="w-4 h-4" style={{ color: "rgb(var(--lp-muted))" }} />
                  )}
                  <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{i.title}</div>
                </div>
                <div className="text-xs lp-muted mt-1">{i.description}</div>
              </div>
              {!i.done ? <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--lp-muted))" }} /> : null}
            </button>
          ))}
        </div>

        {next ? (
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              className="lp-btn-primary"
              onClick={() => {
                void trackEvent({ uid: user?.uid, profile, event: "dashboard_checklist_cta", route: "/app/dashboard", props: { key: next.key, to: next.ctaTo } });
                navigate(next.ctaTo);
              }}
            >
              {next.ctaLabel}
            </button>
            <button
              type="button"
              className="lp-btn-secondary"
              onClick={() => {
                void trackEvent({ uid: user?.uid, profile, event: "dashboard_checklist_cta", route: "/app/dashboard", props: { key: "pets", to: "/app/pets" } });
                navigate("/app/pets");
              }}
            >
              Apri profilo pet
            </button>
          </div>
        ) : (
          <div className="mt-3 text-sm" style={{ color: "rgb(var(--lp-ink))" }}>Ottimo: profilo pronto.</div>
        )}
      </CardContent>
    </Card>
  );
}
