import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          background: "var(--lp-app-bg)",
          color: "rgb(var(--lp-ink))",
        }}
      >
        <div className="lp-card w-full max-w-xl rounded-3xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-rose-700" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold">Si è verificato un errore</div>
              <div className="text-sm text-slate-700 mt-1">Ricarica la pagina. Se il problema persiste, torna alla Home.</div>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="lp-btn-primary inline-flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Ricarica
            </button>
            <a href="/" className="lp-btn-secondary inline-flex items-center justify-center">
              Vai alla Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
