import { useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePetStore } from "@/stores/petStore";
import { PetProtectionCard } from "@/components/pets/PetProtectionCard";
import { uxCopy } from "@/lib/uxCopy";
import { subscribeSafetyEvents } from "@/data/safetyEvents";
import type { SafetyEvent } from "@/types";

export default function Protection() {
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const [events, setEvents] = useState<SafetyEvent[]>([]);

  const pet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  useEffect(() => {
    if (!activePetId) {
      setEvents([]);
      return;
    }
    const unsub = subscribeSafetyEvents(activePetId, setEvents);
    return () => unsub();
  }, [activePetId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={uxCopy.protection.headerTitle}
        description={uxCopy.protection.headerDescription}
        imagePrompt="minimal clean illustration, shield with paw icon and QR code card, white background, soft premium, no text, no watermark"
        imageAlt="Protezione"
      />

      {!pet ? (
        <EmptyState title={uxCopy.protection.selectPetTitle} description={uxCopy.protection.selectPetDescription} />
      ) : (
        <div className="space-y-4">
          <div className="lp-panel p-4">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 lp-icon-primary" />
              <div>
                <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>
                  {uxCopy.protection.trustTitle}
                </div>
                <div className="text-xs lp-muted mt-1">
                  {uxCopy.protection.trustBody}
                </div>
              </div>
            </div>
          </div>

          <PetProtectionCard pet={pet} />

          <div className="lp-panel p-4">
            <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>
              Cronologia
            </div>
            <div className="text-xs lp-muted mt-1">Eventi e segnalazioni recenti relativi a sicurezza e ritrovamento.</div>
            <div className="mt-3 space-y-2">
              {events.length === 0 ? (
                <div className="text-sm lp-muted">Nessun evento recente.</div>
              ) : (
                events.slice(0, 10).map((e) => (
                  <div key={e.id} className="lp-card px-3 py-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>
                        {e.summary || e.type}
                      </div>
                      <div className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                        {new Date(e.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {e.related?.publicId ? (
                      <div className="text-[11px] lp-muted shrink-0">ID {e.related.publicId}</div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
