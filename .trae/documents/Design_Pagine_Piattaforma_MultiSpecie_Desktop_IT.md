# Design Pagine (Desktop-first) — Piattaforma Multi‑Specie

## Global Styles (Design Tokens)
- Layout: grid 12 colonne (max-width 1200–1320px), gutter 24px; sidebar 280px (collassabile).
- Colori: background #0B1220; surface #111B2E; border #23314D; text #E6EEF8; muted #9FB3C8.
- Accenti: Pet #4FD1C5, Farm #F6C177, Critical #FF5A5F, Warning #FFB020, Success #2BD576.
- Tipografia: 14/16/20/28px scale; headings semi-bold; numeri KPI tabular.
- Componenti: Button primary/secondary/ghost; hover +6% brightness; focus ring 2px accent.
- Tabelle: header sticky; row hover; badge status (online/offline, severity).
- Notifiche: toast top-right + inbox (drawer/panel) con stato letto.

## Page 1 — Dashboard (Pet/Farm)
### Meta Information
- Title: “Dashboard Multi‑Specie”
- Description: “KPI, stato dispositivi e alert per pet e allevamento.”
- Open Graph: og:title, og:description, og:type=website

### Page Structure
- Struttura a 2 colonne: Sidebar (nav) + Main (contenuto) con header sticky.

### Sections & Components
1. **Top Header**
   - Switch contesto: segmented control “Pet / Farm” (accent dinamico).
   - Search globale: cerca per soggetto o device.
   - Quick actions: “Avvia Demo”, “Crea Regola”.
2. **KPI Row (cards 4x)**
   - Cards: Soggetti, Device online, Alert aperti, Ultimo evento critico.
3. **Operational Feed (2 colonne)**
   - Sinistra: “Alert recenti” (lista con severity badge, timestamp, link dettaglio).
   - Destra: “Notifiche” (inbox compatta, read/unread).
4. **Sommario stato**
   - Mini chart (sparkline) per metriche chiave (es. temperatura/attività/ruminazione) da `telemetry.metrics`.

Responsive: sotto 1024px le 2 colonne diventano stacked; KPI 2x2.

## Page 2 — Dispositivi & Adapter
### Meta Information
- Title: “Dispositivi & Adapter”
- Description: “Registro device, adapter, mapping e stream telemetria.”

### Page Structure
- Layout master-detail: tabella device (sinistra) + pannello dettaglio (destra).

### Sections & Components
1. **Toolbar**
   - Filtri: stato (online/offline), tipo subject (pet/bovine), adapter_type.
   - CTA: “Aggiungi Device (demo)”, “Importa Config”.
2. **Device Table**
   - Colonne: Nome/ID, Subject, Adapter, Stato, Last seen.
   - Azioni riga: “Apri”, “Simula offline/online” (solo demo).
3. **Detail Panel (tabs)**
   - Tab “Adapter”: contratto DeviceAdapter (read-only), config JSON editor con validate.
   - Tab “Mapping”: UI key→key (payload→metric_key) con preview output normalizzato.
   - Tab “Live”: stream ultimi N eventi, raw_payload vs metrics normalizzate.
4. **Mock Demo Controls**
   - Start/Stop generator; intensità eventi; preset “Pet tracker” / “Collare bovino”.

## Page 3 — Alert & Notifiche
### Meta Information
- Title: “Alert & Notifiche”
- Description: “Regole, alert e notifiche in‑app.”

### Page Structure
- 3 pannelli: Regole (sinistra), Alert list (centro), Dettaglio (destra).

### Sections & Components
1. **Rule Builder (minimo)**
   - Campi: scope (subject/type), metric_key, operator, threshold, window, severity, enabled.
   - CTA: “Salva regola”; test rapido su ultimi eventi (demo).
2. **Alert List**
   - Filtri: open/closed, severity, subject.
   - Row: titolo, subject, device, opened_at, stato.
3. **Alert Detail**
   - Timeline eventi (telemetry correlata), JSON details, azioni “Chiudi / Riapri”, nota operatore.
4. **Notification Inbox**
   - Lista notifiche con read/unread; azione “Segna come letto”.

Interaction states: skeleton loading per liste; empty-state con CTA (avvia demo / crea regola).