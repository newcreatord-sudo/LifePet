import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SmartImage } from "@/components/ui/SmartImage";
import { getLocalFallbackImageFromSeed, getPageHeaderImage } from "@/lib/marketingImages";

type Action = { label: string; to?: string; onClick?: () => void; variant?: "primary" | "secondary" };

export function ContentPageTemplate({
  title,
  description,
  imageSeed,
  primaryAction,
  secondaryAction,
  whatYouCanDo,
  quickSteps,
  sidebarTips,
  children,
}: {
  title: string;
  description?: string;
  imageSeed: string;
  primaryAction?: Action;
  secondaryAction?: Action;
  whatYouCanDo?: string[];
  quickSteps?: { title: string; detail: string }[];
  sidebarTips?: { title: string; detail: string }[];
  children?: React.ReactNode;
}) {
  const headerImage = getPageHeaderImage(imageSeed);
  const headerFallback = getLocalFallbackImageFromSeed(imageSeed);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        showImage={false}
        actions={
          primaryAction || secondaryAction ? (
            <div className="flex items-center gap-2">
              {secondaryAction ? (
                secondaryAction.onClick ? (
                  <button
                    type="button"
                    onClick={secondaryAction.onClick}
                    className={secondaryAction.variant === "primary" ? "lp-btn-primary" : "lp-btn-secondary"}
                  >
                    {secondaryAction.label}
                  </button>
                ) : secondaryAction.to ? (
                  <Link
                    to={secondaryAction.to}
                    className={secondaryAction.variant === "primary" ? "lp-btn-primary" : "lp-btn-secondary"}
                  >
                    {secondaryAction.label}
                  </Link>
                ) : null
              ) : null}
              {primaryAction ? (
                primaryAction.onClick ? (
                  <button
                    type="button"
                    onClick={primaryAction.onClick}
                    className={primaryAction.variant === "secondary" ? "lp-btn-secondary" : "lp-btn-primary"}
                  >
                    {primaryAction.label}
                  </button>
                ) : primaryAction.to ? (
                  <Link to={primaryAction.to} className={primaryAction.variant === "secondary" ? "lp-btn-secondary" : "lp-btn-primary"}>
                    {primaryAction.label}
                  </Link>
                ) : null
              ) : null}
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <Card className="overflow-hidden">
            <SmartImage
              src={headerImage}
              fallbackSrc={headerFallback}
              alt={title}
              className="w-full aspect-[16/9]"
              imgClassName="w-full h-full object-cover"
              loading="eager"
            />
          </Card>

          {whatYouCanDo && whatYouCanDo.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Cosa puoi fare qui</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm" style={{ color: "rgb(var(--lp-ink))" }}>
                  {whatYouCanDo.map((t) => (
                    <li key={t} className="lp-panel p-3">{t}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {quickSteps && quickSteps.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Passi rapidi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {quickSteps.map((s, idx) => (
                    <div key={s.title} className="lp-panel p-3">
                      <div className="text-xs lp-muted">Step {idx + 1}</div>
                      <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{s.title}</div>
                      <div className="text-xs mt-1" style={{ color: "rgb(var(--lp-muted))" }}>{s.detail}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {children}
        </div>

        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suggerimenti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(sidebarTips && sidebarTips.length ? sidebarTips : [{ title: "Inizia dal profilo", detail: "Crea o seleziona un pet per sbloccare tutte le funzioni." }]).map((t) => (
                <div key={t.title} className="lp-panel p-3">
                  <div className="text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{t.title}</div>
                  <div className="text-xs mt-1" style={{ color: "rgb(var(--lp-muted))" }}>{t.detail}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Problemi comuni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm" style={{ color: "rgb(var(--lp-muted))" }}>
              <div className="lp-panel p-3">Se vedi schermi vuoti, prova un refresh (Ctrl+F5) o svuota la cache PWA.</div>
              <div className="lp-panel p-3">Se mancano dati, aggiungi il primo elemento: l’app ti mostrerà trend e riepiloghi.</div>
              <div className="lp-panel p-3">Se un’immagine non carica, vedrai un fallback locale e puoi riprovare.</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
