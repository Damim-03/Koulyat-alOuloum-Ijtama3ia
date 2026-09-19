/**
 * اختبارات قاعدة الأصول.
 *
 * أهمّها الأخير: أن نفق التطوير **لا يُقبل في الإنتاج**. فالتساهل هنا لا
 * يُرى في شاشة — لا رسالة ولا خطأ — ويبقى ثغرةً صامتة: من أنشأ نفقاً باسمٍ
 * عشوائيّ صار أصلاً موثوقاً عند الخادم، يقرأ ردوداً تحمل اعتماداً.
 */
import { isOriginAllowed } from "./origins";

const dev = { allowList: ["http://localhost:5173"], isProduction: false };
const prod = { allowList: ["https://app.univ-eloued.dz"], isProduction: true };

describe("القائمة الصريحة", () => {
  it("ما نصّت عليه البيئة يُقبل في التطوير والإنتاج معاً", () => {
    expect(isOriginAllowed("http://localhost:5173", dev)).toBe(true);
    expect(isOriginAllowed("https://app.univ-eloued.dz", prod)).toBe(true);
  });

  it("وما ليس فيها يُردّ", () => {
    expect(isOriginAllowed("http://evil.example", dev)).toBe(false);
    expect(isOriginAllowed("https://app.univ-eloued.dz.evil.com", prod)).toBe(
      false,
    );
  });

  /** المطابقة حرفية: منفذٌ مختلف أصلٌ مختلف. */
  it("والمنفذ جزءٌ من الأصل", () => {
    expect(isOriginAllowed("http://localhost:5174", dev)).toBe(false);
  });
});

describe("أنفاق التطوير", () => {
  it.each([
    "https://4hfr6hdk-5173.uks1.devtunnels.ms",
    "https://abc123-3000.euw.devtunnels.ms",
    "https://x-8080.devtunnels.ms",
  ])("«%s» يُقبل في التطوير", (origin) => {
    expect(isOriginAllowed(origin, dev)).toBe(true);
  });

  /**
   * الشرط الذي من أجله كُتب هذا الملفّ.
   */
  it.each([
    "https://4hfr6hdk-5173.uks1.devtunnels.ms",
    "https://abc123-3000.euw.devtunnels.ms",
  ])("و«%s» يُردّ في الإنتاج", (origin) => {
    expect(isOriginAllowed(origin, prod)).toBe(false);
  });

  /** `http` ليست نفقاً: النفق لا يُقدّم إلّا `https`. */
  it("و«http» على نطاق الأنفاق يُردّ ولو في التطوير", () => {
    expect(isOriginAllowed("http://abc-5173.uks1.devtunnels.ms", dev)).toBe(
      false,
    );
  });

  /**
   * نطاقٌ يُشبه الاسم ولا ينتهي به. `devtunnels.ms.evil.com` ملكُ المهاجم،
   * ومطابقةٌ متساهلة (بلا `$`) كانت ستقبله.
   */
  it.each([
    "https://devtunnels.ms.evil.com",
    "https://abc-5173.uks1.devtunnels.ms.evil.com",
    "https://evil-devtunnels.ms.attacker.net",
  ])("و«%s» يُردّ — الشبه ليس انتماءً", (origin) => {
    expect(isOriginAllowed(origin, dev)).toBe(false);
  });

  it("ونفقٌ بمسارٍ ملحق ليس أصلاً — يُردّ", () => {
    expect(
      isOriginAllowed("https://abc-5173.uks1.devtunnels.ms/path", dev),
    ).toBe(false);
  });
});
