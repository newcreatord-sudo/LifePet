## 1.Architecture design
```mermaid
graph TD
  A["User Mobile App"] --> B["React Native App"]
  B --> C["Firebase SDK"]
  C --> D["Firebase Auth"]
  C --> E["Firestore"]
  C --> F["Cloud Storage"]
  B --> G["Device Services (GPS, Notifications)"]
  B --> H["HTTPS"]
  H --> I["Cloud Functions"]
  I --> J["LLM API (AI)"]

  subgraph "Client"
    B
    G
  end

  subgraph "Firebase"
    D
    E
    F
    I
  end

  subgraph "External"
    J
  end
```

## 2.Technology Description
- Frontend (mobile): React Native@0.7x + Expo + TypeScript
- Backend: Firebase (Auth, Firestore, Cloud Storage, Cloud Functions)
- AI: Cloud Functions come proxy sicuro verso provider LLM (API key solo server-side)

## 3.Route definitions
| Route (Screen) | Purpose |
|---|---|
| /auth/login | Login e accesso account |
| /auth/register | Registrazione |
| /home | Dashboard multi-animale |
| /pets | Elenco animali |
| /pets/:petId | Profilo animale |
| /health/:petId | Salute + longevità |
| /agenda | Calendario e promemoria |
| /gps/:petId | Mappa, tracking, aree sicure |
| /community | Feed e interazioni |
| /marketplace | Annunci e pubblicazione |
| /expenses | Spese e budget |
| /ai/:petId | Assistente AI |
| /settings | Impostazioni account/privacy |

## 4.API definitions (If it includes backend services)
### 4.1 Cloud Functions (HTTPS)
Generazione AI (chat/riassunti)
```
POST /aiChat
```
Request (TypeScript)
```ts
type AiChatRequest = {
  userId: string;
  petId?: string;
  message: string;
  contextWindowDays?: number; // es. 30
};

type AiChatResponse = {
  answer: string;
  sources?: string[]; // es. "healthEvents", "expenses"
};
```

## 5.Server architecture diagram (If it includes backend services)
```mermaid
graph TD
  A["Mobile App"] --> B["Cloud Functions (HTTPS)"]
  B --> C["Service: Context Builder"]
  C --> D["Repository: Firestore Reads"]
  C --> E["LLM Client"]
  D --> F["Firestore"]
  E --> G["LLM API"]

  subgraph "Cloud Functions"
    B
    C
    D
    E
  end
```

## 6.Data model(if applicable)
### 6.1 Data model definition
Concetto logico (Firestore = collections/documents).
```mermaid
erDiagram
  USERS ||--o{ PETS : owns
  PETS ||--o{ HEALTH_EVENTS : has
  PETS ||--o{ AGENDA_EVENTS : schedules
  PETS ||--o{ GPS_POINTS : tracks
  USERS ||--o{ POSTS : creates
  POSTS ||--o{ COMMENTS : has
  USERS ||--o{ LISTINGS : sells
  USERS ||--o{ EXPENSES : records

  USERS {
    string id
    string email
    string displayName
  }
  PETS {
    string id
    string ownerUserId
    string name
    string species
    string birthDate
  }
  HEALTH_EVENTS {
    string id
    string petId
    string type
    string date
  }
  AGENDA_EVENTS {
    string id
    string petId
    string title
    string dueAt
  }
  GPS_POINTS {
    string id
    string petId
    string recordedAt
    string latLng
  }
  POSTS {
    string id
    string authorUserId
    string createdAt
  }
  COMMENTS {
    string id
    string postId
    string authorUserId
  }
  LISTINGS {
    string id
    string sellerUserId
    string price
    string status
  }
  EXPENSES {
    string id
    string userId
    string petId
    string amount
    string occurredAt
  }
```

### 6.2 Data Definition Language
Non applicabile (Firestore non usa DDL SQL). Struttura consigliata:
- users/{userId}
- pets/{petId} (ownerUserId)
- healthEvents/{eventId} (petId)
- agendaEvents/{eventId} (petId)
- gpsPoints/{pointId} (petId)
- posts/{postId}, comments/{commentId}
- listings/{listingId}
- expenses/{expenseId} (userId, petId)

Permessi (security rules): lettura/scrittura consentita solo a documenti con ownerUserId/userId uguale all’utente autenticato; contenuti community/marketplace con regole dedicate (pubblici in lettura, scrittura autenticata, moderazione via claim/ruolo).