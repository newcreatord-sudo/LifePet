import { cn } from "@/lib/utils";
import { tr, type AppLang } from "@/lib/i18n";
import { useI18nStore } from "@/stores/i18nStore";
import { getLocalFallbackImageFromSeed, getPageHeaderImage } from "@/lib/marketingImages";
import { SmartImage } from "@/components/ui/SmartImage";
import { useState } from "react";
import { Shuffle } from "lucide-react";

type I18nText = string | { it: string; en: string };

function resolveText(lang: AppLang, v: I18nText) {
  if (typeof v === "string") return v;
  return tr(lang, v.it, v.en);
}

export function PageHeader({
  title,
  description,
  actions,
  imagePrompt,
  imageAlt,
  imageSrc,
  imageSize = "landscape_4_3",
  showImage = true,
  className,
  titleClassName,
  actionsClassName,
}: {
  title: I18nText;
  description?: I18nText;
  actions?: React.ReactNode;
  imagePrompt?: string;
  imageAlt?: string;
  imageSrc?: string;
  imageSize?: "landscape_4_3" | "landscape_16_9" | "square";
  showImage?: boolean;
  className?: string;
  titleClassName?: string;
  actionsClassName?: string;
}) {
  const lang = useI18nStore((s) => s.lang);
  const resolvedTitle = resolveText(lang, title);
  const resolvedDescription = description ? resolveText(lang, description) : undefined;
  const _prompt = imagePrompt;
  void _prompt;

  const [touch, setTouch] = useState(0);

  const aspectClass = imageSize === "landscape_16_9" ? "aspect-[16/9]" : imageSize === "square" ? "aspect-square" : "aspect-[4/3]";

  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-start md:justify-between", className)}>
      <div className="min-w-0">
        <div className={cn("text-xl md:text-2xl font-semibold tracking-tight", titleClassName)} style={{ color: "rgb(var(--lp-ink))" }}>
          <span className="relative inline-block">
            {resolvedTitle}
            <span
              className="absolute -bottom-1 left-0 h-[3px] w-12 rounded-full"
              style={{ background: "linear-gradient(90deg, rgb(var(--lp-primary)) 0%, rgb(var(--lp-accent-1)) 55%, rgb(var(--lp-accent-2)) 100%)" }}
            />
          </span>
        </div>
        {resolvedDescription ? (
          <div className="text-sm mt-1" style={{ color: "rgb(var(--lp-muted))" }}>
            {resolvedDescription}
          </div>
        ) : null}
      </div>

      <div className="flex items-start gap-3">
        {actions ? <div className={cn("flex flex-wrap items-center gap-2 justify-end", actionsClassName)}>{actions}</div> : null}
        {showImage ? (
          <div className="hidden md:block w-[220px] lg:w-[260px] lp-hero-frame">
            <SmartImage
              src={imageSrc ?? getPageHeaderImage(imageAlt ?? resolvedTitle, touch)}
              fallbackSrc={getLocalFallbackImageFromSeed(imageAlt ?? resolvedTitle)}
              alt={imageAlt ?? resolvedTitle}
              className={cn("w-full", aspectClass)}
              imgClassName="w-full h-full object-cover lp-anim-in motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
              overlay={
                <button
                  type="button"
                  className="absolute top-2 right-2 lp-btn-secondary px-2 py-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTouch((x) => x + 1);
                  }}
                  aria-label="Cambia immagine"
                  title="Cambia immagine"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
