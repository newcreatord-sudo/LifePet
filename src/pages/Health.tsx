import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createHealthEvent, subscribeRecentHealthEvents } from "@/data/health";
import { getPetDocumentDownloadUrl, uploadPetDocument } from "@/data/documents";
import type { HealthEvent, HealthEventType } from "@/types";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Health() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const [events, setEvents] = useState<HealthEvent[]>([]);

  const [type, setType] = useState<HealthEventType>("visit");
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState<string>("");
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("low");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const placeholderTitle = useMemo(() => {
    if (type === "vaccine") return "Vaccino (es. rabbia)";
    if (type === "med") return "Farmaco";
    if (type === "visit") return "Visita veterinaria";
    if (type === "allergy") return "Allergia";
    if (type === "symptom") return "Sintomo";
    return "Nota";
  }, [type]);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeRecentHealthEvents(activePetId, 30, setEvents);
    return () => unsub();
  }, [activePetId]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activePetId) return;
    setSaving(true);
    try {
      const occurredMs = occurredAt ? new Date(occurredAt).getTime() : Date.now();
      await createHealthEvent(activePetId, {
        petId: activePetId,
        type,
        title: title.trim() || placeholderTitle,
        note: note.trim() || undefined,
        severity: type === "symptom" ? severity : undefined,
        occurredAt: occurredMs,
        createdAt: Date.now(),
        createdBy: user.uid,
      });
      setTitle("");
      setNote("");
      setOccurredAt("");
      setSeverity("low");
    } finally {
      setSaving(false);
    }
  }

  async function onUploadPrescription(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !activePetId) return;
    setUploading(true);
    try {
      const { docId, storagePath } = await uploadPetDocument(activePetId, user.uid, file);
      await createHealthEvent(activePetId, {
        petId: activePetId,
        type: "visit",
        title: "Prescription / report",
        note: `Uploaded: ${file.name}`,
        occurredAt: Date.now(),
        createdAt: Date.now(),
        createdBy: user.uid,
        attachments: [{ name: file.name, storagePath, docId }],
      });
      e.target.value = "";
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Salute" description="Visite, vaccini, terapie, sintomi e cartella clinica digitale." />

      <div className="flex items-center gap-2">
        <Link
          to="/app/symptoms"
          className="rounded-xl bg-emerald-300/90 text-slate-950 px-3 py-2 text-sm font-medium hover:bg-emerald-300"
        >
          Checker sintomi AI
        </Link>
        <Link
          to="/app/medications"
          className="rounded-xl border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
        >
          Terapie
        </Link>
        <Link
          to="/app/vaccines"
          className="rounded-xl border border-slate-800 px-3 py-2 text-sm hover:bg-slate-900"
        >
          Vaccini
        </Link>
        <div className="text-xs text-slate-500">Non sostituisce il veterinario.</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aggiungi evento</CardTitle>
          <CardDescription>Registra un evento clinico in modo ordinato.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per aggiungere eventi salute." />
        ) : (
          <form onSubmit={onAdd} className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-400 mb-1">Tipo</div>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as HealthEventType)}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              >
                <option value="visit">Visita veterinaria</option>
                <option value="vaccine">Vaccino</option>
                <option value="med">Farmaco</option>
                <option value="symptom">Sintomo</option>
                <option value="allergy">Allergia</option>
                <option value="note">Nota</option>
              </select>
            </label>
            <label className="lg:col-span-4 block">
              <div className="text-xs text-slate-400 mb-1">Titolo</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={placeholderTitle}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="lg:col-span-3 block">
              <div className="text-xs text-slate-400 mb-1">Quando</div>
              <input
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                type="datetime-local"
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-400 mb-1">Gravità</div>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as "low" | "medium" | "high")}
                disabled={type !== "symptom"}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="low">Bassa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="lg:col-span-1 rounded-xl bg-emerald-300/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-emerald-300 disabled:opacity-60"
            >
              {saving ? "…" : "Aggiungi"}
            </button>
            <label className="lg:col-span-12 block">
              <div className="text-xs text-slate-400 mb-1">Note</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
            </label>
          </form>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vet SOS</CardTitle>
          <CardDescription>Contatti rapidi e informazioni utili in emergenza.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePet ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere i contatti del veterinario." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-xs text-slate-500">Clinica</div>
              <div className="text-sm font-medium">{activePet.vetContact?.clinicName ?? "—"}</div>
              <div className="text-xs text-slate-500 mt-2">Telefono</div>
              <div className="text-sm font-medium">{activePet.vetContact?.phone ?? "—"}</div>
              <div className="text-xs text-slate-500 mt-2">Emergenza</div>
              <div className="text-sm font-medium">{activePet.vetContact?.emergencyPhone ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-xs text-slate-500">Azioni rapide</div>
              <div className="mt-2 flex flex-col gap-2">
                {activePet.vetContact?.emergencyPhone ? (
                  <a
                    href={`tel:${activePet.vetContact.emergencyPhone}`}
                    className="rounded-xl bg-rose-400/90 text-slate-950 px-4 py-2 text-sm font-medium hover:bg-rose-400 text-center"
                  >
                    Chiama emergenza
                  </a>
                ) : (
                  <div className="text-sm text-slate-400">Aggiungi il numero in Pet Profile.</div>
                )}
                {activePet.vetContact?.phone ? (
                  <a
                    href={`tel:${activePet.vetContact.phone}`}
                    className="rounded-xl border border-slate-800 px-4 py-2 text-sm hover:bg-slate-900 text-center"
                  >
                    Chiama clinica
                  </a>
                ) : null}
              </div>
              <div className="mt-3 text-xs text-slate-500">Se grave: difficoltà respiratoria, collasso, convulsioni, sanguinamento → emergenza.</div>
            </div>
          </div>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Carica referto/ricetta</CardTitle>
          <CardDescription>Carica su Storage e crea automaticamente un evento in timeline.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per caricare documenti clinici." />
        ) : (
          <div className="space-y-2">
            <input
              type="file"
              onChange={onUploadPrescription}
              disabled={uploading}
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:text-slate-100 hover:file:bg-slate-900"
            />
            <div className="text-xs text-slate-500">OCR e classificazione automatica possono essere aggiunti dopo.</div>
          </div>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Storia clinica ordinata e consultabile.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere la storia clinica." />
        ) : events.length === 0 ? (
          <EmptyState title="Nessun evento" description="Aggiungi il primo evento o carica un referto." />
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{ev.title}</div>
                    <div className="text-xs text-slate-500">{ev.type}{ev.severity ? ` · ${ev.severity}` : ""}</div>
                    {ev.note ? <div className="text-sm text-slate-300 mt-1">{ev.note}</div> : null}
                    {ev.attachments && ev.attachments.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ev.attachments.map((a) => (
                          <button
                            key={`${ev.id}:${a.storagePath}`}
                            onClick={async () => {
                              try {
                                const url = await getPetDocumentDownloadUrl(a.storagePath);
                                window.open(url, "_blank", "noopener,noreferrer");
                              } catch {
                                return;
                              }
                            }}
                            className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                          >
                            Apri: {a.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">{new Date(ev.occurredAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-slate-500">Suggerimento: usa anche Records per una timeline unificata.</div>
        </CardContent>
      </Card>
    </div>
  );
}
