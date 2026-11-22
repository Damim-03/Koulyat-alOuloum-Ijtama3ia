import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";
import type { CapturedPhoto } from "../../components/camera/photo-capture";

/**
 * التفعيل بمرحلتين، وصور التوثيق (Backend modules/activation).
 *
 * يُحرس: أنّ الطالب الذي دخل بكلمة المرور المسلَّمة يبدأ بكلمة مروره — ولا صور
 * قبلها — فتسري فوراً، ثمّ تأتي الصور على الشاشة نفسها؛ وأنّ له أن يتخطّاها، أو
 * يرسلها فيُقال «قيد المراجعة»؛ ثمّ المرحلة الثالثة: مراجعة ما فعل وبيانات
 * حسابه، ومنها يعود إلى الصور إن تخطّاها، وبالتأكيد يدخل حسابه؛ وأنّ الموثَّق
 * من قبل لا يُطلب منه شيء. وفي الصور: أنّ الإرسال لا يكون قبل
 * الصورتين، وأنّ ما يُرسل الصورتان ورقم البطاقة كما قُرئ من رمزها — بلا كلمة
 * مرور؛ وأنّ رمز البطاقة يُقال للطالب أيطابق حسابه؛ وأنّ الطلب المرسَل يُعاد
 * إرساله؛ وأنّ الرفض يُعرض بسببه مع الصور من جديد.
 *
 * الكاميرا والرسم على canvas لا يوجدان في jsdom، فهنا بديلٌ يعطي صورةً جاهزة —
 * وما تفعله الكاميرا نفسها يُرى في المتصفّح.
 */
const REG = F.authUsers.student.registrationNumber!;
let cardQr: string | null = `https://progres.mesrs.dz/check/${REG}`;

vi.mock("../../components/camera/photo-capture", () => ({
  PhotoCapture: ({ kind, photo, onPhoto }: { kind: "card" | "selfie"; photo: CapturedPhoto | null; onPhoto: (p: CapturedPhoto | null) => void }) =>
    photo ? (
      <span data-testid={`photo-${kind}-taken`}>taken</span>
    ) : (
      <button
        type="button"
        data-testid={`photo-${kind}-take`}
        onClick={() => onPhoto({ blob: new Blob([kind], { type: "image/jpeg" }), url: `blob:${kind}`, qr: kind === "card" ? cardQr : null })}
      >
        take {kind}
      </button>
    ),
}));

const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const asWaiting = { as: "student" as const, user: { activationRequired: true, mustChangePassword: true } };
const unverified = () => fake.on("get", "/account", () => ({ account: { ...F.myAccount(F.authUsers.student), isVerified: false } }));
const stages = () => within(screen.getByTestId("activation-steps")).getAllByRole("listitem");

beforeEach(() => {
  fake.reset();
  localStorage.clear();
  cardQr = `https://progres.mesrs.dz/check/${REG}`;
});

/** The first stage: the handed-out password, replaced. */
async function choosePassword(app: ReturnType<typeof renderApp>) {
  await app.user.type(await screen.findByTestId("acc-pw-current"), "2003-handed-out");
  await app.user.type(screen.getByTestId("acc-pw-new"), "Wadi-Souf#2026");
  await app.user.type(screen.getByTestId("acc-pw-again"), "Wadi-Souf#2026");
  await app.user.click(screen.getByTestId("acc-pw-submit"));
  await waitFor(() => expect(fake.find("post", "/account/password")).toHaveLength(1));
}

