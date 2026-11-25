// Seam F3: the lessons can be followed step by step, the quiz answers without giving the right
// answer away, a finished lesson is marked, and playback in Simulasi goes step by step.
import { expect, test } from "@playwright/test";

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
  await page.goto("/simulasi?project=KOPI&cap=1.5");
  await page.getByRole("button", { name: "Jalankan" }).click();
  await expect(page.locator(".scene")).toBeVisible({ timeout: 180_000 });
  await page.getByRole("combobox", { name: "Kecepatan putar" }).selectOption("700");
  await page.getByRole("button", { name: "Putar langkah demi langkah" }).click();
  await expect(page.locator(".scene__step.on")).toContainText("Sebelum gangguan");
  await expect(page.locator(".scene__step.on")).toContainText("Gangguan masuk", { timeout: 5_000 });
  await expect(page.locator(".scene__look")).toContainText("tugas yang terkena gangguan");
  await expect(page.locator(".scene__step.on")).toContainText("Sesudah perbaikan", { timeout: 5_000 });
  await page.getByRole("button", { name: "Jeda" }).click();
});
