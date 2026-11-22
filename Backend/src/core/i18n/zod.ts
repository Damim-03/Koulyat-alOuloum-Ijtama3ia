import { z } from "zod";
import { currentLang, tr, type MessageKey } from "./index";

/**
 * zod بلغة الطلب.
 *
 * رسائله المبنيّة («Required»، «Invalid email»…) بلغةٍ واحدة لكلّ برنامج، فتُدار
 * هنا بلغة الطلب الجاري — zod يسأل عنها حين يُنشئ المشكلة، أي داخل الطلب.
 * وتُستورد هذه الوحدة مرّةً عند الإقلاع (app.ts).
 */
const LOCALES = {
  ar: z.locales.ar().localeError,
  en: z.locales.en().localeError,
  fr: z.locales.fr().localeError,
};

/**
 * علامةٌ على مشكلةٍ لم يكتب لها المخطَّط رسالةً، فقال zod رسالته العامّة.
 *
 * والفرق يهمّ: رسالةٌ كتبها المخطَّط (`zmsg`) جملةٌ تُقال للمستخدم كما هي،
 * ورسالة zod العامّة («يفترض إدخال array…») لا تقول أيّ الحقول — فيُذكر بدلها
 * الحقل (`issuesMessage`). وكان يُعرف الفرق من بداية النصّ بالإنجليزية
 * (Invalid / Expected / Required)، فلمّا صارت رسائل zod بلغة الطلب فات العربيّةَ
 * والفرنسيّةَ، وبلغت المستخدمَ بلا اسم حقل.
 *
 * وتُعرف بنصّها: كلّ رسالةٍ عامّة يكتبها zod هنا تُحفظ، فما طابقها في المشكلة
 * الأخيرة رسالةُ zod. وكانت العلامة رمزاً (Symbol) يُوضع على المشكلة الخام،
 * فينسخه zod معها — حتى صار (4.6) يبني المشكلة الأخيرة من مفاتيحها النصّية
 * وحدها (`Object.keys`)، فضاع الرمز وبلغت رسالته العامّة المستخدمَ بلا اسم
 * حقل. والنصّ هو ما يصل المشكلة الأخيرة دائماً. ولا يُضاف إليها شيء، فلا يظهر
 * في JSON شيء.
 *
 * ورسائل zod العامّة عائلةٌ محدودة (أنواعٌ وحدودٌ في مخطَّطاتٍ معروفة، بثلاث
 * لغات)، فالمحفوظ صغير؛ والحدّ احتياطٌ لا يُبلغ.
 */
const zodDefaults = new Set<string>();
const REMEMBERED = 5000;

z.config({
  localeError: (issue) => {
    const said = LOCALES[currentLang()]!(issue);
    const text = typeof said === "string" ? said : said?.message;
    if (text) {
      if (zodDefaults.size >= REMEMBERED) zodDefaults.clear();
      zodDefaults.add(text);
    }
    return said;
  },
});

/** رسالة zod العامّة — لا ما كتبه المخطَّط. */
export const isZodDefaultMessage = (issue: object): boolean => {
  const message = (issue as { message?: unknown }).message;
  return typeof message === "string" && zodDefaults.has(message);
};

/**
 * رسالةٌ خاصّة في مخطَّط — تُترجم حين يُتحقّق، لا حين تُحمَّل الوحدة.
 * `z.string().min(1, zmsg("v.titleRequired"))`
 */
export const zmsg = (key: MessageKey) => ({ error: () => tr(key) });
