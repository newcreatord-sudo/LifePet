import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-800 bg-slate-950/40 p-5", className)}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="w-10 h-10 rounded-2xl bg-emerald-300/10 border border-emerald-300/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-emerald-200" />
          </div>
        ) : null}
        <div className="flex-1">
          <div className="font-semibold">{title}</div>
          {description ? <div className="text-sm text-slate-400 mt-1">{description}</div> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

