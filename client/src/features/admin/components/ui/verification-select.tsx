import { useTranslation } from "react-i18next";
import { BadgeCheck, Check, ShieldQuestion } from "lucide-react";

/**
 * توثيق الحساب عند إنشائه.
 *
 * العمود `isVerified` موجودٌ في القاعدة منذ البداية، وتقرؤه ثلاث صفحات
 * وتُرشّح به قائمة المستخدمين — ولم يكن في المنصّة كلّها موضعٌ **يكتبه**.
 * أي أن كل حساب كان يولد «غير موثّق» ويبقى كذلك إلى الأبد. وهذا الاختيار
 * هو الموضع الذي كان ناقصاً: الإدارة التي تُنشئ الحساب بيدها هي بعينها
 * الجهة التي تعرف صاحبه.
 *
 * وخياران لا قائمة منسدلة: القائمة تُخفي الخيارين خلف نقرة، ولا تسع تحت
 * كلٍّ منهما سطراً يقول ما يعنيه. وهي مذياعٌ حقيقيّ (`radio` مخفيٌّ بصرياً)
 * فالتنقّل بالأسهم وإعلان قارئ الشاشة يأتيان بلا شيفرة.
 */
export function VerificationSelect({
  value,
  onChange,
  name = "isVerified",
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  name?: string;
}) {
  const { t } = useTranslation();

  const options = [
    {
      on: true,
      Icon: BadgeCheck,
      label: t("admin.verified"),
      hint: t("admin.verifiedHint"),
      ink: "text-sage",
      tint: "bg-sage/10",
    },
    {
      on: false,
      Icon: ShieldQuestion,
      label: t("admin.unverified"),
      hint: t("admin.unverifiedHint"),
      ink: "text-clay",
      tint: "bg-forest/5",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(({ on, Icon, label, hint, ink, tint }) => {
        const active = value === on;
        return (
          <label key={String(on)} className="group cursor-pointer">
            <input
              type="radio"
              name={name}
              value={String(on)}
              checked={active}
              onChange={() => onChange(on)}
              className="peer sr-only"
            />
            <span className="flex h-full items-center gap-2.5 rounded-xl border border-forest/15 bg-cream-2 px-2.5 py-1.5 transition group-hover:border-gold/40 group-hover:bg-forest/5 peer-checked:border-gold peer-checked:bg-gold/10 peer-focus-visible:ring-2 peer-focus-visible:ring-gold/45">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full ${tint} ${ink}`}
              >
                <Icon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-forest">
                  {label}
                </span>
                <span className="block text-[10px] leading-tight text-clay">
                  {hint}
                </span>
              </span>
              {active && <Check size={15} className="shrink-0 text-gold" />}
            </span>
          </label>
        );
      })}
    </div>
  );
}
