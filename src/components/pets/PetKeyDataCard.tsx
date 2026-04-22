import type { Pet } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { BadgeCheck, ClipboardCopy, FileText, PhoneCall, ShieldPlus, Syringe } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";
import { Link } from "react-router-dom";

function safeClipboardCopy(text: string) {
  const v = String(text || "").trim();
  if (!v) return Promise.reject(new Error("Vuoto"));
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(v);
  const el = document.createElement("textarea");
  el.value = v;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.focus();
  el.select();
  const ok = document.execCommand("copy");
  el.remove();
  return ok ? Promise.resolve() : Promise.reject(new Error("Copia fallita"));
}

function fmtDob(dob?: string) {
  const s = String(dob || "").trim();
  if (!s) return "—";
  const ms = new Date(s).getTime();
  if (!Number.isFinite(ms)) return s;
  return new Date(ms).toLocaleDateString();
}

export function PetKeyDataCard({
  pet,
  docsCount,
  vaccinesCount,
}: {
  pet: Pet;
  docsCount: number;
  vaccinesCount: number;
}) {
  const pushToast = useToastStore((s) => s.push);
  const micro = String(pet.microchipId || "").trim();
  const vetPhone = String(pet.vetContact?.phone || "").trim();
  const emergency = String(pet.vetContact?.emergencyPhone || "").trim();
  const protectionOn = Boolean(pet.petProtection?.enabled);

  return (
    <Card className="relative overflow-hidden">
      <div className="lp-card-accent" aria-hidden="true" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Dati chiave</CardTitle>
            <CardDescription>Le informazioni che servono davvero in emergenza.</CardDescription>
          </div>
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(var(--lp-primary),0.10)", border: "1px solid rgba(var(--lp-primary),0.22)" }}
          >
            <BadgeCheck className="w-5 h-5" style={{ color: "rgb(var(--lp-primary-700))" }} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="lp-panel p-3">
            <div className="text-xs lp-muted">Microchip</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{micro || "—"}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="lp-btn-secondary inline-flex items-center gap-2"
                disabled={!micro}
                onClick={() => {
                  void safeClipboardCopy(micro)
                    .then(() => pushToast({ type: "success", title: "Microchip", message: "Copiato." }))
                    .catch(() => pushToast({ type: "error", title: "Microchip", message: "Impossibile copiare." }));
                }}
              >
                <ClipboardCopy className="w-4 h-4" />
                Copia
              </button>
              <Link to="/app/documents" className="lp-btn-secondary inline-flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documenti ({docsCount})
              </Link>
            </div>
            {!micro ? <div className="mt-2 text-[11px]" style={{ color: "rgb(var(--lp-warning))" }}>Consiglio: aggiungilo per identificazione rapida.</div> : null}
          </div>

          <div className="lp-panel p-3">
            <div className="text-xs lp-muted">Veterinario</div>
            <div className="mt-1 text-sm font-semibold truncate" style={{ color: "rgb(var(--lp-ink))" }}>
              {pet.vetContact?.clinicName ? pet.vetContact.clinicName : "—"}
            </div>
            <div className="mt-1 text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
              {vetPhone ? `Tel: ${vetPhone}` : "Telefono non impostato"}
              {emergency ? ` · Emergenza: ${emergency}` : ""}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                className="lp-btn-secondary inline-flex items-center gap-2"
                href={vetPhone ? `tel:${vetPhone}` : undefined}
                onClick={(e) => {
                  if (!vetPhone) e.preventDefault();
                }}
              >
                <PhoneCall className="w-4 h-4" />
                Chiama
              </a>
              <Link to="/app/vaccines" className="lp-btn-secondary inline-flex items-center gap-2">
                <Syringe className="w-4 h-4" />
                Vaccini ({vaccinesCount})
              </Link>
            </div>
            {!vetPhone ? <div className="mt-2 text-[11px]" style={{ color: "rgb(var(--lp-warning))" }}>Consiglio: aggiungi un numero per emergenze.</div> : null}
          </div>

          <div className="lp-panel p-3 md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs lp-muted">Nascita</div>
                <div className="mt-1 text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{fmtDob(pet.dob)}</div>
              </div>
              <div>
                <div className="text-xs lp-muted">Peso</div>
                <div className="mt-1 text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{pet.weightKg ? `${pet.weightKg} kg` : "—"}</div>
              </div>
              <div>
                <div className="text-xs lp-muted">Pet Protetto</div>
                <div className="mt-1 text-sm font-semibold" style={{ color: protectionOn ? "rgb(var(--lp-accent-2))" : "rgb(var(--lp-muted))" }}>
                  {protectionOn ? "Attivo" : "Non attivo"}
                </div>
                <div className="mt-2">
                  <Link to="/app/pets" className={protectionOn ? "lp-btn-secondary inline-flex items-center gap-2" : "lp-btn-primary inline-flex items-center gap-2"}>
                    <ShieldPlus className="w-4 h-4" />
                    {protectionOn ? "Gestisci" : "Attiva"}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

