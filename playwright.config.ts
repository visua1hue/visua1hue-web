import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:8787" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://localhost:8787",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
