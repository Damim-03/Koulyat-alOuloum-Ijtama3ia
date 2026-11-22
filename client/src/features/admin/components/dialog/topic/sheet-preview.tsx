import type { CSSProperties } from "react";
import type { SheetPreview } from "../../../../../types/admin";

/**
 * ورقةُ Excel قبل تنزيلها — كما ستُفتح.
 *
 * يرسم ما يصفه الخادم (previewSheet) بقواعد الملف نفسها: شريطُ العنوان بلون
 * المنصّة وسطورُ تعريفه، ثمّ الرأس، ثمّ الصفوف بألوانها — المتناوبة، وخانة
 * النوع بلونه، والحالة والرمز بحبرهما، و«لا يوجد» باهتةً مائلة، والمشرف
 * خانةً واحدةً ممتدّة. وحولها إطارُ Excel: حروف الأعمدة، وأرقام الصفوف،
 * ولسانُ الورقة باسمها — ويُقلب الإطار مع اتّجاه الورقة كما يقلبه Excel.
 *
 * الألوان صريحةٌ من الوصف لا من رموز السمة: الورقة بيضاء في الوضع الداكن
 * أيضاً، كما يراها من يفتح الملف.
 */

const FONT = "Arial, 'Liberation Sans', Tahoma, sans-serif";
/** Excel's column width (characters) in pixels. */
const px = (chars: number) => Math.round(chars * 7 + 5);

