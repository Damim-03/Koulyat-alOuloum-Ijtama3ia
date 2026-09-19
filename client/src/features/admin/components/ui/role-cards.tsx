import {
  Check,
  GraduationCap,
  Presentation,
  Shield,
  type LucideIcon,
} from "lucide-react";

export type RoleValue = "student" | "professor" | "admin";

/**
 * لكلّ دورٍ أيقونته ومعالجته البصرية.
 *
 * لا صورة لدورٍ في قاعدة بيانات، ولا معنى لصورةٍ عامّة من الشبكة. فيقوم
 * مقامها رأسٌ مُركَّب: تدرّجٌ لونيّ، وإضاءةٌ قطرية من أعلى، وقرصان مموّهان
 * يعطيان عمقاً، والأيقونة في القلب. أربع طبقاتٍ من CSS بلا ملفٍّ واحد.
 *
 * والألوان من هويّة المنصّة نفسها (`soft-sage` و`sage` و`gold`)،
 * فتتبع السمة الفاتحة والداكنة بلا إعدادٍ خاصّ.
 */
const ROLE_STYLE: Record<
  RoleValue,
  { Icon: LucideIcon; cover: string; glow: string; ink: string }
> = {
  student: {
    Icon: GraduationCap,
    cover: "bg-linear-to-br from-soft-sage/70 via-soft-sage/40 to-sage/20",
    glow: "bg-soft-sage/70",
    ink: "text-forest",
  },
  professor: {
    Icon: Presentation,
    cover: "bg-linear-to-br from-sage/45 via-sage/25 to-soft-sage/20",
    glow: "bg-sage/55",
    ink: "text-forest",
  },
  admin: {
    Icon: Shield,
    cover: "bg-linear-to-br from-gold/45 via-gold/25 to-gold/10",
    glow: "bg-gold/55",
    ink: "text-forest-deep",
  },
};

export interface RoleCardOption {
  value: RoleValue;
  label: string;
  /** مَن هو هذا الدور — سطرٌ أو سطران. */
  description: string;
  /** ما سيُسأل عنه بعد اختياره؛ مصدره جدول حقول الخطوة الثالثة. */
  chips: string[];
}

/**
 * اختيار الدور ببطاقات.
 *
 * كانت قائمةً منسدلة، وهي تكفي حين يكون الخيار تفصيلاً في استمارة. لكن الدور
 * هنا **أوّل الخطوات ويقرّر بقيّتها**، والقائمة تُخفي الخيارات خلف نقرة ولا
 * تسع تحت كلٍّ منها ما يترتّب عليه.
 *
 * والبطاقات مذياعٌ حقيقيّ (`input type="radio"` مخفيٌّ بصرياً): تنقّلٌ
 * بالأسهم، وإعلانٌ صحيح لقارئ الشاشة، وحلقة تركيز — بلا سطرٍ واحدٍ من
 * معالجة لوحة المفاتيح. والحالة المختارة **ليست لوناً وحده**: حدٌّ ذهبيّ،
 * وشارةُ صحٍّ، وشريطٌ ممتلئ، ونصٌّ يتبدّل.
 */
