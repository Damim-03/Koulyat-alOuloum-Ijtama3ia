import { test, expect, type Page } from "@playwright/test";

import { login, expectRendered, collectConsoleErrors } from "./helpers";

/**
 * الشاشات نفسها — أنّها تُعرَض، وأنّ ما يصل من الخادم يظهر عليها.
 *
 * وهذا أدنى ما يُطلب، ومع ذلك لم يكن مضموناً: خطأٌ في التصيير يترك
 * `<div id="root">` فارغاً بينما الشبكة كلّها خضراء — فتمرّ ٧٩١ اختباراً في
 * الخلفية ولا يرى أحد أن الشاشة بيضاء.
 *
 * ولذلك يفحص كل اختبارٍ هنا ثلاثة أشياء معاً:
 *
 *   **أن شيئاً رُسم** — لا `#root` فارغ.
 *   **ألّا خطأ في الطرفية** — فخطأٌ غير مُلتقط قد لا يُفرغ الشاشة كلّها لكنه
 *     يُسقط جزءاً منها بصمت.
 *   **ألّا نداءَ ردّ بـ٥٠٠** — الشاشة قد تبدو سليمةً وهي تُخفي قسماً فشل.
 */

/** يجمع أخطاء الطرفية والنداءات الفاشلة معاً. */
function watch(page: Page) {
  const consoleErrors = collectConsoleErrors(page);
  const serverErrors: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 500)
      serverErrors.push(`${r.status()} ${r.url()}`);
  });
  return { consoleErrors, serverErrors };
}

/**
 * أخطاءٌ لا تدلّ على عطلٍ في الشاشة: ٤٠١ متوقَّعة أثناء التحميل الأوّل قبل
 * وصول الرمز، وتحذيرات المصادر الخارجية. نستثنيها صراحةً بدل أن نتساهل في
 * الشرط كلّه.
 */
const IGNORED = [/401/, /Failed to load resource: the server responded with a status of 40/];

const realErrors = (errors: string[]) =>
  errors.filter((e) => !IGNORED.some((p) => p.test(e)));

async function visit(page: Page, path: string) {
  await page.goto(path);
  await expectRendered(page);
  // بعض الأقسام تصل بعد التحميل الأوّل؛ نمهل الشبكة لتهدأ.
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

//
// ═══ شاشات الطالب ═══
//

test.describe("شاشات الطالب", () => {
  const PAGES = [
    ["اللوحة", "/ar/student"],
    ["تصفّح المواضيع", "/ar/student/topics"],
    ["طلباتي", "/ar/student/requests"],
    ["مشروعي", "/ar/student/project"],
  ] as const;

  for (const [label, path] of PAGES) {
    test(`${label} تُعرَض بلا أخطاء`, async ({ page }) => {
      const w = watch(page);
      await login(page, "student");
      await visit(page, path);

      expect(realErrors(w.consoleErrors)).toEqual([]);
      expect(w.serverErrors).toEqual([]);
    });
  }

  /**
   * المواضيع المنشورة تصل من الخادم — والسؤال هنا هل تظهر. وهذا الوصل بين
   * الطبقتين هو ما لا يراه أي اختبارٍ خلفيّ: قد يردّ الخادم ثلاثة مواضيع
   * وتعرض الشاشة «لا توجد مواضيع».
   */
  test("وقائمة المواضيع تعرض ما يردّه الخادم", async ({ page }) => {
    await login(page, "student");

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/") && r.url().includes("topics") && r.ok(),
        { timeout: 20_000 },
      ),
      page.goto("/ar/student/topics"),
    ]);

    const body = (await response.json()) as unknown;
    const topics = (Array.isArray(body) ? body : (body as Record<string, unknown>).topics) as
      | { title: string }[]
      | undefined;

    expect(topics?.length ?? 0).toBeGreaterThan(0);

    // عنوانُ أوّل موضوعٍ ردّه الخادم موجودٌ على الشاشة.
    await expect(page.locator("#root")).toContainText(topics![0]!.title, {
      timeout: 15_000,
    });
  });
});

//
// ═══ شاشات الأستاذ ═══
//

