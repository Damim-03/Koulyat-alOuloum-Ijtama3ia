import { useLayoutEffect, useRef, useState } from "react";

import facultyLogo from "../../../assets/Faculty.png";
import universityLogo from "../../../assets/university-logo.png";
import { assetUrl } from "../../../lib/asset-url";
import type { SupervisionSnapshot } from "../api/supervision.api";
import { SHEET_DEGREES, legacyTemplate } from "../lib/sheet-template";
import { Ean13Barcode } from "./barcode";

/** أدنى تصغيرٍ مسموح: دونه تصير الورقة غير مقروءة، فالصفحةُ الثانية أهون. */
const MIN_FIT = 0.62;

/**
 * ورقةُ «طلب الموافقة على الإشراف» بمقاس A4.
 *
 * **وهي نفسها المعاينة ونفسها المطبوع.** لا قالب ثانٍ للطباعة: ما يُرى على
 * الشاشة هو ما يخرج من الطابعة، فلا يفترقان بتعديلٍ يُنسى في أحدهما.
 *
 * والمقاسات بالمليمتر لا بالبكسل: الورقة ٢١٠×٢٩٧ مهما كانت كثافة الشاشة،
 * فلا تنزلق سطراً إلى صفحةٍ ثانية عند الطباعة.
 *
 * وإن طال العنوان أو كثُر الطلبة حتى تجاوز المحتوى حدّ الصفحة، يُقاس
 * المحتوى بعد رسمه ويُصغَّر بمقدار ما يلزم تماماً — قياسٌ لا تخمين. ويُعوَّض
 * العرضُ بـ`calc(100% / fit)` فيبقى السطر ممتدّاً على عرض الورقة كما كان،
 * ويصغُر الخطُّ والفراغ وحدهما. ولا يُقصّ شيء: لو لزم تصغيرٌ دون `MIN_FIT`
 * وقف عنده، لأنّ ابتلاع اسم طالبٍ من وثيقةٍ رسمية أسوأ من ورقةٍ زائدة.
 *
 * والألوان سوداء على أبيض صراحةً، لا من رموز السمة: الوثيقة لا وضع داكن
 * لها، ولو تبعت السمة لخرجت من الطابعة بخلفيةٍ سوداء.
 *
 * **ونصّها من قالبها** (`snapshot.template`) — الترويسة والعبارات وأسماء
 * الشهادات والشعاران، كما حفظتها الإدارة يوم صدرت الوثيقة — وإلّا فالنصّ
 * الأصليّ. وكلّ عبارةٍ فيه اختيارية: الفارغة لا تُطبع، وتبقى البيانات التي
 * تليها. وهو عربيٌّ لا تُترجمه الواجهة: الورقة تُطبع وتُودَع بالعربية
 * وحدها مهما كانت لغة الشاشة التي أصدرتها، وترجمتُها تُخرجها عن صفتها.
 */
