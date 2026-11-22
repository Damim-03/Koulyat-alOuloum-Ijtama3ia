import facultyLogo from "../../../../../assets/Faculty.png";
import universityLogo from "../../../../../assets/university-logo.png";
import type { TitlesListGroup, TitlesListRow, TopicTitlesList } from "../../../../../types/admin";
import { typeCodes } from "../../../../../lib/topic-extras";
import { assetUrl } from "../../../../../lib/asset-url";
import {
  HEADER_AR,
  SHEET_TEXT,
  columnWidths,
  columnsWithData,
  headerLatin,
  inkOf,
  nameIn,
  prefixed,
  sheetHeading,
  supervisorName,
  supervisorSpans,
  type SheetColumn,
  type TableColumn,
  type SheetLang,
} from "./titles-list-utils";

/**
 * قائمةُ المواضيع كما يكتبها القسم — على صورة قائمته الرسمية للمواضيع المقترحة.
 *
 * ورقةٌ أفقيّة لكلّ تخصّص: في رأسها شعارا الجامعة والكلّية وبينهما سطورُ
 * الدولة والوزارة والجامعة بالعربية وتحت كلٍّ منها ترجمتُه، ثمّ الكلّية
 * والقسم — باللاتينية يساراً وبالعربية يميناً — ثمّ خطّ، ثمّ العنوان، ثمّ
 * الجدول: رأسُه كحليّ، وأوّلُ أعمدته رمزُ الموضوع بلون نوعه (IoT01، AI01)،
 * واسمُ المشرف مرّةً بجانب مواضيعه المتتالية، والمشرفُ المساعد أو «—»،
 * والعنوان، والوصف المختصر، ونوعُ الموضوع في خانةٍ بلونه.
 *
 * والترويسة باللغتين أيّاً كانت لغة الورقة؛ ولغةُ الورقة لغةُ عنوانها
 * وجدولها، وكلُّ خانةٍ تأخذ اتّجاهها من نصّها: عنوانٌ لاتينيّ في ورقةٍ
 * عربية يبقى بنقطته في آخره. والألوان صريحةٌ لا من رموز السمة: لا وضع داكن للورق.
 * والجدول يمتدّ على ما يلزم من صفحات، ويتكرّر رأسه، ورقمُ الصفحة في أسفلها.
 */

export function TitlesListSheet({
  data,
  lang = "ar",
  columns,
}: {
  data: TopicTitlesList;
  lang?: SheetLang;
  /** What to show beside «#», the supervisor and the title; by default, the department's. */
  columns?: Set<SheetColumn>;
}) {
  const cols = columns ?? columnsWithData(data.groups);
  const after = data.mode === "after";
  const T = SHEET_TEXT[lang];
  return (
    <div className="tl-doc" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} data-testid="titles-sheet">
      <style>{SHEET_CSS}</style>
      {data.groups.map((g) => (
        <article key={g.specialization.id} className={`tl-paper tl-lang-${lang}`}>
          <SheetHeader group={g} lang={lang} />
          <hr className="tl-rule" />

          <h1 className="tl-title">{sheetHeading(data.mode, g.specialization.level, lang, data.year?.title)}</h1>
          <p className="tl-scope">
            {g.filiere && (
              <span>
                {lang === "ar" ? (
                  prefixed(g.filiere.name, "شعبة")
                ) : (
                  <>
                    {T.filiere}: <bdi>{g.filiere.name}</bdi>
                  </>
                )}
              </span>
            )}
            <span>
              {T.specialization}: <bdi>{g.specialization.name}</bdi>
            </span>
          </p>

          <SheetTable rows={g.rows} after={after} cols={cols} lang={lang} />
        </article>
      ))}
    </div>
  );
}

/**
 * The university's logo on the left and the faculty's on the right, the
 * state, the ministry and the university between them — each Arabic line
 * with its translation under it; then the faculty and the department, in
 * Latin letters on the left and in Arabic on the right. Laid out so on
 * every sheet, as the department's header is.
 */