describe("التفعيل بمرحلتين", () => {
  it("كلمة المرور أوّلاً — تسري فوراً — ثمّ الصور على الشاشة نفسها؛ تُرسل، فـ«قيد المراجعة»، فلوحته", async () => {
    unverified();
    const app = renderApp("/ar/student", asWaiting);
    await screen.findByTestId("setup-gate-activation");
    expect(screen.getByRole("heading", { name: t("account.gate.activation.password.title") })).toBeInTheDocument();
    expect(stages()[0]).toHaveAttribute("data-state", "current");
    expect(stages()[1]).toHaveTextContent(t("account.gate.activation.steps.optional"));
    // No photos before the password is the student's own.
    expect(screen.queryByTestId("activation-request-form")).toBeNull();
    expect(screen.queryByTestId("activation-skip")).toBeNull();

    await choosePassword(app);
    expect(fake.find("post", "/account/password")[0]!.body).toEqual({ currentPassword: "2003-handed-out", newPassword: "Wadi-Souf#2026" });

    // Same screen, second stage — the dashboard never shows in between.
    expect(await screen.findByTestId("activation-request-form")).toBeInTheDocument();
    expect(screen.getByTestId("setup-gate-activation")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: t("account.gate.activation.photos.title") })).toBeInTheDocument();
    expect(stages()[0]).toHaveAttribute("data-state", "done");
    expect(stages()[1]).toHaveAttribute("data-state", "current");

    const send = screen.getByTestId("activation-send");
    expect(send).toBeDisabled();
    // The card alone: no photo of the face is asked for.
    expect(screen.queryByTestId("photo-selfie-take")).toBeNull();
    await app.user.click(screen.getByTestId("photo-card-take"));
    expect(screen.getByTestId("activation-qr")).toHaveTextContent(t("activation.qr.match"));
    expect(send).toBeEnabled();
    await app.user.click(send);

    await waitFor(() => expect(fake.find("post", "/account/activation-request")).toHaveLength(1));
    const body = fake.find("post", "/account/activation-request")[0]!.body as Record<string, unknown>;
    expect(body.card).toBeInstanceOf(Blob);
    expect(body).not.toHaveProperty("selfie");
    expect(body.qrNumber).toBe(REG);
    expect(body).not.toHaveProperty("newPassword");
    expect(await screen.findByTestId("activation-pending")).toHaveTextContent(t("activation.verification.pendingBody"));

    // Third stage: what was done, and the account's details — then in.
    await app.user.click(screen.getByTestId("activation-continue"));
    const review = await screen.findByTestId("activation-review");
    expect(screen.getByRole("heading", { name: t("account.gate.activation.review.title") })).toBeInTheDocument();
    expect(stages().map((s) => s.getAttribute("data-state"))).toEqual(["done", "done", "current"]);
    expect(screen.getByTestId("activation-review-verification")).toHaveAttribute("data-state", "pending");
    expect(within(review).getByTestId("activation-review-details")).toHaveTextContent(REG);
    expect(screen.getByText(t("account.gate.activation.review.wrong"))).toBeInTheDocument();
    expect(screen.getByTestId("setup-gate-activation")).toBeInTheDocument();

    await app.user.click(screen.getByTestId("activation-confirm"));
    await waitFor(() => expect(screen.queryByTestId("setup-gate-activation")).toBeNull());
    expect((await screen.findAllByText(F.topicFull.title)).length).toBeGreaterThan(0);
  });

  it("«تخطَّ الآن» ⇒ المراجعة تقول إنّه تُخطّي، و«وثّق الآن» يعيد إلى الصور؛ والتأكيد ⇒ لوحته بلا صور", async () => {
    unverified();
    const app = renderApp("/ar/student", asWaiting);
    await screen.findByTestId("setup-gate-activation");
    await choosePassword(app);
    expect(await screen.findByTestId("activation-skip")).toHaveTextContent(t("account.gate.activation.skip"));
    expect(screen.getByText(t("account.gate.activation.skipHint"))).toBeInTheDocument();

    await app.user.click(screen.getByTestId("activation-skip"));
    await screen.findByTestId("activation-review");
    expect(screen.getByTestId("activation-review-verification")).toHaveAttribute("data-state", "skipped");
    expect(stages()[1]).toHaveAttribute("data-state", "skipped");
    expect(stages()[1]).toHaveTextContent(t("account.gate.activation.steps.skipped"));

    // Back to the photos — then skipped again, all the same.
    await app.user.click(screen.getByTestId("activation-verify-now"));
    expect(await screen.findByTestId("activation-request-form")).toBeInTheDocument();
    expect(stages()[1]).toHaveAttribute("data-state", "current");
    await app.user.click(screen.getByTestId("activation-skip"));
    await app.user.click(await screen.findByTestId("activation-confirm"));

    await waitFor(() => expect(screen.queryByTestId("setup-gate-activation")).toBeNull());
    expect((await screen.findAllByText(F.topicFull.title)).length).toBeGreaterThan(0);
    expect(fake.find("post", "/account/activation-request")).toHaveLength(0);
  });

  it("موثَّقٌ من قبل (أعادت الإدارة كلمة مروره) ⇒ المرحلة الثانية تقول ذلك، والمراجعة كذلك", async () => {
    const app = renderApp("/ar/student", asWaiting);
    await screen.findByTestId("setup-gate-activation");
    await choosePassword(app);
    expect(await screen.findByTestId("verification-done")).toBeInTheDocument();
    expect(screen.queryByTestId("activation-request-form")).toBeNull();
    await app.user.click(screen.getByTestId("activation-continue"));
    expect(await screen.findByTestId("activation-review-verification")).toHaveAttribute("data-state", "verified");
    expect(screen.queryByTestId("activation-verify-now")).toBeNull();
    await app.user.click(screen.getByTestId("activation-confirm"));
    await waitFor(() => expect(screen.queryByTestId("setup-gate-activation")).toBeNull());
  });

  it("والتفعيل غير مفعّل ⇒ شاشة كلمة المرور وحدها، بلا مراحل ولا صور", async () => {
    const app = renderApp("/ar/student", { as: "student", user: { mustChangePassword: true } });
    await screen.findByTestId("setup-gate-password");
    expect(screen.queryByTestId("activation-steps")).toBeNull();
    await choosePassword(app);
    await waitFor(() => expect(screen.queryByTestId("setup-gate-password")).toBeNull());
    expect(screen.queryByTestId("activation-request-form")).toBeNull();
  });
});

