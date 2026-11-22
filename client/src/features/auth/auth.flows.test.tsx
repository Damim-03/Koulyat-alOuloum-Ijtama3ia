import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";
import { useAuthStore } from "../../store/auth.store";

/**
 * صفحة الدخول بأدوارها الثلاثة — من الكتابة إلى اللوحة.
 *
 * يُحرس: أنّ كلّ دورٍ يرسل حقله هو (رقم التسجيل، البريد الجامعيّ، البريد)
 * إلى مساره؛ وأنّ الخطأ في الصيغة يُقال قبل أيّ طلب؛ وأنّ رفض الخادم يُعرض
 * بسببه؛ وأنّ المسؤول الذي فعّل التحقّق بخطوتين لا يدخل بكلمة المرور وحدها؛
 * وأنّ الدخول يعيد صاحبه إلى الصفحة التي جاء منها.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

/*
 * أداة التحقّق الحقيقية تحلّ مسألةً في المتصفّح (crypto.subtle)، وjsdom ليس
 * متصفّحاً. فهنا بديلٌ بزرّ «حُلّ» يعطي حلّاً جديداً في كلّ مرّة — والخادم
 * يُختبَر بحلولٍ حقيقية في Backend tests/api/auth-captcha.
 */
let solutions = 0;
vi.mock("./components/form/signin-check", () => ({
  SignInCheck: ({ level, onVerified, waiting }: { level: string; onVerified: (p: string) => void; waiting: boolean }) => (
    <div data-testid="signin-check" data-level={level}>
      <button type="button" onClick={() => onVerified(`SOLVED-${++solutions}`)}>
        solve
      </button>
      {waiting && <span>waiting</span>}
    </div>
  ),
}));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function fill(app: ReturnType<typeof renderApp>, id: string, pw: string) {
  const idField = await screen.findByTestId("login-identifier");
  await app.user.clear(idField);
  if (id) await app.user.type(idField, id);
  if (pw) await app.user.type(screen.getByTestId("login-password"), pw);
  await app.user.click(screen.getByTestId("login-submit"));
}

describe("الدخول", () => {
  it("الطالب برقم تسجيله ⇒ مساره، ثمّ لوحته", async () => {
    const app = renderApp("/ar/login");
    await fill(app, "202039012345", "Pass#2026");
    await waitFor(() => expect(fake.find("post", "/auth/student/login")).toHaveLength(1));
    expect(fake.find("post", "/auth/student/login")[0]!.body).toEqual({ registrationNumber: "202039012345", password: "Pass#2026" });
    await waitFor(() => expect(app.location()).toBe("/ar/student"));
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, accessToken: "tok-student" });
  });

  it("حقلان فارغان ⇒ سببان، ولا طلب", async () => {
    const app = renderApp("/ar/login");
    await fill(app, "", "");
    expect(await screen.findByText(t("validation.regNumberRequired"))).toBeInTheDocument();
    expect(screen.getByText(t("validation.passwordRequired"))).toBeInTheDocument();
    expect(fake.writes).toEqual([]);
  });

  it("الأستاذ ببريدٍ لا يصلح ⇒ يُقال؛ وبالجامعيّ ⇒ لوحة الأستاذ", async () => {
    const app = renderApp("/ar/login");
    await app.user.click(await screen.findByTestId("role-professor"));
    await fill(app, "not-an-email", "Pass#2026");
    expect(await screen.findByText(t("validation.emailInvalid"))).toBeInTheDocument();
    expect(fake.writes).toEqual([]);

    await fill(app, F.prof1.universityEmail, "");
    await waitFor(() => expect(fake.find("post", "/auth/professor/login")[0]?.body).toEqual({ universityEmail: F.prof1.universityEmail, password: "Pass#2026" }));
    await waitFor(() => expect(app.location()).toBe("/ar/professor"));
  });

  it("كلمة مرورٍ خاطئة ⇒ رسالة الخادم، ويبقى في الصفحة", async () => {
    fake.fail("post", "/auth/student/login", 401, "بيانات الدخول غير صحيحة", "AUTH_INVALID_CREDENTIALS");
    const app = renderApp("/ar/login");
    await fill(app, "202039012345", "wrong");
    expect((await screen.findAllByText(/غير صحيحة/)).length).toBeGreaterThan(0);
    expect(app.location()).toBe("/ar/login");
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("من أُرسل إلى الدخول من صفحةٍ يعود إليها بعده", async () => {
    const app = renderApp("/ar/topics");
    await waitFor(() => expect(app.location()).toBe("/ar/login"));
    await fill(app, "202039012345", "Pass#2026");
    await waitFor(() => expect(app.location()).toBe("/ar/topics"));
  });

  it("وصفحةٌ محميّة بفلاترها ⇒ يعود إليها كما كانت بعد الخطوة الثانية", async () => {
    fake.on("post", "/auth/admin/login", { message: "ok", twoFactorRequired: true, challenge: "ticket-1" });
    const app = renderApp("/ar/admin/topics?status=pending");
    await waitFor(() => expect(app.location()).toBe("/ar/login"));
    await app.user.click(await screen.findByTestId("role-admin"));
    await fill(app, "admin@univ-msila.dz", "Pass#2026");
    await app.user.type(await screen.findByTestId("login-2fa-code"), "123456");
    await waitFor(() => expect(app.location()).toBe("/ar/admin/topics?status=pending"));
  });

  it("زرّ العودة يقود إلى الرئيسية", async () => {
    const app = renderApp("/ar/login");
    await app.user.click(await screen.findByRole("button", { name: new RegExp(t("auth.backHome")) }));
    await waitFor(() => expect(app.location()).toBe("/ar"));
  });
});

