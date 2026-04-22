import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, Plus, Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { subscribeFarms, subscribeHerds, subscribeSubjects, setSubjectHerd, upsertFarm, upsertHerd } from "@/multispecies/data/msData";
import { useAuthStore } from "@/stores/authStore";
import { useMsFarmStore } from "@/multispecies/stores/msFarmStore";
import type { Farm, Herd, Subject } from "@/multispecies/types";

export default function PlatformHerdManagement() {
  useMultiSpeciesDemo();
  const location = useLocation();
  const base = location.pathname.startsWith("/app/farm")
    ? "/app/farm"
    : "/app/tech";
  const inFarmArea = base === "/app/farm";

  const uid = useAuthStore((s) => s.user?.uid) || "demo";

  const activeFarmId = useMsFarmStore((s) => s.activeFarmId);
  const setActiveFarmId = useMsFarmStore((s) => s.setActiveFarmId);

  const [farms, setFarms] = useState<Farm[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [selectedHerdId, setSelectedHerdId] = useState<string>("");

  useEffect(() => subscribeFarms(uid, setFarms), [uid]);
  useEffect(() => subscribeHerds(uid, setHerds), [uid]);
  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);

  useEffect(() => {
    if (selectedFarmId) return;
    if (inFarmArea && activeFarmId) {
      setSelectedFarmId(activeFarmId);
      return;
    }
    if (farms[0]?.id) {
      setSelectedFarmId(farms[0].id);
      if (inFarmArea) setActiveFarmId(farms[0].id);
    }
  }, [activeFarmId, farms, inFarmArea, selectedFarmId, setActiveFarmId]);

  useEffect(() => {
    if (selectedHerdId) return;
    const first = herds.find((h) => (selectedFarmId ? h.farmId === selectedFarmId : true));
    if (first?.id) setSelectedHerdId(first.id);
  }, [herds, selectedFarmId, selectedHerdId]);

  const herdById = useMemo(() => new Map(herds.map((h) => [h.id, h] as const)), [herds]);
  const livestock = useMemo(() => subjects.filter((s) => s.type !== "pet"), [subjects]);

  const herdCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of livestock) {
      if (!s.herdId) continue;
      map.set(s.herdId, (map.get(s.herdId) ?? 0) + 1);
    }
    return map;
  }, [livestock]);

  const filteredHerds = useMemo(() => herds.filter((h) => (selectedFarmId ? h.farmId === selectedFarmId : true)), [herds, selectedFarmId]);
  const selectedHerd = useMemo(() => (selectedHerdId ? herdById.get(selectedHerdId) ?? null : null), [herdById, selectedHerdId]);

  const herdMembers = useMemo(() => {
    if (!selectedHerdId) return [];
    return livestock.filter((s) => s.herdId === selectedHerdId);
  }, [livestock, selectedHerdId]);

  const unassigned = useMemo(() => livestock.filter((s) => !s.herdId), [livestock]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Gestione mandria", en: "Herd management" }}
        description={{ it: "Organizza i capi in gruppi, utile per filtri, report e alert farm.", en: "Organize animals into herds for filters, reports and farm alerts." }}
        showImage={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Layers className="w-4 h-4" />Azienda</CardTitle>
              <CardDescription>Seleziona una farm per vedere le mandrie.</CardDescription>
            </CardHeader>
            <CardContent>
              <select
                className="w-full lp-input"
                value={selectedFarmId}
                onChange={(e) => {
                  setSelectedFarmId(e.target.value);
                  if (inFarmArea) setActiveFarmId(e.target.value);
                  setSelectedHerdId("");
                }}
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <div className="mt-3">
                <button
                  type="button"
                  className="lp-btn-secondary w-full"
                  onClick={() => {
                    const name = `Farm ${new Date().toLocaleDateString()}`;
                    void (async () => {
                      const id = await upsertFarm(uid, { name });
                      setSelectedFarmId(id);
                      setSelectedHerdId("");
                    })();
                  }}
                >
                  <span className="inline-flex items-center gap-2"><Plus className="w-4 h-4" />Nuova farm</span>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Mandrie</CardTitle>
              <CardDescription>Lista gruppi e numero capi.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredHerds.map((h) => (
                  <div
                    key={h.id}
                    className={
                      "w-full lp-panel px-3 py-2 flex items-center justify-between gap-3 " +
                      (h.id === selectedHerdId ? "ring-2 ring-sky-500/30" : "")
                    }
                  >
                    <button type="button" className="min-w-0 text-left" onClick={() => setSelectedHerdId(h.id)}>
                      <div className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{h.name}</div>
                      <div className="text-xs lp-muted truncate">{herdCounts.get(h.id) ?? 0} capi</div>
                    </button>
                    <Link to={`${base}/herds/${h.id}`} className="lp-btn-secondary">Dashboard</Link>
                  </div>
                ))}
                {filteredHerds.length === 0 ? <div className="text-sm lp-muted">Nessuna mandria.</div> : null}
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  className="lp-btn-secondary w-full"
                  disabled={!selectedFarmId}
                  onClick={() => {
                    if (!selectedFarmId) return;
                    const name = `Mandria ${filteredHerds.length + 1}`;
                    void (async () => {
                      const id = await upsertHerd(uid, { farmId: selectedFarmId, name });
                      setSelectedHerdId(id);
                    })();
                  }}
                >
                  <span className="inline-flex items-center gap-2"><Plus className="w-4 h-4" />Nuova mandria</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dettaglio</CardTitle>
              <CardDescription>{selectedHerd ? `Gestisci capi per ${selectedHerd.name}.` : "Seleziona una mandria."}</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedHerd ? (
                <div className="text-sm lp-muted">Nessuna mandria selezionata.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-6">
                    <div className="text-xs lp-muted">Capi in mandria</div>
                    <div className="mt-2 space-y-2 max-h-[420px] overflow-y-auto">
                      {herdMembers.map((s) => (
                        <div key={s.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link to={`${base}/subjects/${s.id}`} className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>
                              {s.displayName}
                            </Link>
                            <div className="text-xs lp-muted truncate">{s.earTag || s.farmTagNumber || s.id}</div>
                          </div>
                          <button type="button" className="lp-btn-secondary" onClick={() => { void setSubjectHerd(uid, s.id, null); }}>Rimuovi</button>
                        </div>
                      ))}
                      {herdMembers.length === 0 ? <div className="text-sm lp-muted">Nessun capo assegnato.</div> : null}
                    </div>
                  </div>
                  <div className="lg:col-span-6">
                    <div className="text-xs lp-muted">Non assegnati</div>
                    <div className="mt-2 space-y-2 max-h-[420px] overflow-y-auto">
                      {unassigned.map((s) => (
                        <div key={s.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link to={`${base}/subjects/${s.id}`} className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>
                              {s.displayName}
                            </Link>
                            <div className="text-xs lp-muted truncate">{s.earTag || s.farmTagNumber || s.id}</div>
                          </div>
                          <button type="button" className="lp-btn-primary" onClick={() => { void setSubjectHerd(uid, s.id, selectedHerd.id); }}>Aggiungi</button>
                        </div>
                      ))}
                      {unassigned.length === 0 ? <div className="text-sm lp-muted">Nessun capo libero.</div> : null}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
