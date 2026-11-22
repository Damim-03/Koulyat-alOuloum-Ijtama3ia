/**
 * كلّ رسالةٍ في الفهرس، بكلّ لغة — تُكتب كاملة.
 *
 * الاختبارات الأخرى تقرأ ما يقوله الخادم بالعربية غالباً، فالترجمة الفرنسية
 * والإنجليزية لرسالةٍ بعددٍ (طالبٌ واحد · 3 طلاب) لا يمرّ بها أحد: خطأٌ فيها
 * يصل الواجهة «NaN étudiants» أو «{{count}} students» ولا ينبّه عليه شيء.
 * فهنا كلّ مفتاحٍ بالعربية والفرنسية والإنجليزية، والمعدود بأعدادٍ تمرّ بكلّ
 * صيغة جمع (١، ٢، ٣–١٠، ١١–٩٩، المئات).
 */
import { tr } from "./index";
import { MESSAGES, type MessageKey } from "./messages";
import type { Lang, Params } from "./types";

const LANGS: Lang[] = ["ar", "fr", "en"];
const NUMERIC = ["count", "max", "minutes", "hours", "teams", "students", "projects", "defenses"];
const NAMES = [
  "account", "accepted", "actual", "code", "columns", "column", "department", "device", "domain", "email", "error", "example",
  "faculty", "fields", "file", "filiere", "fix", "hint", "ip", "issues", "label", "length", "letters",
  "level", "list", "members", "min", "name", "names", "odd", "options", "parent", "part", "platform", "professor",
  "project", "ranks", "reason", "reg", "request", "room", "rows", "seat", "sheet", "spec", "status", "text",
  "title", "topic", "topicSpec", "url", "username", "usual", "value", "what", "when", "year", "date",
];
const params = (n: number): Params => ({
  ...Object.fromEntries(NAMES.map((k) => [k, `«${k}»`])),
  ...Object.fromEntries(NUMERIC.map((k) => [k, n])),
});

const keys = Object.keys(MESSAGES) as MessageKey[];
const counted = keys.filter((k) => LANGS.some((l) => typeof MESSAGES[k][l] === "function"));

describe("i18n — الفهرس كلّه", () => {
  it("فيه رسائل، وبعضها بالمعدود", () => {
    expect(keys.length).toBeGreaterThan(300);
    expect(counted.length).toBeGreaterThan(5);
  });

  it.each(LANGS)("كلّ رسالةٍ بـ%s تُكتب كاملة: لا قيمة ناقصة ولا عددٌ معطوب", (lang) => {
    for (const key of keys) {
      const text = tr(key, params(3), lang);
      expect({ key, text }).toEqual({ key, text: expect.stringMatching(/\S/) });
      expect({ key, text }).toEqual({ key, text: expect.not.stringMatching(/NaN|undefined|\{\{|\[object/) });
    }
  });

  it.each(LANGS)("والمعدود بـ%s في كلّ صيغة جمع", (lang) => {
    for (const key of counted)
      for (const n of [0, 1, 2, 3, 11, 100, 103]) {
        const text = tr(key, params(n), lang);
        expect({ key, n, text }).toEqual({ key, n, text: expect.not.stringMatching(/NaN|undefined/) });
      }
  });
});
