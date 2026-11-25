// The lessons read their numbers from the example run; these tests render every step and every
// question with a recorded copy of that run (fixtures/kopi.json, numbers from arls-ppo) and
// check that the key numbers the lessons teach come out right.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LessonData } from "./lessonData";
import fixture from "./__fixtures__/kopi.json";
import { LESSONS, makeCtx } from "./lessons";
import { order } from "./progress";

const c = makeCtx(fixture as unknown as LessonData);
const html = (node: unknown) => renderToStaticMarkup(<>{node as never}</>);
const stepText = (id: string, i: number) => {
  const s = LESSONS.find((l) => l.id === id)!.steps[i];
  return html(s.body(c)) + (s.look ? html(s.look(c)) : "") + (s.visual?.kind === "node" ? html(s.visual.render(c)) : "");
};

describe("lessons", () => {
  it("have unique ids, at least three steps and two questions each", () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(l.steps.length).toBeGreaterThanOrEqual(3);
      expect(l.quiz.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("render every step and every question with the example run", () => {
    for (const l of LESSONS) {
      for (let i = 0; i < l.steps.length; i++) expect(stepText(l.id, i).length).toBeGreaterThan(20);
      for (const q of l.quiz) {
        const opts = q.options(c);
        expect(opts).toHaveLength(4);
        expect(new Set(opts).size).toBe(4);
        expect(html(q.q(c)).length).toBeGreaterThan(5);
        expect(html(q.why(c)).length).toBeGreaterThan(5);
      }
    }
  });

  it("teach the due date of KOPI-1 from S0: 6 + 0,5 × 6 = 9", () => {
    const t = stepText("jadwal-awal", 1);
    expect(t).toContain("6 + 0,5 × 6");
    expect(t).toContain("9,0");
  });

  it("teach E = 59 / 12", () => {
    expect(stepText("jadwal-awal", 2)).toContain("59 / 12");
    expect(stepText("jadwal-awal", 2)).toContain("4,9167");
  });

  it("teach J of the four levels of event 2 with λ = 3", () => {
    const t = stepText("ukuran-j", 3);
    expect(t).toContain("5,586 + 3,0 × 1 = <b>8,586</b>");     // L1
    expect(t).toContain("6,545 + 3,0 × 1 = <b>9,545</b>");     // L2
    expect(t).toContain("9,808 + 3,0 × 0 = <b>9,808</b>");     // L0
  });

  it("teach n − LIS on the queue of Sari: [3, 1, 2] gives 3 − 2 = 1", () => {
    const t = stepText("ukuran-j", 2);
    expect(t).toContain("[3, 1, 2]");
    expect(t).toContain("3 − 2");
  });

  it("teach that the guard accepts L2 at event 2 and refuses L3 at event 4", () => {
    expect(stepText("pemilih", 2)).toContain("9,545 ≤ 9,808");
    expect(stepText("pemilih", 2)).toContain("ya, diterima");
    expect(stepText("pemilih", 3)).toContain("15,058 ≤ 11,666");
    expect(stepText("pemilih", 3)).toContain("tidak, ditolak");
  });

  it("teach J of the episode: 11,666 + 3 × 1 = 14,666", () => {
    expect(stepText("episode", 1)).toContain("11,666 + 3 × 1");
    expect(stepText("episode", 1)).toContain("14,666");
  });
});

describe("question order", () => {
  it("is a stable permutation", () => {
    const a = order("6b", 4);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    expect(order("6b", 4)).toEqual(a);
  });
});
