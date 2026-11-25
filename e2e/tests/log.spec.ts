// Seam F2: the number log on screen shows the numbers of the API, the worked example of thesis
// section 4.6 can be followed in it, and learning mode adds tooltips and a tour only when on.
import { expect, test } from "@playwright/test";

const fmt = (v: number, d = 4) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

async function runMk01(page: import("@playwright/test").Page) {
  await page.goto("/simulasi?project=MK01&cap=1.5");
  const started = page.waitForResponse((r) => r.url().endsWith("/api/runs") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Jalankan" }).click();
  const { run_id } = await (await started).json();
  await expect(page.locator(".ev").first()).toBeVisible({ timeout: 180_000 });
  return run_id as string;
}

test("the number log shows the worked example of Bab IV with the numbers of the API", async ({ page, request }) => {
  const runId = await runMk01(page);
  await page.getByRole("tab", { name: "Log hitung" }).click();
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
  await runMk01(page);
  await expect(page.locator(".info__btn")).toHaveCount(0);
  await page.getByRole("button", { name: /Mode belajar/ }).click();
  await expect(page.locator(".info__btn").first()).toBeVisible();
  await page.getByRole("button", { name: "Penjelasan: Change penalty λ" }).click();
  await expect(page.locator(".info__pop")).toContainText("Subbab 3.3.5");
  await page.getByRole("button", { name: "Tur halaman ini" }).click();
  await expect(page.locator(".tour__card")).toContainText("1. Atur episode");
  await page.locator(".tour__card").getByRole("button", { name: "Lanjut" }).click();
  await expect(page.locator(".tour__card")).toContainText("2. Jalankan");
  await page.locator(".tour__card").getByRole("button", { name: "Lewati tur" }).click();
  await expect(page.locator(".tour__card")).toHaveCount(0);
  await page.getByRole("button", { name: /Mode belajar/ }).click();
  await expect(page.locator(".info__btn")).toHaveCount(0);
});

test("choosing a method shows its schedule at the chosen event, step by step", async ({ page, request }) => {
  const runId = await runMk01(page);
  await page.locator(".ev").nth(1).click();
  await page.locator(".mchip", { hasText: "Fixed-L3 + guard" }).click();
  await expect(page.locator(".mchip.on")).toContainText("Fixed-L3 + guard");
  await expect(page.locator(".decision .muted").first()).toContainText("Fixed-L3 + guard");
  const frame = await (await request.get(`/api/runs/${runId}/fix3_g/frames/1/after`)).json();
  await expect(page.locator(".decision .kv")).toContainText(
    new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(frame.event.J_after_batch));
  await page.locator(".scene__step", { hasText: "Gangguan masuk" }).click();
  await expect(page.locator(".scene__caption")).toContainText("belum diperbaiki");
  await page.locator(".mchip", { hasText: "AOR (tanpa perbaikan)" }).click();
  await page.locator(".scene__step", { hasText: "Sesudah perbaikan" }).click();
  await expect(page.locator(".scene__caption")).toContainText("tidak pernah memperbaiki");
});
