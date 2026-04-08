import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";
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
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur-sm p-6">
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
            <Link to="/" className="lp-btn-secondary inline-flex items-center justify-center">
              Vai alla Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

