import { useEffect, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePetStore } from "@/stores/petStore";
import { deletePetDocument, getPetDocumentDownloadUrl, subscribeDocuments, uploadPetDocument } from "@/data/documents";
import type { PetDocument } from "@/types";
import { useToastStore } from "@/stores/toastStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Documents() {
  const user = useAuthStore((s) => s.user);
  const activePetId = usePetStore((s) => s.activePetId);
  const pushToast = useToastStore((s) => s.push);
  const [docs, setDocs] = useState<PetDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!activePetId) return;
    const unsub = subscribeDocuments(activePetId, setDocs);
    return () => unsub();
  }, [activePetId]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !activePetId) return;
    if (file.size > 10 * 1024 * 1024) {
      pushToast({ type: "error", title: "File troppo grande", message: "Massimo 10MB." });
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      await uploadPetDocument(activePetId, user.uid, file);
      e.target.value = "";
      pushToast({ type: "success", title: "Documento caricato", message: "Disponibile in libreria." });
    } catch (err) {
      pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Upload fallito" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Documenti" description="Carica, apri e gestisci referti, ricette e allegati." />

      <Card>
        <CardHeader>
          <CardTitle>Caricamento</CardTitle>
          <CardDescription>PDF e immagini fino a 10MB.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per caricare documenti." />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-slate-400" />
              <input
                type="file"
                onChange={onUpload}
                disabled={uploading}
                className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:text-slate-100 hover:file:bg-slate-900"
              />
            </div>
            <div className="text-xs text-slate-500">Suggerimento: usa nomi chiari (es. “Vaccino rabbia 2026.pdf”).</div>
          </div>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Libreria</CardTitle>
          <CardDescription>Archivio documenti del pet attivo.</CardDescription>
        </CardHeader>
        <CardContent>
        {!activePetId ? (
          <EmptyState title="Seleziona un pet" description="Scegli un profilo per vedere i documenti." />
        ) : docs.length === 0 ? (
          <EmptyState title="Nessun documento" description="Carica referti e ricette per averli sempre con te." />
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-slate-500">{(d.size / 1024).toFixed(0)} KB · {new Date(d.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const url = await getPetDocumentDownloadUrl(d.storagePath);
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch (err) {
                          pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Apertura fallita" });
                        }
                      }}
                      className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900"
                    >
                      Apri
                    </button>
                    <button
                      onClick={async () => {
                        if (!activePetId) return;
                        if (!confirm(`Eliminare "${d.name}"?`)) return;
                        setBusyId(d.id);
                        try {
                          await deletePetDocument(activePetId, d.id, d.storagePath);
                          pushToast({ type: "success", title: "Documento eliminato", message: "Rimosso." });
                        } catch (err) {
                          pushToast({ type: "error", title: "Errore", message: err instanceof Error ? err.message : "Eliminazione fallita" });
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      disabled={busyId === d.id}
                      className="rounded-xl border border-slate-800 px-3 py-2 text-xs hover:bg-slate-900 disabled:opacity-60"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
