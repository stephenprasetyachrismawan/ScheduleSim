// Seam F2: the number log on screen shows the numbers of the API, the worked example of thesis
// section 4.6 can be followed in it, and learning mode adds tooltips and a tour only when on.
import { expect, test } from "@playwright/test";
import { MK01, openRun, PPO } from "./helpers";

const fmt = (v: number, d = 4) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

async function runMk01(page: import("@playwright/test").Page, extra = "") {
  return openRun(page, `/simulasi/run/${PPO}/kejadian/1?${MK01}${extra}`);
}

test("the number log shows the worked example of Bab IV with the numbers of the API", async ({ page, request }) => {
  const runId = await runMk01(page, "&tab=log");
  const ev = await (await request.get(`/api/runs/${runId}/ppo_bc_ppo_g@0/log/0`)).json();
  const log = page.locator(".nlog");
  await expect(log).toContainText("Kejadian 1 dari 16");
  // J after AOR, the logits and probability of level 1, and J after the first sub-decision
  await expect(log).toContainText(fmt(ev.tard_aor));
  expect(fmt(ev.tard_aor)).toBe("18,9373");
  await expect(log).toContainText(fmt(ev.subs[0].selector.logits[1]));
  await expect(log).toContainText(fmt(ev.subs[0].selector.probs[1]));
  expect(fmt(ev.subs[0].levels["1"].J)).toBe("3,0102");
  await expect(log.locator(".lv-table")).toContainText(fmt(ev.subs[0].levels["1"].J));
  await expect(log.locator(".ftable tbody tr.ftable__row")).toHaveCount(38);
  // input and output of the episode
  const ep = await (await request.get(`/api/runs/${runId}/ppo_bc_ppo_g@0/log`)).json();
  await page.locator(".nlog__bar").getByRole("tab", { name: "Input" }).click();
  await expect(log).toContainText(fmt(ep.input.E.value));
  await expect(log).toContainText("sama persis");
  await page.locator(".nlog__bar").getByRole("tab", { name: "Output" }).click();
  await expect(log).toContainText(fmt(ep.output.J));
});

test("learning mode adds tooltips and a tour only when it is on", async ({ page }) => {
  await page.goto(`/simulasi/baru?${MK01}`);
  await expect(page.locator(".o-sheet")).toBeVisible();
  await expect(page.locator(".info__btn")).toHaveCount(0);
  await page.getByRole("button", { name: /Mode belajar/ }).click();
  await expect(page.locator(".info__btn").first()).toBeVisible();
  await page.getByRole("button", { name: "Penjelasan: Change penalty λ" }).click();
  await expect(page.locator(".info__pop")).toContainText("Subbab 3.3.5");
  await runMk01(page);
  await page.getByRole("button", { name: "Tur halaman ini" }).click();
  await expect(page.locator(".tour__card")).toContainText("1. Di mana saya?");
  await page.locator(".tour__card").getByRole("button", { name: "Lanjut" }).click();
  await expect(page.locator(".tour__card")).toContainText("2. Pindah kejadian");
  await page.locator(".tour__card").getByRole("button", { name: "Lewati tur" }).click();
  await expect(page.locator(".tour__card")).toHaveCount(0);
  await page.getByRole("button", { name: /Mode belajar/ }).click();
  await expect(page.locator(".info__btn")).toHaveCount(0);
});

test("the same event opens for another method, with its own schedule and numbers", async ({ page, request }) => {
  const runId = await runMk01(page);
  await page.getByRole("link", { name: "Kejadian berikutnya" }).click();
  await expect(page.locator(".o-sheet__title")).toContainText("Kejadian 2");
  await page.getByRole("link", { name: "Bandingkan metode lain" }).click();
  await page.locator(".o-related tbody tr", { hasText: "Fixed-L3 + guard" }).click();
  await expect(page).toHaveURL(/\/simulasi\/run\/fix3_g\/kejadian\/2/);
  await expect(page.locator(".o-crumbs")).toContainText("Fixed-L3 + guard");
  const frame = await (await request.get(`/api/runs/${runId}/fix3_g/frames/1/after`)).json();
  await expect(page.locator(".o-field", { hasText: "J = Tard/E" })).toContainText(
    new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(frame.event.J_after_batch));
  await page.locator(".o-status__step", { hasText: "Gangguan masuk" }).click();
  await expect(page.locator(".o-step__text")).toContainText("belum diperbaiki");
  await page.locator(".o-related tbody tr", { hasText: "AOR (tanpa perbaikan)" }).click();
  await expect(page.locator(".o-crumbs")).toContainText("AOR (tanpa perbaikan)");
  await expect(page.locator(".o-status__step.on")).toHaveText("② Gangguan masuk");
});
