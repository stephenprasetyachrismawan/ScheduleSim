// Seam F1: the four views open, a simulation steps through events, and the numbers on screen
// are the numbers of the API (which come from arls-ppo's cek_episode.run).
import { expect, test } from "@playwright/test";

const fmt = (v: number, d = 3) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

test("a project opens in list, board, form and timeline views", async ({ page }) => {
  await page.goto("/proyek/MK01?view=list");
  await expect(page.locator("table.grid tbody tr.row")).toHaveCount(55);
  await page.getByRole("tab", { name: "Board (kanban)" }).click();
  await expect(page.locator(".card").first()).toBeVisible();
  await expect(page.locator(".lane__head")).toHaveCount(6);
  await page.getByRole("tab", { name: "Timeline (Gantt)" }).click();
  await expect(page.locator(".gbar").first()).toBeVisible();
  await page.getByRole("tab", { name: "Form" }).click();
  await expect(page.locator(".sheet__title")).toBeVisible();
  await expect(page.locator(".statusbar")).toBeVisible();
});

test("a simulation shows the same numbers as the API", async ({ page, request }) => {
  await page.goto("/simulasi?project=MK01");
  const started = page.waitForResponse((r) => r.url().endsWith("/api/runs") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Jalankan" }).click();
  const { run_id } = await (await started).json();
  await expect(page.locator(".ev").first()).toBeVisible({ timeout: 180_000 });

  const run = await (await request.get(`/api/runs/${run_id}`)).json();
  const arls = run.results.find((r: { key: string }) => r.key === "ppo_bc_ppo_g@0");
  const row = page.locator("tr.row", { hasText: "ARLS-PPO" }).first();
  await expect(row).toContainText(fmt(arls.J));
  await expect(row).toContainText(fmt(arls.tard));
  await expect(row).toContainText(String(arls.changes));

  const events = await (await request.get(`/api/runs/${run_id}/ppo_bc_ppo_g@0/events`)).json();
  await expect(page.locator(".ev")).toHaveCount(events.length);
  await page.locator(".ev").nth(2).click();
  await expect(page.locator(".decision h3")).toHaveText(`Kejadian 3 dari ${events.length}`);
  const frame = await (await request.get(`/api/runs/${run_id}/ppo_bc_ppo_g@0/frames/2/after`)).json();
  await expect(page.locator(".decision .kv")).toContainText(fmt(frame.event.J_after_batch));
});

test("test data cannot be opened", async ({ page }) => {
  await page.goto("/proyek/MK03");
  await expect(page.locator(".notice")).toContainText("data uji");
});
