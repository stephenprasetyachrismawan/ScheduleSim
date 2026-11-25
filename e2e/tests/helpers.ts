import { expect, type Page } from "@playwright/test";

export const fmt = (v: number, d = 3) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

export const MK01 = "p=MK01&cap=1.5&int=0.15&seed=5000&lam=3&m=ppo_bc_ppo_g@0,fix3_g,acak_g,aor";
export const KOPI = "p=KOPI&cap=1.5&int=0.15&seed=5000&lam=3&m=ppo_bc_ppo_g@0,aor,seq,fix3_g,acak_g";
export const PPO = "ppo_bc_ppo_g%400";

/** Opens a page of a run and returns the run id the page started (or reused from the cache). */
export async function openRun(page: Page, url: string): Promise<string> {
  const started = page.waitForResponse((r) => r.url().endsWith("/api/runs") && r.request().method() === "POST");
  await page.goto(url);
  const { run_id } = await (await started).json();
  await expect(page.locator(".o-sheet").first()).toBeVisible({ timeout: 240_000 });
  return run_id as string;
}