export function RoleCards({
  value,
  onChange,
  options,
  selectLabel,
  selectedLabel,
  name = "role",
}: {
  value: RoleValue;
  onChange: (next: RoleValue) => void;
  options: RoleCardOption[];
  selectLabel: string;
  selectedLabel: string;
  name?: string;
}) {
  // صفٌّ واحد: عمودٌ لكل دور.
  //
  // كانت الشبكة عمودين حين كانت الأدوار أربعة (٢×٢). ولمّا أُلغي `owner`
  // صارت ثلاثةً، فبقاء العمودين يترك الثالث وحيداً في سطرٍ ثانٍ — وترتيبٌ
  // كهذا يُوحي بأن الأخير من صنفٍ آخر، وليس كذلك.
  return (
    <div className="grid grid-cols-1 gap-5 p-1 sm:grid-cols-3">
      {options.map((option) => {
        const { Icon, cover, glow, ink } = ROLE_STYLE[option.value];
        const active = option.value === value;

        return (
          <label
            key={option.value}
            data-testid={`role-card-${option.value}`}
            className="group cursor-pointer"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />

            {/*
              بطاقةٌ على هيئة بطاقات الوجهات: صورةٌ **داخل** البطاقة بحوافّها
              الخاصّة، والعنوان فوقها لا تحتها، ثم صفُّ بيانات، ثم زرّ.
              ولمّا لم تكن ثمّة صورة، قام مقامها الرأس المُركَّب — ومعه
              حجابٌ متدرّج أسفله، وهو ما يجعل الكتابة البيضاء تُقرأ فوق
              أيّ تدرّج، في السمة الفاتحة والداكنة معاً.
            */}
            <div className="flex h-full flex-col gap-2 rounded-[22px] border border-forest/10 bg-cream-card p-2.5 shadow-[0_2px_10px_rgba(38,66,61,0.07)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_24px_rgba(38,66,61,0.13)] peer-checked:border-gold peer-checked:shadow-[0_10px_28px_rgba(197,160,89,0.26)] peer-focus-visible:ring-2 peer-focus-visible:ring-gold/45">
              {/* ══ «الصورة» ══ */}
              <div
                className={`relative isolate h-[210px] shrink-0 overflow-hidden rounded-[16px] ${cover}`}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_12%,rgba(255,255,255,0.24),transparent_62%)]"
                />
                <span
                  aria-hidden
                  className={`pointer-events-none absolute -top-9 -end-7 size-24 rounded-full blur-2xl ${glow}`}
                />
                <span
                  aria-hidden
                  className={`pointer-events-none absolute -bottom-12 start-4 size-20 rounded-full opacity-70 blur-2xl ${glow}`}
                />

                {/*
                  الاسم مع أيقونته في شارةٍ زجاجية.
                  أعلى الرأس أفتح مواضعه (الإضاءة القطرية هناك)، فنصٌّ أبيض
                  عليه مباشرةً يذوب في السمة الفاتحة. والشارة تحمل أرضيّتها
                  معها — ضبابٌ خلفها وحلقةٌ رفيعة — فتُقرأ فوق أيّ تدرّج.
                */}
                <div className="absolute start-3 top-3 z-20 flex items-center gap-2 rounded-full bg-forest-deep/45 py-1 pe-3.5 ps-1 shadow-sm ring-1 ring-cream/20 backdrop-blur-md">
                  <span
                    className={`grid size-8 place-items-center rounded-full bg-cream/95 transition-transform duration-300 group-hover:scale-110 ${ink}`}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="text-[13.5px] font-bold leading-none text-cream">
                    {option.label}
                  </span>
                </div>

                {/* شارة الاختيار — تكبر من الصفر */}
                <span
                  aria-hidden
                  className={`absolute end-2.5 top-2.5 z-20 grid size-6 place-items-center rounded-full bg-gold text-forest-deep shadow-md transition-all duration-200 ${
                    active ? "scale-100 opacity-100" : "scale-0 opacity-0"
                  }`}
                >
                  <Check size={14} />
                </span>

                {/* الحجاب: بدونه يذوب النصّ الأبيض في التدرّج الفاتح */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5 bg-linear-to-t from-forest-deep/90 via-forest-deep/50 to-transparent"
                />

                <div className="absolute inset-x-3.5 bottom-3 z-20">
                  <span className="block text-[11px] leading-snug text-cream/90">
                    {option.description}
                  </span>
                </div>
              </div>

              {/* ══ ما سيُسأل عنه — أعمدةٌ متساوية كصفّ الأرقام في المرجع ══ */}
              <div className="flex items-stretch px-0.5">
                {option.chips.map((chip, i) => (
                  <span
                    key={chip}
                    className={`flex-1 px-1 text-center text-[9.5px] font-medium leading-tight text-clay ${
                      i > 0 ? "border-s border-forest/10" : ""
                    }`}
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <span
                className={`mt-auto block rounded-xl py-2 text-center text-[11.5px] font-bold transition-all duration-200 ${
                  active
                    ? "bg-gold text-forest-deep shadow-[0_2px_8px_rgba(197,160,89,0.35)]"
                    : "border border-forest/15 text-forest group-hover:border-gold/60 group-hover:bg-gold/5"
                }`}
              >
                {active ? selectedLabel : selectLabel}
              </span>
            </div>
          </label>
        );
      })}
    </div>
  );
}
