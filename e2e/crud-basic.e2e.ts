import { expect, test } from "@playwright/test";
import path from "node:path";

test("CRUD base demo: pet + health + planner + documents", async ({ page }) => {
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

  await page.goto("/app/health");
  await dismissTutorial();

  await page.getByRole("button", { name: "Nuovo evento" }).click();
  await page.getByRole("button", { name: "Sintomo", exact: true }).click();
  await page.locator('label:has-text("Note") textarea').fill("Leggera");
  await page.getByRole("button", { name: "Aggiungi" }).click();
  await expect(page.getByRole("button", { name: /Evento aggiunto/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Evento aggiunto/ })).toBeVisible();

  await page.goto("/app/planner");
  await dismissTutorial();
  await page.getByPlaceholder("Titolo task").fill("Passeggiata");
  await page.getByRole("button", { name: "Aggiungi" }).click();
  await expect(page.getByRole("button", { name: /Task creato/ })).toBeVisible();

  await page.goto("/app/vaccines");
  await dismissTutorial();
  const vaccineCreateForm = page.locator("form").filter({ has: page.locator('label:has-text("Intervallo (giorni)")') });
  await vaccineCreateForm.locator('label:has-text("Nome") input').fill("Rabbia");
  await vaccineCreateForm.locator('button[type="submit"]').click();
  await expect(page.getByRole("button", { name: /Vaccino aggiunto/ })).toBeVisible();

  await page.goto("/app/medications");
  await dismissTutorial();
  const medCreateForm = page.locator("form").filter({ has: page.locator('label:has-text("Orari (separati da virgola)")') });
  await medCreateForm.locator('label:has-text("Nome") input').fill("Antibiotico");
  await medCreateForm.locator('label:has-text("Orari") input').fill("08:00");
  await medCreateForm.locator('button[type="submit"]').click();
  await expect(page.getByRole("button", { name: /Farmaco aggiunto|Terapia creata/ })).toBeVisible();

  await page.goto("/app/documents");
  await dismissTutorial();

  const filePath = path.join(process.cwd(), "e2e", "fixtures", "sample.txt");
  await page.getByTestId("documents-upload-open").click();
  await page.getByTestId("documents-file-input").setInputFiles(filePath);
  await expect(page.getByText("sample.txt")).toBeVisible();
});
