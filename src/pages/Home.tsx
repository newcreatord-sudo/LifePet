import { Navigate, Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import {
  PawPrint,
  Shield,
  QrCode,
  FileText,
  Bell,
  HeartHandshake,
  Shuffle,
  ArrowRight,
  Lock,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { getFeatureImage, getLocalFallbackImageFromSeed, getMarketingHeroImage } from "@/lib/marketingImages";
import { SmartImage } from "@/components/ui/SmartImage";
import { Modal } from "@/components/ui/Modal";

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const configError = useAuthStore((s) => s.configError);
  const enterDemo = useAuthStore((s) => s.enterDemo);
  const [touch, setTouch] = useState(0);
  const [downloadOpen, setDownloadOpen] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const prevForce = el.getAttribute("data-lp-force-light");
    el.setAttribute("data-lp-force-light", "1");

    return () => {
      if (prevForce === null) el.removeAttribute("data-lp-force-light");
      else el.setAttribute("data-lp-force-light", prevForce);
    };
  }, []);

  if (!ready)
    return (
      <div
        className="min-h-screen"
        style={{
          background:
            "radial-gradient(1200px 900px at 10% 10%, rgba(224,247,255,0.96) 0%, rgba(255,255,255,0.98) 45%, rgba(240,238,255,0.96) 100%)",
        }}
      />
    );
  if (user) return <Navigate to="/app/dashboard" replace />;

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background:
          "radial-gradient(1200px 900px at 10% 10%, rgba(224,247,255,0.96) 0%, rgba(255,255,255,0.98) 45%, rgba(240,238,255,0.96) 100%)",
        color: "rgb(15,23,42)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -left-28 w-[520px] h-[520px] blur-3xl rounded-full" style={{ backgroundColor: "rgba(99,102,241,0.18)" }} />
        <div className="absolute top-12 -right-32 w-[620px] h-[620px] blur-3xl rounded-full" style={{ backgroundColor: "rgba(14,165,233,0.20)" }} />
        <div className="absolute -bottom-40 left-1/3 w-[680px] h-[680px] blur-3xl rounded-full" style={{ backgroundColor: "rgba(16,185,129,0.12)" }} />
      </div>

      <header className="relative px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center lp-primary-soft">
              <PawPrint className="w-5 h-5 lp-icon-primary" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold">{APP_NAME}</div>
              <div className="text-xs lp-muted">Sicurezza, ritrovamento, documenti</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {configError ? (
              <button type="button" onClick={() => enterDemo()} className="lp-btn-primary">
                Prova in demo
              </button>
            ) : (
              <>
                <button type="button" onClick={() => setDownloadOpen(true)} className="lp-btn-primary">
                  Scarica gratis
                </button>
                <Link to="/login?mode=signin" className="lp-btn-secondary inline-flex items-center justify-center">
                  Accedi
                </Link>
                <Link
                  to="/login?mode=signup"
                  className="lp-btn-secondary"
                >
                  Registra il tuo animale
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative px-6 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <section className="lg:col-span-7 pt-6">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs lp-primary-soft">
              <Shield className="w-4 h-4 lp-icon-primary" />
              Sicurezza e organizzazione, ogni giorno
            </div>
            <h1 className="mt-4 text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
              Tutto il tuo pet in un posto sicuro
            </h1>
            <div className="mt-2 text-2xl lg:text-3xl font-semibold tracking-tight leading-tight">
              Documenti, promemoria e profilo “Pet Protetto”
            </div>
            <p className="mt-4 text-base text-slate-700 leading-relaxed max-w-2xl">
              Organizza dati, vaccini e referti. Attiva QR + ID per una scheda pubblica sicura in caso di smarrimento.
              In emergenza hai tutto pronto, senza cercare tra chat e foto.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setDownloadOpen(true)}
                className="lp-btn-primary inline-flex items-center justify-center px-5 py-3"
              >
                Scarica gratis
              </button>
              <Link
                to={configError ? "#" : "/login?mode=signup"}
                onClick={configError ? (e) => {
                  e.preventDefault();
                  enterDemo();
                } : undefined}
                className="lp-btn-secondary inline-flex items-center justify-center px-5 py-3"
              >
                Registra il tuo animale
              </Link>
            </div>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="lp-panel p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Shield className="w-4 h-4 lp-icon-primary" />
                  🛡️ Pet protetto
                </div>
                <div className="mt-1 text-xs lp-muted">QR + ID · Scheda pubblica · Segnalazioni trovato/avvistato</div>
                <div className="mt-2 text-xs text-slate-700">Attivalo quando vuoi: la scheda pubblica esiste solo se abiliti la protezione.</div>
              </div>
              <div className="lp-panel p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="w-4 h-4 lp-icon-primary" />
                  Documenti cloud
                </div>
                <div className="mt-1 text-xs text-slate-700">PDF e foto ordinati per pet: referti, ricette, analisi, microchip.</div>
                <div className="mt-2 text-xs lp-muted">Backup ed export quando serve (ZIP/manifest).</div>
              </div>
              <div className="lp-panel p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bell className="w-4 h-4 lp-icon-primary" />
                  Promemoria chiari
                </div>
                <div className="mt-1 text-xs lp-muted">Planner · Agenda · Notifiche</div>
                <div className="mt-2 text-xs text-slate-700">Vaccini, visite, routine: meno stress e più controllo.</div>
              </div>
              <div className="lp-panel p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <QrCode className="w-4 h-4 lp-icon-primary" />
                  Smarrimento
                </div>
                <div className="mt-1 text-xs lp-muted">Segna smarrito · Messaggio pubblico · Segnalazioni</div>
                <div className="mt-2 text-xs text-slate-700">Chi scansiona il QR può inviare una segnalazione al proprietario.</div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-5">
            <div className="rounded-3xl p-5 overflow-hidden relative border border-slate-200/70 bg-white/80 backdrop-blur-sm shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
              <div className="relative space-y-3">
                <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70">
                  <SmartImage
                    alt={`Ritrovamento con ${APP_NAME}`}
                    className="w-full h-56"
                    imgClassName="w-full h-full object-cover"
                    decoding="async"
                    loading="eager"
                    src={
                      "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=" +
                      encodeURIComponent(
                        "photorealistic scene, split focus between pet and farm: a person holding a smartphone with a clean animal management app UI, map with geofence circle and livestock markers visible; in background a friendly dog with a tag and a small group of cattle in a field, warm natural light, cinematic composition, shallow depth of field, high detail, natural colors, no text"
                      ) +
                      "&image_size=landscape_16_9"
                    }
                    fallbackSrc={getMarketingHeroImage("home", touch)}
                    overlay={
                      <button
                        type="button"
                        className="absolute top-2 right-2 lp-btn-secondary px-2 py-1"
                        onClick={() => setTouch((x) => x + 1)}
                        aria-label="Cambia immagine"
                        title="Cambia immagine"
                      >
                        <Shuffle className="w-4 h-4" />
                      </button>
                    }
                  />
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">Funzioni chiave</div>
                    <div className="text-xs lp-muted mt-1">Chiaro, veloce, mobile-first</div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center lp-primary-soft">
                    <QrCode className="w-5 h-5 lp-icon-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="lp-panel p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <QrCode className="w-4 h-4 lp-icon-primary" />
                      QR + ID univoco
                    </div>
                    <div className="text-xs lp-muted mt-1">Scansione → scheda pet → contatto rapido → segnalazione trovato.</div>
                  </div>
                  <div className="lp-panel p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Shield className="w-4 h-4 lp-icon-primary" />
                      Privacy by design
                    </div>
                    <div className="text-xs lp-muted mt-1">I dati del pet sono privati. Pubblico solo ciò che attivi tu.</div>
                  </div>
                  <div className="lp-panel p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HeartHandshake className="w-4 h-4 lp-icon-primary" />
                      Adozioni e impatto sociale
                    </div>
                    <div className="text-xs lp-muted mt-1">Aiutiamo a svuotare i canili: bacheca animali e richieste.</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="max-w-6xl mx-auto mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="lp-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><Lock className="w-4 h-4 lp-icon-primary" /> Sicurezza</div>
              <div className="text-xs lp-muted mt-2">Accesso protetto. Dati privati per default.</div>
              <div className="text-xs text-slate-700 mt-2">La scheda pubblica esiste solo se attivi “Pet Protetto”.</div>
            </div>
            <div className="lp-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="w-4 h-4 lp-icon-primary" /> Praticità</div>
              <div className="text-xs lp-muted mt-2">In emergenza trovi tutto in 10 secondi.</div>
              <div className="text-xs text-slate-700 mt-2">Documenti, vaccini, cronologia e promemoria collegati allo stesso pet.</div>
            </div>
            <div className="lp-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><HelpCircle className="w-4 h-4 lp-icon-primary" /> Supporto</div>
              <div className="text-xs lp-muted mt-2">Strumenti chiari, feedback immediato, flussi guidati.</div>
              <div className="text-xs text-slate-700 mt-2">Se qualcosa non va, “Stato sistema” ti dice cosa manca.</div>
            </div>
          </div>

          <div className="mt-4 lp-card p-5">
            <div className="text-lg font-semibold">Quando serve davvero, sei pronto</div>
            <div className="text-sm text-slate-700 mt-1">Smarrimento, visita veterinaria, emergenza: riduci ansia e tempi morti.</div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Link to="/login?mode=signup" className="lp-btn-secondary inline-flex items-center justify-center px-5 py-3">
                Crea account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <button
                type="button"
                onClick={() => enterDemo()}
                className="lp-btn-primary inline-flex items-center justify-center px-5 py-3"
              >
                Prova subito
              </button>
            </div>
            <div className="mt-4 text-xs lp-muted">Consiglio: attiva “Pet Protetto” solo quando hai completato almeno foto + microchip/nota.</div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="lp-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><PawPrint className="w-4 h-4 lp-icon-primary" /> Feedback</div>
              <div className="mt-3 space-y-3">
                <div className="lp-panel p-4">
                  <div className="text-sm">“Finalmente i documenti non sono sparsi tra chat e galleria foto.”</div>
                  <div className="text-xs lp-muted mt-1">— Proprietario di cane</div>
                </div>
                <div className="lp-panel p-4">
                  <div className="text-sm">“Il QR è semplice: chi trova il pet può inviare una segnalazione subito.”</div>
                  <div className="text-xs lp-muted mt-1">— Proprietaria di gatto</div>
                </div>
              </div>
            </div>
            <div className="lp-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold"><PawPrint className="w-4 h-4 lp-icon-primary" /> Tutte le funzioni</div>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <div className="lp-panel p-4">
                  <SmartImage
                    alt="Documenti e cartella clinica"
                    className="w-full h-20 rounded-xl"
                    imgClassName="w-full h-full object-cover"
                    decoding="async"
                    loading="lazy"
                    src={getFeatureImage("documents", touch)}
                    fallbackSrc={getLocalFallbackImageFromSeed("documenti")}
                  />
                  <div className="mt-2 text-xs lp-muted">Documenti, cartella clinica, vaccini, terapie, planner e molto altro.</div>
                </div>
                <div className="lp-panel p-4">
                  <SmartImage
                    alt="Community e adozioni"
                    className="w-full h-20 rounded-xl"
                    imgClassName="w-full h-full object-cover"
                    decoding="async"
                    loading="lazy"
                    src={getFeatureImage("community", touch)}
                    fallbackSrc={getLocalFallbackImageFromSeed("community")}
                  />
                  <div className="mt-2 text-xs lp-muted">Community, passeggiate, geolocalizzazione e bacheca adozioni.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 lp-card p-5" id="faq">
            <div className="text-lg font-semibold">FAQ</div>
            <div className="text-sm text-slate-700 mt-1">Risposte rapide alle domande più comuni.</div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  q: "La scheda pubblica è visibile a tutti?",
                  a: "Solo se attivi Pet Protetto. Puoi disattivarla quando vuoi. I dati privati restano nel tuo account.",
                },
                {
                  q: "Cosa vede chi scansiona il QR?",
                  a: "Una pagina pubblica con le info utili per aiutarti a recuperare l’animale e un form per inviare una segnalazione.",
                },
                {
                  q: "Posso usare PetLyon senza installare app?",
                  a: "Sì: funziona da browser. Se vuoi, puoi installarla come PWA da iPhone/Android.",
                },
                {
                  q: "E se perdo il telefono?",
                  a: "Accedi da un altro dispositivo e ritrovi profili e documenti. Puoi esportare backup dei documenti quando vuoi.",
                },
              ].map((x) => (
                <details key={x.q} className="lp-panel p-4">
                  <summary className="cursor-pointer text-sm font-semibold" style={{ color: "rgb(var(--lp-ink))" }}>{x.q}</summary>
                  <div className="mt-2 text-sm text-slate-700">{x.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Modal
        open={downloadOpen}
        title="Scarica PetLyon gratis"
        description="Puoi usarlo come app (PWA) oppure da browser."
        onClose={() => setDownloadOpen(false)}
      >
        <div className="space-y-3">
          <div className="lp-panel p-4">
            <div className="text-sm font-semibold">Installa come app</div>
            <div className="text-xs lp-muted mt-1">Android: menu del browser → “Installa app”. iPhone: Condividi → “Aggiungi a Home”.</div>
          </div>
          <div className="lp-panel p-4">
            <div className="text-sm font-semibold">Inizia subito</div>
            <div className="text-xs lp-muted mt-1">Crea un account e registra il tuo animale per attivare “Pet Protetto”.</div>
            <div className="mt-3 flex gap-2">
              <Link to="/login?mode=signup" className="lp-btn-primary inline-flex items-center justify-center">Registra il tuo animale</Link>
              <button type="button" className="lp-btn-secondary" onClick={() => { enterDemo(); setDownloadOpen(false); }}>Prova in demo</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