describe("التحقّق القصير بعد المحاولات الخاطئة", () => {
  const ASKED = "للمتابعة، أكمل التحقّق القصير ثم أعد المحاولة.";
  const solvedBy = (body: unknown) => typeof (body as { altcha?: unknown }).altcha === "string";

  it("الخادم يطلبه ⇒ يظهر بلا رسالة خطأ، والدخول يُرسل وحده حين يُحلّ، ومعه الحلّ", async () => {
    fake.refuseUnless("post", "/auth/student/login", (r) => solvedBy(r.body), 428, ASKED, "AUTH_CAPTCHA_REQUIRED");
    const app = renderApp("/ar/login");
    await fill(app, "202039012345", "Pass#2026");

    const box = await screen.findByTestId("signin-check");
    expect(within(box).getByText("waiting")).toBeInTheDocument();
    expect(screen.queryByText(ASKED)).toBeNull();
    expect(fake.find("post", "/auth/student/login")).toHaveLength(1);

    await app.user.click(within(box).getByRole("button", { name: "solve" }));
    await waitFor(() => expect(fake.find("post", "/auth/student/login")).toHaveLength(2));
    expect(fake.find("post", "/auth/student/login")[1]!.body).toEqual({
      registrationNumber: "202039012345",
      password: "Pass#2026",
      altcha: `SOLVED-${solutions}`,
    });
    await waitFor(() => expect(app.location()).toBe("/ar/student"));
  });

  it("الخادم يرفع الدرجة إلى الصورة ⇒ تُعرض الصورة، والدخول يُرسل بتصريحها", async () => {
    solutions = 0;
    const altchaOf = (body: unknown) => (body as { altcha?: string }).altcha;
    // بلا شيء ⇒ المسألة؛ بحلّ المسألة ⇒ الصورة (قام إنذارٌ بينهما)؛ بالتصريح ⇒ الدخول.
    fake.refuseUnless(
      "post",
      "/auth/student/login",
      (r) => altchaOf(r.body) === "SOLVED-2",
      428,
      ASKED,
      "AUTH_CAPTCHA_REQUIRED",
      (r) => ({ captcha: altchaOf(r.body) ? "image" : "work" }),
    );
    const app = renderApp("/ar/login");
    await fill(app, "202039012345", "Pass#2026");
    const level = () => screen.getByTestId("signin-check").dataset.level;
    const solve = async () =>
      app.user.click(within(await screen.findByTestId("signin-check")).getByRole("button", { name: "solve" }));

    await waitFor(() => expect(level()).toBe("work"));
    await solve();
    await waitFor(() => expect(level()).toBe("image"));
    await solve();

    await waitFor(() => expect(app.location()).toBe("/ar/student"));
    expect(fake.find("post", "/auth/student/login").map((c) => altchaOf(c.body))).toEqual([undefined, "SOLVED-1", "SOLVED-2"]);
  });

  it("حلولٌ تُردّ مرّتين متتاليتين ⇒ يتوقّف عن الإعادة ويقول السبب", async () => {
    const used = "انتهت صلاحية التحقّق أو استُعمل من قبل — أعده ثم حاول مجدداً.";
    fake.fail("post", "/auth/student/login", 428, used, "AUTH_CAPTCHA_REQUIRED");
    const app = renderApp("/ar/login");
    await fill(app, "202039012345", "Pass#2026");

    for (const sent of [2, 3]) {
      await app.user.click(within(await screen.findByTestId("signin-check")).getByRole("button", { name: "solve" }));
      await waitFor(() => expect(fake.find("post", "/auth/student/login")).toHaveLength(sent));
    }
    expect((await screen.findAllByText(used)).length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("signin-check")).queryByText("waiting")).toBeNull();
    expect(app.location()).toBe("/ar/login");
  });
});

