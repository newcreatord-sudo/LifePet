# LifePet Page Design (Desktop-first)

## Global styles (all pages)
- Layout system: CSS Grid for app shell + Flexbox for components.
- Breakpoints: Desktop ≥1024px (primary), Tablet 768–1023px (collapse sidebar), Mobile ≤767px (bottom nav, stacked cards).
- Design tokens:
  - Background: #0B1220 (app), Surface: #111B2E, Card: #16233B
  - Text: #E8EEF9, Muted: #A9B4C7, Accent: #6EE7B7, Danger: #FB7185
  - Font: Inter/system; scale 12/14/16/20/24/32
  - Buttons: primary (accent), secondary (surface), destructive (danger). Hover: +6% brightness; Focus: 2px ring accent.
  - Links: accent, underline on hover.

## App shell (authenticated)
- Structure: 2-column grid.
  - Left: fixed sidebar (260px) with logo, pet switcher, nav items.
  - Right: content area with top bar (page title, global actions, profile menu).
- Components:
  - Sidebar nav: Dashboard, Pet Profile, Care Planner, Insights, Settings.
  - Pet switcher: dropdown with avatar + quick “Add pet”.
  - Notification center: due reminders list.

---

## 1) Login & Sign up
### Meta
- Title: “LifePet – Sign in”
- Description: “Sign in to manage your pets’ care routines and health logs.”
- OG: title/description + app logo.

### Layout
- Centered card (max 420px) on subtle gradient background.

### Sections & components
- Tabs: Sign in / Create account.
- Form fields: email, password; confirm password on sign up.
- Actions: primary submit; “Forgot password” link; OAuth buttons (optional).
- States: inline validation, loading, error banner.

---

## 2) Dashboard
### Meta
- Title: “Dashboard – LifePet”
- Description: “Today’s tasks, quick logging, and recent activity.”

### Page structure
- Top bar: page title + “Quick Add” button.
- Main grid: 2 columns (8/4).

### Sections & components
- Today column:
  - “Due today” list (task cards): title, due time, assignee, complete checkbox.
  - Quick Add modal: log type selector (food/med/symptom/weight/vet/note), note, occurredAt, attachments.
- Right column:
  - Pet snapshot card: weight baseline, last fed, meds next due.
  - Recent activity feed: latest 10 logs; filter chips.
- Interaction: completing a task updates immediately (optimistic), with undo toast.

---

## 3) Pet Profile
### Meta
- Title: “Pet Profile – LifePet”
- Description: “Your pet’s details, medical information, and timeline.”

### Page structure
- Header: pet avatar, name, species/breed, edit button.
- Content: tabbed layout (Details / Medical / Timeline).

### Sections & components
- Details tab: editable form (DOB, microchip, diet notes), save/cancel.
- Medical tab:
  - Cards: Allergies, Medications, Vaccinations, Vet contacts.
  - Document uploader (PDF/image) with list.
- Timeline tab:
  - Filters: type, date range.
  - Event list with expandable rows + attachment preview.

---

## 4) Care Planner
### Meta
- Title: “Care Planner – LifePet”
- Description: “Plan recurring routines and manage tasks.”

### Page structure
- Split view: left list + right editor (responsive stacks on tablet).

### Sections & components
- Routines list: searchable; status pill (active/paused); next run time.
- Routine editor:
  - Name, type (food/med/walk/etc), recurrence (daily/weekly/custom), reminder times.
  - “Preview upcoming” mini list (next 7 occurrences).
- Tasks board:
  - Tabs: Due, Completed.
  - Task card: assign, dueAt, notes; complete/undo.

---

## 5) Insights (AI)
### Meta
- Title: “Insights – LifePet”
- Description: “AI summaries and Q&A grounded in your pet logs.”

### Page structure
- 2-column layout: left summaries/recommendations, right chat.

### Sections & components
- Summary generator:
  - Range picker (7/30/custom) + “Generate” button.
  - Output panel with sections: Highlights, Patterns, Suggested actions.
  - Disclaimer banner: “Not veterinary advice.”
- Recommendations list: actionable cards with “Add as task” CTA.
- Chat panel:
  - Message list; input box; send.
  - Citations drawer: shows log entries used for the answer.
  - States: streaming/loading, retry, rate-limit message (Pro upsell).

---

## 6) Settings
### Meta
- Title: “Settings – LifePet”
- Description: “Account, household sharing, and plan.”

### Sections & components
- Account: email, password change, sign out.
- Household: invite member, role selector, remove access.
- Notifications: toggles for reminders.
- Plan (Pro): current plan, usage, upgrade button.