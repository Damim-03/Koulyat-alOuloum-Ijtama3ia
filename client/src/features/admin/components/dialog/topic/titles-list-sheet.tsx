import facultyLogo from "../../../../../assets/Faculty.png";
import universityLogo from "../../../../../assets/university-logo.png";
import type { TopicTitlesList } from "../../../../../types/admin";
import { arabicName, prefixed, sheetDate, sheetHeading, supervisorName, type Orientation } from "./titles-list-utils";

/**
 * قائمةُ عناوين المذكرات كما يطبعها القسم ويعلّقها.
 *
 * لكلّ تخصّصٍ صفحتُه: ترويسةُ الجامعة والكلّية والقسم، ثمّ الشعبة والتخصّص،
 * ثمّ الجدول. **قبل الإسناد** هي المواضيع المعتمدة وأساتذتها؛ **وبعد
 * الإسناد** هي المذكرات وطلبتها — على صورة القائمة التي يتداولها القسم.
 *
 * نصٌّ إداريٌّ ثابت لا تُترجمه الواجهة، كورقة الإشراف: الوثيقة تُعلَّق
 * بالعربية مهما كانت لغة الشاشة التي أصدرتها، والأسماء بالعربية كذلك.
 * والألوان صريحةٌ لا من رموز السمة: لا وضع داكن للورق.
 *
 * والجدول يمتدّ على ما يلزم من صفحات عند الطباعة، ويتكرّر رأسه في كلّ صفحة.
 */

export function TitlesListSheet({ data, orientation }: { data: TopicTitlesList; orientation: Orientation }) {
  const after = data.mode === "after";
  const date = sheetDate();
  return (
    <div className="tl-doc" dir="rtl" lang="ar" data-testid="titles-sheet">
      <style>{SHEET_CSS}</style>
      {data.groups.map((g) => (
        <article key={g.specialization.id} className={`tl-paper tl-${orientation} ${after ? "tl-wide" : ""}`}>
          <header className="tl-head">
            {/* في RTL: الأوّل يمينُ الورقة — شعار الجامعة — والثاني يسارُها. */}
            <img className="tl-logo" src={universityLogo} alt="" />
            <div className="tl-head-text">
              <p>جامعة الشهيد حمه لخضر الوادي</p>
              {g.faculty && <p>{prefixed(g.faculty.name, "كلية")}</p>}
              {g.department && <p>{prefixed(g.department.name, "قسم")}</p>}
            </div>
            <img className="tl-logo tl-logo-faculty" src={facultyLogo} alt="" />
          </header>

          <div className="tl-sub">
            <span>{g.filiere ? prefixed(g.filiere.name, "شعبة") : ""}</span>
            <span>تخصص: {g.specialization.name}</span>
          </div>
          <hr className="tl-rule" />

          <h1 className="tl-title">
            {sheetHeading(data.mode, g.specialization.level)}
            {data.year && (
              <>
                {" "}
                للسنة الجامعية <bdi dir="ltr">{data.year.title}</bdi>
              </>
            )}
          </h1>

          <table className="tl-table">
            <thead>
              <tr>
                <th className="tl-num">الرقم</th>
                {after && <th className="tl-students">الطالب</th>}
                <th>عنوان المذكرة</th>
                <th className="tl-sup">الأستاذ المشرف</th>
                <th className="tl-mail">البريد الجامعي للأستاذ المشرف</th>
                <th className="tl-count">عدد الطلبة في المجموعة</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="tl-num">{i + 1}</td>
                  {after && <td className="tl-students">{r.students.map(arabicName).filter(Boolean).join(" / ")}</td>}
                  <td className="tl-topic">{r.title}</td>
                  <td className="tl-sup">{supervisorName(r.supervisor)}</td>
                  <td className="tl-mail">
                    <MailCell email={r.supervisor.email} />
                  </td>
                  {/* After: who is in the group. Before: how many it is meant for. */}
                  <td className="tl-count">{after ? r.students.length : r.maxStudents}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="tl-foot">
            <span>
              {after ? "عدد المذكرات" : "عدد المواضيع"}: {g.rows.length}
            </span>
            <span>
              حُرّرت بتاريخ: <bdi dir="ltr">{date}</bdi>
            </span>
          </footer>
        </article>
      ))}
    </div>
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
 */
const SHEET_CSS = `
.tl-doc { display: flex; flex-direction: column; align-items: center; gap: 10mm; }
.tl-paper {
  box-sizing: border-box;
  padding: 12mm 14mm;
  background: #fff;
  color: #000;
  font-family: "Traditional Arabic", "Amiri", "Times New Roman", serif;
  font-size: 13pt;
  line-height: 1.6;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.28);
}
.tl-portrait { width: 210mm; min-height: 297mm; }
.tl-landscape { width: 297mm; min-height: 210mm; }
.tl-head { display: flex; align-items: center; justify-content: space-between; gap: 6mm; }
.tl-logo { width: 24mm; height: 24mm; object-fit: contain; flex: none; }
.tl-logo-faculty { width: 38mm; height: 28mm; }
.tl-head-text { flex: 1; text-align: center; }
.tl-head-text p { margin: 0; font-weight: 700; font-size: 15pt; line-height: 1.55; }
.tl-sub { display: flex; justify-content: space-between; gap: 6mm; margin-top: 3mm; font-weight: 700; font-size: 14pt; }
.tl-rule { border: none; border-top: 1.5px solid #000; margin: 1.5mm 0 0; }
.tl-title { margin: 7mm 0 5mm; text-align: center; color: #365f91; font-size: 19pt; font-weight: 700; line-height: 1.4; }
.tl-table { width: 100%; border-collapse: collapse; font-size: 12.5pt; }
.tl-table th {
  background: #4f81bd;
  color: #fff;
  font-weight: 700;
  text-align: start;
  padding: 2mm 3mm;
  border: 1px solid #4f81bd;
}
.tl-table td { padding: 2mm 3mm; border: 1px solid #95b3d7; vertical-align: top; }
.tl-table tbody tr:nth-child(odd) td { background: #dbe5f1; }
.tl-table .tl-num { width: 11mm; text-align: center; }
.tl-table .tl-count { width: 26mm; text-align: center; }
/* An address breaks anywhere rather than pushing the table past the page. */
.tl-table .tl-mail { width: 26%; font-size: 11pt; overflow-wrap: anywhere; }
.tl-wide .tl-table { font-size: 11.5pt; }
.tl-wide .tl-table .tl-students { width: 24%; }
.tl-wide .tl-table .tl-sup { width: 17%; }
.tl-wide .tl-table .tl-mail { width: 21%; font-size: 10.5pt; }
.tl-wide .tl-table .tl-count { width: 20mm; }
.tl-mail-part { display: inline-block; }
.tl-table .tl-students { width: 28%; }
.tl-table .tl-sup { width: 23%; }
.tl-table .tl-topic { overflow-wrap: anywhere; }
.tl-foot { display: flex; justify-content: space-between; gap: 6mm; margin-top: 6mm; font-size: 11.5pt; }

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
