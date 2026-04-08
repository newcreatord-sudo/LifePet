import type { TutorialStep } from "@/stores/tutorialStore";

export type TutorialSection = {
  key: string;
  title: string;
  steps: TutorialStep[];
};

export function getTutorialSections(): TutorialSection[] {
  return [
    {
      key: "/app/dashboard",
      title: "Dashboard",
      steps: [
        { id: "dash-1", title: "Panoramica", body: "Qui trovi lo stato generale dei tuoi pet, i promemoria e i collegamenti rapidi alle sezioni principali." },
        { id: "dash-2", title: "Prossime azioni", body: "Usa Notifiche e Planner per non perdere terapie, vaccini, agenda e task." },
      ],
    },
    {
      key: "/app/pets",
      title: "Profilo animale avanzato",
      steps: [
        { id: "pets-1", title: "Scheda intelligente", body: "Crea uno o più profili animale (nome, specie, razza, età, peso, carattere, note)." },
        { id: "pets-2", title: "Multi-animale", body: "Passa da un pet all’altro dal selettore in alto. Tutti i dati sono separati per pet." },
      ],
    },
    {
      key: "/app/health",
      title: "Salute & veterinario",
      steps: [
        { id: "health-1", title: "Storico salute", body: "Registra eventi, visite e informazioni cliniche. Questo alimenta anche status e insight." },
        { id: "health-2", title: "Promemoria", body: "Integra terapie, vaccini e agenda per un flusso completo di salute." },
      ],
    },
    {
      key: "/app/records",
      title: "Cartella clinica digitale",
      steps: [
        { id: "records-1", title: "Timeline", body: "Consulta log, documenti, task e salute in un’unica timeline ricercabile." },
        { id: "records-2", title: "Condivisione", body: "Crea un link temporaneo per condividere i dati principali (utile con veterinario)." },
        { id: "records-3", title: "Export (Pro)", body: "In Pro puoi esportare i dati in JSON. L’export è protetto lato server." },
      ],
    },
    {
      key: "/app/documents",
      title: "Documenti",
      steps: [
        { id: "docs-1", title: "Archivio referti", body: "Carica referti, ricette e documenti. Puoi scaricarli e condividerli via link protetto." },
      ],
    },
    {
      key: "/app/medications",
      title: "Terapie",
      steps: [
        { id: "med-1", title: "Piano terapeutico", body: "Inserisci farmaci e dosaggi. Puoi collegare promemoria in Agenda e Planner." },
        { id: "med-2", title: "Storico", body: "Le somministrazioni e i log aiutano a mantenere coerenza e a condividere con il veterinario." },
      ],
    },
    {
      key: "/app/vaccines",
      title: "Vaccini",
      steps: [
        { id: "vax-1", title: "Scadenze", body: "Gestisci vaccini e richiami. Le scadenze alimentano notifiche e timeline." },
      ],
    },
    {
      key: "/app/nutrition",
      title: "Alimentazione intelligente",
      steps: [
        { id: "nut-1", title: "Pasti e note", body: "Registra cibo e abitudini. Il sistema usa i log per suggerimenti e notifiche intelligenti." },
        { id: "nut-2", title: "AI", body: "Usa gli Insight AI per consigli su dieta, energia e routine (limiti diversi per Free/Pro)." },
      ],
    },
    {
      key: "/app/symptoms",
      title: "Sintomi AI",
      steps: [
        { id: "sym-1", title: "Analisi informativa", body: "Descrivi sintomi e contesto: l’AI fornisce una sintesi informativa con disclaimer (non sostituisce un medico)." },
        { id: "sym-2", title: "Azioni consigliate", body: "Il risultato suggerisce quando contattare il veterinario e quali informazioni preparare." },
      ],
    },
    {
      key: "/app/vision",
      title: "Foto AI",
      steps: [
        { id: "vis-1", title: "Check visivi", body: "Carica una foto per una descrizione informativa (es. pelle, occhi, postura)." },
        { id: "vis-2", title: "Privacy", body: "Evita di caricare dati sensibili. Puoi cancellare e gestire gli allegati." },
      ],
    },
    {
      key: "/app/video",
      title: "Video AI",
      steps: [
        { id: "vid-1", title: "Movimento e comportamento", body: "Carica un video breve per un’analisi informativa di movimento o comportamento." },
      ],
    },
    {
      key: "/app/wellness",
      title: "Monitoraggio benessere",
      steps: [
        { id: "well-1", title: "Fitness tracker", body: "Attività, idratazione e segnali di comportamento: tutto converge qui e nello Status." },
        { id: "well-2", title: "Notifiche intelligenti", body: "Esempi: bevuto poco, poca attività, caldo. Le notifiche sono calcolate server-side." },
      ],
    },
    {
      key: "/app/status",
      title: "Stato animale (🟢🟡🔴)",
      steps: [
        { id: "status-1", title: "Indice salute", body: "Qui vedi lo stato generale e i fattori che lo influenzano (log, task, salute, pattern recenti)." },
      ],
    },
    {
      key: "/app/agenda",
      title: "Agenda completa",
      steps: [
        { id: "ag-1", title: "Calendario", body: "Pianifica visite, toelettatura, pulizie, addestramento e qualsiasi evento." },
        { id: "ag-2", title: "Notifiche", body: "Gli eventi generano promemoria automatici (sweep server-side)." },
      ],
    },
    {
      key: "/app/planner",
      title: "Planner",
      steps: [
        { id: "pl-1", title: "Task & routine", body: "Crea task e routine ricorrenti. Riceverai reminder intelligenti." },
      ],
    },
    {
      key: "/app/training",
      title: "Addestramento & comportamento",
      steps: [
        { id: "tr-1", title: "Guide", body: "Contenuti e consigli comportamentali per specie. Puoi aggiungere note e progressi." },
      ],
    },
    {
      key: "/app/gps",
      title: "GPS & sicurezza",
      steps: [
        { id: "gps-1", title: "Tracciamento", body: "Registra punti GPS e consulta la mappa. Attiva gli avvisi per sicurezza." },
        { id: "gps-2", title: "Retention", body: "I punti GPS vecchi vengono puliti automaticamente per privacy (sweep)." },
      ],
    },
    {
      key: "/app/community",
      title: "Community",
      steps: [
        { id: "com-1", title: "Post e gruppi", body: "Confrontati con altri proprietari: post, commenti e chat di gruppo." },
        { id: "com-2", title: "Chat sicura", body: "Puoi scrivere in chat gruppo solo se sei membro del gruppo." },
      ],
    },
    {
      key: "/app/moderation",
      title: "Moderazione",
      steps: [
        { id: "mod-1", title: "Strumenti moderazione", body: "Area riservata a moderatori: gestisci segnalazioni e contenuti." },
      ],
    },
    {
      key: "/app/marketplace",
      title: "Marketplace",
      steps: [
        { id: "mk-1", title: "Prodotti", body: "Sfoglia e salva articoli. In futuro: consigli AI personalizzati in base al profilo pet." },
      ],
    },
    {
      key: "/app/insights",
      title: "Insights",
      steps: [
        { id: "ins-1", title: "Sintesi e trend", body: "Raccoglie segnali da log, task e salute per aiutarti a capire i trend." },
        { id: "ins-2", title: "Azioni", body: "Usa gli insight per adattare routine, agenda e promemoria." },
      ],
    },
    {
      key: "/app/expenses",
      title: "Spese e gestione economica",
      steps: [
        { id: "exp-1", title: "Analisi costi", body: "Registra le spese per pet e categoria. Imposta budget mensile e ricevi alert." },
        { id: "exp-2", title: "Ricorrenze", body: "Le spese ricorrenti vengono generate automaticamente lato server." },
      ],
    },
    {
      key: "/app/bookings",
      title: "Prenotazioni",
      steps: [
        { id: "bk-1", title: "Integrazione appuntamenti", body: "Gestisci prenotazioni e reminder. La logica anti-no-show è già integrata." },
      ],
    },
    {
      key: "/app/provider",
      title: "Console pro",
      steps: [
        { id: "prov-1", title: "Strumenti professionali", body: "Se sei un professionista, qui gestisci prenotazioni e supporto (accesso controllato)." },
      ],
    },
    {
      key: "/app/notifications",
      title: "Notifiche",
      steps: [
        { id: "not-1", title: "Centro notifiche", body: "Qui trovi promemoria e alert intelligenti. Puoi segnare come lette." },
        { id: "not-2", title: "Push", body: "Attiva/disattiva push in Impostazioni. Le quiet hours riducono le interruzioni." },
      ],
    },
    {
      key: "/app/settings",
      title: "Impostazioni",
      steps: [
        { id: "set-1", title: "Preferenze", body: "Attiva/disattiva funzioni e push. Qui puoi anche riavviare o disattivare il tutorial." },
        { id: "set-2", title: "Piano", body: "Gestisci Free/Pro. Alcune funzioni (export, limiti AI) sono applicate server-side." },
      ],
    },
  ];
}

export function findTutorialSection(routeKey: string) {
  const sections = getTutorialSections();
  return sections.find((s) => s.key === routeKey) ?? null;
}
