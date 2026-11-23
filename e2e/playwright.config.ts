import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 240_000,
  use: { baseURL: "http://127.0.0.1:8000", viewport: { width: 1500, height: 920 },
         screenshot: "only-on-failure" },
  webServer: {
    command: "cd ../backend && OMP_NUM_THREADS=1 .venv/bin/python -m uvicorn schedulesim.api:app --port 8000",
    url: "http://127.0.0.1:8000/api/meta",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
