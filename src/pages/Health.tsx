import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { createHealthEvent, deleteHealthEvent, subscribeHealthEventsRange, updateHealthEvent } from "@/data/health";
import { getPetDocumentDownloadUrl, uploadPetDocument } from "@/data/documents";
import type { HealthEvent, HealthEventType } from "@/types";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Paperclip, Pencil, Search, Trash2 } from "lucide-react";

export default function Health() {
  const user = useAuthStore((s) => s.user);
  const pets = usePetStore((s) => s.pets);
  const activePetId = usePetStore((s) => s.activePetId);
  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);
  const [events, setEvents] = useState<HealthEvent[]>([]);

  const [rangeDays, setRangeDays] = useState("180");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<Record<HealthEventType, boolean>>({
    visit: true,
    vaccine: true,
    med: true,
    symptom: true,
    allergy: true,
    note: true,
  });

  const [type, setType] = useState<HealthEventType>("visit");
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState<string>("");
  const [note, setNote] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("low");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editOccurredAt, setEditOccurredAt] = useState("");
  const [editSeverity, setEditSeverity] = useState<"low" | "medium" | "high">("low");
  const [savingEdit, setSavingEdit] = useState(false);

  function parseSeverity(v: string): "low" | "medium" | "high" {
    if (v === "medium" || v === "high") return v;
    return "low";
  }

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
    const toMs = Date.now();
    const days = Number(rangeDays);
    const fromMs = toMs - (Number.isFinite(days) && days > 0 ? days : 180) * 24 * 60 * 60 * 1000;
    const unsub = subscribeHealthEventsRange(activePetId, fromMs, toMs, 200, setEvents);
    return () => unsub();
  }, [activePetId, rangeDays]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events
      .filter((e) => typeFilter[e.type])
      .filter((e) => {
        if (!needle) return true;
        return `${e.type} ${e.title} ${e.note ?? ""}`.toLowerCase().includes(needle);
      });
  }, [events, q, typeFilter]);

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

  async function onUploadAttachment(ev: HealthEvent, file: File) {
    if (!user || !activePetId) return;
    setUploading(true);
    try {
      const { docId, storagePath } = await uploadPetDocument(activePetId, user.uid, file);
      const next = [...(ev.attachments ?? []), { name: file.name, storagePath, docId }];
      await updateHealthEvent(activePetId, ev.id, { attachments: next });
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
          className="lp-btn-primary"
        >
          Checker sintomi AI
        </Link>
        <Link
          to="/app/medications"
          className="lp-btn-secondary"
        >
          Terapie
        </Link>
        <Link
          to="/app/vaccines"
          className="lp-btn-secondary"
        >
          Vaccini
        </Link>
        <div className="text-xs text-slate-600">Non sostituisce il veterinario.</div>
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
              <div className="text-xs text-slate-600 mb-1">Tipo</div>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as HealthEventType)}
                className="lp-select"
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
              <div className="text-xs text-slate-600 mb-1">Titolo</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={placeholderTitle}
                className="lp-input"
              />
            </label>
            <label className="lg:col-span-3 block">
              <div className="text-xs text-slate-600 mb-1">Quando</div>
              <input
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                type="datetime-local"
                className="lp-input"
              />
            </label>
            <label className="lg:col-span-2 block">
              <div className="text-xs text-slate-600 mb-1">Gravità</div>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as "low" | "medium" | "high")}
                disabled={type !== "symptom"}
                className="lp-select disabled:opacity-60"
              >
                <option value="low">Bassa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="lg:col-span-1 lp-btn-primary"
            >
              {saving ? "…" : "Aggiungi"}
            </button>
            <label className="lg:col-span-12 block">
              <div className="text-xs text-slate-600 mb-1">Note</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="lp-textarea"
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
            <div className="lp-panel p-3">
              <div className="text-xs text-slate-600">Clinica</div>
              <div className="text-sm font-medium">{activePet.vetContact?.clinicName ?? "—"}</div>
              <div className="text-xs text-slate-600 mt-2">Telefono</div>
              <div className="text-sm font-medium">{activePet.vetContact?.phone ?? "—"}</div>
              <div className="text-xs text-slate-600 mt-2">Emergenza</div>
              <div className="text-sm font-medium">{activePet.vetContact?.emergencyPhone ?? "—"}</div>
            </div>
            <div className="lp-panel p-3">
              <div className="text-xs text-slate-600">Azioni rapide</div>
              <div className="mt-2 flex flex-col gap-2">
                {activePet.vetContact?.emergencyPhone ? (
                  <a
                    href={`tel:${activePet.vetContact.emergencyPhone}`}
                    className="rounded-xl bg-rose-500 text-white px-4 py-2 text-sm font-medium hover:bg-rose-400 text-center"
                  >
                    Chiama emergenza
                  </a>
                ) : (
                  <div className="text-sm text-slate-600">Aggiungi il numero in Profilo Pet.</div>
                )}
                {activePet.vetContact?.phone ? (
                  <a
                    href={`tel:${activePet.vetContact.phone}`}
                    className="lp-btn-secondary text-center"
                  >
                    Chiama clinica
                  </a>
                ) : null}
              </div>
              <div className="mt-3 text-xs text-slate-600">Se grave: difficoltà respiratoria, collasso, convulsioni, sanguinamento → emergenza.</div>
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
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-fuchsia-600 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-fuchsia-500"
            />
            <div className="text-xs text-slate-600">Carica file e associane uno alla timeline (anche dopo l’upload).</div>
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
        ) : filtered.length === 0 ? (
          <EmptyState title="Nessun evento" description="Aggiungi il primo evento o carica un referto." />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-6">
                <div className="text-xs text-slate-600 mb-1">Cerca</div>
                <div className="flex items-center gap-2 rounded-xl bg-white/80 border border-slate-200/70 px-3 py-2">
                  <Search className="w-4 h-4 text-slate-600" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="titolo, note…" className="w-full bg-transparent outline-none text-sm" />
                </div>
              </div>
              <div className="lg:col-span-3">
                <div className="text-xs text-slate-600 mb-1">Periodo</div>
                <select value={rangeDays} onChange={(e) => setRangeDays(e.target.value)} className="lp-select">
                  <option value="30">Ultimi 30 giorni</option>
                  <option value="90">Ultimi 90 giorni</option>
                  <option value="180">Ultimi 180 giorni</option>
                  <option value="365">Ultimo anno</option>
                </select>
              </div>
              <div className="lg:col-span-3">
                <div className="text-xs text-slate-600 mb-1">Tipi</div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["visit", "Visite"],
                      ["vaccine", "Vaccini"],
                      ["med", "Farmaci"],
                      ["symptom", "Sintomi"],
                      ["allergy", "Allergie"],
                      ["note", "Note"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTypeFilter((s) => ({ ...s, [k]: !s[k] }))}
                      className={
                        typeFilter[k]
                          ? "rounded-xl bg-fuchsia-600/10 border border-fuchsia-600/20 px-3 py-2 text-xs text-fuchsia-800"
                          : "rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs text-slate-700 hover:bg-white"
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filtered.map((ev) => (
              <div key={ev.id} className="lp-panel px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {editingId === ev.id ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!activePetId) return;
                          setSavingEdit(true);
                          try {
                            const when = editOccurredAt ? new Date(editOccurredAt).getTime() : ev.occurredAt;
                            await updateHealthEvent(activePetId, ev.id, {
                              title: editTitle.trim() || ev.title,
                              note: editNote.trim() || undefined,
                              occurredAt: when,
                              severity: ev.type === "symptom" ? editSeverity : undefined,
                            });
                            setEditingId(null);
                          } finally {
                            setSavingEdit(false);
                          }
                        }}
                        className="space-y-2"
                      >
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="lp-input" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input value={editOccurredAt} onChange={(e) => setEditOccurredAt(e.target.value)} type="datetime-local" className="lp-input" />
                          <select value={editSeverity} onChange={(e) => setEditSeverity(parseSeverity(e.target.value))} disabled={ev.type !== "symptom"} className="lp-select disabled:opacity-60">
                            <option value="low">Bassa</option>
                            <option value="medium">Media</option>
                            <option value="high">Alta</option>
                          </select>
                        </div>
                        <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} className="lp-textarea" />
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setEditingId(null)} className="lp-btn-secondary">
                            Annulla
                          </button>
                          <button type="submit" disabled={savingEdit} className="lp-btn-primary">
                            {savingEdit ? "…" : "Salva"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="text-sm font-medium">{ev.title}</div>
                        <div className="text-xs text-slate-600">{ev.type}{ev.severity ? ` · ${ev.severity}` : ""}</div>
                        {ev.note ? <div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{ev.note}</div> : null}
                      </>
                    )}
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
                            className="lp-btn-icon"
                          >
                            Apri: {a.name}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {editingId !== ev.id && activePetId ? (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="lp-btn-icon inline-flex items-center gap-2 cursor-pointer">
                          <Paperclip className="w-4 h-4" />
                          Allega
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              void onUploadAttachment(ev, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-600">{new Date(ev.occurredAt).toLocaleString()}</div>
                    {editingId !== ev.id ? (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(ev.id);
                            setEditTitle(ev.title);
                            setEditNote(ev.note ?? "");
                            setEditOccurredAt(new Date(ev.occurredAt).toISOString().slice(0, 16));
                            setEditSeverity(ev.severity ?? "low");
                          }}
                          className="lp-btn-icon"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!activePetId) return;
                            if (!confirm("Eliminare questo evento salute?")) return;
                            await deleteHealthEvent(activePetId, ev.id);
                          }}
                          className="lp-btn-icon"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-slate-600">Suggerimento: usa anche Cartella clinica per una timeline unificata.</div>
        </CardContent>
      </Card>
    </div>
  );
}
