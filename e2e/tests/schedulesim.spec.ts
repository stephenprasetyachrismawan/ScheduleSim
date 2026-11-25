// Seam F1: a project opens in its views, a run shows the numbers of the API (which come from
// arls-ppo's cek_episode.run), and test data cannot be opened.
import { expect, test } from "@playwright/test";
import { fmt, MK01, openRun, PPO } from "./helpers";

test("a project opens in list, board and timeline views, and a task opens as its own record", async ({ page }) => {
  await page.goto("/proyek/MK01?view=list");
  await expect(page.locator("table.grid tbody tr.row")).toHaveCount(55, { timeout: 120_000 });
  await page.getByRole("tab", { name: "Board (kanban)" }).click();
  await expect(page.locator(".card").first()).toBeVisible();
  await expect(page.locator(".lane__head")).toHaveCount(6);
  await page.getByRole("tab", { name: "Timeline (Gantt)" }).click();
  await expect(page.locator(".gbar").first()).toBeVisible();
  await page.locator(".gbar").first().click();
  await expect(page).toHaveURL(/\/proyek\/MK01\/tugas\/\d+$/);
  await expect(page.locator(".o-raw")).toBeVisible();
});

test("a run shows the same numbers as the API", async ({ page, request }) => {
  const runId = await openRun(page, `/simulasi/run?${MK01}`);
  const run = await (await request.get(`/api/runs/${runId}`)).json();
  const arls = run.results.find((r: { key: string }) => r.key === "ppo_bc_ppo_g@0");
  const row = page.locator(".o-list tbody tr", { hasText: "ARLS-PPO" }).first();
  await expect(row).toContainText(fmt(arls.J));
  await expect(row).toContainText(fmt(arls.tard));
  await expect(row).toContainText(String(arls.changes));
  await row.click();

  const events = await (await request.get(`/api/runs/${runId}/ppo_bc_ppo_g@0/events`)).json();
  await expect(page.locator(".o-list tbody tr")).toHaveCount(events.length + 1);
  await page.locator(".o-list tbody tr").nth(2).click();
  await expect(page).toHaveURL(new RegExp(`/simulasi/run/${PPO}/kejadian/3`));
  await expect(page.locator(".o-sheet__title")).toContainText("Kejadian 3");
  const frame = await (await request.get(`/api/runs/${runId}/ppo_bc_ppo_g@0/frames/2/after`)).json();
  await expect(page.locator(".o-field", { hasText: "J = Tard/E" })).toContainText(fmt(frame.event.J_after_batch));
});

test("test data cannot be opened", async ({ page }) => {
  await page.goto("/proyek/MK03");
  await expect(page.locator(".notice")).toContainText("data uji");
});