function SheetHeader({ group: g, lang }: { group: TitlesListGroup; lang: SheetLang }) {
  const L = headerLatin(lang);
  const facultyIcon = assetUrl(g.faculty?.iconUrl) ?? facultyLogo;
  return (
    <>
      <header className="tl-head" dir="ltr">
        <img className="tl-logo" src={universityLogo} alt="" />
        <div className="tl-state">
          <p className="tl-ar" lang="ar">
            {HEADER_AR.republic}
          </p>
          <p className="tl-la">{L.republic}</p>
          <p className="tl-ar" lang="ar">
            {HEADER_AR.ministry}
          </p>
          <p className="tl-la">{L.ministry}</p>
          <p className="tl-ar" lang="ar">
            {HEADER_AR.university}
          </p>
          <p className="tl-la">{L.university}</p>
        </div>
        <img className="tl-logo tl-logo-faculty" src={facultyIcon} alt="" />
      </header>
      <div className="tl-places" dir="ltr">
        <div className="tl-places-la" data-testid="titles-places-latin">
          {g.faculty?.nameLatin?.trim() && <p>{g.faculty.nameLatin}</p>}
          {g.department?.nameLatin?.trim() && <p>{g.department.nameLatin}</p>}
        </div>
        <div className="tl-places-ar" dir="rtl" lang="ar">
          {g.faculty && <p>{prefixed(g.faculty.name, "كلية")}</p>}
          {g.department && <p>{prefixed(g.department.name, "قسم")}</p>}
        </div>
      </div>
    </>
  );
}

