import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useMultiSpeciesDemo } from "@/multispecies/hooks/useMultiSpeciesDemo";
import { subscribeFarms, subscribeHerds, subscribeSubjects } from "@/multispecies/data/msData";
import { useMsFarmStore } from "@/multispecies/stores/msFarmStore";
import { useAuthStore } from "@/stores/authStore";
import type { Farm, Herd, Subject } from "@/multispecies/types";

export default function FarmSubjects() {
  useMultiSpeciesDemo();

  const uid = useAuthStore((s) => s.user?.uid) || "demo";
  const activeFarmId = useMsFarmStore((s) => s.activeFarmId);
  const setActiveFarmId = useMsFarmStore((s) => s.setActiveFarmId);
  const [q, setQ] = useState("");
  const [farmId, setFarmId] = useState<string>("");
  const [herdId, setHerdId] = useState<string>("");
  const [species, setSpecies] = useState<string>("");
  const [farms, setFarms] = useState<Farm[]>([]);
  const [herds, setHerds] = useState<Herd[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => subscribeFarms(uid, setFarms), [uid]);
  useEffect(() => subscribeHerds(uid, setHerds), [uid]);
  useEffect(() => subscribeSubjects(uid, setSubjects), [uid]);

  useEffect(() => {
    if (farmId) return;
    if (activeFarmId) {
      setFarmId(activeFarmId);
      return;
    }
    if (farms[0]?.id) {
      setFarmId(farms[0].id);
      setActiveFarmId(farms[0].id);
    }
  }, [activeFarmId, farmId, farms, setActiveFarmId]);

  const herdOptions = useMemo(() => herds.filter((h) => (farmId ? h.farmId === farmId : true)), [farmId, herds]);
  const livestock = useMemo(() => subjects.filter((s) => s.type !== "pet"), [subjects]);
  const speciesOptions = useMemo(() => {
    const set = new Set(livestock.map((s) => s.species).filter(Boolean));
    return Array.from(set).sort();
  }, [livestock]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return livestock
      .filter((s) => (farmId ? s.farmId === farmId : true))
      .filter((s) => (herdId ? s.herdId === herdId : true))
      .filter((s) => (species ? s.species === species : true))
      .filter((s) => {
        if (!needle) return true;
        const hay = `${s.displayName} ${s.earTag ?? ""} ${s.farmTagNumber ?? ""} ${s.microchipNumber ?? ""}`.toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [farmId, herdId, livestock, q, species]);

  const herdNameById = useMemo(() => new Map(herds.map((h) => [h.id, h.name] as const)), [herds]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={{ it: "Animali da allevamento", en: "Farm animals" }}
        description={{ it: "Elenco e filtri per specie/mandria. Apri la scheda per telemetria e export.", en: "List and filters by species/herd. Open profile for telemetry and export." }}
        showImage={false}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Filtri</CardTitle>
          <CardDescription>Lavora come “reparto Farm”: qui non compaiono i pet domestici.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4">
              <div className="text-xs lp-muted">Cerca</div>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input className="lp-input w-full pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, ear tag, microchip…" />
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="text-xs lp-muted">Farm</div>
              <select
                className="lp-input w-full mt-1"
                value={farmId}
                onChange={(e) => {
                  setFarmId(e.target.value);
                  setActiveFarmId(e.target.value);
                  setHerdId("");
                }}
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <div className="text-xs lp-muted">Mandria</div>
              <select className="lp-input w-full mt-1" value={herdId} onChange={(e) => setHerdId(e.target.value)}>
                <option value="">(tutte)</option>
                {herdOptions.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <div className="text-xs lp-muted">Specie</div>
              <select className="lp-input w-full mt-1" value={species} onChange={(e) => setSpecies(e.target.value)}>
                <option value="">(tutte)</option>
                {speciesOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco</CardTitle>
          <CardDescription>{rows.length} animali</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[680px] overflow-y-auto">
            {rows.map((s) => (
              <div key={s.id} className="lp-panel px-3 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/app/farm/subjects/${s.id}`} className="text-sm font-medium truncate" style={{ color: "rgb(var(--lp-ink))" }}>{s.displayName}</Link>
                  <div className="text-xs lp-muted truncate">
                    {s.species}{s.herdId ? ` · ${herdNameById.get(s.herdId) ?? s.herdId}` : ""} · {s.earTag || s.farmTagNumber || s.microchipNumber || s.id}
                  </div>
                </div>
                <Link className="lp-btn-secondary" to={`/app/farm/subjects/${s.id}`}>Apri</Link>
              </div>
            ))}
            {rows.length === 0 ? <div className="text-sm lp-muted">Nessun animale.</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
