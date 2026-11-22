import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestHandler } from "express";
import { MESSAGES, type MessageKey } from "./messages";
import type { Lang, Params } from "./types";

export type { Lang, Params } from "./types";
export type { MessageKey } from "./messages";

/**
 * لغة الرسائل التي يكتبها الخادم — رسائل الخطأ، والإشعارات، وتقارير الاستيراد.
 *
 * الواجهة ترسل لغتها مع كلّ طلب (`Accept-Language`)، فتُحفظ هنا لمدّة الطلب
 * (AsyncLocalStorage) ويقرؤها `tr()` أينما كُتبت الرسالة — في خدمةٍ أو فحصٍ
 * أو معالج خطأ — بلا تمريرها من دالّةٍ إلى دالّة.
 *
 * وما لا لغة له (اختبارٌ، أو سكربت، أو طلبٌ بلا ترويسة) بالعربية: لغة المنصّة.
 */

export const LANGS: readonly Lang[] = ["ar", "en", "fr"];
export const DEFAULT_LANG: Lang = "ar";

const store = new AsyncLocalStorage<Lang>();

/** «en-US,en;q=0.9» ⇒ en · «fr» ⇒ fr · غير المعروف ⇒ ar. */
export function parseLang(header: string | undefined): Lang {
  // `split` يُرجع عنصراً واحداً على الأقلّ، ولو من نصٍّ فارغ.
  const first = (header ?? "").split(",")[0]!.trim().toLowerCase().slice(0, 2);
  return (LANGS as readonly string[]).includes(first) ? (first as Lang) : DEFAULT_LANG;
}

/** يحفظ لغة الطلب لكلّ ما يجري فيه. */
export const languageMiddleware: RequestHandler = (req, _res, next) => {
  store.run(parseLang(req.headers["accept-language"]), next);
};

/** لغة الطلب الجاري — أو العربية خارج الطلبات. */
export const currentLang = (): Lang => store.getStore() ?? DEFAULT_LANG;

/** يُجري `fn` بلغةٍ بعينها — للاختبارات، ولما يُكتب لغير صاحب الطلب. */
export const withLang = <T>(lang: Lang, fn: () => T): T => store.run(lang, fn);

const interpolate = (text: string, params?: Params) =>
  params ? text.replace(/\{\{(\w+)\}\}/g, (all, name: string) => (name in params ? String(params[name]) : all)) : text;

/** الرسالة بلغة الطلب (أو بلغةٍ معطاة)، بقيمها. */
export function tr(key: MessageKey, params?: Params, lang: Lang = currentLang()): string {
  const entry = MESSAGES[key];
  const text = entry[lang] ?? entry.ar;
  return typeof text === "function" ? text(params ?? {}) : interpolate(text, params);
}

/** قائمةٌ في جملةٍ بلغة الطلب: «أ، ب وج» · «a, b and c» · «a, b et c». */
export function listOf(items: string[], lang: Lang = currentLang()): string {
  if (items.length <= 1) return items[0] ?? "";
  const head = items.slice(0, -1);
  const last = items[items.length - 1];
  if (lang === "ar") return `${head.join("، ")} و${last}`;
  return `${head.join(", ")} ${lang === "fr" ? "et" : "and"} ${last}`;
}

/** مشكلات التحقّق في سطرٍ بلغة الطلب: «بياناتٌ غير صالحة: title: … | email: …». */
export function issuesMessage(issues: readonly { path: readonly PropertyKey[]; message: string }[]): string {
  return tr("request.validationAt", {
    issues: issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`).join(" | "),
  });
}
