import { defineConfig, devices } from "@playwright/test";

const EMULATORS = process.env.VITE_FIREBASE_EMULATORS === "1";
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? (EMULATORS ? 5194 : 5173));
const URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: URL,
    reuseExistingServer: !EMULATORS,
    timeout: 120_000,
  },
});
