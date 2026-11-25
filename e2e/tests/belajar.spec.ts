// Seam F3: the lessons can be followed step by step, the quiz answers without giving the right
// answer away, a finished lesson is marked, and playback in Simulasi goes step by step.
import { expect, test } from "@playwright/test";
import { KOPI, openRun, PPO } from "./helpers";

test("a lesson is followed step by step and its quiz checks understanding", async ({ page }) => {
  await page.goto("/belajar");
  await expect(page.locator(".lesson-card")).toHaveCount(9);
  await page.locator(".lesson-card").first().click();
  await expect(page.locator(".lesson__title")).toHaveText("Proyek = tugas yang dikerjakan pengembang", { timeout: 180_000 });
  await expect(page.locator(".mini-gantt svg")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".lesson__look")).toContainText("Perhatikan");
  for (let i = 0; i < 4; i++) await page.locator(".lesson__nav .btn--primary").click();
  await expect(page.locator(".lesson__title")).toHaveText("Cek pemahaman");
  const q1 = page.locator(".qcard").first();
  await q1.getByRole("radio", { name: "Satu pengembang" }).click();
  await expect(q1).toContainText("Belum tepat");
  await expect(q1.locator(".qopt--right")).toHaveCount(0);           // the answer is not given away
  await q1.getByRole("radio", { name: "Satu tugas (issue)" }).click();
  await expect(q1).toContainText("Benar");
  const q2 = page.locator(".qcard").nth(1);
  await q2.getByRole("radio").filter({ hasText: "baru boleh mulai sesudah" }).click();
  await expect(page.locator(".lesson__done")).toBeVisible();
  await page.goto("/belajar");
  await expect(page.locator(".lesson-card").first()).toContainText("2/2 soal benar");
});

test("the numbers of a lesson come from the example run", async ({ page }) => {
  await page.goto("/belajar/ukuran-j");
  await expect(page.locator(".lesson__title")).toBeVisible({ timeout: 180_000 });
  for (let i = 0; i < 3; i++) await page.locator(".lesson__nav .btn--primary").click();
  await expect(page.locator(".lesson__body")).toContainText("8,586");
  await expect(page.locator(".lesson__body")).toContainText("9,545");
});

test("playback in Simulasi moves one step at a time and says what to look at", async ({ page }) => {
  await openRun(page, `/simulasi/run/${PPO}/kejadian/1?${KOPI}&langkah=1`);
  await page.getByRole("combobox", { name: "Kecepatan putar" }).selectOption("700");
  await expect(page.locator(".o-status__step.on")).toHaveText("① Sebelum gangguan");
  await page.getByRole("button", { name: "Putar" }).click();
  await expect(page.locator(".o-status__step.on")).toHaveText("② Gangguan masuk", { timeout: 5_000 });
  await expect(page.locator(".o-look").first()).toContainText("tugas yang terkena gangguan");
  await expect(page.locator(".o-status__step.on")).toHaveText("③ Sesudah perbaikan", { timeout: 5_000 });
  await page.getByRole("button", { name: "Jeda" }).click();
});
