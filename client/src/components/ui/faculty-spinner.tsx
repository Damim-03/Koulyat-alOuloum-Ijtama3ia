import facultyLogo from "../../assets/Faculty.png";

/**
 * مؤشّرُ الانتظار بشعار الكلّية.
 *
 * ثلاثُ حركاتٍ على دورةٍ واحدة (٢٫٤ث) فتُقرأ حركةً واحدة لا ثلاثاً تتسابق:
 * حلقتان تتّسعان وتخبوان بفارقٍ بينهما فيتّصل النبض، وقوسٌ يدور، وشعارٌ
 * يتنفّس. وتُطفأ جميعاً عند `prefers-reduced-motion` من ورقة الأنماط.
 *
 * والقرصُ تحته بلونٍ **مثبَّت** لا برمز سمة: فيه سطرٌ كحليّ داكن
 * («الاجتماعية و الإنسانية») يختفي على أيّ خلفيةٍ داكنة. ولو أخذ القرصُ
 * `bg-cream-card` لانقلب داكناً في الوضع الداكن ولَعاد السطرُ يختفي عليه —
 * وهو ما كان. فاللونُ ثابتٌ كما في ورقة الإشراف، وللسبب نفسه: الشعارُ
 * مرسومٌ ليُقرأ على فاتح.
 *
 * والمقاسُ بخاصّيةٍ لا بصنفٍ ثابت: نفسُه يخدم شاشةَ تحميلٍ كاملة وزاويةَ
 * بطاقة، والنِّسب داخله محسوبةٌ بالمئة فتتبعه.
 */
export function FacultySpinner({
  size = 112,
  className,
}: {
  /** قطرُ الدائرة بالبكسل. */
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative grid shrink-0 place-items-center ${className ?? ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* حلقتا النبض — الثانيةُ متأخّرةٌ بنصف دورة. */}
      <span className="faculty-pulse absolute inset-0 rounded-full bg-gold/30" />
      <span
        className="faculty-pulse absolute inset-0 rounded-full bg-sage/25"
        style={{ animationDelay: "1.2s" }}
      />

      {/* القوسُ الدائر: الحلقةُ الباهتة مسارُه، والقوسُ الذهبيّ موضعُه. */}
      <svg
        className="faculty-spin absolute inset-0 size-full"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle
          cx="50"
          cy="50"
          r="47"
          className="stroke-forest/12"
          strokeWidth="2"
        />
        <path
          d="M 50 3 A 47 47 0 0 1 97 50"
          className="stroke-gold"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      {/* القرصُ والشعار. */}
      <span className="faculty-breathe relative grid size-[76%] place-items-center overflow-hidden rounded-full bg-[#fffaf2] ring-1 ring-forest/10 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
        {/*
          الشعارُ أوسعُ من قرصه عمداً: لوحتُه فيها فراغٌ شفّافٌ واسع — الرسمُ
          لا يشغل إلّا ٥٣٪ من عرضها — فلو حُصر داخل القرص لَبدا نقطةً فيه.

          والإزاحةُ لأسفل تُصحّح مركزَه: الرسمُ في أعلى لوحته لا في وسطها
          (يمتدّ من ١٢٪ إلى ٧٧٪ من ارتفاعها)، فيُحاذيه `object-contain` على
          مركز اللوحة فيعلو داخل القرص ويقترب سطرُه الأخير من حافّته.
        */}
        <img
          src={facultyLogo}
          alt=""
          className="w-[136%] max-w-none translate-y-[6%] object-contain"
        />
      </span>
    </div>
  );
}