describe("المسؤول بالتحقّق بخطوتين", () => {
  beforeEach(() => fake.on("post", "/auth/admin/login", { message: "ok", twoFactorRequired: true, challenge: "ticket-1" }));

  async function toSecondStep(app: ReturnType<typeof renderApp>) {
    await app.user.click(await screen.findByTestId("role-admin"));
    await fill(app, "admin@univ-msila.dz", "Pass#2026");
    return screen.findByTestId("login-2fa");
  }

  it("كلمة المرور تُعطي تذكرةً لا جلسة، والرقم السادس يرسل الرمز وحده", async () => {
    const app = renderApp("/ar/login");
    await toSecondStep(app);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    await app.user.type(screen.getByTestId("login-2fa-code"), "12a345");
    expect(screen.getByTestId("login-2fa-code")).toHaveValue("12345");
    expect(screen.getByTestId("login-2fa-submit")).toBeDisabled();
    expect(fake.find("post", "/auth/admin/login/2fa")).toEqual([]);

    await app.user.type(screen.getByTestId("login-2fa-code"), "6");
    await waitFor(() => expect(app.location()).toBe("/ar/admin"));
    expect(fake.find("post", "/auth/admin/login/2fa").map((c) => c.body)).toEqual([{ challenge: "ticket-1", code: "123456" }]);
  });

  it("رمز استردادٍ بدل التطبيق: عشرة أحرف", async () => {
    const app = renderApp("/ar/login");
    await toSecondStep(app);
    await app.user.click(screen.getByRole("button", { name: t("auth.twoFactor.useRecovery") }));
    await app.user.type(screen.getByTestId("login-2fa-code"), "abcde-fghjk");
    await app.user.click(screen.getByTestId("login-2fa-submit"));
    await waitFor(() => expect(fake.find("post", "/auth/admin/login/2fa")[0]?.body).toMatchObject({ challenge: "ticket-1" }));
  });

  it("تذكرةٌ انتهت ⇒ يُقال، ويعود إلى كلمة المرور", async () => {
    fake.fail("post", "/auth/admin/login/2fa", 401, "انتهت صلاحية الخطوة، أعد الدخول", "AUTH_INVALID_TOKEN");
    const app = renderApp("/ar/login");
    await toSecondStep(app);
    await app.user.type(screen.getByTestId("login-2fa-code"), "123456");
    await waitFor(() => expect(screen.queryByTestId("login-2fa")).toBeNull());
    expect(await screen.findByText("انتهت صلاحية الخطوة، أعد الدخول")).toBeInTheDocument();
    expect(screen.getByTestId("login-password")).toBeInTheDocument();
  });

  it("رمزٌ خاطئ ⇒ يُمسح ويبقى في الخطوة الثانية", async () => {
    fake.fail("post", "/auth/admin/login/2fa", 401, "الرمز غير صحيح", "AUTH_INVALID_CREDENTIALS");
    const app = renderApp("/ar/login");
    await toSecondStep(app);
    await app.user.type(screen.getByTestId("login-2fa-code"), "000000");
    await waitFor(() => expect(screen.getByTestId("login-2fa-code")).toHaveValue(""));
    expect(await screen.findByText("الرمز غير صحيح")).toBeInTheDocument();
    expect(screen.getByTestId("login-2fa")).toBeInTheDocument();
  });

  it("«رجوع» يعيد إلى كلمة المرور", async () => {
    const app = renderApp("/ar/login");
    await toSecondStep(app);
    await app.user.click(screen.getByRole("button", { name: new RegExp(t("auth.twoFactor.back")) }));
    expect(await screen.findByTestId("login-password")).toBeInTheDocument();
  });
});

