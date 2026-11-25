import { defineConfig } from "@playwright/test";

// SCHEDULESIM_PORT lets the tests run against a second server next to one already running.
const port = process.env.SCHEDULESIM_PORT ?? "8000";

export default defineConfig({
  testDir: "tests",
  timeout: 240_000,
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1500, height: 920 },
         screenshot: "only-on-failure" },
  webServer: {
    command: `cd ../backend && OMP_NUM_THREADS=1 .venv/bin/python -m uvicorn schedulesim.api:app --port ${port}`,
    url: `http://127.0.0.1:${port}/api/meta`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
