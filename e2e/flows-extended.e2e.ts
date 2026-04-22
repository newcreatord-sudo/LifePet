import { expect, test } from "@playwright/test";

test.use({
  permissions: ["geolocation"],
  geolocation: { latitude: 45.0, longitude: 9.0 },
});

test("demo: spese + marketplace + community + gps", async ({ page }) => {
  async function dismissTutorial() {
    const closeTutorial = page.getByLabel("Chiudi tutorial");
    const visible = await closeTutorial.isVisible({ timeout: 1500 }).catch(() => false);
    if (!visible) return;
    await closeTutorial.click();
    await expect(closeTutorial).toBeHidden();
  }

  await page.goto("/");
  await page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === "lifepet:demo:pets" || k === "lifepet:demoSeeded" || k.startsWith("lifepet:demo:")) localStorage.removeItem(k);
    }
    localStorage.removeItem("lifepet:activePetId");
    localStorage.setItem("lifepet:demoMode", "1");
    localStorage.setItem("lifepet:onboardingCompleted", "1");
    localStorage.setItem("lifepet:tutorial:v1", JSON.stringify({ enabled: false, completedRouteKeys: {} }));
  });

  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.getByText("Pet attivo").first()).toBeVisible({ timeout: 15_000 });
  await dismissTutorial();

  await page.goto("/app/expenses");
  await dismissTutorial();
  const addExpenseForm = page.locator("form").filter({ has: page.locator('text=Importo (EUR)') }).first();
  await addExpenseForm.locator('label:has-text("Importo (EUR)") input').fill("12");
  await addExpenseForm.locator('label:has-text("Categoria") select').selectOption("food");
  await addExpenseForm.locator('label:has-text("Note") input').fill("Crocchette");
  await addExpenseForm.getByRole("button", { name: "Aggiungi" }).click();
  await expect(page.getByRole("button", { name: /Spesa aggiunta/ })).toBeVisible();

  await page.goto("/app/marketplace");
  await dismissTutorial();
  const createListingForm = page.locator("form").filter({ has: page.locator('button:has-text("Pubblica")') });
  await createListingForm.locator('label:has-text("Titolo") input').fill("Guinzaglio");
  await createListingForm.locator('label:has-text("Prezzo") input').fill("5");
  await createListingForm.locator('label:has-text("Descrizione") textarea').fill("Usato poco, ottimo stato");
  await createListingForm.getByRole("button", { name: "Pubblica" }).click();
  await expect(page.getByRole("button", { name: /Annuncio/ })).toBeVisible();

  await page.goto("/app/community");
  await dismissTutorial();
  await page.getByRole("button", { name: "Bacheca" }).click();
  await page.getByPlaceholder("Scrivi qualcosa di utile…").fill("Ciao community!");
  await page.getByRole("button", { name: "Pubblica" }).click();
  await expect(page.getByRole("button", { name: /Post/ })).toBeVisible();

  await page.getByRole("button", { name: "Gruppi" }).click();
  const follow = page.getByRole("button", { name: "Segui" });
  const needsFollow = await follow.isVisible({ timeout: 1500 }).catch(() => false);
  if (needsFollow) await follow.click();
  const chatForm = page.locator("form").filter({ has: page.locator('button:has-text("Invia")') }).first();
  await chatForm.locator("input").first().fill("Ciao dal gruppo!");
  await chatForm.getByRole("button", { name: "Invia" }).click();
  await expect(page.getByRole("button", { name: /Messaggio/ })).toBeVisible();

  await page.goto("/app/gps");
  await dismissTutorial();
  await page.getByRole("button", { name: "Registra punto" }).click();
  await expect(page.getByRole("button", { name: /GPS[\s\S]*Punto registrato\./ })).toBeVisible();
});