describe("المساعدة", () => {
  it.each(["student", "professor", "admin"])("دليل %s يُفتح ويُغلق", async (role) => {
    const app = renderApp("/ar/login");
    await app.user.click(await screen.findByTestId(`role-${role}`));
    await app.user.click(screen.getByRole("button", { name: new RegExp(t("auth.help")) }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(t("auth.guide.subtitle"))).toBeInTheDocument();
    await app.user.click(within(dialog).getByRole("button", { name: t("auth.understood") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it.each([
    ["admin", true],
    ["professor", false],
  ] as const)("خطوة رمز Google Authenticator في دليل %s: %s", async (role, shown) => {
    const app = renderApp("/ar/login");
    await app.user.click(await screen.findByTestId(`role-${role}`));
    await app.user.click(screen.getByRole("button", { name: new RegExp(t("auth.help")) }));
    const dialog = await screen.findByRole("dialog");
    const steps = within(dialog).getByRole("list");
    expect(within(steps).getAllByRole("listitem")).toHaveLength(shown ? 4 : 3);
    expect(within(steps).queryByText(t("auth.guide.adminCode"))).toEqual(shown ? expect.anything() : null);
  });

  describe("الشرح المتحرّك", () => {
    async function guide(role = "admin") {
      const app = renderApp("/ar/login");
      await app.user.click(await screen.findByTestId(`role-${role}`));
      await app.user.click(screen.getByRole("button", { name: new RegExp(t("auth.help")) }));
      const dialog = await screen.findByRole("dialog");
      return { app, dialog, steps: within(within(dialog).getByRole("list")).getAllByRole("button") };
    }
    const stage = () => screen.getByTestId("login-tutorial");
    const caption = () => screen.getByTestId("tutorial-caption");
    const toggle = () => screen.getByTestId("tutorial-toggle");

    it("يعمل وحده من أوّله، ويمضي إلى الخطوة الأولى فيُضيئها", async () => {
      await guide();
      expect(stage()).toHaveAttribute("data-scene", "intro");
      expect(caption()).toHaveTextContent(t("auth.tutorial.intro"));
      expect(toggle()).toHaveAccessibleName(t("auth.tutorial.pause"));
      expect(screen.queryByRole("button", { current: "step" })).toBeNull();
      await waitFor(() => expect(stage()).toHaveAttribute("data-scene", "role"), { timeout: 3000 });
      expect(caption()).toHaveTextContent(t("auth.tutorial.role", { role: t("roles.admin") }));
      expect(screen.getByRole("button", { current: "step" })).toHaveTextContent(t("auth.guide.chooseRole", { role: t("roles.admin") }));
    });

    it("النقر على خطوةٍ يأخذ الشرح إليها؛ وموقوفاً يقف حيث تمّت؛ والإعادة من أوّله", async () => {
      const { app, steps } = await guide();
      await app.user.click(toggle());
      expect(toggle()).toHaveAccessibleName(t("auth.tutorial.play"));

      await app.user.click(steps[1]!);
      expect(stage()).toHaveAttribute("data-scene", "id");
      expect(caption()).toHaveTextContent(t("auth.tutorial.email"));
      expect(steps[1]).toHaveAttribute("aria-current", "step");
      // البريد كُتب كلّه وفُصِّل إلى جزأيه.
      expect(stage()).toHaveTextContent(t("auth.guide.adminLocal"));

      await app.user.click(steps[3]!);
      expect(stage()).toHaveAttribute("data-scene", "code");
      expect(caption()).toHaveTextContent(t("auth.tutorial.code"));
      expect(stage()).toHaveTextContent("482913");

      await app.user.click(screen.getByRole("button", { name: t("auth.tutorial.replay") }));
      expect(stage()).toHaveAttribute("data-scene", "intro");
      expect(toggle()).toHaveAccessibleName(t("auth.tutorial.pause"));
    });

    it("وللأستاذ بلا شاشة الرمز", async () => {
      const { steps } = await guide("professor");
      expect(steps).toHaveLength(3);
      expect(stage()).not.toHaveTextContent(t("auth.twoFactor.verify"));
    });

    it("وللطالب: رقم التسجيل كما على بطاقته، وكلمة المرور تُكشف فتُرى صيغتها؛ والبطاقة باقية", async () => {
      const { app, dialog, steps } = await guide("student");
      expect(steps).toHaveLength(3);
      // «طالب» مختارٌ من الأصل: لا مشهد للدور.
      await app.user.click(toggle());
      await app.user.click(steps[0]!);
      expect(stage()).toHaveAttribute("data-scene", "id");
      expect(caption()).toHaveTextContent(t("auth.tutorial.reg"));
      // كما على صورة البطاقة نفسها.
      expect(stage()).toHaveTextContent("2222399XXXXXX");
      expect(stage()).toHaveTextContent(t("auth.guide.asOnCard"));

      await app.user.click(steps[1]!);
      expect(caption()).toHaveTextContent(t("auth.tutorial.birth"));
      expect(stage()).toHaveTextContent("YYYY/MM/DD");
      expect(steps[1]).toHaveAttribute("aria-current", "step");

      await app.user.click(steps[2]!);
      expect(stage()).toHaveAttribute("data-scene", "submit");
      expect(within(dialog).getByText(t("auth.guide.whereTitle"))).toBeInTheDocument();
      expect(within(dialog).getByRole("img", { name: t("auth.guide.cardAlt") })).toBeInTheDocument();
    });

    it("ومن طلب تقليل الحركة يراه واقفاً على نهايته", async () => {
      const original = window.matchMedia;
      window.matchMedia = (q: string) => ({ ...original(q), matches: q.includes("reduce") });
      try {
        await guide();
        expect(stage()).toHaveAttribute("data-scene", "done");
        expect(caption()).toHaveTextContent(t("auth.tutorial.done"));
        expect(toggle()).toHaveAccessibleName(t("auth.tutorial.play"));
      } finally {
        window.matchMedia = original;
      }
    });
  });
});
