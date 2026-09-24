import { FacultySpinner } from "./faculty-spinner";

/**
 * انتظارُ منطقةٍ من الشاشة — صفحةٍ أو نافذةٍ أو قائمة.
 *
 * وموضعٌ واحد لكلّ هذه الحالات، لا `Loader2` مكرَّرةً في كلّ ملفّ بمقاسٍ
 * يختلف عن جاره (كانت ٢٠ و٢٢ و٢٤ و٢٨ في ستّ شاشات). فإن تغيّر شكلُ
 * الانتظار يوماً تغيّر من هنا.
 *
 * ولا يخدم هذا المكوّن الأزرار ولا الأسطر الداخلية: شعارُ الكلّية فيه
 * سطران من النصّ لا يُقرآن دون ٤٠ بكسل، فيصير في زرٍّ لطخةً ملوّنة. تلك
 * مواضعُ `Loader2` وتبقى لها.
 */
export function LoadingArea({
  label,
  size = 76,
  className,
}: {
  /** نصٌّ تحت الشعار — يُترك فارغاً حين يكفي السياقُ وحده. */
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid place-items-center gap-4 py-12 ${className ?? ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <FacultySpinner size={size} />
      {label && <p className="text-sm text-clay">{label}</p>}
    </div>
  );
}
