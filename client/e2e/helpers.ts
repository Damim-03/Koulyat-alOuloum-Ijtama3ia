import fs from "node:fs";
import { expect, type Page } from "@playwright/test";

import { ACCOUNTS_FILE, type Accounts } from "./global-setup";

export const accounts = (): Accounts =>
  JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8")) as Accounts;

export type LoginRole = "student" | "professor" | "admin";

/**
 * المُحدِّدات مبنيّة على `data-testid` لا على النصّ المعروض.
 *
 * الواجهة بثلاث لغات وكلّ نصٍّ فيها يمرّ بـ`t()`. فاختبارٌ يبحث عن «تسجيل
 * الدخول» ينكسر يوم يُحرَّر ملفّ ترجمة — تحريرٌ لا علاقة له بالسلوك. أمّا
 * المِقبض الثابت فعقدٌ صريح بين الشاشة والاختبار.
 */
export const IDENTIFIER = '[data-testid="login-identifier"]';
export const PASSWORD = '[data-testid="login-password"]';
export const SUBMIT = '[data-testid="login-submit"]';

/** يملأ نموذج الدخول ويُرسله — بلا انتظارِ نتيجة، ليصلح للنجاح وللفشل. */
export async function submitLogin(
  page: Page,
  role: LoginRole,
  identifier: string,
  password: string,
) {
  await page.goto("/ar/login");
  await page.locator(`[data-testid="role-${role}"]`).click();
  await page.locator(IDENTIFIER).fill(identifier);
  await page.locator(PASSWORD).fill(password);
  await page.locator(SUBMIT).click();
}

/** الوجهة النهائية لكل دور بعد الدخول. */
export const HOME: Record<LoginRole, RegExp> = {
  student: /\/ar\/student(\/|$)/,
  professor: /\/ar\/professor(\/|$)/,
  admin: /\/ar\/admin(\/|$)/,
};

/**
 * دخولٌ ناجح: يُرسل ثم ينتظر **الوجهة النهائية** لا مجرّد مغادرة صفحة الدخول.
 *
 * فبينهما محطّة: `/dashboard` تقرأ الدور ثم تُحوّل. وانتظارُ «أيّ مسارٍ ليس
 * الدخول» يلتقط تلك المحطّة العابرة، فيقرأ الاختبار عنواناً يتغيّر تحت يده —
 * وهو ما أوقع اختبار «الجلسة تصمد أمام إعادة التحميل» في فشلٍ لا علاقة له
 * بما يختبره.
 */
export async function login(page: Page, role: LoginRole, identifier?: string) {
  const a = accounts();
  const value =
    identifier ??
    (role === "student"
      ? a.student.registrationNumber
      : role === "professor"
        ? a.professor.universityEmail
        : a.admin.email);

  await submitLogin(page, role, value, a.password);
  await page.waitForURL(HOME[role], { timeout: 20_000 });
}

/** الرمز محفوظٌ في `localStorage` تحت مفتاح zustand باسم "auth". */
export async function storedAuth(page: Page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("auth");
    if (!raw) return null;
    return (JSON.parse(raw) as { state: unknown }).state as {
      isAuthenticated: boolean;
      accessToken: string | null;
      refreshToken: string | null;
      user: { role: string; id: string } | null;
    };
  });
}

/**
 * أن الصفحة ليست بيضاء.
 *
 * وهذا أدنى ما يُطلب من شاشة، ومع ذلك يكشف أكثر ما يقع فعلاً: خطأٌ في التصيير
 * يترك `<div id="root">` فارغاً بينما الشبكة كلّها خضراء — فيمرّ كل اختبار
 * خلفيّ ولا يرى أحد أن الشاشة سوداء.
 */
export async function expectRendered(page: Page, min = 40) {
  await expect(page.locator("#root")).toBeVisible();
  const text = (await page.locator("#root").innerText()).trim();
  expect(text.length).toBeGreaterThan(min);
}

/** أخطاء الطرفية التي لا تُغتفر — تُجمَع لتُفحص في نهاية الاختبار. */
export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}
