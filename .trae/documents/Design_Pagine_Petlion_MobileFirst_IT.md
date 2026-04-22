# Design Pagine — Petlion (Mobile-first)

## Global Styles (design tokens)
- Layout: mobile-first con Flexbox + CSS Grid (card grid solo da tablet in su).
- Breakpoints: base < 768px; md ≥ 768px; lg ≥ 1024px.
- Spacing scale: 4/8/12/16/24/32.
- Typography: 16px base; H1 24–28; H2 18–20; label 12–13.
- Colori: background #0B1220 (scuro) o #F7F9FC (chiaro); primary #2F6BFF; danger #E5484D; success #2ECC71; border #E6E8EB.
- Bottoni: primary pieno, secondary outline, destructive per “Elimina/Disattiva”. Stato disabled e loading obbligatori.
- Link: underline on hover (desktop) / tappabile con area minima 44px (mobile).
- Motion: transizioni 150–200ms (opacity/transform). Evitare animazioni pesanti.

## 1) Home
**Meta**
- Title: “Petlion — I tuoi pet”
- Description: “Riepilogo pet, documenti e stato smarrimento.”
- OG: titolo + immagine hero (brand) + url.

**Layout / Struttura**
- App shell: Top bar fissa + contenuto scroll + bottom nav (mobile).
- Sezioni stacked.

**Sezioni & Componenti**
- Top bar: logo + avatar (menu account) + stato rete (solo icona discreta).
- “I miei pet” (lista card): card con foto, nome, badge “Smarrito” se attivo, CTA “Apri”.
- CTA primarie: “Crea pet”, “Documenti” (shortcut al pet selezionato se 1 solo).
- Empty state: illustrazione + testo + CTA “Crea pet”.

## 2) Login e registrazione
**Meta**
- Title: “Accedi — Petlion”
- Description: “Accedi o crea un account.”

**Layout / Struttura**
- Pagina centrata, una colonna, padding 16–24.

**Sezioni & Componenti**
- Tabs/segmented control: “Accedi” / “Registrati”.
- Form: email, password, submit; validazione inline; messaggi errore non tecnici.
- Link: “Password dimenticata” → /auth/reset.
- Stato loading e blocco doppio submit.

## 3) Onboarding
**Meta**
- Title: “Benvenuto — Petlion”
- Description: “Configura Petlion in pochi passaggi.”

**Layout / Struttura**
- Wizard a step con progress indicator (3–4 step max).

**Sezioni & Componenti**
- Step cards: valore del prodotto + privacy (copy breve).
- CTA: “Continua”, “Salta” (se consentito), “Crea il tuo primo pet”.
- Persistenza: riprendere da ultimo step completato.

## 4) Crea Pet + Profilo Pet e Documenti
**Meta**
- Title: “Profilo pet — Petlion”
- Description: “Dati e documenti del tuo pet.”

**Layout / Struttura**
- Header profilo (foto + nome) + tab bar: “Profilo” | “Documenti” | “Smarrimento”.

**Sezioni & Componenti — Tab Profilo**
- Foto pet: upload/replace con crop semplice (opzionale), placeholder se assente.
- Form minimo: nome, specie, note essenziali; salvataggio con snackbar.

**Sezioni & Componenti — Tab Documenti**
- Lista documenti (cards): tipo, data, azioni “Apri/Scarica”, menu “Elimina”.
- CTA sticky: “Carica documento”.
- Upload modal/sheet: selezione file, tipo documento, data; progress bar; errori chiari.

## 5) Modalità Smarrimento (gestione + pagina pubblica)
### 5.1 Gestione smarrimento (autenticato)
**Meta**
- Title: “Smarrimento — Petlion”
- Description: “Attiva/disattiva e condividi il link pubblico.”

**Layout / Struttura**
- Sezione principale con stato + CTA.

**Sezioni & Componenti**
- Stato: toggle “Smarrito” + testo di conferma + timestamp.
- Safety confirm: dialog “Attivare smarrimento?” / “Disattivare smarrimento?”.
- Link pubblico: campo read-only + pulsanti “Copia link” e “Mostra QR”.
- QR sheet: QR grande + testo breve “Scansiona per vedere info essenziali”.

### 5.2 Pagina pubblica smarrimento (anonimo) — /l/:publicToken
**Meta**
- Title: “Pet smarrito — Petlion”
- Description: “Informazioni essenziali per aiutare il ricongiungimento.”
- OG: foto pet (se presente) + titolo “Pet smarrito”.

**Layout / Struttura**
- Una colonna, leggibile, call-to-action di contatto in alto.

**Sezioni & Componenti**
- Hero: foto + nome + badge “Smarrito”.
- Istruzioni: blocco testo (breve, chiaro), senza dettagli sensibili non necessari.
- CTA contatto: pulsante principale (es. chiama/contatta) se presente un canale; altrimenti testo istruzioni.
- Footer: branding minimo e note privacy.

## Note responsive
- Da md: bottom nav → sidebar/ top nav estesa; liste → griglia 2 colonne.
- Targets touch: min 44px; input font-size ≥16px per evitare zoom iOS.
