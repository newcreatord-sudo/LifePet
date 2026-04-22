import { cn } from "@/lib/utils";

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: "info" | "success" | "warn" | "danger";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const bodyColor = variant === "info" ? "rgb(var(--lp-muted))" : "rgba(var(--lp-ink), 0.88)";
  return (
    <div
      className={cn(
        "lp-alert",
        variant === "info" ? "lp-alert-info" : variant === "success" ? "lp-alert-success" : variant === "warn" ? "lp-alert-warn" : "lp-alert-danger",
        className
      )}
      role={variant === "danger" ? "alert" : "status"}
    >
      {title ? <div className="text-sm font-semibold">{title}</div> : null}
      {children ? (
        <div
          className={title ? "mt-1 text-sm whitespace-pre-wrap break-words" : "text-sm whitespace-pre-wrap break-words"}
          style={{ color: bodyColor }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
