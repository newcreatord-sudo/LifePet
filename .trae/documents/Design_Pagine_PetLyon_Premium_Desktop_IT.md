# Design Pagine (Desktop-first) — PetLyon Premium

## Global Styles
- Layout: desktop-first con grid a 12 colonne; sidebar sinistra fissa (IA), contenuto a destra; sticky header per contesto (Pet/Farm).
- Token: background `slate-50 → white`, ink `--lp-ink`, muted `--lp-muted`, accent (Premium) oro tenue `#C8A24A`.
- Tipografia: H1 28/32, H2 18/24, body 14/20; badge 12/16.
- Button: primary (accent), secondary (slate), ghost (hover slate-100). Stati: disabled 50% opacity; focus ring accent.

## Pagina: App Shell (tutte le pagine /app/*)
### Meta
- Title: "PetLyon" + nome pagina
- Description: "Gestione pet e funzioni Premium"
- OG: og:image `/og.svg`, og:title coerente

### Struttura
- Header: logo + PetSwitcher + badge piano (Free/Pro) + CTA Premium se Free.
- Sidebar (IA):
  - Sezione **Core** (sempre visibile): Dashboard, Profilo Pet, Salute, Documenti, Planner.
  - Sezione **Secondaria** (collassabile): Explore, Community, Marketplace, Servizi, Tech.
  - Sezione **Farm** (separata): singola entry “Farm” con descrizione "Area allevamento" e stato accesso.
- Contenuto: PageHeader + cards; CTA Premium contestuale quando serve.

### Microcopy (shell)
- Badge piano Free: "Free" + link: "Passa a Premium"
- Badge piano Pro: "Pro attivo"
- Tooltip lock: "Disponibile con Premium"
- Empty state paywall: "Sblocca questa funzione con Premium."

## Pagina: Impostazioni & Premium (/app/settings)
### Struttura
- Sezione "Piano": card con stato (`BillingStatus`), benefici, CTA.
- CTA principali:
  - Free: bottone primary "Attiva Premium" → checkout
  - Pro: bottone secondary "Gestisci abbonamento" → portal
- Gestione callback: banner in-page per `?checkout=success|cancel`.

### Microcopy (Premium)
- Titolo: "PetLyon Premium"
- Sottotitolo: "Più potenza, meno limiti."
- Benefici (bullets): "Limiti AI più alti", "Sblocco funzioni Pro", "Export avanzato (se presente)"
- Checkout success: "Premium attivo. Bentornato!"
- Checkout cancel: "Operazione annullata. Puoi riprovare quando vuoi."

## Pagina: AI (/app/ai/*)
### Struttura
- Top nav AI (tab): Chat, Sintomi, Foto, Video, Summary, Salvati.
- Gating: quando `resource-exhausted`/"Pro required" → modal paywall con CTA + "Non ora".

### Microcopy (AI)
- Banner medico-legale: "Risposte informative, non sostituiscono il veterinario."
- Paywall title: "Sblocca AI Premium"
- Paywall CTA: "Passa a Premium"
- Secondary: "Continua con Free" (se consentito) / "Chiudi"

## Pagina: Farm (shell /app/farm/*)
### Struttura
- Header contesto: label "Reparto: Farm" + selector farm + pulsante "Pet" per tornare in /app/dashboard.
- Sidebar interna: Dashboard, Mappa, Animali, Dispositivi, Mandrie, Recinti, Alert, Report.

### Microcopy (Farm)
- Entry da App: "Apri Farm" + helper "Gestione allevamento e dispositivi"
- Se bloccata: "Farm è una funzione Premium" + CTA "Attiva Premium"
