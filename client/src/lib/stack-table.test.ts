import { describe, expect, it } from "vitest";
import { labelCells, stackOnPhone } from "./stack-table";

function table(html: string) {
  const t = document.createElement("table");
  t.innerHTML = html;
  document.body.append(t);
  return t;
}
const labels = (t: HTMLTableElement) =>
  Array.from(t.tBodies[0].rows).map((r) => Array.from(r.cells).map((c) => c.dataset.label ?? null));

describe("labelCells", () => {
  it("names each cell after its column, and leaves unnamed columns bare", () => {
    const t = table(`
      <thead><tr><th>Name</th><th> Email </th><th></th></tr></thead>
      <tbody><tr><td>A</td><td>a@x</td><td>›</td></tr><tr><td>B</td><td>b@x</td><td>›</td></tr></tbody>`);
    labelCells(t);
    expect(labels(t)).toEqual([
      ["Name", "Email", null],
      ["Name", "Email", null],
    ]);
  });

  it("follows column spans in the header and in the rows", () => {
    const t = table(`
      <thead><tr><th colspan="2">Who</th><th>Status</th></tr></thead>
      <tbody><tr><td>x</td><td>y</td><td>ok</td></tr><tr><td colspan="3">Nothing here</td></tr></tbody>`);
    labelCells(t);
    expect(labels(t)).toEqual([["Who", "Who", "Status"], [null]]);
  });
});

describe("stackOnPhone", () => {
  it("labels rows that arrive later, until it is let go", async () => {
    const t = table(`<thead><tr><th>Name</th></tr></thead><tbody></tbody>`);
    const release = stackOnPhone(t);
    t.tBodies[0].innerHTML = "<tr><td>late</td></tr>";
    await Promise.resolve();
    expect(labels(t)).toEqual([["Name"]]);

    release?.();
    t.tBodies[0].innerHTML = "<tr><td>later</td></tr>";
    await Promise.resolve();
    expect(labels(t)).toEqual([[null]]);
  });
});
