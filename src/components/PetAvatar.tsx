import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getPhotoUrl } from "@/data/profilePhotos";

export function PetAvatar({ photoPath, name, className }: { photoPath?: string; name?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!photoPath) return;
    getPhotoUrl(photoPath)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [photoPath]);

  return (
    <div
      className={cn(
        "w-10 h-10 rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden flex items-center justify-center text-xs text-slate-300",
        className
      )}
    >
      {url ? (
        <img src={url} alt={name ?? "pet"} className="w-full h-full object-cover" />
      ) : (
        <span className="font-medium">{(name ?? "").slice(0, 1).toUpperCase() || "P"}</span>
      )}
    </div>
  );
}