describe("صور التوثيق — «توثيق الحساب» في «حسابي»", () => {
  const wing = async () => {
    unverified();
    const app = renderApp("/ar/student/account?tab=verification", { as: "student" });
    await screen.findByTestId("wing-verification");
    return app;
  };

  it("طالبٌ غير موثّق ⇒ صورة البطاقة وحدها، بلا كلمة مرور؛ ثمّ «قيد المراجعة»", async () => {
    const app = await wing();
    expect(screen.getByTestId("wing-verification")).toHaveTextContent(t("admin.account.security.notVerified"));
    expect(await screen.findByText(t("activation.verification.intro"))).toBeInTheDocument();
    expect(screen.queryByTestId("acc-pw-new")).toBeNull();

    const send = screen.getByTestId("activation-send");
    expect(send).toHaveTextContent(t("activation.verification.send"));
    expect(send).toBeDisabled();
    await app.user.click(send);
    expect(fake.writes).toEqual([]);
    expect(screen.queryByTestId("photo-selfie-take")).toBeNull();
    await app.user.click(screen.getByTestId("photo-card-take"));
    expect(send).toBeEnabled();
    await app.user.click(send);

    await waitFor(() => expect(fake.find("post", "/account/activation-request")).toHaveLength(1));
    const body = fake.find("post", "/account/activation-request")[0]!.body as Record<string, unknown>;
    expect(body).not.toHaveProperty("newPassword");
    expect(body.qrNumber).toBe(REG);
    expect(await screen.findByTestId("activation-pending")).toHaveTextContent(t("activation.verification.pendingBody"));
    expect(screen.getByTestId("wing-verification")).toHaveTextContent(t("admin.account.wing.verifyPending"));
  });

  it("رمز البطاقة برقمٍ آخر ⇒ يُقال للطالب، ولا يُرسل الطلب", async () => {
    cardQr = "https://progres.mesrs.dz/check/999999999999";
    const app = await wing();
    await app.user.click(await screen.findByTestId("photo-card-take"));
    const said = screen.getByTestId("activation-qr");
    expect(said).toHaveTextContent(t("activation.qr.other"));
    expect(said).toHaveAttribute("role", "alert");
    const send = screen.getByTestId("activation-send");
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute("title", t("activation.qr.blocked"));
    await app.user.click(send);
    expect(fake.writes).toEqual([]);
  });

  it("رمزٌ لم يُقرأ ⇒ يُقال أعد التصوير، ولا يُرسل الطلب", async () => {
    cardQr = null;
    const app = await wing();
    await app.user.click(await screen.findByTestId("photo-card-take"));
    expect(screen.getByTestId("activation-qr")).toHaveAttribute("data-verdict", "unread");
    expect(screen.getByTestId("activation-qr")).toHaveTextContent(t("activation.qr.unread"));
    expect(screen.getByTestId("activation-send")).toBeDisabled();
    await app.user.click(screen.getByTestId("activation-send"));
    expect(fake.writes).toEqual([]);
  });

  it("طلبٌ قيد المراجعة ⇒ يُقال، ويُعاد إرساله بصورٍ أخرى", async () => {
    fake.on("get", "/account/activation-request", { status: "pending", sentAt: "2026-11-01T08:00:00.000Z" });
    const app = await wing();
    expect(await screen.findByTestId("activation-pending")).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: t("activation.pending.resend") }));
    expect(await screen.findByTestId("activation-request-form")).toBeInTheDocument();
  });

  it("رُفض الطلب ⇒ سببه، والصور من جديد", async () => {
    fake.on("get", "/account/activation-request", { status: "rejected", reason: "الوجه غير واضح.", decidedAt: "2026-11-01T10:00:00.000Z" });
    await wing();
    const banner = await screen.findByTestId("activation-rejected");
    expect(banner).toHaveTextContent(t("activation.rejected.title"));
    expect(banner).toHaveTextContent("الوجه غير واضح.");
    expect(screen.getByTestId("activation-request-form")).toBeInTheDocument();
  });

  it("رفض الخادم الإرسال ⇒ سببه تحت الزرّ", async () => {
    fake.fail("post", "/account/activation-request", 400, "أرسل صورة بطاقة الطالب.", "VALIDATION_ERROR");
    const app = await wing();
    await app.user.click(await screen.findByTestId("photo-card-take"));
    await app.user.click(screen.getByTestId("activation-send"));
    expect(await screen.findByText("أرسل صورة بطاقة الطالب.")).toBeInTheDocument();
  });

  it("حسابٌ موثّق ⇒ يقول ذلك، ولا يطلب شيئاً", async () => {
    renderApp("/ar/student/account?tab=verification", { as: "student" });
    expect(await screen.findByTestId("verification-done")).toHaveTextContent(t("activation.verification.doneTitle"));
    expect(screen.getByTestId("wing-verification")).toHaveTextContent(t("admin.struct.spec.verified"));
    expect(fake.find("get", "/account/activation-request")).toHaveLength(0);
  });

  it("الأستاذ ⇒ لا جناح توثيقٍ بالصور", async () => {
    renderApp("/ar/professor/account", { as: "professor" });
    await screen.findByTestId("wing-password");
    expect(screen.queryByTestId("wing-verification")).toBeNull();
  });
});
