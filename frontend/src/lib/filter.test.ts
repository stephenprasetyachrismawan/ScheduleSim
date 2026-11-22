import { describe, expect, it } from "vitest";
import { angka, persen } from "../format";
import type { Issue } from "../types";
import { emptyFilters, filterIssues, groupIssues, sortIssues } from "./filter";

function issue(id: number, over: Partial<Issue> = {}): Issue {
  return {
    id, key: `MK01-${id + 1}`, summary: `Fitur 01 / Tugas ${id + 1}`, epic: "Fitur 01",
    epic_id: 0, unplanned: false, status: "To Do", status_code: "not_started",
    assignee: "Pengembang 1", assignee_id: 0, estimate: 2, progress: 0, remaining: 2,
    start: id, end: id + 2, due: id + 3, late: false, lateness: 0, rank: id + 1,
    priority: "Medium", priority_value: 0.3, blocked_by: [], blocks: [],
    origin: { instance: "MK01", job: 1, operation: id + 1, machine: "M1", eligible: { M1: 2 } },
    ...over,
  };
}

const ISSUES = [
  issue(0),
  issue(1, { assignee: "Pengembang 2", assignee_id: 1, late: true, lateness: 1.5,
             status: "In Progress", estimate: 4 }),
  issue(2, { epic: "Pekerjaan tidak terencana", epic_id: null, unplanned: true,
             summary: "Pekerjaan tidak terencana #1", priority: "Highest" }),
];

describe("filterIssues", () => {
  it("keeps everything without filters", () => {
    expect(filterIssues(ISSUES, emptyFilters)).toHaveLength(3);
  });
  it("matches key or summary text, assignee, epic, status and late", () => {
    expect(filterIssues(ISSUES, { ...emptyFilters, text: "mk01-2" }).map((i) => i.id)).toEqual([1]);
    expect(filterIssues(ISSUES, { ...emptyFilters, text: "tidak terencana" }).map((i) => i.id))
      .toEqual([2]);
    expect(filterIssues(ISSUES, { ...emptyFilters, assignees: [1] }).map((i) => i.id)).toEqual([1]);
    expect(filterIssues(ISSUES, { ...emptyFilters, lateOnly: true }).map((i) => i.id)).toEqual([1]);
    expect(filterIssues(ISSUES, { ...emptyFilters, statuses: ["To Do"] })).toHaveLength(2);
  });
});

describe("groupIssues", () => {
  it("puts unplanned work after the planned epics and sums estimates", () => {
    const g = groupIssues(ISSUES, "epic");
    expect(g.map((x) => x.label)).toEqual(["Fitur 01", "Pekerjaan tidak terencana"]);
    expect(g[0].estimate).toBe(6);
    expect(g[0].late).toBe(1);
  });
  it("orders statuses as a board does", () => {
    expect(groupIssues(ISSUES, "status").map((x) => x.label)).toEqual(["To Do", "In Progress"]);
  });
});

describe("sortIssues", () => {
  it("sorts by lateness, largest first", () => {
    expect(sortIssues(ISSUES, "lateness", true)[0].id).toBe(1);
  });
});

describe("format", () => {
  it("writes numbers with a decimal comma", () => {
    expect(angka(1234.5, 1)).toBe("1.234,5");
    expect(persen(-24.0119)).toBe("−24,01%");
    expect(persen(0.49)).toBe("+0,49%");
  });
});
