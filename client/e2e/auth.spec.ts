import { test, expect } from "@playwright/test";

import {
  accounts,
  login,
  submitLogin,
  storedAuth,
  expectRendered,
  collectConsoleErrors,
  IDENTIFIER,
  PASSWORD,
} from "./helpers";

/**
 * الدخول والحُرّاس — أوّل ما يراه المستخدم وأوّل ما لم يُختبَر قطّ.
 *
 * الخلفية تعرف تماماً من يدخل ومن يُردّ: ٢٣٨ اختبار حراسة تُثبت ذلك. لكن
 * بين ردّ الخادم وبين ما يقع على الشاشة طبقةٌ كاملة لم يمسّها شيء — التوجيه،
 * وحفظ الرمز، وحارس الدور في المتصفّح، وعرض الخطأ. وخادمٌ يردّ ٤٠١ صحيحةً
 * وشاشةٌ تبقى عالقةً على «جارٍ التحميل» ليسا نجاحاً.
 */

test.describe("تسجيل الدخول", () => {
  test("صفحة الدخول تُعرَض وفيها النموذج", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto("/ar/login");
    await expectRendered(page);

    await expect(page.locator(IDENTIFIER)).toBeVisible();
    await expect(page.locator(PASSWORD)).toBeVisible();
    await expect(page.locator('[data-testid="role-student"]')).toBeVisible();
    await expect(page.locator('[data-testid="role-professor"]')).toBeVisible();
    await expect(page.locator('[data-testid="role-admin"]')).toBeVisible();

    expect(errors).toEqual([]);
  });

  /**
   * مبدّل الدور يُبدّل النموذج فعلاً: الطالب يُدخِل رقم تسجيل، والأستاذ
   * والإدارة بريداً. ولو بقي نوع الحقل كما هو لَقبِل المتصفّح رقم تسجيلٍ في
   * حقل بريدٍ ثم ردّه الخادم بسببٍ لا يفهمه أحد.
   */
  test("ومبدّل الدور يُغيّر نوع الحقل", async ({ page }) => {
    await page.goto("/ar/login");

    await page.locator('[data-testid="role-student"]').click();
    await expect(page.locator(IDENTIFIER)).toHaveAttribute("inputmode", "numeric");

    await page.locator('[data-testid="role-professor"]').click();
    await expect(page.locator(IDENTIFIER)).toHaveAttribute("type", "email");

    await page.locator('[data-testid="role-admin"]').click();
    await expect(page.locator(IDENTIFIER)).toHaveAttribute("type", "email");
  });

  test("وبيانات خاطئة ⇒ تبقى في مكانك ولا يُحفَظ رمز", async ({ page }) => {
    await submitLogin(page, "student", "لا-وجود-له", "كلمة-خاطئة");

    // الرسالة تصل من الخادم وتُعرَض؛ والمهمّ ألّا يتغيّر شيءٌ آخر.
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/login/);

    const auth = await storedAuth(page);
    expect(auth?.isAuthenticated ?? false).toBe(false);
    expect(auth?.accessToken ?? null).toBeNull();
  });

  test("وكلمة سرّ فارغة ⇒ يُمنع الإرسال قبل الشبكة", async ({ page }) => {
    const a = accounts();
    let sent = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/auth/") && r.method() === "POST") sent++;
    });

    await page.goto("/ar/login");
    await page.locator('[data-testid="role-student"]').click();
    await page.locator(IDENTIFIER).fill(a.student.registrationNumber);
    await page.locator('[data-testid="login-submit"]').click();

    await page.waitForTimeout(800);
    // التحقّق في المتصفّح موجودٌ لسببٍ واحد: ألّا يُرسَل طلبٌ محكومٌ بالفشل.
    expect(sent).toBe(0);
  });

  test.describe("دخولٌ ناجح لكل دور", () => {
    test("الطالب يصل إلى شاشته", async ({ page }) => {
      await login(page, "student");

      await expect(page).toHaveURL(/\/ar\/student/);
      await expectRendered(page);

      const auth = await storedAuth(page);
      expect(auth!.isAuthenticated).toBe(true);
      expect(auth!.accessToken).toBeTruthy();
      expect(String(auth!.user!.role).toLowerCase()).toBe("student");
    });

    test("والأستاذ يصل إلى شاشته", async ({ page }) => {
      await login(page, "professor");

      await expect(page).toHaveURL(/\/ar\/professor/);
      await expectRendered(page);
      expect(String((await storedAuth(page))!.user!.role).toLowerCase()).toBe(
        "professor",
      );
    });

    test("والإدارة تصل إلى شاشتها", async ({ page }) => {
      await login(page, "admin");

      await expect(page).toHaveURL(/\/ar\/admin/);
      await expectRendered(page);
      expect(String((await storedAuth(page))!.user!.role).toLowerCase()).toBe(
        "admin",
      );
    });
  });

  /**
   * الرمز محفوظٌ في `localStorage`، فإعادة التحميل لا تُخرج المستخدم. وهذا
   * سلوكٌ يقع أو لا يقع في المتصفّح وحده — لا اختبار خلفيّ يراه.
   */
  test("والجلسة تصمد أمام إعادة التحميل", async ({ page }) => {
    await login(page, "admin");
    const url = page.url();

    await page.reload();
    await expect(page).toHaveURL(url);
    await expectRendered(page);
    expect((await storedAuth(page))!.isAuthenticated).toBe(true);
  });
});

//
// ═══ الحُرّاس في المتصفّح ═══
//

test.describe("حُرّاس المسارات", () => {
  test("زائرٌ يطلب شاشة الإدارة ⇒ يُساق إلى الدخول", async ({ page }) => {
    await page.goto("/ar/admin");

    await expect(page).toHaveURL(/\/login/);
    await expectRendered(page);
  });

  test("وطالبٌ يطلب شاشة الإدارة ⇒ يُردّ ولا يراها", async ({ page }) => {
    await login(page, "student");
    await page.goto("/ar/admin");

    // إمّا صفحة «غير مصرَّح» وإمّا إعادةٌ إلى شاشته — والمهمّ ألّا يرى الإدارة.
    await expect(page).not.toHaveURL(/\/ar\/admin$/);
    await expectRendered(page);
  });

  test("وطالبٌ يطلب شاشة الأستاذ ⇒ يُردّ كذلك", async ({ page }) => {
    await login(page, "student");
    await page.goto("/ar/professor");

    await expect(page).not.toHaveURL(/\/ar\/professor$/);
  });

  test("وأستاذٌ يطلب شاشة الطالب ⇒ يُردّ", async ({ page }) => {
    await login(page, "professor");
    await page.goto("/ar/student");

    await expect(page).not.toHaveURL(/\/ar\/student$/);
  });

  /**
   * المسجَّل لا يعود إلى صفحة الدخول: `PublicOnlyRoute` تُعيده إلى شاشته.
   * ولولا ذلك لَرأى نموذج دخولٍ وهو داخلٌ أصلاً.
   */
  test("والمسجَّل لا يرى صفحة الدخول مرّة أخرى", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/ar/login");

    await expect(page).not.toHaveURL(/\/login$/);
  });
});
