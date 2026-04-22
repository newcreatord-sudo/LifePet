import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("lp-skeleton", className)} />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="lp-panel p-3">
      <div className="lp-skeleton h-4 w-40" />
      <div className="mt-2 grid gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="lp-skeleton h-3 w-full" />
        ))}
      </div>
    </div>
  );
}

