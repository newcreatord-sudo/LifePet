import { forwardRef } from "react";
import { ClipboardCheck, ListPlus, NotebookPen, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/components/ai/aiChatUi";
import { cn } from "@/lib/utils";

export const AiChatMessageList = forwardRef<
  HTMLDivElement,
  {
    messages: ChatMessage[];
    busy: boolean;
    disableActions?: boolean;
    onCopy?: (m: ChatMessage) => void;
    onSave?: (m: ChatMessage) => void;
    onTasks?: (m: ChatMessage) => void;
  }
>(function AiChatMessageList(props, ref) {
  return (
    <div ref={ref} className="h-[320px] overflow-y-auto lp-surface p-3 space-y-3">
      {props.messages.length === 0 ? (
        <div className="text-sm" style={{ color: "rgb(var(--lp-muted))" }}>
          <div className="font-semibold inline-flex items-center gap-2" style={{ color: "rgb(var(--lp-ink))" }}>
            <Sparkles className="w-4 h-4 lp-icon-primary" />
            Chat AI
          </div>
          <div className="mt-1">Scrivi una domanda e ricevi passi concreti. Puoi salvare in cartella clinica o creare task.</div>
        </div>
      ) : null}

      {props.messages.map((m, idx) => {
        const isAssistant = m.role === "assistant";
        const showActions = isAssistant && (props.onCopy || props.onSave || props.onTasks);
        const disabled = Boolean(props.disableActions || m.streaming);
        return (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap relative",
                m.role === "user" ? "text-white" : "lp-panel group"
              )}
              style={
                m.role === "user"
                  ? {
                      background: "linear-gradient(135deg, rgb(var(--lp-primary)) 0%, rgb(var(--lp-accent-1)) 100%)",
                    }
                  : { color: "rgb(var(--lp-ink))" }
              }
            >
              {showActions ? (
                <div className="absolute -top-3 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {props.onSave ? (
                    <button
                      type="button"
                      className="lp-btn-icon rounded-full px-2 py-1 text-[11px]"
                      aria-label="Salva messaggio"
                      data-testid={`ai-msg-save-${idx}`}
                      disabled={disabled}
                      onClick={() => props.onSave?.(m)}
                    >
                      <span className="inline-flex items-center gap-1">
                        <NotebookPen className="w-3 h-3" />
                        Salva
                      </span>
                    </button>
                  ) : null}
                  {props.onTasks ? (
                    <button
                      type="button"
                      className="lp-btn-icon rounded-full px-2 py-1 text-[11px]"
                      aria-label="Crea task dal messaggio"
                      data-testid={`ai-msg-tasks-${idx}`}
                      disabled={disabled}
                      onClick={() => props.onTasks?.(m)}
                    >
                      <span className="inline-flex items-center gap-1">
                        <ListPlus className="w-3 h-3" />
                        Task
                      </span>
                    </button>
                  ) : null}
                  {props.onCopy ? (
                    <button
                      type="button"
                      className="lp-btn-icon rounded-full px-2 py-1 text-[11px]"
                      aria-label="Copia messaggio"
                      data-testid={`ai-msg-copy-${idx}`}
                      disabled={disabled}
                      onClick={() => props.onCopy?.(m)}
                    >
                      <span className="inline-flex items-center gap-1">
                        <ClipboardCheck className="w-3 h-3" />
                        Copia
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {m.text}
              <div
                className="mt-1 text-[10px]"
                style={m.role === "user" ? { color: "rgba(255,255,255,0.72)" } : { color: "rgb(var(--lp-muted))" }}
              >
                {new Date(m.ts).toLocaleTimeString()}
              </div>
            </div>
          </div>
        );
      })}

      {props.busy ? (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl lp-panel px-3 py-2 text-sm" style={{ color: "rgb(var(--lp-muted))" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "rgba(var(--lp-primary),0.45)" }} />
              <div
                className="w-2 h-2 rounded-full animate-pulse [animation-delay:120ms]"
                style={{ backgroundColor: "rgba(var(--lp-primary),0.45)" }}
              />
              <div
                className="w-2 h-2 rounded-full animate-pulse [animation-delay:240ms]"
                style={{ backgroundColor: "rgba(var(--lp-primary),0.45)" }}
              />
              <span className="text-xs" style={{ color: "rgb(var(--lp-muted))" }}>
                Sto scrivendo…
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});
