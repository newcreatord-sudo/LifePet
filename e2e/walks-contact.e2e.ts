import { expect, test } from "@playwright/test";

test("mappa passeggiate → contatta → invia in Community (walks)", async ({ page, context }) => {
  const base = (test.info().project.use.baseURL as string | undefined) ?? "http://localhost:5173";
  await context.grantPermissions(["geolocation"], { origin: base });
  await context.setGeolocation({ latitude: 41.9028, longitude: 12.4964 });

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

    const now = Date.now();
    const other = {
      petId: "pet_other_1",
      ownerId: "user_other_1",
      petName: "Milo",
      species: "dog",
      badge: "yellow",
      lat: 41.9032,
      lng: 12.4971,
      accuracyM: 12,
      updatedAt: now,
    };
    localStorage.setItem("lifepet:demo:walkPresence", JSON.stringify([other]));
  });

  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/app\/dashboard/);

  await expect(page.getByText("Pet attivo").first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/app/pets");
  await expect(page.getByText("Profilo Pet").first()).toBeVisible();
  await page.getByLabel("Bollino temperamento").selectOption("green");
  await page.getByLabel("Visibile in mappa durante passeggiata").check();
  await page.getByRole("button", { name: "Salva" }).first().click();

  await page.goto("/app/gps");
  await expect(page.getByText("GPS").first()).toBeVisible();
  await page.getByRole("button", { name: "Passeggiate" }).click();

  await expect(page.getByText("Mappa passeggiate").first()).toBeVisible();
  await expect(page.getByText("Milo").first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Contatta per passeggiata" }).first().click();
  await expect(page.getByText("Contatta per passeggiata").first()).toBeVisible();
  await page.getByRole("button", { name: "Invia" }).click();

  await expect(page).toHaveURL(/\/app\/community\?tab=groups&groupId=walks/);
  await expect(page.getByText("Passeggiate").first()).toBeVisible();
  await expect(page.getByText("Ho visto Milo").first()).toBeVisible({ timeout: 10_000 });
});
