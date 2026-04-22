import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartImage } from "@/components/ui/SmartImage";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  imageSrc,
  imageAlt,
  bullets,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  bullets?: string[];
  className?: string;
}) {
  return (
    <div className={cn("lp-surface p-5", className)}>
      {imageSrc ? (
        <div className="mb-4 overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(var(--lp-ink),0.10)" }}>
          <SmartImage src={imageSrc} alt={imageAlt ?? title} className="w-full aspect-[16/9]" imgClassName="w-full h-full object-cover" />
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center lp-primary-soft">
            <Icon className="w-5 h-5 lp-icon-primary" />
          </div>
        ) : null}
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>
            {title}
          </div>
          {description ? (
            <div className="text-sm mt-1" style={{ color: "rgb(var(--lp-muted))" }}>
              {description}
            </div>
          ) : null}
          {bullets && bullets.length ? (
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm" style={{ color: "rgb(var(--lp-ink))" }}>
              {bullets.map((b) => (
                <li key={b} className="lp-panel p-3">{b}</li>
              ))}
            </ul>
          ) : null}
          {action || secondaryAction ? (
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              {action}
              {secondaryAction}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
