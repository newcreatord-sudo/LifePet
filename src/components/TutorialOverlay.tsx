import { useMemo } from "react";
import { X, ChevronLeft, ChevronRight, CircleHelp, RotateCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { findTutorialSection, getTutorialSections } from "@/lib/tutorialContent";
import { useTutorialStore } from "@/stores/tutorialStore";

export function TutorialOverlay() {
  const enabled = useTutorialStore((s) => s.enabled);
  const open = useTutorialStore((s) => s.open);
  const routeKey = useTutorialStore((s) => s.routeKey);
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const close = useTutorialStore((s) => s.close);
  const next = useTutorialStore((s) => s.next);
  const prev = useTutorialStore((s) => s.prev);
  const markRouteDone = useTutorialStore((s) => s.markRouteDone);
  const resetProgress = useTutorialStore((s) => s.resetProgress);

  const navigate = useNavigate();
  const location = useLocation();

  const section = useMemo(() => findTutorialSection(routeKey), [routeKey]);
  const steps = section?.steps ?? [];
  const step = steps[stepIndex] ?? null;
  const canPrev = stepIndex > 0;
  const canNext = stepIndex < steps.length - 1;

  if (!enabled || !open || !step) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm" onClick={close} />

      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200/70 bg-white/90 shadow-xl">
          <div className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-600/10 border border-sky-600/20 flex items-center justify-center">
                  <CircleHelp className="w-4 h-4 text-sky-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{section?.title ?? "Tutorial"}</div>
                  <div className="text-xs text-slate-600">
                    Passo {stepIndex + 1} di {steps.length}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-sm font-medium text-slate-900">{step.title}</div>
              <div className="mt-1 text-sm text-slate-700 leading-relaxed">{step.body}</div>
            </div>

            <button
              onClick={close}
              className="shrink-0 rounded-xl border border-slate-200/70 bg-white/60 p-2 hover:bg-white"
              aria-label="Chiudi tutorial"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {getTutorialSections().map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    if (location.pathname !== s.key) navigate(s.key);
                    useTutorialStore.getState().openForRoute(s.key);
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs transition-colors",
                    s.key === routeKey
                      ? "border-sky-600/30 bg-sky-600/10 text-sky-800"
                      : "border-slate-200/70 bg-white/60 text-slate-700 hover:bg-white"
                  )}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => resetProgress()}
                className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={() => {
                  useTutorialStore.getState().setEnabled(false);
                  close();
                }}
                className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-xs hover:bg-white"
              >
                Disattiva tutorial
              </button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => prev()}
                disabled={!canPrev}
                className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-sm hover:bg-white disabled:opacity-50 inline-flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Indietro
              </button>
              {canNext ? (
                <button
                  onClick={() => next(steps.length)}
                  className="rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-500 inline-flex items-center gap-2"
                >
                  Avanti
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    markRouteDone(routeKey);
                    close();
                  }}
                  className="rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-500"
                >
                  Fine
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

