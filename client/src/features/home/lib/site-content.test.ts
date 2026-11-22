import { describe, expect, it } from "vitest";
import {
  defaultDirectorMessage,
  defaultLoginContent,
  directorDefaults,
  isInternalLink,
  newsText,
  resolveDirector,
  resolveLogin,
} from "./site-content";

/**
 * العربية أصلُ ما تكتبه الإدارة، والفرنسية والإنجليزية اختياريّتان: كلّ حقلٍ
 * فارغٍ في الترجمة (ولو بمسافاتٍ وحدها) يُعرض بقيمته العربية، وما تُرجم
 * يُعرض كما كُتب.
 */
describe("ما لم يُترجَم يُعرض بالعربية", () => {
  it("كلمة رئيس القسم: الحقل الفارغ والفقرات الفارغة تأخذ العربية، والمكتوب يبقى", () => {
    const base = defaultDirectorMessage();
    const content = {
      ...base,
      fr: { ...base.fr, title: "  ", fullName: "Dr. Benali", paragraphs: ["", "   "], quote: "" },
    };
    const fr = resolveDirector(content, "fr");
    expect(fr.title).toBe(base.ar.title);
    expect(fr.fullName).toBe("Dr. Benali");
    expect(fr.paragraphs).toEqual(base.ar.paragraphs);
    expect(fr.quote).toBe(base.ar.quote);
    expect(fr.sectionTitle).toBe(base.fr.sectionTitle || base.ar.sectionTitle);

    const translated = resolveDirector({ ...content, en: { ...base.en, paragraphs: ["Welcome."] } }, "en");
    expect(translated.paragraphs).toEqual(["Welcome."]);
    expect(resolveDirector(content, "ar")).toBe(content.ar);
  });

  it("النصوص الافتراضية من ملفّات الترجمة، بفقراتٍ قائمةً لا نصّاً واحداً", () => {
    const ar = directorDefaults("ar");
    expect(Array.isArray(ar.paragraphs)).toBe(true);
    expect(ar.paragraphs.length).toBeGreaterThan(0);
    expect(directorDefaults("fr").title).not.toBe(ar.title);
  });

  it("صفحة الدخول: الفارغ يأخذ العربية، والمكتوب يبقى؛ والعربية كما هي", () => {
    const base = defaultLoginContent();
    const content = { ...base, en: { ...base.en, welcome: "", platform: "Theses portal", body: " " } };
    const en = resolveLogin(content, "en");
    expect(en.welcome).toBe(base.ar.welcome);
    expect(en.body).toBe(base.ar.body);
    expect(en.platform).toBe("Theses portal");
    expect(resolveLogin(content, "ar")).toBe(content.ar);
  });

  it("الخبر بلغة الزائر إن تُرجم، وإلّا بالعربية؛ والرابط الداخليّ لا يبدأ بـ«//»", () => {
    const item = { id: "n1", text: "خبر", textFr: "Nouvelle", textEn: null } as never;
    expect(newsText(item, "fr")).toBe("Nouvelle");
    expect(newsText(item, "en")).toBe("خبر");
    expect(newsText(item, "ar")).toBe("خبر");
    expect(isInternalLink("/topics")).toBe(true);
    expect(isInternalLink("//evil.example")).toBe(false);
    expect(isInternalLink("https://univ.dz")).toBe(false);
  });
});
