import { expect, test } from "@playwright/test";
import path from "node:path";

test.skip(process.env.VITE_FIREBASE_EMULATORS !== "1", "Requires Firebase emulators");

test.use({
  permissions: ["geolocation"],
  geolocation: { latitude: 45.0, longitude: 9.0 },
});

test("firebase emulators: signup → pet → core CRUD", async ({ page }) => {
  test.setTimeout(180_000);

  page.on("pageerror", (e) => {
    console.log("e2e: pageerror", e.message);
  });
  page.on("requestfailed", (r) => {
    console.log("e2e: requestfailed", r.url(), r.failure()?.errorText || "");
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("e2e: console.error", m.text());
  });

  async function dismissTutorial() {
    const closeTutorial = page.getByLabel("Chiudi tutorial");
    const visible = await closeTutorial.isVisible({ timeout: 1500 }).catch(() => false);
    if (!visible) return;
    await closeTutorial.click();
    await expect(closeTutorial).toBeHidden();
  }

  const email = `e2e_${Date.now()}@lifepet.local`;
  const password = "Passw0rd!123";

  await page.goto("/login?mode=signup");
  console.log("e2e: after goto", page.url());
  const html = await page.content();
  console.log("e2e: html length", html.length, "has root", html.includes('id="root"'));
  await expect(page.locator("form")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator("form").getByRole("button", { name: "Crea account" }).click();

  await page.waitForURL(/\/(onboarding|app\/dashboard)/, { timeout: 30_000 });
  const urlNow = page.url();
  if (urlNow.includes("/onboarding")) {
    await page.getByRole("button", { name: "Salta" }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);
  }
  await page.evaluate(() => {
    localStorage.setItem("lifepet:tutorial:v1", JSON.stringify({ enabled: false, completedRouteKeys: {} }));
    localStorage.setItem("lifepet:onboardingCompleted", "1");
  });
  await page.reload();
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await dismissTutorial();

  await page.evaluate(() => {
    (window as unknown as { __lpClipboard?: string }).__lpClipboard = "";
    try {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (t: string) => {
            (window as unknown as { __lpClipboard?: string }).__lpClipboard = t;
          },
        },
        configurable: true,
      });
    } catch {
      (window as unknown as { __lpClipboard?: string }).__lpClipboard = "";
    }
  });

  await page.getByRole("main").getByRole("button", { name: "Crea pet" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.locator('label:has-text("Nome") input').fill("Emu");
  await dialog.getByRole("button", { name: "Crea pet" }).click();
  await expect(page.getByRole("button", { name: /Pet attivo[\s\S]*Emu/ })).toBeVisible();

  const activePetId = await page.evaluate(() => localStorage.getItem("lifepet:activePetId"));
  expect(activePetId).toBeTruthy();

  await page.evaluate(() => {
    localStorage.setItem("lifepet:tutorial:v1", JSON.stringify({ enabled: false, completedRouteKeys: {} }));
  });

  const toastRegion = page.locator(".fixed.top-4.right-4");

  await page.goto("/app/diagnostics");
  await dismissTutorial();
  await page.getByRole("button", { name: "Verifica pet" }).click();
  await expect(page.getByRole("button", { name: /Pet[\s\S]*Su Firestore:/ })).toBeVisible();

  await page.goto("/app/bookings");
  await dismissTutorial();
  await expect(page.getByText("Prenotazioni").first()).toBeVisible();

  await page.goto("/app/health");
  await dismissTutorial();
  await page.getByRole("button", { name: "Nuovo evento" }).click();
  await page.getByRole("button", { name: "Sintomo" }).click();
  await page.locator('label:has-text("Gravità") select').selectOption("high");
  await page.locator('label:has-text("Titolo") input').fill("Tosse");
  await page.locator('label:has-text("Note") textarea').fill("Leggera");
  await page.getByRole("button", { name: "Aggiungi" }).click();
  await expect(toastRegion).toContainText("Evento aggiunto");

  await page.goto("/app/diagnostics");
  await dismissTutorial();
  await page.getByRole("button", { name: "Crea notifica test" }).click();
  await expect(toastRegion).toContainText("Creata", { timeout: 30_000 });

  await page.getByRole("button", { name: "Verifica notifiche" }).click();
  await expect(toastRegion).toContainText("Su Firestore:", { timeout: 30_000 });

  const activePetIdAfterNotif = await page.evaluate(() => localStorage.getItem("lifepet:activePetId"));
  expect(activePetIdAfterNotif).toBeTruthy();

  await page.goto(`/app/notifications?petId=${encodeURIComponent(String(activePetIdAfterNotif))}`);
  await dismissTutorial();
  await expect(page.getByText("Notifica test")).toBeVisible({ timeout: 30_000 });
  await page.getByText("Notifica test").click();

  await page.goto("/app/planner");
  await dismissTutorial();
  await page.getByPlaceholder("Titolo task").fill("Passeggiata");
  await page.getByRole("button", { name: "Aggiungi" }).click();
  await expect(toastRegion).toContainText("Task creato");

  await page.goto("/app/vaccines");
  await dismissTutorial();
  const vaccineCreateForm = page.locator("form").filter({ has: page.locator('label:has-text("Intervallo (giorni)")') });
  await vaccineCreateForm.locator('label:has-text("Nome") input').fill("Rabbia");
  await vaccineCreateForm.locator('button[type="submit"]').click();
  await expect(toastRegion).toContainText("Vaccino aggiunto");

  await page.goto("/app/medications");
  await dismissTutorial();
  const medCreateForm = page.locator("form").filter({ has: page.locator('label:has-text("Orari (separati da virgola)")') });
  await medCreateForm.locator('label:has-text("Nome") input').fill("Antibiotico");
  await medCreateForm.locator('label:has-text("Orari") input').fill("08:00");
  await medCreateForm.locator('button[type="submit"]').click();
  await expect(toastRegion).toContainText(/Farmaco aggiunto|Terapia creata/);

  await page.goto("/app/expenses");
  await dismissTutorial();
  const addExpenseForm = page.locator("form").filter({ has: page.locator('text=Importo (EUR)') });
  await addExpenseForm.locator('label:has-text("Importo") input').fill("12");
  await addExpenseForm.locator('label:has-text("Categoria") select').selectOption("food");
  await addExpenseForm.locator('label:has-text("Note") input').fill("Crocchette");
  await addExpenseForm.getByRole("button", { name: "Aggiungi" }).click();
  await expect(toastRegion).toContainText("Spesa aggiunta");

  await page.goto("/app/agenda");
  await dismissTutorial();
  const agendaWhen = new Date(Date.now() + 20 * 60 * 1000);
  const ayyyy = agendaWhen.getFullYear();
  const amm = String(agendaWhen.getMonth() + 1).padStart(2, "0");
  const add = String(agendaWhen.getDate()).padStart(2, "0");
  const ahh = String(agendaWhen.getHours()).padStart(2, "0");
  const amin = String(agendaWhen.getMinutes()).padStart(2, "0");
  const agendaDtLocal = `${ayyyy}-${amm}-${add}T${ahh}:${amin}`;
  const agendaForm = page.locator("form").filter({ has: page.locator('input[type="datetime-local"]') });
  await agendaForm.locator('label:has-text("Titolo") input').fill("Visita");
  await agendaForm.locator('input[type="datetime-local"]').first().fill(agendaDtLocal);
  await agendaForm.locator('button[type="submit"]').click();
  await expect(toastRegion).toContainText("Evento creato");

  await page.goto("/app/marketplace");
  await dismissTutorial();
  const createListingForm = page.locator("form").filter({ has: page.locator('button:has-text("Pubblica")') });
  await createListingForm.locator('label:has-text("Titolo") input').fill("Guinzaglio");
  await createListingForm.locator('label:has-text("Prezzo") input').fill("5");
  await createListingForm.locator('label:has-text("Descrizione") textarea').fill("Usato poco");
  await createListingForm.getByRole("button", { name: "Pubblica" }).click();
  await expect(toastRegion).toContainText("Annuncio", { timeout: 30_000 });
  await expect(toastRegion).toContainText("Pubblicato.", { timeout: 30_000 });

  await page.goto("/app/community");
  await dismissTutorial();
  await page.getByRole("button", { name: /Bacheca/ }).click();
  await page.getByPlaceholder("Scrivi qualcosa di utile…").fill("Ciao community!");
  await page.getByRole("button", { name: "Pubblica" }).click();
  await expect(page.getByText("Ciao community!").first()).toBeVisible();

  await page.getByRole("button", { name: "Gruppi" }).click();
  const follow = page.getByRole("button", { name: "Segui" });
  const needsFollow = await follow.isVisible({ timeout: 1500 }).catch(() => false);
  if (needsFollow) await follow.click();
  const chatForm = page.locator("form").filter({ has: page.locator('button:has-text("Invia")') }).first();
  await chatForm.locator("input").first().fill("Ciao dal gruppo!");
  await chatForm.getByRole("button", { name: "Invia" }).click();
  await expect(page.getByText("Ciao dal gruppo!").first()).toBeVisible();

  await page.goto("/app/gps");
  await dismissTutorial();
  await page.getByRole("button", { name: "Registra punto" }).click();
  await expect(toastRegion).toContainText("Punto registrato.");

  await page.goto("/app/documents");
  await dismissTutorial();
  const filePath = path.join(process.cwd(), "e2e", "fixtures", "sample.txt");
  await page.getByRole("button", { name: /^Carica$/ }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Carica documento", { timeout: 30_000 });
  await page.setInputFiles('[data-testid="documents-file-input"]', filePath);
  await page.getByRole("dialog").getByRole("button", { name: "Carica" }).click();
  await expect(page.getByText("sample.txt")).toBeVisible({ timeout: 30_000 });

  await page.goto("/app/records");
  await dismissTutorial();
  await page.getByRole("button", { name: "Condividi" }).click();
  const shareDialog = page.getByRole("dialog");
  await expect(shareDialog).toContainText("Condividi cartella", { timeout: 30_000 });
  await shareDialog.getByRole("button", { name: "Genera" }).click();
  const linkInput = shareDialog.locator('input.lp-input[readonly]').first();
  await expect(linkInput).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => (await linkInput.inputValue()) || "", { timeout: 30_000 })
    .toContain("/share/");
  const shareUrl = await linkInput.inputValue();
  expect(shareUrl).toContain("/share/");
  await page.goto(shareUrl);
  await expect(page.getByText("Timeline")).toBeVisible();
});
