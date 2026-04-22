import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  CalendarCheck,
  ClipboardList,
  Cpu,
  FileText,
  Files,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  MapPin,
  MapPinned,
  PawPrint,
  Pill,
  Receipt,
  Settings,
  ShieldPlus,
  ShoppingBag,
  Sparkles,
  Syringe,
  Users,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { usePetStore } from "@/stores/petStore";
import { useToastStore } from "@/stores/toastStore";

type ModuleItem = {
  key: string;
  title: string;
  description: string;
  to: string;
  requiresPet?: boolean;
  Icon: typeof LayoutDashboard;
  category: "Core" | "Farm" | "Salute" | "Pianifica" | "Community" | "Marketplace" | "Pro";
};

export default function Explore() {
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.push);
  const activePetId = usePetStore((s) => s.activePetId);
  const [q, setQ] = useState("");

  const items = useMemo<ModuleItem[]>(
    () => [
      {
        key: "dashboard",
        title: "Dashboard",
        description: "Panoramica veloce e azioni di oggi.",
        to: "/app/dashboard",
        Icon: LayoutDashboard,
        category: "Core",
      },
      ...(import.meta.env.DEV
        ? [
            {
              key: "gallery",
              title: "Galleria",
              description: "Immagini e fallback (verifica).",
              to: "/app/gallery",
              Icon: Files,
              category: "Core",
            } satisfies ModuleItem,
          ]
        : []),
      {
        key: "notifications",
        title: "Notifiche",
        description: "Centro notifiche con filtri e stato letto.",
        to: "/app/notifications",
        requiresPet: true,
        Icon: Bell,
        category: "Core",
      },
      {
        key: "status",
        title: "Status",
        description: "Indicatori, trend e suggerimenti smart.",
        to: "/app/status",
        requiresPet: true,
        Icon: Activity,
        category: "Core",
      },
      {
        key: "pets",
        title: "Profilo Pet",
        description: "Dati pet, contatti veterinario, routine base.",
        to: "/app/pets",
        Icon: PawPrint,
        category: "Core",
      },
      {
        key: "ai",
        title: "AI",
        description: "Chat e supporto per salute/decisioni/pratiche.",
        to: "/app/ai/chat",
        requiresPet: true,
        Icon: Sparkles,
        category: "Core",
      },

      {
        key: "farm",
        title: "Reparto Farm",
        description: "Area separata per allevamento: animali, mandrie, recinti digitali, device e alert.",
        to: "/app/farm",
        Icon: Cpu,
        category: "Farm",
      },
      {
        key: "pet_tech",
        title: "Tecnologia (Pet)",
        description: "Dispositivi, alert, diagnostica e ingest per pet.",
        to: "/app/tech",
        Icon: Sparkles,
        category: "Core",
      },

      {
        key: "health",
        title: "Salute",
        description: "Eventi, sintomi, note, allegati.",
        to: "/app/health",
        requiresPet: true,
        Icon: ShieldPlus,
        category: "Salute",
      },
      {
        key: "records",
        title: "Cartella clinica",
        description: "Timeline unificata e condivisione.",
        to: "/app/records",
        requiresPet: true,
        Icon: FileText,
        category: "Salute",
      },
      {
        key: "documents",
        title: "Documenti",
        description: "Upload e gestione documenti del pet.",
        to: "/app/documents",
        requiresPet: true,
        Icon: Files,
        category: "Salute",
      },
      {
        key: "medications",
        title: "Terapie",
        description: "Piani, orari, attiva/disattiva.",
        to: "/app/medications",
        requiresPet: true,
        Icon: Pill,
        category: "Salute",
      },
      {
        key: "vaccines",
        title: "Vaccini",
        description: "Scadenze e promemoria.",
        to: "/app/vaccines",
        requiresPet: true,
        Icon: Syringe,
        category: "Salute",
      },
      {
        key: "nutrition",
        title: "Alimentazione",
        description: "Pasti, acqua, routine alimentare.",
        to: "/app/nutrition",
        requiresPet: true,
        Icon: HeartPulse,
        category: "Salute",
      },
      {
        key: "wellness",
        title: "Benessere",
        description: "Attività e routine benessere.",
        to: "/app/wellness",
        requiresPet: true,
        Icon: HeartPulse,
        category: "Salute",
      },

      {
        key: "agenda",
        title: "Agenda",
        description: "Eventi, serie, export calendario.",
        to: "/app/agenda",
        requiresPet: true,
        Icon: CalendarCheck,
        category: "Pianifica",
      },
      {
        key: "planner",
        title: "Planner",
        description: "Task, scadenze, batch actions.",
        to: "/app/planner",
        requiresPet: true,
        Icon: ClipboardList,
        category: "Pianifica",
      },
      {
        key: "training",
        title: "Training",
        description: "Allenamento e progressi.",
        to: "/app/training",
        requiresPet: true,
        Icon: GraduationCap,
        category: "Pianifica",
      },
      {
        key: "bookings",
        title: "Prenotazioni",
        description: "Visite e appuntamenti.",
        to: "/app/bookings",
        requiresPet: true,
        Icon: ClipboardList,
        category: "Pianifica",
      },
      {
        key: "gps",
        title: "GPS",
        description: "Posizioni, ultimo punto, storico.",
        to: "/app/gps",
        requiresPet: true,
        Icon: MapPin,
        category: "Pianifica",
      },
      {
        key: "nearby",
        title: "Servizi vicini",
        description: "Ricerca servizi intorno a te.",
        to: "/app/nearby",
        Icon: MapPinned,
        category: "Pianifica",
      },
      {
        key: "expenses",
        title: "Spese",
        description: "Tracking spese e serie.",
        to: "/app/expenses",
        requiresPet: true,
        Icon: Receipt,
        category: "Pianifica",
      },

      {
        key: "community",
        title: "Community",
        description: "Post, gruppi e chat.",
        to: "/app/community",
        Icon: Users,
        category: "Community",
      },
      {
        key: "adoptions",
        title: "Adozioni",
        description: "Annunci e opportunità di adozione.",
        to: "/app/adoptions",
        Icon: HeartHandshake,
        category: "Community",
      },

      {
        key: "marketplace",
        title: "Marketplace",
        description: "Compra/vendi accessori e servizi.",
        to: "/app/marketplace",
        requiresPet: true,
        Icon: ShoppingBag,
        category: "Marketplace",
      },

      {
        key: "settings",
        title: "Impostazioni",
        description: "Tema, privacy, preferenze.",
        to: "/app/settings",
        Icon: Settings,
        category: "Pro",
      },
      ...(import.meta.env.DEV
        ? [
            {
              key: "provider",
              title: "Console pro",
              description: "Strumenti per professionisti.",
              to: "/app/provider",
              Icon: ClipboardList,
              category: "Pro",
            } satisfies ModuleItem,
            {
              key: "diagnostics",
              title: "Diagnostica",
              description: "Healthcheck, reset e strumenti.",
              to: "/app/diagnostics",
              Icon: Wrench,
              category: "Pro",
            } satisfies ModuleItem,
          ]
        : []),
    ],
    []
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => (i.title + " " + i.description).toLowerCase().includes(s));
  }, [items, q]);

  const grouped = useMemo(() => {
    const map = new Map<ModuleItem["category"], ModuleItem[]>();
    for (const i of filtered) {
      const arr = map.get(i.category) ?? [];
      arr.push(i);
      map.set(i.category, arr);
    }
    const order: ModuleItem["category"][] = ["Core", "Farm", "Salute", "Pianifica", "Community", "Marketplace", "Pro"];
    return order
      .map((k) => ({ k, items: (map.get(k) ?? []).slice().sort((a, b) => a.title.localeCompare(b.title)) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  function go(i: ModuleItem) {
    if (i.requiresPet && !activePetId) {
      pushToast({ type: "info", title: "Serve un pet", message: "Crea o seleziona un pet per usare questa funzione." });
      navigate("/app/pets");
      return;
    }
    navigate(i.to);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Esplora"
        description="Tutte le funzioni, in un posto solo. Cerca e apri al volo."
        imagePrompt="minimal clean illustration, grid of app modules with paw icon, airy white background, sky blue accent, premium, no text, no watermark"
        imageAlt="Esplora"
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Cerca funzioni</div>
              <div className="text-xs lp-muted">Esempio: “community”, “vaccini”, “gps”.</div>
            </div>
            <input
              className="lp-input max-w-md"
              placeholder="Cerca…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {grouped.map((g) => (
        <div key={g.k} className="space-y-2">
          <div className="text-sm font-semibold">{g.k}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.items.map((i) => (
              <button
                key={i.key}
                type="button"
                onClick={() => go(i)}
                className={i.requiresPet && !activePetId ? "lp-panel p-4 text-left opacity-75" : "lp-panel p-4 text-left"}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <i.Icon className="w-4 h-4" style={{ color: "rgb(var(--lp-primary-700))" }} />
                      <div className="text-sm font-semibold truncate">{i.title}</div>
                    </div>
                    <div className="mt-1 text-xs lp-muted">{i.description}</div>
                    {i.requiresPet && !activePetId ? (
                      <div className="mt-2 text-[11px]" style={{ color: "rgb(var(--lp-danger))" }}>
                        Richiede un pet selezionato
                      </div>
                    ) : null}
                  </div>
                  <span className="lp-badge lp-badge-info">Apri</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
