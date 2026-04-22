import { createContext, useContext, type CSSProperties } from "react";

export const ConfirmStyles = {
  cancelButtonClass: "lp-btn-secondary",
  confirmButtonClass: "lp-btn-primary",
  dangerButtonStyle: { backgroundColor: "rgb(var(--lp-danger))" } as CSSProperties,
};

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};

export type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirmDialog() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("ConfirmProvider mancante");
  return ctx.confirm;
}