export function SupervisionSheet({
  snapshot,
  documentNumber,
  barcode,
  revoked = false,
}: {
  snapshot: SupervisionSnapshot;
  documentNumber: string;
  /** ثلاثة عشر رقماً أسفل الورقة — `null` في المسوّدة قبل الإصدار. */
  barcode: string | null;
  revoked?: boolean;
}) {
  // A document without a template was issued with the original text; one whose template has no
  // specialization line was printed before it existed — neither has it.
  const tpl = snapshot.template ?? legacyTemplate();
  const { fit, pageRef, bodyRef } = useFitToPage([
    JSON.stringify(tpl),
    snapshot.topicTitle,
    snapshot.supervisorName,
    snapshot.specialization ?? "",
    snapshot.students.map((s) => s.fullName).join("·"),
    documentNumber,
    barcode ?? "",
  ].join("|"));

  const department =
    tpl.department.show && snapshot.specialization
      ? [tpl.department.prefix.trim(), snapshot.specialization].filter(Boolean).join(" ")
      : "";
  // A degree with no name is not printed (the doctorate, by default).
  const degrees = SHEET_DEGREES.filter((d) => tpl.degrees[d].trim());
  // Under the degrees' boxes, the topic's specialization.
  const specialization = tpl.specialization?.show && snapshot.specialization ? snapshot.specialization : "";

  return (
    <div
      className="sup-sheet"
      dir="rtl"
      lang="ar"
      data-testid="supervision-sheet"
    >
      <style>{SHEET_CSS}</style>

      <div className="sup-page" ref={pageRef}>
        <div
          className="sup-body"
          ref={bodyRef}
          data-fit={fit < 1 ? "shrunk" : undefined}
          style={{ "--sup-fit": String(fit) } as React.CSSProperties}
        >
          {/* ── الترويسة ── */}
          <header className="sup-head">
            {/* في RTL: الأوّل يمينُ الورقة — شعار الجامعة — والثاني يسارُها. */}
            <img className="sup-logo" src={assetUrl(tpl.universityLogo) ?? universityLogo} alt="" />
            <div className="sup-head-text" data-testid="sup-header">
              {tpl.header
                .filter((line) => line.trim())
                .map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              {department && <p>{department}</p>}
            </div>
            <img
              className={`sup-logo ${tpl.facultyLogo ? "sup-logo-own" : "sup-logo-faculty"}`}
              src={assetUrl(tpl.facultyLogo) ?? facultyLogo}
              alt=""
            />
          </header>

          <hr className="sup-rule" />

          {tpl.title ? <h1 className="sup-title">{tpl.title}</h1> : <div className="sup-title-gap" />}

          {/* ── المشرف ── */}
          <section className="sup-block">
            {tpl.supervisorLead && <p className="sup-lead">{tpl.supervisorLead}</p>}
            <p className="sup-filled">{snapshot.supervisorName}</p>
          </section>

          {/* ── عنوان المذكّرة ── */}
          <section className="sup-block">
            {tpl.topicLead && <p className="sup-lead">{tpl.topicLead}</p>}
            <p className="sup-filled sup-topic">{snapshot.topicTitle}</p>
          </section>

          {/* ── الشهادة ── */}
          {(degrees.length > 0 || specialization) && (
            <section className="sup-block">
              {tpl.degreeLead && degrees.length > 0 && <p className="sup-lead">{tpl.degreeLead}</p>}
              {degrees.length > 0 && (
                <p className="sup-degrees">
                  {degrees.map((d) => (
                    <span key={d} className="sup-choice" data-degree={d}>
                      <span className="sup-box">{snapshot.level === d ? "✕" : ""}</span> {tpl.degrees[d]}
                    </span>
                  ))}
                </p>
              )}
              {specialization && (
                <p className="sup-spec" data-testid="sup-specialization">
                  {tpl.specialization!.label.trim() && <span className="sup-spec-label">{tpl.specialization!.label.trim()} </span>}
                  <span className="sup-spec-name">{specialization}</span>
                </p>
              )}
            </section>
          )}

          {/* ── الطلبة ── */}
          <section className="sup-block">
            {tpl.studentsLead && <p className="sup-lead">{tpl.studentsLead}</p>}
            <ol className="sup-students">
              {snapshot.students.map((s, i) => (
                <li key={s.registrationNumber}>
                  <span className="sup-student-label">
                    {i + 1}) {tpl.studentLabel && `${tpl.studentLabel} `}
                    <span className="sup-student-name">{s.fullName}</span>
                  </span>
                  <span className="sup-dots" aria-hidden />
                  <span className="sup-reg" dir="ltr">
                    {s.registrationNumber}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <p className="sup-year">
            {tpl.yearLabel && `${tpl.yearLabel} `}
            {snapshot.academicYear}
          </p>

          {/* ── الإمضاء ── */}
          <section className="sup-sign">
            {tpl.signLabel && <p>{tpl.signLabel}</p>}
            <div className="sup-sign-space" />
          </section>

          {/* ── الذيل: الرقم والرمز الشريطيّ ── */}
          <footer className="sup-foot">
            <div className="sup-foot-text">
              <p className="sup-docnum" dir="ltr">
                {documentNumber}
              </p>
              {revoked && <p className="sup-revoked">وثيقة ملغاة</p>}
            </div>

            {/*
              المربّع محجوزٌ دائماً وإن لم يكن للمسوّدة رمز: لو ظهر متأخّراً
              لأزاح سطراً وغيّر قياس الصفحة بعد استقراره.
            */}
            <div className="sup-code">
              {barcode && (
                <>
                  <Ean13Barcode value={barcode} className="sup-barcode" />
                  <p className="sup-barnum" dir="ltr">
                    {groupDigits(barcode)}
                  </p>
                </>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

/**
 * تجميعُ الأرقام الثلاثة عشر ١ + ٦ + ٦ كما يُطبع EAN-13.
 *
 * والغرضُ أن تُنقل باليد إلى حقل التحقّق بلا عدٍّ على الأصابع: ثلاث عشرة
 * خانةً متلاصقة تُقرأ خطأً، وثلاث مجموعاتٍ تُقرأ نظرةً واحدة.
 */
function groupDigits(code: string): string {
  return `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`;
}

/**
 * يقيس المحتوى بعد رسمه ويردّ معامل التصغير الذي يُدخله في حدّ الصفحة.
 *
 * القياسُ يجري دائماً عند `fit = 1` — تُكتب القيمة في العنصر مباشرةً قبل
 * القراءة ثمّ تُرفع — حتى لا يقيس تصغيراً سابقاً فيتراكم على نفسه.
 * و`scrollHeight` قيمةُ تخطيطٍ لا يمسّها `transform`، فقياسُ الورقة داخل
 * معاينةٍ مصغَّرة يصحّ كما يصحّ خارجها.
 *
 * وتوسيعُ العرض بعد التصغير لا يُبطل القياس: العرض الأوسع يَطوي أسطراً
 * أقلّ لا أكثر، فالنتيجة أقصر ممّا قيس لا أطول.
 */
function useFitToPage(contentKey: string) {
  const [fit, setFit] = useState(1);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const body = bodyRef.current;
    if (!page || !body) return;

    body.style.setProperty("--sup-fit", "1");
    const available = page.clientHeight;
    const needed = body.scrollHeight;
    body.style.removeProperty("--sup-fit");

    // jsdom لا يرسم شيئاً فيعود القياس صفراً: تُترك الورقة على حالها.
    if (!available || !needed) return;
    setFit(needed > available ? Math.max(MIN_FIT, available / needed) : 1);
  }, [contentKey]);

  return { fit, pageRef, bodyRef };
}

/**
 * أنماطُ الورقة، داخلها لا في ورقة الأنماط العامّة.
 *
 * لأنّ الوثيقة تُطبع من أكثر من شاشة، فلو عاشت أنماطُها في مكانٍ آخر
 * لَطُبعت يوماً بلا تنسيق حين تُستعمل من شاشةٍ لم تستورده. وهي معزولة
 * بالبادئة `sup-` فلا تمسّ شيئاً حولها.
 */
const SHEET_CSS = `
.sup-sheet {
  --sup-fit: 1;
  width: 210mm;
  height: 297mm;
  padding: 14mm 16mm;
  box-sizing: border-box;
  /* لا تنكمش لو وُضعت يوماً داخل صندوقٍ مرن: الورقة مقاسها مقاسها. */
  flex: none;
  background: #fff;
  color: #000;
  font-family: "Traditional Arabic", "Amiri", "Times New Roman", serif;
  font-size: 13.5pt;
  line-height: 1.9;
}
/*
  صندوقٌ بلا حشوٍ ولا إطار، فـ clientHeight منه هو حدُّ الصفحة نفسه
  دون حسابٍ يدويّ للهوامش — والقياسُ الذي يُبنى عليه التصغير يقرأه كما هو.
*/
.sup-page { height: 100%; }
/*
  التعويضُ بالعرض: يتمدّد الصندوق بمقدار مقلوب التصغير ثمّ يُصغَّر من ركنه
  الأعلى، فيعود إلى عرض الورقة وقد صغُر خطُّه وفراغُه وحدهما.
*/
.sup-body {
  width: calc(100% / var(--sup-fit));
  height: calc(100% / var(--sup-fit));
  transform: scale(var(--sup-fit));
  transform-origin: top left;
  display: flex;
  flex-direction: column;
}
.sup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6mm;
}
/*
  الشعاران متساويان في الارتفاع المرسوم — ٢١٫٥مم لكليهما — لا في مقاس
  الصندوق: لوحةُ كلٍّ منهما فيها فراغٌ شفّاف بقدرٍ مختلف، فصندوقان
  متساويان يُخرجان رسمين متفاوتين.
*/
.sup-logo { width: 27mm; height: 27mm; object-fit: contain; }
/*
  شعارُ الكلّية داخل لوحةٍ فيها فراغٌ شفّاف واسع — الرسمُ نفسه لا يشغل إلّا
  ٥٣٪ من عرضها و٦٥٪ من ارتفاعها — فصندوقُه أوسع من مربّع شعار الجامعة
  بمقدار ذلك الفراغ وزيادة، ليخرج المرسوم ٢٣×٢١مم فيُقرأ سطراه.

  ولا يُكلّف ذلك الصفحةَ شيئاً: ارتفاعَ الترويسة تحدّده أسطرُها الأربعة
  (٣٧٫٥مم) لا الشعارات، فكلاهما يتوسّطها بما دون ذلك.
*/
.sup-logo-faculty { width: 44mm; height: 33mm; }
/* شعارٌ رفعته الإدارة: لا يُعرف فراغُه، فصندوقٌ أعرض قليلاً يتّسع للمستطيل والمربّع معاً. */
.sup-logo-own { width: 33mm; height: 27mm; }
.sup-head-text { flex: 1; text-align: center; }
.sup-head-text p { margin: 0; font-weight: 700; font-size: 14pt; }
.sup-rule { border: none; border-top: 1px solid #000; margin: 4mm 0 0; }
.sup-title {
  margin: 7mm 0 6mm;
  text-align: center;
  font-size: 21pt;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 4px;
}
/* Without a title: the space it held, so the sheet keeps its rhythm. */
.sup-title-gap { height: 7mm; }
.sup-block { margin-bottom: 5mm; }
.sup-lead { margin: 0 0 1.5mm; font-weight: 700; }
.sup-filled {
  margin: 0;
  padding: 0 6mm 1mm;
  border-bottom: 1px dotted #000;
  min-height: 8mm;
}
.sup-topic { font-weight: 700; overflow-wrap: anywhere; }
.sup-degrees { margin: 0; display: flex; gap: 18mm; padding: 0 6mm; }
.sup-choice { display: inline-flex; align-items: center; gap: 2mm; }
/* Under the boxes: the specialization on a dotted line, as the names filled in above. */
.sup-spec { margin: 3mm 0 0; padding: 0 6mm; display: flex; align-items: baseline; gap: 2.5mm; }
.sup-spec-label { font-weight: 700; white-space: nowrap; }
.sup-spec-name {
  flex: 1;
  min-width: 0;
  padding: 0 2mm 1mm;
  border-bottom: 1px dotted #000;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.sup-box {
  display: inline-grid;
  place-items: center;
  width: 5mm;
  height: 5mm;
  border: 1px solid #000;
  font-size: 11pt;
  line-height: 1;
}
.sup-students { margin: 0; padding: 0 6mm; list-style: none; }
.sup-students li {
  display: flex;
  align-items: baseline;
  gap: 2mm;
  margin-bottom: 1mm;
}
.sup-student-label { min-width: 0; overflow-wrap: anywhere; }
/* الاسمُ أكبر من تمهيده وأثقل: هو ما تقرأه العين من السطر. */
.sup-student-name { font-size: 1.14em; font-weight: 700; }
.sup-dots {
  flex: 1 0 8mm;
  border-bottom: 1px dotted #000;
  transform: translateY(-2px);
}
.sup-reg {
  font-family: "Courier New", monospace;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.sup-year { margin: 0 0 5mm; padding: 0 6mm; }
.sup-sign { margin-top: auto; padding: 0 6mm; text-align: left; }
.sup-sign p { margin: 0 0 2mm; font-weight: 700; }
.sup-sign-space { height: 22mm; }
/* حين تضيق الورقة، فراغُ الإمضاء أوّل ما يتنازل: النصّ لا يُمسّ. */
.sup-body[data-fit="shrunk"] .sup-sign-space { height: 16mm; }
.sup-foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8mm;
  border-top: 1px solid #000;
  padding-top: 3mm;
}
.sup-foot-text p { margin: 0; }
.sup-docnum { font-family: "Courier New", monospace; font-weight: 700; }
.sup-revoked { font-size: 12pt; font-weight: 700; }
.sup-code {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 1mm;
  min-width: 62mm;
}
.sup-barcode { display: block; width: 62mm; height: 15mm; }
/* أرقامٌ تُنقل باليد: أحاديُّ العرض ومتباعدٌ، فلا يلتبس ١ بـ٧ ولا ٠ بـ٥. */
.sup-barnum {
  margin: 0;
  font-family: "Courier New", monospace;
  font-size: 13pt;
  font-weight: 700;
  letter-spacing: 1.5px;
  line-height: 1.2;
}

@media print {
  @page { size: A4 portrait; margin: 0; }
  .sup-sheet {
    width: 210mm;
    height: 297mm;
    margin: 0 auto !important;
    box-shadow: none !important;
    break-inside: avoid;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
