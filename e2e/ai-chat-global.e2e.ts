import { expect, test } from "@playwright/test";

test("AI globale: chat → salva in cartella clinica", async ({ page }, testInfo) => {
  const base = testInfo.project.use.baseURL || "http://localhost:5173";
  await page.goto(new URL("/", base).toString());
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

  await page.goto(new URL("/app/dashboard", base).toString());
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.getByText("Pet attivo").first()).toBeVisible({ timeout: 15_000 });

  await page.goto(new URL("/app/ai/chat", base).toString());
  await expect(page.getByPlaceholder("Scrivi una domanda…")).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("Scrivi una domanda…").fill("Ho bisogno di consigli rapidi");
  await page.getByLabel("Invia").click();

  const save = page.getByTestId("ai-msg-save-1");
  await expect(save).toBeEnabled({ timeout: 10_000 });
  await save.evaluate((el) => (el as HTMLButtonElement).click());

  await expect(page.getByText("Salvato.").first()).toBeVisible({ timeout: 10_000 });

  await page.goto(new URL("/app/records", base).toString());
  await expect(page.getByText("Cartella clinica").first()).toBeVisible();
  await expect(page.getByText(/AI\s*·\s*AI/).first()).toBeVisible({ timeout: 20_000 });
});