function SheetTable({ rows, after, cols, lang }: { rows: TitlesListRow[]; after: boolean; cols: Set<SheetColumn>; lang: SheetLang }) {
  const T = SHEET_TEXT[lang];
  const spans = supervisorSpans(rows);
  const codes = typeCodes(rows);
  const on = (c: SheetColumn) => cols.has(c);
  // The columns drawn, and each one's width: every header on one line, the table on the page.
  const drawn: TableColumn[] = [
    "num",
    "sup",
    ...(on("coSupervisor") ? (["co"] as const) : []),
    "topic",
    ...(after ? (["students"] as const) : []),
    ...(on("summary") ? (["summary"] as const) : []),
    ...(on("type") ? (["type"] as const) : []),
    ...(on("email") ? (["mail"] as const) : []),
    ...(on("count") ? (["count"] as const) : []),
  ];
  const labels: Record<TableColumn, string> = {
    num: T.num,
    sup: T.supervisor,
    co: T.coSupervisor,
    topic: T.title,
    students: T.students,
    summary: T.summary,
    type: T.type,
    mail: T.email,
    count: T.count,
  };
  const { widths, tight } = columnWidths(drawn, labels);
  return (
    <table className={`tl-table ${tight ? "tl-tight" : ""}`}>
      <colgroup>
        {drawn.map((c) => (
          <col key={c} style={{ width: `${widths[c]!.toFixed(2)}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className="tl-num">{T.num}</th>
          <th className="tl-sup">{T.supervisor}</th>
          {on("coSupervisor") && <th className="tl-co">{T.coSupervisor}</th>}
          <th className="tl-topic">{T.title}</th>
          {after && <th className="tl-students">{T.students}</th>}
          {on("summary") && <th className="tl-summary">{T.summary}</th>}
          {on("type") && <th className="tl-type">{T.type}</th>}
          {on("email") && <th className="tl-mail">{T.email}</th>}
          {on("count") && <th className="tl-count">{T.count}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} data-testid="titles-row">
            {/* The type's code in its ink — or, for a topic without a type, its place in the list. */}
            <td className="tl-num" style={r.type ? { color: inkOf(r.type.color) } : undefined}>
              <bdi dir="ltr">{codes[i] ?? i + 1}</bdi>
            </td>
            {spans[i]! > 0 && (
              <td className="tl-sup" rowSpan={spans[i]} dir="auto">
                {supervisorName(r.supervisor, lang)}
              </td>
            )}
            {on("coSupervisor") && (
              <td className={`tl-co ${r.coSupervisor ? "" : "tl-none"}`} dir="auto">{r.coSupervisor ? nameIn(r.coSupervisor, lang) : "—"}</td>
            )}
            <td className="tl-topic" dir="auto">
              {r.title}
            </td>
            {after && <td className="tl-students" dir="auto">{r.students.map((s) => nameIn(s, lang)).filter(Boolean).join(" / ")}</td>}
            {on("summary") && <td className="tl-summary" dir="auto">{r.summary || r.excerpt || ""}</td>}
            {on("type") && (
              <td
                className={`tl-type ${r.type ? "" : "tl-none"}`}
                dir="auto"
                style={r.type ? { background: r.type.color } : undefined}
              >
                {r.type?.name ?? "—"}
              </td>
            )}
            {on("email") && (
              <td className="tl-mail">
                <MailCell email={r.supervisor.email} />
              </td>
            )}
            {/* After: who is in the group. Before: how many it is meant for. */}
            {on("count") && <td className="tl-count">{after ? r.students.length : r.maxStudents}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * An address breaks before its «@», if anywhere: the name on one line, the
 * domain whole on the next — not «univ-» here and «eloued.dz» there.
 */
function MailCell({ email }: { email: string | null }) {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 1) return <bdi dir="ltr">{email}</bdi>;
  return (
    <bdi dir="ltr">
      <span className="tl-mail-part">{email.slice(0, at)}</span>
      <wbr />
      <span className="tl-mail-part">{email.slice(at)}</span>
    </bdi>
  );
}

/**
 * أنماطُ الوثيقة داخلها، معزولةً بالبادئة `tl-`: تُطبع بتنسيقها من أيّ
 * شاشةٍ استُعملت فيها. والمقاسات بالمليمتر — الورقة ورقة مهما كانت الشاشة.
 * وألوانها ألوانُ قائمة القسم: كحليٌّ للرأس والعنوان، ورماديٌّ للحدود.
 */
const SHEET_CSS = `
.tl-doc { display: flex; flex-direction: column; align-items: center; gap: 10mm; }
.tl-paper {
  box-sizing: border-box;
  width: 297mm;
  min-height: 210mm;
  padding: 11mm 13mm 12mm;
  background: #fff;
  color: #000;
  font-family: Arial, "Liberation Sans", Helvetica, "Segoe UI", Tahoma, sans-serif;
  font-size: 10pt;
  line-height: 1.3;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.28);
}
.tl-head { display: flex; align-items: center; justify-content: space-between; gap: 8mm; }
.tl-logo { width: 26mm; height: 26mm; object-fit: contain; flex: none; }
.tl-logo-faculty { width: 30mm; height: 28mm; }
.tl-state { flex: 1; text-align: center; }
.tl-state p { margin: 0; }
.tl-ar { font-family: "Simplified Arabic", "Traditional Arabic", "Amiri", "Times New Roman", serif; font-weight: 700; font-size: 12.5pt; line-height: 1.35; }
.tl-la { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.3; }
.tl-places { display: flex; justify-content: space-between; align-items: flex-end; gap: 10mm; margin-top: 3mm; }
.tl-places p { margin: 0; }
.tl-places-la { font-family: "Times New Roman", Times, serif; font-size: 12.5pt; line-height: 1.6; text-align: left; }
.tl-places-ar { font-family: "Simplified Arabic", "Traditional Arabic", "Amiri", "Times New Roman", serif; font-weight: 700; font-size: 12.5pt; line-height: 1.6; text-align: right; }
.tl-rule { border: none; border-top: 1.2px solid #8c8c8c; margin: 4mm 0 0; }
.tl-title { margin: 6mm 0 1.5mm; text-align: start; color: #1f3864; font-size: 17pt; font-weight: 700; line-height: 1.3; }
.tl-lang-ar .tl-title { font-size: 18pt; }
.tl-scope { display: flex; flex-wrap: wrap; gap: 0 6mm; margin: 0 0 4mm; color: #595959; font-size: 9.5pt; }
/* Widths from the colgroup (columnWidths): fixed, so no column is squeezed by another's text. */
.tl-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9.5pt; line-height: 1.28; }
.tl-table th {
  background: #203864;
  color: #fff;
  font-weight: 700;
  font-size: 10pt;
  text-align: start;
  /* One line, as the department's list: the widths leave each header room for it. */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 1.8mm 2mm;
  border: 1px solid #203864;
  border-inline-color: #8faadc;
}
.tl-table th:first-child { border-inline-start-color: #203864; }
.tl-table th:last-child { border-inline-end-color: #203864; }
.tl-table th.tl-num { color: #ff0000; text-align: center; }
/* Clear lines between the cells: on paper, a light grey disappears. */
.tl-table td { padding: 1.4mm 2mm; border: 1px solid #7f7f7f; vertical-align: middle; overflow-wrap: break-word; }
.tl-table .tl-num { text-align: center; font-weight: 700; white-space: nowrap; color: #1f3864; }
.tl-table td.tl-sup { font-weight: 700; }
.tl-table td.tl-none { text-align: center; }
.tl-table td.tl-type { font-weight: 700; }
.tl-table .tl-mail { font-size: 8.5pt; }
.tl-table td.tl-mail { overflow-wrap: anywhere; }
.tl-table .tl-count { text-align: center; }
.tl-mail-part { display: inline-block; }
.tl-lang-ar .tl-table { font-size: 10.5pt; }
.tl-lang-ar .tl-table th { font-size: 10.5pt; }
/* Many columns: a size smaller, so they still fit the page. */
.tl-table.tl-tight { font-size: 8.5pt; }
.tl-table.tl-tight th { font-size: 9pt; padding: 1.6mm 1.5mm; }
.tl-table.tl-tight td { padding: 1.2mm 1.5mm; }

@media print {
  .tl-doc { display: block; gap: 0; }
  .tl-paper {
    width: auto !important;
    min-height: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    break-after: page;
    page-break-after: always;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .tl-paper:last-child { break-after: auto; page-break-after: auto; }
  .tl-table thead { display: table-header-group; }
  .tl-table tr { break-inside: avoid; page-break-inside: avoid; }
}
`;