/** «A», «B»… «Z», «AA»: a column's letters, as Excel heads it. */
function letters(n: number) {
  let s = "";
  for (let k = n + 1; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s;
  return s;
}

export function SheetPreviewView({
  preview,
  fileName,
  moreLabel,
  sheets,
  onSheet,
}: {
  preview: SheetPreview;
  fileName: string;
  moreLabel?: string;
  /** The file's sheets by name — one per level — the shown one among them. */
  sheets?: string[];
  onSheet?: (index: number) => void;
}) {
  const c = preview.colors;
  const n = preview.columns.length;
  const dir = preview.rtl ? "rtl" : "ltr";
  // Spreadsheet rows: the title lines, the note, a gap, the header — then the data.
  let rowNo = 0;
  const gutter: CSSProperties = {
    background: "#f3f3f3",
    color: "#6b6b6b",
    fontSize: 11,
    textAlign: "center",
    border: "1px solid #d9d9d9",
    width: 36,
    minWidth: 36,
    position: "sticky",
    insetInlineStart: 0,
    zIndex: 1,
  };
  const banner = (text: string, i: number) => (
    <tr key={`t${i}`} style={{ height: i === 0 ? 46 : 26 }}>
      <td style={gutter}>{++rowNo}</td>
      <td
        colSpan={n}
        style={{
          background: c.brand,
          color: i === 0 ? "#fff" : c.goldSoft,
          fontSize: i === 0 ? 20 : 12.5,
          fontWeight: i === 0 ? 700 : 400,
          padding: "0 12px",
          borderBottom: i === preview.title.length - 1 ? `2.5px solid ${c.gold}` : undefined,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </td>
    </tr>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#c8c8c8] bg-white shadow-[0_18px_50px_-24px_rgba(0,0,0,0.6)]" data-testid="sheet-preview">
      {/* Excel's bar: the file's name. */}
      <div className="flex shrink-0 items-center gap-2 bg-[#1f6e43] px-4 py-2 text-[12px] font-semibold text-white" dir="ltr">
        <span className="grid size-5 place-items-center rounded-[4px] bg-white text-[11px] font-black text-[#1f6e43]">X</span>
        <bdi className="truncate" dir="auto">
          {fileName}
        </bdi>
        <span className="ms-auto text-white/70">Excel</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto" dir={dir}>
        <table style={{ borderCollapse: "collapse", fontFamily: FONT, fontSize: 12.5, color: c.ink, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 36 }} />
            {preview.columns.map((col, i) => (
              <col key={i} style={{ width: px(col.width) }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <th style={{ ...gutter, zIndex: 3 }} />
              {preview.columns.map((_, i) => (
                <th key={i} style={{ background: "#f3f3f3", color: "#6b6b6b", fontWeight: 400, fontSize: 11, border: "1px solid #d9d9d9", height: 22 }}>
                  {letters(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.title.map(banner)}
            {preview.note && (
              <tr style={{ height: 24 }}>
                <td style={gutter}>{++rowNo}</td>
                <td colSpan={n} style={{ background: "#f7f3ea", color: c.muted, fontStyle: "italic", fontSize: 11.5, padding: "0 12px", whiteSpace: "nowrap" }}>
                  {preview.note}
                </td>
              </tr>
            )}
            <tr style={{ height: 10 }}>
              <td style={gutter}>{++rowNo}</td>
              <td colSpan={n} />
            </tr>
            <tr style={{ height: 34 }} data-testid="sheet-preview-header">
              <td style={gutter}>{++rowNo}</td>
              {preview.columns.map((col, i) => (
                <th
                  key={i}
                  style={{
                    background: col.accent ? c.gold : c.brand,
                    color: col.accent ? c.brand : "#fff",
                    fontWeight: 700,
                    fontSize: 12.5,
                    padding: "4px 6px",
                    textAlign: "center",
                    borderInline: "1px solid #3e5f58",
                    borderBottom: `2.5px solid ${col.accent ? c.brand : c.gold}`,
                    whiteSpace: "normal",
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
            {preview.rows.map((row, r) => (
              <tr key={r} style={{ height: 30 }} data-testid="sheet-preview-row">
                <td style={gutter}>{++rowNo}</td>
                {row.cells.map((cell, k) =>
                  cell.covered ? null : (
                    <td
                      key={k}
                      rowSpan={cell.rowSpan}
                      // A Latin title on an Arabic sheet keeps its full stop at its end.
                      dir={cell.ltr ? "ltr" : "auto"}
                      style={{
                        background: cell.fill ?? (row.band ? c.zebra : "#fff"),
                        color: cell.muted ? c.muted : (cell.ink ?? (k === 0 ? c.muted : c.ink)),
                        fontWeight: cell.ink && !cell.muted ? 700 : 400,
                        fontStyle: cell.muted ? "italic" : undefined,
                        // The sheet's side, whatever the text's own direction — as Excel aligns it.
                        textAlign: cell.center ? "center" : preview.rtl ? "right" : "left",
                        verticalAlign: "middle",
                        padding: "4px 6px",
                        border: `1px solid ${c.line}`,
                        whiteSpace: cell.wrap ? "normal" : "nowrap",
                        overflow: "hidden",
                        textOverflow: cell.wrap ? undefined : "ellipsis",
                        lineHeight: 1.35,
                      }}
                    >
                      {cell.v}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {moreLabel && (
          <p className="px-4 py-3 text-center text-[12px] font-medium text-[#6b6b6b]" style={{ fontFamily: FONT }}>
            {moreLabel}
          </p>
        )}
      </div>

      {/* The sheets' tabs, by their names — one per level, as in the file; the shown one in green. */}
      <div className="flex shrink-0 items-end gap-1 overflow-x-auto border-t border-[#d9d9d9] bg-[#f3f3f3] px-3 pt-1" dir={dir} role="tablist">
        {(sheets ?? [preview.name]).map((name, i) => {
          const on = name === preview.name;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onSheet?.(i)}
              data-testid="sheet-preview-tab"
              className={`shrink-0 rounded-t-md border border-b-0 px-4 py-1 text-[12px] font-semibold transition ${
                on ? "border-[#d9d9d9] bg-white text-[#1f6e43] shadow-[inset_0_-2px_0_#1f6e43]" : "border-transparent text-[#555] hover:bg-white/60"
              }`}
              style={{ fontFamily: FONT }}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
