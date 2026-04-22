import { expect, test } from "@playwright/test";
import path from "path";

test("demo → onboarding ritorna a pagina richiesta → smoke navigazione", async ({ page }) => {
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
    localStorage.setItem("lifepet:demoSeeded", "1");
    localStorage.setItem("lifepet:demo:pets", JSON.stringify([]));
    localStorage.setItem("lifepet:tutorial:v1", JSON.stringify({ enabled: false, completedRouteKeys: {} }));
  });

  await page.goto("/app/pets");
  await dismissTutorial();

  await page.getByRole("button", { name: "Crea pet" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('label:has-text("Nome") input').fill("Milo");
  const filePath = path.join(process.cwd(), "e2e", "fixtures", "sample.svg");
  await dialog.getByTestId("create-pet-photo-input").setInputFiles(filePath);
  await dialog.getByRole("button", { name: "Crea pet" }).click();
  await expect(page.getByText("Pet attivo").first()).toBeVisible();

  await page.evaluate(() => {
    try {
      const raw = localStorage.getItem("lifepet:demo:pets");
      const pets = raw ? (JSON.parse(raw) as Array<{ id: string; name?: string }>) : [];
      const pet = pets.find((p) => p.name === "Milo") ?? pets[pets.length - 1];
      if (pet?.id) localStorage.setItem("lifepet:activePetId", pet.id);
    } catch {
      return;
    }
  });
  await page.reload();
  await dismissTutorial();

  await page.goto("/app/planner");
  await dismissTutorial();
  await expect(page.getByText("Planner").first()).toBeVisible();

  for (const [path, title] of [
    ["/app/status", "Stato animale"],
    ["/app/records", "Cartella clinica"],
    ["/app/documents", "Documenti"],
    ["/app/medications", "Terapie"],
    ["/app/notifications", "Notifiche"],
  ] as const) {
    await page.goto(path);
    await dismissTutorial();
    await expect(page.getByText(title).first()).toBeVisible();
  }
});
