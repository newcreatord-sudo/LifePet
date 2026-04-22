import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrainCircuit, Camera, FileArchive, MessageSquare, Stethoscope, Video } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePetStore } from "@/stores/petStore";
import { AiTopNav } from "@/components/ai/AiTopNav";
import { AiSafetyBanner } from "@/components/ai/AiSafetyBanner";

export default function Ai() {
  const activePetId = usePetStore((s) => s.activePetId);
  const pets = usePetStore((s) => s.pets);
  const navigate = useNavigate();
  const location = useLocation();

  const activePet = useMemo(() => pets.find((p) => p.id === activePetId) ?? null, [activePetId, pets]);

  const legacyTab = useMemo(() => {
    const p = new URLSearchParams(location.search);
    const t = String(p.get("tab") || "").trim().toLowerCase();
    if (!t) return "";
    if (t === "chat") return "chat";
    if (t === "saves" || t === "salvataggi") return "saves";
    if (t === "symptoms" || t === "sintomi") return "symptoms";
    if (t === "photo" || t === "foto") return "photo";
    if (t === "video") return "video";
    if (t === "summary" || t === "riepilogo") return "summary";
    return "";
  }, [location.search]);

  useEffect(() => {
    if (!legacyTab) return;
    const to =
      legacyTab === "chat"
        ? "/app/ai/chat"
        : legacyTab === "symptoms"
          ? "/app/ai/symptoms"
          : legacyTab === "photo"
            ? "/app/ai/photo"
            : legacyTab === "video"
              ? "/app/ai/video"
              : legacyTab === "summary"
                ? "/app/ai/summary"
                : "/app/ai/saves";
    navigate(to, { replace: true });
  }, [legacyTab, navigate]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI"
        description={activePet ? `Pet attivo: ${activePet.name}` : "Seleziona un pet"}
        imageAlt="AI"
      />

      <AiTopNav active="chat" />

      <AiSafetyBanner mode="general" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/app/ai/chat" className="group">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 lp-icon-primary" />
              <div className="text-sm font-semibold">Chat</div>
            </div>
            <div className="text-xs lp-muted mt-1">Domande rapide e risposte pratiche.</div>
            <div className="mt-3 text-sm font-medium group-hover:underline" style={{ color: "rgb(var(--lp-primary-700))" }}>Apri</div>
          </Card>
        </Link>
        <Link to="/app/ai/symptoms" className="group">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5" style={{ color: "rgb(var(--lp-danger))" }} />
              <div className="text-sm font-semibold">Sintomi</div>
            </div>
            <div className="text-xs lp-muted mt-1">Checklist e domande utili, senza diagnosi.</div>
            <div className="mt-3 text-sm font-medium group-hover:underline" style={{ color: "rgb(var(--lp-primary-700))" }}>Apri</div>
          </Card>
        </Link>
        <Link to="/app/ai/summary" className="group">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 lp-icon-primary" />
              <div className="text-sm font-semibold">Riepilogo</div>
            </div>
            <div className="text-xs lp-muted mt-1">Sintesi e prossimi passi.</div>
            <div className="mt-3 text-sm font-medium group-hover:underline" style={{ color: "rgb(var(--lp-primary-700))" }}>Apri</div>
          </Card>
        </Link>
        <Link to="/app/ai/photo" className="group">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 lp-icon-primary" />
              <div className="text-sm font-semibold">Foto</div>
            </div>
            <div className="text-xs lp-muted mt-1">Analisi informativa immagini.</div>
            <div className="mt-3 text-sm font-medium group-hover:underline" style={{ color: "rgb(var(--lp-primary-700))" }}>Apri</div>
          </Card>
        </Link>
        <Link to="/app/ai/video" className="group">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 lp-icon-primary" />
              <div className="text-sm font-semibold">Video</div>
            </div>
            <div className="text-xs lp-muted mt-1">Analisi informativa video brevi.</div>
            <div className="mt-3 text-sm font-medium group-hover:underline" style={{ color: "rgb(var(--lp-primary-700))" }}>Apri</div>
          </Card>
        </Link>
        <Link to="/app/ai/saves" className="group">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <FileArchive className="w-5 h-5 lp-icon-primary" />
              <div className="text-sm font-semibold">Salvataggi</div>
            </div>
            <div className="text-xs lp-muted mt-1">Storico affidabile e copia rapida.</div>
            <div className="mt-3 text-sm font-medium group-hover:underline" style={{ color: "rgb(var(--lp-primary-700))" }}>Apri</div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
