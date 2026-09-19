import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The vocabulary the account dialogs are written in.
 *
 * These three lived twice, byte for byte, in the professor and student edit
 * dialogs. The create dialog is a third caller, and three copies of a border
 * radius is how two dialogs stop looking like each other.
 */

export const inputCls =
  "w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 placeholder:text-clay/50";

/** One of the two side-by-side panels a dialog is built from. */
export function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-2xl border border-forest/10 bg-cream-card p-3 shadow-[0_2px_12px_rgba(38,66,61,0.04)]">
      <h4 className="flex items-center gap-2 border-b border-forest/10 pb-2 text-sm font-bold text-forest">
        <span className="grid size-7 place-items-center rounded-lg bg-gold/15 text-gold">
          <Icon size={15} />
        </span>
        {title}
      </h4>
      {children}
    </section>
  );
}

export function FieldBox({
  label,
  icon: Icon,
  required,
  error,
  children,
}: {
  label: string;
  icon: LucideIcon;
  required?: boolean;
  /** Validation message for this field; the edit dialogs report at the top. */
  error?: string;
  children: ReactNode;
}) {
  // الخطأ يُعلَّم في ثلاثة مواضع لا في واحد: إطارُ الحقل، وعنوانه، والرسالة
  // تحته. ورسالةٌ حمراء تحت حقلٍ بلونه الطبيعيّ تُقرأ سهواً — خصوصاً في
  // استمارةٍ فيها عشرة حقول، حيث العين تبحث عن **الحقل** لا عن السطر.
  //
  // والتلوين هنا لا في كل نداء: `FieldBox` هي التي تعرف أن ثمّة خطأً، فتُلوّن
  // ما بداخلها أياً كان — مُدخلاً أو قائمة. ولو تُرك للنداءات لَنُسي في بعضها.
  const invalid = Boolean(error);

  // الحقل الناقص يُعلَّم في صندوقه هو — لا في مُدخلٍ بداخله.
  //
  // جرّبتُ أوّلاً تلوين المُدخل عبر مُتغيّرٍ اعتراضيّ (`[&_input]:border-brick`)
  // فعمل على نسخةٍ مطابقة في المتصفّح ولم يعمل على الحقل الحقيقيّ — فتركتُه:
  // تنسيقٌ يصيب أحياناً أسوأ من تنسيقٍ لا يصيب، لأن العين تتعلّم ألّا تثق به.
  //
  // وهذا الصندوق هو العنصر الذي يحمل الصنف بنفسه، فلا وسيط ولا أسبقيّة:
  // أرضيّةٌ حمراء خفيفة، وحدٌّ أحمر، وشريطٌ جانبيّ — تُرى من طرف العين في
  // استمارةٍ فيها عشرة حقول.
  const boxCls = invalid
    ? "-mx-2 rounded-xl border border-brick/35 bg-brick/5 px-2 py-1.5 border-s-4 border-s-brick"
    : "";

  return (
    <label className={`block ${boxCls}`}>
      <span
        className={`mb-1 flex items-center gap-1.5 text-[11px] font-medium ${
          invalid ? "text-brick" : "text-clay"
        }`}
      >
        <Icon size={12} className={invalid ? "text-brick/80" : "text-clay/70"} />
        {label}
        {required && <span className="text-brick">*</span>}
      </span>
      {children}
      {error && <p className="mt-1 text-[11px] text-brick">{error}</p>}
    </label>
  );
}
