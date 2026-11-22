/**
 * Gives every cell of a table the name of its column, as `data-label`, so the
 * `stack-sm` rule in index.css can show it beside the value when a phone lays
 * each row out as a card.
 *
 * Use as the table's ref: `<table ref={stackOnPhone} className="stack-sm …">`.
 * Rows come and go with the data, so the table is watched and relabelled on
 * every change; React never touches `data-label`, so the two do not fight.
 */
export function stackOnPhone(table: HTMLTableElement | null) {
  if (!table) return;
  labelCells(table);
  const watcher = new MutationObserver(() => labelCells(table));
  watcher.observe(table, { childList: true, subtree: true, characterData: true });
  return () => watcher.disconnect();
}

/** Copies each header cell's text onto the body cells of its column. */
export function labelCells(table: HTMLTableElement) {
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headRow) return;

  // A header cell spanning columns names all of them.
  const names: string[] = [];
  for (const th of Array.from(headRow.cells)) {
    const name = (th.textContent ?? "").replace(/\s+/g, " ").trim();
    for (let i = 0; i < th.colSpan; i++) names.push(name);
  }

  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      let col = 0;
      for (const cell of Array.from(row.cells)) {
        const name = cell.colSpan === 1 ? names[col] : "";
        if (name) {
          if (cell.dataset.label !== name) cell.dataset.label = name;
        } else if (cell.hasAttribute("data-label")) {
          cell.removeAttribute("data-label");
        }
        col += cell.colSpan;
      }
    }
  }
}
