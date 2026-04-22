import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Status = "loading" | "loaded" | "error";

export function SmartImage({
  src,
  alt,
  className,
  imgClassName,
  fallbackSrc,
  loading = "lazy",
  decoding = "async",
  onClick,
  overlay,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackSrc?: string;
  loading?: "eager" | "lazy";
  decoding?: "async" | "auto" | "sync";
  onClick?: () => void;
  overlay?: ReactNode;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
    setStatus("loading");
  }, [src]);

  const clickable = Boolean(onClick);

  const skeleton = useMemo(() => {
    if (status !== "loading") return null;
    return <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: "rgba(var(--lp-ink),0.06)" }} />;
  }, [status]);

  const errorOverlay = useMemo(() => {
    if (status !== "error") return null;
    return (
      <div
        className="absolute inset-0 flex items-center justify-center text-xs"
        style={{ backgroundColor: "rgba(var(--lp-ink),0.06)", color: "rgb(var(--lp-muted))" }}
      >
        Immagine non disponibile
      </div>
    );
  }, [status]);

  return (
    <div
      className={cn("relative overflow-hidden", clickable ? "cursor-pointer" : "", className)}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
    >
      <img
        alt={alt}
        className={cn("block w-full h-full object-cover", imgClassName)}
        decoding={decoding}
        loading={loading}
        src={currentSrc}
        onLoad={() => setStatus("loaded")}
        onError={() => {
          if (fallbackSrc && currentSrc !== fallbackSrc) {
            setCurrentSrc(fallbackSrc);
            setStatus("loading");
            return;
          }
          setStatus("error");
        }}
      />
      {skeleton}
      {errorOverlay}
      {overlay}
    </div>
  );
}
