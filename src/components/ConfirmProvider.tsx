import { useCallback, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmContext, ConfirmStyles, type ConfirmOptions } from "@/components/confirm";

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const resolverRef = useRef<null | ((v: boolean) => void)>(null);
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ title: "Conferma" });

  const confirm = useCallback(async (next: ConfirmOptions) => {
    setOpts(next);
    setOpen(true);
    return await new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    setOpen(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    if (r) r(value);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal open={open} title={opts.title} description={opts.description} onClose={() => close(false)}>
        <div className="flex justify-end gap-2">
          <button type="button" className={ConfirmStyles.cancelButtonClass} onClick={() => close(false)}>
            {opts.cancelLabel ?? "Annulla"}
          </button>
          <button
            type="button"
            className={ConfirmStyles.confirmButtonClass}
            style={opts.variant === "danger" ? ConfirmStyles.dangerButtonStyle : undefined}
            onClick={() => close(true)}
          >
            {opts.confirmLabel ?? "Conferma"}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
