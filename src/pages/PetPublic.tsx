import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Toasts } from "@/components/Toasts";
import { useToastStore } from "@/stores/toastStore";
import { getPetCard, createFinderReport } from "@/data/petCards";
import type { FinderReportType, PetCard } from "@/types";
import { getLocalFallbackImageFromSeed } from "@/lib/marketingImages";
import { MapPin, QrCode, Shield, Phone, Eye, AlertTriangle } from "lucide-react";

function buildQrImageSrc(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}`;
}

export default function PetPublic() {
  const { publicId } = useParams();
  const pushToast = useToastStore((s) => s.push);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<PetCard | null>(null);
  const [reportOpen, setReportOpen] = useState<null | FinderReportType>(null);
  const [contact, setContact] = useState("");
  const [locationText, setLocationText] = useState("");
  const [note, setNote] = useState("");
  const [hp, setHp] = useState("");
  const [sending, setSending] = useState(false);

  const reportValidation = useMemo(() => {
    const c = String(contact || "").trim();
    const loc = String(locationText || "").trim();
    const n = String(note || "").trim();
    const okMin = Boolean(c || loc);
    const okHp = !String(hp || "").trim();
    const errors: string[] = [];
    if (!okMin) errors.push("Inserisci un contatto oppure la zona.");
    if (!okHp) errors.push("Richiesta non valida.");
    if (c.length > 80) errors.push("Contatto troppo lungo.");
    if (loc.length > 120) errors.push("Zona troppo lunga.");
    if (n.length > 500) errors.push("Note troppo lunghe.");
    return { ok: errors.length === 0, errors, trimmed: { c, loc, n } };
  }, [contact, hp, locationText, note]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCard(null);
    getPetCard(String(publicId || ""))
      .then((res) => {
        if (!cancelled) setCard(res);
      })
      .catch(() => {
        if (!cancelled) setCard(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicId]);

  const publicUrl = useMemo(() => {
    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
    return `${origin}/p/${encodeURIComponent(String(publicId || ""))}`;
  }, [publicId]);

  async function onSendReport(type: FinderReportType) {
    if (!card) return;
    if (!reportValidation.ok) {
      pushToast({ type: "info", title: "Controlla i campi", message: reportValidation.errors[0] ?? "Completa i campi richiesti." });
      return;
    }
    setSending(true);
    try {
      await createFinderReport({
        petId: card.petId,
        publicId: card.publicId,
        reportType: type,
        reporterContactOptional: reportValidation.trimmed.c,
        locationTextOptional: reportValidation.trimmed.loc,
        noteOptional: reportValidation.trimmed.n,
        hpOptional: hp,
      });
      pushToast({
        type: "success",
        title: "Segnalazione inviata",
        message: "Grazie. Il proprietario riceverà la segnalazione in app.",
      });
      setReportOpen(null);
      setContact("");
      setLocationText("");
      setNote("");
      setHp("");
    } catch {
      pushToast({ type: "error", title: "Errore", message: "Impossibile inviare la segnalazione." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--lp-app-bg)", color: "rgb(var(--lp-ink))" }}>
      <Toasts />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center lp-primary-soft">
              <Shield className="w-5 h-5 lp-icon-primary" />
            </div>
            <div>
              <div className="font-semibold">Pet Protetto PetLyon</div>
              <div className="text-xs lp-muted">📍 Tracciabile · 👤 Identificabile · 📄 Documenti sempre disponibili</div>
            </div>
          </div>
          <Link to="/" className="lp-btn-secondary">Home</Link>
        </div>

        <div className="mt-4">
          {loading ? (
            <Card>
              <CardContent>
                <div className="p-6 text-sm lp-muted">Caricamento…</div>
              </CardContent>
            </Card>
          ) : !card ? (
            <Card>
              <CardHeader>
                <CardTitle>Profilo non trovato</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-700">Controlla l’ID oppure riprova la scansione del QR.</div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {card.isLost ? (
                <Card>
                  <CardContent>
                    <div className="p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5" style={{ color: "rgb(var(--lp-danger-600))" }} />
                        <div>
                          <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>Animale segnalato come smarrito</div>
                          <div className="text-xs lp-muted mt-1">Se lo vedi o lo trovi, invia una segnalazione al proprietario.</div>
                          {card.publicNote ? <div className="mt-2 text-sm text-slate-700">{card.publicNote}</div> : null}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4 py-2">
                    <div className="w-full sm:w-40">
                      <div className="rounded-2xl overflow-hidden border border-slate-200/70 bg-white/70">
                        <img
                          src={getLocalFallbackImageFromSeed(card.petName)}
                          alt={card.petName}
                          className="w-full h-40 object-cover"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs lp-muted">Scheda animale</div>
                      <div className="text-2xl font-semibold mt-1">{card.petName}</div>
                      <div className="text-sm text-slate-700 mt-1">{card.species}</div>
                      <div className="mt-3 text-sm">
                        Se il tuo animale è registrato su PetLyon, sarà sempre riconducibile al proprietario.
                      </div>
                      <div className="mt-2 text-xs lp-muted">PetLyon rende l’abbandono molto più difficile e facilmente tracciabile.</div>
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => setReportOpen("found")}
                          className="lp-btn-primary inline-flex items-center justify-center"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Ho trovato
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportOpen("sighted")}
                          className="lp-btn-secondary inline-flex items-center justify-center"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ho avvistato
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>QR e ID</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-40">
                      <div className="rounded-2xl overflow-hidden border border-slate-200/70 bg-white p-2">
                        <img src={buildQrImageSrc(publicUrl)} alt="QR" className="w-full h-auto" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium flex items-center gap-2"><QrCode className="w-4 h-4 lp-icon-primary" /> ID: {card.publicId}</div>
                      <div className="text-xs lp-muted mt-2">Se hai scansionato questo QR, sei già nel posto giusto.</div>
                      <div className="text-xs lp-muted mt-2">URL: {publicUrl}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={reportOpen !== null}
        title={reportOpen === "found" ? "Ho trovato questo animale" : "Ho avvistato questo animale"}
        description="Invia una segnalazione al proprietario."
        onClose={() => {
          if (sending) return;
          setReportOpen(null);
        }}
      >
        <div className="space-y-3">
          <label className="block">
            <div className="text-xs lp-muted">Il tuo contatto (telefono/email)</div>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="lp-input mt-1"
              placeholder="Es. +39… oppure email"
              maxLength={80}
              inputMode="text"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <div className="text-xs lp-muted">Dove? (zona o indirizzo)</div>
            <div className="relative mt-1">
              <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                className="lp-input pl-9"
                placeholder="Es. Parco Sempione, Milano"
                maxLength={120}
              />
            </div>
          </label>
          <label className="block">
            <div className="text-xs lp-muted">Note (facoltativo)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="lp-input mt-1 h-24"
              placeholder="Dettagli utili…"
              maxLength={500}
            />
          </label>

          <label className="hidden">
            <div>Website</div>
            <input value={hp} onChange={(e) => setHp(e.target.value)} />
          </label>

          {!reportValidation.ok ? (
            <div className="lp-panel p-3" style={{ borderColor: "rgba(var(--lp-warning),0.35)" }}>
              <div className="text-xs" style={{ color: "rgb(var(--lp-warning))" }}>{reportValidation.errors[0]}</div>
              <div className="text-[11px] mt-1" style={{ color: "rgb(var(--lp-muted))" }}>Per inviare: contatto oppure zona. Note facoltative.</div>
            </div>
          ) : null}

          <div className="lp-panel p-3">
            <div className="text-xs lp-muted">Sicurezza</div>
            <div className="text-xs text-slate-700 mt-1">
              Avvicinati con cautela. Se serve, contatta le autorità o un veterinario.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" className="lp-btn-secondary" onClick={() => setReportOpen(null)} disabled={sending}>
              Annulla
            </button>
            <button
              type="button"
              className="lp-btn-primary"
              onClick={() => (reportOpen ? onSendReport(reportOpen) : undefined)}
              disabled={sending || !card || !reportValidation.ok}
            >
              {sending ? "Invio…" : "Invia"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
