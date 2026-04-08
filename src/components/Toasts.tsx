import { useEffect } from "react";
import { CircleCheck, CircleX, Info } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";

function iconFor(type: "success" | "error" | "info") {
  if (type === "success") return CircleCheck;
  if (type === "error") return CircleX;
  return Info;
}

function clsFor(type: "success" | "error" | "info") {
  if (type === "success") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-900";
  if (type === "error") return "border-rose-500/25 bg-rose-500/10 text-rose-950";
  return "border-sky-500/25 bg-sky-500/10 text-slate-900";
}

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => remove(t.id), 4500));
    return () => {
      for (const x of timers) clearTimeout(x);
    };
  }, [remove, toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[70] space-y-2 w-[min(360px,calc(100vw-2rem))]">
      {toasts.map((t) => {
        const Icon = iconFor(t.type);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => remove(t.id)}
            className={`w-full text-left rounded-2xl border px-3 py-2 shadow-sm backdrop-blur-md bg-white/80 hover:bg-white ${clsFor(t.type)}`}
          >
            <div className="flex items-start gap-2">
              <Icon className="w-5 h-5 mt-0.5" />
              <div className="min-w-0">
                {t.title ? <div className="text-sm font-semibold truncate">{t.title}</div> : null}
                <div className="text-sm leading-snug">{t.message}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

