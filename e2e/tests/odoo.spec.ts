// Seam F4: the simulation as records in the manner of Odoo. A URL always brings back the same
// record, the pager ends in an "Akhir episode" record instead of an empty screen, the breadcrumb
// climbs back without losing the settings, and a number can be followed down to the raw file.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fmt, MK01, openRun, PPO } from "./helpers";

const RAW = "../vendor/arls-ppo/exp1/dfjsp-ppo-repair/data/raw/MK01.json";

test("a record URL reloads to the same record", async ({ page }) => {
  await openRun(page, `/simulasi/run/${PPO}/kejadian/3?${MK01}&langkah=2`);
  await expect(page.locator(".o-sheet__title")).toContainText("Kejadian 3");
  await expect(page.locator(".o-status__step.on")).toHaveText("② Gangguan masuk");
  await page.reload();
  await expect(page.locator(".o-sheet__title")).toContainText("Kejadian 3", { timeout: 240_000 });
  await expect(page.locator(".o-status__step.on")).toHaveText("② Gangguan masuk");
});

test("the pager ends at the last event, which leads to Akhir episode", async ({ page, request }) => {
  const runId = await openRun(page, `/simulasi/run/${PPO}/kejadian/15?${MK01}`);
  const events = await (await request.get(`/api/runs/${runId}/ppo_bc_ppo_g@0/events`)).json();
  expect(events.length).toBe(16);
  await page.getByRole("link", { name: "Kejadian berikutnya" }).click();
  await expect(page.locator(".o-sheet__title")).toContainText("Kejadian 16");
  await expect(page.locator(".o-pager__btn.is-off")).toHaveAttribute("aria-label", "Kejadian berikutnya");
  await page.getByRole("link", { name: /Akhir episode/ }).first().click();
  await expect(page.locator(".o-crumb--last")).toHaveText("Akhir episode");
  await expect(page.locator(".gbar").first()).toBeVisible({ timeout: 60_000 });
  const run = await (await request.get(`/api/runs/${runId}`)).json();
  const arls = run.results.find((r: { key: string }) => r.key === "ppo_bc_ppo_g@0");
  await expect(page.locator(".o-field", { hasText: "J episode" })).toContainText(fmt(arls.J));
});

test("the breadcrumb climbs back up without losing the settings", async ({ page }) => {
  await openRun(page, `/simulasi/run/${PPO}/akhir?${MK01}`);
  await page.locator(".o-crumbs").getByRole("link", { name: "ARLS-PPO" }).click();
  await expect(page.locator(".o-sheet__title")).toHaveText("ARLS-PPO");
  await expect(page.locator(".o-list tbody tr")).toHaveCount(17);              // 16 events + Akhir episode
  await page.locator(".o-crumbs").getByRole("link", { name: /MK01 · 1,5/ }).click();
  await expect(page).toHaveURL(/\/simulasi\/run\?/);
  const got = new URL(page.url()).searchParams;
  for (const [k, v] of new URLSearchParams(MK01)) expect(got.get(k)).toBe(v);
  await expect(page.locator(".o-list tbody tr", { hasText: "Fixed-L3 + guard" })).toBeVisible();
});

test("MK01-56 is task id 55, made by a disruption of event 1", async ({ page }) => {
  await openRun(page, `/simulasi/run/${PPO}/kejadian/1?${MK01}&langkah=3`);
  await page.locator(".o-look").getByRole("link", { name: "MK01-56" }).click();
  await expect(page.locator(".o-sheet__title")).toHaveText("MK01-56", { timeout: 60_000 });
  await expect(page.locator(".o-field", { hasText: "id di kode dan naskah" })).toContainText("55");
  await expect(page.locator(".o-look")).toContainText("id 55");
  await expect(page.locator(".o-look")).toContainText("dibuat oleh gangguan pada kejadian 1");
});

test("MK01-1 shows the options written in the raw file at jobs[0][0]", async ({ page }) => {
  const raw = JSON.parse(readFileSync(RAW, "utf-8"));
  await page.goto("/proyek/MK01/tugas/0");
  const box = page.locator(".o-raw");
  await expect(box).toContainText("jobs[0][0]", { timeout: 120_000 });
  for (const o of raw.jobs[0][0]) await expect(box).toContainText(`"machine": ${o.machine}, "processing": ${o.processing}`);
  await expect(page.locator(".o-field", { hasText: "id di kode dan naskah" })).toContainText("0");
});

test("the source of E lists the 55 tasks it adds up", async ({ page, request }) => {
  const runId = await openRun(page, `/simulasi/run?${MK01}&tab=input`);
  const ep = await (await request.get(`/api/runs/${runId}/ppo_bc_ppo_g@0/log`)).json();
  const E = ep.input.E;
  expect(E.n).toBe(55);
  const rows = ep.input.tasks.reduce((s: number, r: { upaya: number }) => s + r.upaya, 0);
  expect(Math.abs(rows - E.sum)).toBeLessThan(1e-9);
  expect(Math.abs(E.sum / E.n - E.value)).toBeLessThan(1e-12);
  await page.locator(".o-field", { hasText: "E (rata-rata upaya)" }).locator(".o-src").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText(fmt(E.value, 4));
  await expect(sheet.locator("tbody tr")).toHaveCount(55);
  await expect(sheet.locator("tfoot")).toContainText(fmt(E.sum, 4));
  await expect(sheet).toContainText(`${fmt(E.sum, 4)} / 55`);
});
