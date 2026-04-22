import type { Pet } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmDialog } from "@/components/confirm";
import { buildPublicPetUrl, disablePetProtection, enablePetProtection, getPetCard, setPetLostMode } from "@/data/petCards";
import { Shield, QrCode, Copy, ExternalLink, Info, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUserProfile } from "@/hooks/useUserProfile";
import { trackEvent } from "@/lib/telemetryClient";

function qrSrc(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

export function PetProtectionCard({ pet }: { pet: Pet }) {
  const pushToast = useToastStore((s) => s.push);
  const confirmDialog = useConfirmDialog();
  const user = useAuthStore((s) => s.user);
  const profile = useUserProfile(user?.uid);
  const [busy, setBusy] = useState(false);
  const enabled = Boolean(pet.petProtection?.enabled && pet.petProtection.publicId);
  const publicId = pet.petProtection?.publicId ?? "";
  const publicUrl = useMemo(() => (enabled ? buildPublicPetUrl(publicId) : ""), [enabled, publicId]);
  const [cardBusy, setCardBusy] = useState(false);
  const [isLost, setIsLost] = useState(false);
  const [publicNote, setPublicNote] = useState("");
  const publicNoteMax = 220;

  useEffect(() => {
    let alive = true;
    if (!enabled || !publicId) {
      setIsLost(false);
      setPublicNote("");
      return;
    }
    getPetCard(publicId)
      .then((c) => {
        if (!alive) return;
        setIsLost(Boolean(c?.isLost));
        setPublicNote(String(c?.publicNote || ""));
      })
      .catch(() => {
        if (!alive) return;
        setIsLost(false);
        setPublicNote("");
      });
    return () => {
      alive = false;
    };
  }, [enabled, publicId]);

  async function onEnable() {
    if (busy) return;
    if (enabled) return;
    setBusy(true);
    try {
      await enablePetProtection(pet);
      pushToast({ type: "success", title: "Pet Protetto", message: "Protezione attiva. QR e ID pronti." });
      void trackEvent({ uid: user?.uid, profile, event: "pet_protection_enabled", route: "/app/pets" });
    } catch {
      pushToast({ type: "error", title: "Errore", message: "Impossibile attivare la protezione." });
    } finally {
      setBusy(false);
    }
  }

  async function onDisable() {
    if (busy) return;
    if (!enabled) return;
    const ok = await confirmDialog({
      title: "Disattiva Pet Protetto",
      description: "Vuoi disattivare QR/ID e la scheda pubblica?",
      confirmLabel: "Disattiva",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await disablePetProtection(pet);
      pushToast({ type: "info", title: "Protezione disattivata", message: "QR e scheda pubblica rimossi." });
    } catch {
      pushToast({ type: "error", title: "Errore", message: "Impossibile disattivare la protezione." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="inline-flex items-center gap-2">
              <Shield className="w-5 h-5 lp-icon-primary" />
              Pet Protetto PetLyon
            </CardTitle>
            <CardDescription>🛡️ QR + ID univoco, contatto rapido e segnalazioni in caso di smarrimento.</CardDescription>
          </div>
          {enabled ? (
            <button type="button" className="lp-btn-secondary" onClick={onDisable} disabled={busy}>
              Disattiva
            </button>
          ) : (
            <button type="button" className="lp-btn-primary" onClick={onEnable} disabled={busy}>
              {busy ? "Attivo…" : "Attiva protezione"}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4">
              <div className="rounded-2xl overflow-hidden border border-slate-200/70 bg-white p-2">
                <img src={qrSrc(publicUrl)} alt="QR" className="w-full h-auto" />
              </div>
            </div>
            <div className="md:col-span-8 space-y-3">
              {isLost ? (
                <div className="lp-panel p-4" style={{ borderColor: "rgba(var(--lp-danger),0.35)" }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5" style={{ color: "rgb(var(--lp-danger-600))" }} />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Modalità smarrito attiva</div>
                      <div className="text-xs lp-muted mt-1">Chi scansiona il QR può inviare una segnalazione. Disattivala quando rientra.</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="lp-panel p-4">
                <div className="text-xs lp-muted">ID univoco</div>
                <div className="mt-1 text-lg font-semibold flex items-center gap-2">
                  <QrCode className="w-5 h-5 lp-icon-primary" />
                  {publicId}
                </div>
                <div className="mt-2 text-xs lp-muted">URL scheda pubblica</div>
                <div className="mt-1 text-sm break-all">{publicUrl}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="lp-btn-secondary inline-flex items-center justify-center"
                    onClick={() =>
                      copyText(publicUrl)
                        .then(() => pushToast({ type: "success", title: "Copiato", message: "Link copiato." }))
                        .catch(() => pushToast({ type: "error", title: "Errore", message: "Impossibile copiare." }))
                    }
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copia link
                  </button>
                  <Link
                    to={`/p/${encodeURIComponent(publicId)}`}
                    className="lp-btn-secondary inline-flex items-center justify-center"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Apri scheda
                  </Link>
                  <Link to="/app/records?share=1" className="lp-btn-secondary inline-flex items-center justify-center">
                    Condividi cartella
                  </Link>
                </div>
              </div>

              <div className="lp-panel p-4">
                <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Smarrimento</div>
                <div className="text-xs lp-muted mt-1">Attiva solo quando serve. Aggiungi un messaggio breve visibile nella scheda pubblica.</div>
                <label className="block mt-3">
                  <div className="text-xs lp-muted">Messaggio pubblico (facoltativo)</div>
                  <textarea
                    className="lp-input mt-1 h-20"
                    value={publicNote}
                    onChange={(e) => setPublicNote(e.target.value)}
                    placeholder="Es. Smarrito in zona Parco Sempione. Docile ma spaventato. Contattami subito."
                    maxLength={publicNoteMax}
                  />
                  <div className="text-[11px] mt-1" style={{ color: "rgb(var(--lp-muted))" }}>{String(publicNote || "").length}/{publicNoteMax}</div>
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={isLost ? "lp-btn-secondary" : "lp-btn-primary"}
                    disabled={cardBusy}
                    onClick={async () => {
                      if (cardBusy) return;
                      setCardBusy(true);
                      try {
                        await setPetLostMode(pet, true, publicNote);
                        setIsLost(true);
                        pushToast({ type: "success", title: "Smarrito", message: "Modalità smarrito attivata." });
                      } catch (e) {
                        pushToast({ type: "error", title: "Errore", message: e instanceof Error ? e.message : "Operazione fallita" });
                      } finally {
                        setCardBusy(false);
                      }
                    }}
                  >
                    Segna smarrito
                  </button>
                  <button
                    type="button"
                    className={isLost ? "lp-btn-primary" : "lp-btn-secondary"}
                    disabled={cardBusy}
                    onClick={async () => {
                      if (cardBusy) return;
                      setCardBusy(true);
                      try {
                        await setPetLostMode(pet, false, publicNote);
                        setIsLost(false);
                        pushToast({ type: "success", title: "Risolto", message: "Modalità smarrito disattivata." });
                      } catch (e) {
                        pushToast({ type: "error", title: "Errore", message: e instanceof Error ? e.message : "Operazione fallita" });
                      } finally {
                        setCardBusy(false);
                      }
                    }}
                  >
                    Risolto
                  </button>
                </div>
              </div>

              <div className="lp-panel p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><Info className="w-4 h-4 lp-icon-primary" /> Messaggio UX</div>
                <div className="mt-2 text-sm">Se il tuo animale è registrato su PetLyon, sarà sempre riconducibile a te.</div>
                <div className="mt-2 text-xs lp-muted">PetLyon rende l’abbandono molto più difficile e facilmente tracciabile.</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lp-panel p-4">
            <div className="text-sm font-semibold">Attiva la protezione in 30 secondi</div>
            <div className="text-xs lp-muted mt-1">Crea QR + ID e abilita la scheda pubblica per contatto e segnalazioni.</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
