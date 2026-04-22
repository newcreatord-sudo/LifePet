import { expect, test } from "@playwright/test";

test.skip(process.env.VITE_FIREBASE_EMULATORS !== "1", "Requires Firebase emulators");

test("pet protetto: attiva → scheda pubblica → invia segnalazione", async ({ page }) => {
  test.setTimeout(120_000);

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
  await dismissTutorial();

  const toastRegion = page.locator(".fixed.top-4.right-4");

  await page.getByRole("main").getByRole("button", { name: "Crea pet" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.locator('label:has-text("Nome") input').fill("Luna");
  await dialog.getByRole("button", { name: "Crea pet" }).click();
  await expect(page.getByRole("button", { name: /Pet attivo[\s\S]*Luna/ })).toBeVisible();

  await page.goto("/app/pets");
  await dismissTutorial();

  const protectionCard = page.getByText("Pet Protetto", { exact: false }).first();
  await protectionCard.scrollIntoViewIfNeeded();

  const enableBtn = page.getByRole("button", { name: "Attiva protezione" });
  const alreadyEnabled = await enableBtn.isVisible({ timeout: 1500 }).catch(() => false);
  if (alreadyEnabled) {
    await enableBtn.click();
    await expect(toastRegion).toContainText("Pet Protetto", { timeout: 30_000 });
  }

  const openPublic = page.getByRole("link", { name: "Apri scheda" });
  await expect(openPublic).toBeVisible({ timeout: 30_000 });

  const popupPromise = page.waitForEvent("popup");
  await openPublic.click();
  const publicPage = await popupPromise;
  await publicPage.waitForLoadState("domcontentloaded");

  await expect(publicPage.getByText("Pet Protetto", { exact: false })).toBeVisible({ timeout: 30_000 });

  await publicPage.getByRole("button", { name: "Ho trovato" }).click();

  const sendBtn = publicPage.getByRole("button", { name: "Invia" });
  await expect(sendBtn).toBeDisabled();

  await publicPage.getByLabel("Il tuo contatto (telefono/email)").fill("+39 333 000 0000");
  await expect(sendBtn).toBeEnabled();
  await sendBtn.click();

  await expect(publicPage.getByRole("button", { name: /Segnalazione inviata/ })).toBeVisible({ timeout: 30_000 });

  await publicPage.close();

  await page.goto("/app/notifications");
  await dismissTutorial();
  await expect(page.getByText("Segnalazioni smarrimento")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Ho trovato", { exact: false })).toBeVisible({ timeout: 30_000 });
});