test.describe("شاشات الأستاذ", () => {
  const PAGES = [
    ["اللوحة", "/ar/professor"],
    ["مواضيعي", "/ar/professor/topics"],
    ["المشاريع", "/ar/professor/groups"],
    ["المراحل", "/ar/professor/milestones"],
  ] as const;

  for (const [label, path] of PAGES) {
    test(`${label} تُعرَض بلا أخطاء`, async ({ page }) => {
      const w = watch(page);
      await login(page, "professor");
      await visit(page, path);

      expect(realErrors(w.consoleErrors)).toEqual([]);
      expect(w.serverErrors).toEqual([]);
    });
  }

  /**
   * اللوحة كتلةٌ من الاشتقاقات اختُبرت في الخلفية عدداً عدداً. وهنا يُسأل
   * سؤالٌ آخر: هل وصلت إلى الشاشة؟ فحسابٌ صحيحٌ لا يعرضه أحد لا ينفع.
   */
  test("ولوحة الأستاذ تعرض أرقاماً لا هياكل فارغة", async ({ page }) => {
    await login(page, "professor");
    await visit(page, "/ar/professor");

    const text = await page.locator("#root").innerText();
    expect(text).toMatch(/\d/); // رقمٌ واحد على الأقل
    expect(text.length).toBeGreaterThan(120);
  });
});

//
// ═══ شاشات الإدارة ═══
//

test.describe("شاشات الإدارة", () => {
  const PAGES = [
    ["اللوحة", "/ar/admin"],
    ["المواضيع", "/ar/admin/topics"],
    ["الطلبة", "/ar/admin/students"],
    ["الأساتذة", "/ar/admin/professors"],
    ["المستخدمون", "/ar/admin/users"],
    ["الهيكل الأكاديمي", "/ar/admin/academic"],
    ["المشاريع", "/ar/admin/projects"],
    ["طلبات المجموعات", "/ar/admin/group-requests"],
    ["المناقشات", "/ar/admin/defenses"],
  ] as const;

  for (const [label, path] of PAGES) {
    test(`${label} تُعرَض بلا أخطاء`, async ({ page }) => {
      const w = watch(page);
      await login(page, "admin");
      await visit(page, path);

      expect(realErrors(w.consoleErrors)).toEqual([]);
      expect(w.serverErrors).toEqual([]);
    });
  }

  /**
   * الموضوع المعلَّق موجودٌ في البذر، ويجب أن تراه الإدارة. وهو أيضاً ما لا
   * يراه الطالب — والفرق بين الشاشتين هو نصف ما عالجناه في `status`.
   */
  test("وشاشة المواضيع تعرض المعلَّق الذي لا يراه الطالب", async ({ page }) => {
    await login(page, "admin");
    await visit(page, "/ar/admin/topics");

    await expect(page.locator("#root")).toContainText("مقترحٌ بانتظار القرار", {
      timeout: 15_000,
    });
  });
});

//
// ═══ الصفحات العامّة ═══
//

test.describe("الصفحات العامّة", () => {
  test("الرئيسية تُعرَض لزائرٍ بلا حساب", async ({ page }) => {
    const w = watch(page);
    await visit(page, "/ar");

    expect(realErrors(w.consoleErrors)).toEqual([]);
    expect(w.serverErrors).toEqual([]);
  });

  /**
   * «المواضيع العامّة» ليست عامّةً فعلاً: مسارها في الخادم يطلب رمزاً، بقرارٍ
   * موثَّق — ألّا يتسرّب أيّ موضوع إلى زائرٍ في لسان الشبكة. فالمطلوب هنا
   * صفحةٌ تقول ذلك، لا صفحةٌ فارغة ولا شاشةُ تحميلٍ لا تنتهي.
   */
  test("وصفحة المواضيع لزائرٍ: تُعرَض ولا تبقى معلَّقة", async ({ page }) => {
    await visit(page, "/ar/topics");
    await expectRendered(page);
  });

  test("ومسارٌ غير موجود لا يترك الشاشة بيضاء", async ({ page }) => {
    await page.goto("/ar/هذا-المسار-لا-وجود-له");
    await expectRendered(page, 10);
  });
});
