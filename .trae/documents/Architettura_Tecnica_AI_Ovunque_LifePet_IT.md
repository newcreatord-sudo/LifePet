## 1.Architecture design
```mermaid
graph TD
  A["User Browser"] --> B["React Frontend Application"]
  B --> C["Firebase Web SDK"]
  C --> D["Firebase Auth"]
  C --> E["Cloud Firestore"]
  C --> F["Firebase Storage"]
  B --> G["Cloud Functions (AI Proxy)"]
  G --> H["LLM API Service"]

  subgraph "Frontend Layer"
    B
  end

  subgraph "Service Layer (Firebase)"
    D
    E
    F
    G
  end

  subgraph "External Services"
    H
  end
```

## 2.Technology Description
- Frontend: React@18 + TypeScript + vite + tailwindcss@3
- UI: design tokens (primary **celeste**) + componenti accessibili + stati standard (loading/empty/error)
- Motion: transizioni coerenti (150–200ms, ease-out) + rispetto `prefers-reduced-motion`
- Backend/Services: Firebase (Auth, Firestore, Storage)
- AI: Cloud Functions come **proxy** (API key solo server-side) + rate limit + logging minimo (userId, petId, timestamp)

## 3.Route definitions
| Route | Purpose |
|---|---|
| /onboarding | Tour guidato a step (primo accesso) |
| /login | Login / registrazione / recupero password |
| /app/dashboard | Dashboard semplificata + entry point IA |
| /app/pets/:petId | Scheda pet hub (salute/agenda/alimentazione/training/documenti) |
| /app/gps | Tracking, storico, geofence, alert |
| /app/explore | Community + marketplace + (opz.) moderazione |
| /app/expenses | Spese, budget, trend |
| /app/settings | Privacy/consensi, notifiche, export/cancellazione, preferenze IA |
| /share/:shareId | Condivisione cartella (read-only, link a scadenza) |

## 4.API definitions (If it includes backend services)
### 4.1 Cloud Function: AI contestuale (globale)
```
callable aiAssistant (Firebase Functions)
```
TypeScript (condivise)
```ts
type AiContext = {
  page: "dashboard"|"pet"|"gps"|"explore"|"expenses"|"settings";
  petId?: string;
  contextWindowDays?: number; // default 30
};

type AiAssistantRequest = {
  message: string;
  context: AiContext;
};

type AiAssistantResponse = {
  answer: string;
  actions?: { label: string; deepLink: string }[]; // es. apri promemoria, crea evento
  disclaimer: string; // sempre valorizzato
};
```

## 5.Server architecture diagram (If it includes backend services)
```mermaid
graph TD
  A["React Frontend"] --> B["Cloud Function Endpoint"]
  B --> C["Service: Context Builder"]
  C --> D["Service: Prompt Builder"]
  D --> E["LLM Client"]
  E --> F["LLM API"]

  subgraph "Cloud Functions"
    B
    C
    D
    E
  end
```

## 6.Data model(if applicable)
### 6.1 Data model definition
```mermaid
erDiagram
  USERS ||--o{ PETS : owns
  PETS ||--o{ HEALTH_EVENTS : has
  PETS ||--o{ REMINDERS : schedules
  PETS ||--o{ PET_FILES : stores
  PETS ||--o{ LOGS : tracks
  USERS ||--o{ POSTS : writes
  USERS ||--o{ LISTINGS : publishes
  USERS ||--o{ EXPENSES : records

  PETS {
    uuid id
    uuid owner_id
    string name
    string species
    string breed
  }
  HEALTH_EVENTS {
    uuid id
    uuid pet_id
    string type
    string notes
  }
  REMINDERS {
    uuid id
    uuid pet_id
    string title
    string recurrence_rule
  }
  PET_FILES {
    uuid id
    uuid pet_id
    string file_path
    string file_type
  }
```
