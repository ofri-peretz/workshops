import { defineConfig } from "@playwright/test";

// Every page at the widths it is used on, in the Chrome already installed (no browser download).
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: 1, // every viewport drives the same relay room: in parallel, one test moves another's scene
  reporter: process.env.CI ? "github" : "list",
  use: { channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "phone-se", use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "projector", use: { viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: [
    {
      command: "node relay/server.mjs",
      url: "http://127.0.0.1:8098/status",
      env: { PORT: "8098", PRESENTER_TOKEN: "e2e", JOIN_CODE: "424242" },
      reuseExistingServer: !process.env.CI,
    },
    {
      // Sign-in renders without real services: the room status fetch fails closed ("unavailable").
      command: "npm --prefix console run dev -- -p 4181",
      url: "http://127.0.0.1:4181/signin",
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_ANON_KEY: "e2e", OWNER_EMAIL: "presenter@example.com",
        CODE_SECRET: "e2e", PRESENTER_TOKEN: "e2e", RELAY_URL: "http://127.0.0.1:8098", PHONE_URL: "http://127.0.0.1:8098/",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
