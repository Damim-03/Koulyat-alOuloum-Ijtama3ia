import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import type { CapturedPhoto } from "../../components/camera/photo-capture";

/**
 * «نسيت كلمة المرور» لطالبٍ بلا بريدٍ مؤكَّد (Backend modules/password-request).
 *
 * يُحرس: أنّ رقم التسجيل يُبحث عنه حين يكتمل فيقال «موجود» أو «غير موجود»،
 * وطريقه — الرابط أو الإدارة —؛ وأنّ رقماً لا طالب له لا يُرسل شيئاً؛ وأنّ طريق
 * الإدارة يطلب صورة البطاقة، ولا يُرسل إلا ببطاقة هذا الرقم؛ وأنّ ما يُرسل الرقم
 * والبطاقة ورقم رمزها؛ وأنّ الصفحة تنتظر ثمّ تعرض ما كتبته الإدارة — للمتصفّح
 * الذي أرسل وحده، ولو أُغلقت وفُتحت —؛ وأنّ النسخ يغلقها إلى صفحة الدخول برقمه
 * وبالإرشاد؛ وأنّ الرفض يقول سببه ويعيد إلى البطاقة؛ وأنّ الطلب يُسحب.
 *
 * الكاميرا لا توجد في jsdom: صورةٌ جاهزة برمزٍ يُختار لكلّ اختبار.
 */
const REG = "202039012345";
let cardQr: string | null = `https://progres.mesrs.dz/check/${REG}`;

vi.mock("../../components/camera/photo-capture", () => ({
  PhotoCapture: ({ photo, onPhoto }: { photo: CapturedPhoto | null; onPhoto: (p: CapturedPhoto | null) => void }) =>
    photo ? (
      <span data-testid="photo-card-taken">taken</span>
    ) : (
      <button type="button" data-testid="photo-card-take" onClick={() => onPhoto({ blob: new Blob(["card"], { type: "image/jpeg" }), url: "blob:card", qr: cardQr })}>
        take card
      </button>
    ),
}));

const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const STORE = "recover.passwordRequest";
const TOKEN = "T".repeat(43);
const PASSWORD = "Wadi-Souf#2026";

beforeEach(() => {
  fake.reset();
  localStorage.clear();
  cardQr = `https://progres.mesrs.dz/check/${REG}`;
});

const lookupState = async (state: string) =>
  waitFor(() => expect(screen.getByTestId("recover-lookup")).toHaveAttribute("data-state", state));

describe("البحث برقم التسجيل", () => {
  it("رقمٌ لا طالب له ⇒ «غير موجود»، ولا يُرسل شيء؛ ورقمٌ ببريدٍ مؤكَّد ⇒ «موجود» والرابط", async () => {
    fake.on("post", "/auth/password/student", (r: { body: unknown }) =>
      (r.body as { registrationNumber: string }).registrationNumber === REG ? { found: true, via: "email" } : { found: false },
    );
    const app = renderApp("/ar/forgot-password");
    await app.user.type(await screen.findByTestId("recover-identifier"), "202039012399");
    await lookupState("missing");
    expect(screen.getByTestId("recover-lookup")).toHaveTextContent(t("auth.recover.lookup.missing"));
    expect(fake.find("post", "/auth/password/student").at(-1)!.body).toEqual({ registrationNumber: "202039012399" });
    await app.user.click(screen.getByTestId("recover-send"));
    expect(await screen.findByText(t("auth.recover.lookup.missing"))).toBeInTheDocument();
    expect(fake.find("post", "/auth/password/forgot")).toEqual([]);

    await app.user.clear(screen.getByTestId("recover-identifier"));
    await app.user.type(screen.getByTestId("recover-identifier"), REG);
    await lookupState("email");
    expect(screen.getByTestId("recover-lookup")).toHaveTextContent(t("auth.recover.lookup.found"));
    expect(screen.getByTestId("recover-send")).toHaveTextContent(t("auth.recover.send"));
  });

  it("بحثٌ لم يُجَب (طلباتٌ كثيرة) ⇒ يقال ذلك بدل الانتظار", async () => {
    fake.fail("post", "/auth/password/student", 429, "طلباتٌ كثيرة في وقتٍ قصير");
    const app = renderApp("/ar/forgot-password");
    await app.user.type(await screen.findByTestId("recover-identifier"), REG);
    await lookupState("error");
    expect(screen.getByTestId("recover-lookup")).toHaveTextContent("طلباتٌ كثيرة في وقتٍ قصير");
  });

  it("حسابٌ موقوف ⇒ يقال ذلك، والزرّ معطَّل", async () => {
    fake.on("post", "/auth/password/student", { found: true, via: "blocked" });
    const app = renderApp("/ar/forgot-password");
    await app.user.type(await screen.findByTestId("recover-identifier"), REG);
    await lookupState("blocked");
    expect(screen.getByTestId("recover-lookup")).toHaveTextContent(t("auth.recover.lookup.blocked"));
    expect(screen.getByTestId("recover-send")).toBeDisabled();
  });
});

describe("بلا بريدٍ مؤكَّد: طلبٌ إلى الإدارة", () => {
  it("البطاقة ⇒ الانتظار ⇒ كلمة المرور ⇒ النسخ يغلق الصفحة إلى الدخول برقمه وبالإرشاد", async () => {
    fake.on("post", "/auth/password/student", { found: true, via: "admin" });
    const app = renderApp("/ar/forgot-password");
    await app.user.type(await screen.findByTestId("recover-identifier"), REG);
    await lookupState("admin");
    expect(screen.getByTestId("recover-lookup")).toHaveTextContent(t("auth.recover.lookup.viaAdmin"));
    expect(screen.getByTestId("recover-send")).toHaveTextContent(t("auth.recover.askAdmin"));
    await app.user.click(screen.getByTestId("recover-send"));

    // The card: only this number's goes.
    expect(await screen.findByTestId("recover-request-form")).toBeInTheDocument();
    expect(screen.getByTestId("recover-request-number")).toHaveTextContent(REG);
    const send = screen.getByTestId("recover-request-send");
    expect(send).toBeDisabled();
    await app.user.click(screen.getByTestId("photo-card-take"));
    expect(screen.getByTestId("recover-request-qr")).toHaveAttribute("data-verdict", "match");
    await app.user.click(send);

    await waitFor(() => expect(fake.find("post", "/auth/password/request")).toHaveLength(1));
    const body = fake.find("post", "/auth/password/request")[0]!.body as Record<string, unknown>;
    expect(body.registrationNumber).toBe(REG);
    expect(body.qrNumber).toBe(REG);
    expect(body.card).toBeInstanceOf(Blob);
    expect(fake.find("post", "/auth/password/forgot")).toEqual([]);

    // Waiting — and the secret kept by this browser, in the body of every question, never the address.
    expect(await screen.findByTestId("recover-request-pending")).toHaveTextContent(REG);
    expect(JSON.parse(localStorage.getItem(STORE)!)).toEqual({ token: TOKEN, registrationNumber: REG });
    expect(fake.find("post", "/auth/password/request/status")[0]!.body).toEqual({ token: TOKEN });

    // Closed and opened again on this device: the answer is there.
    app.unmount();
    fake.on("post", "/auth/password/request/status", { status: "approved", password: PASSWORD, registrationNumber: REG, decidedAt: "2026-11-20T10:00:00.000Z" });
    const again = renderApp("/ar/forgot-password");
    expect(await screen.findByTestId("recover-password")).toHaveTextContent(PASSWORD);

    await again.user.click(screen.getByTestId("recover-copy"));
    await waitFor(() => expect(again.location()).toBe("/ar/login"));
    expect(await navigator.clipboard.readText()).toBe(PASSWORD);
    expect(fake.find("post", "/auth/password/request/close")[0]!.body).toEqual({ token: TOKEN });
    expect(localStorage.getItem(STORE)).toBeNull();
    expect(await screen.findByTestId("login-recovered")).toHaveTextContent(t("auth.recover.loginNote"));
    expect(screen.getByTestId("login-identifier")).toHaveValue(REG);
  });

  it("بطاقة رقمٍ آخر، أو رمزٌ لم يُقرأ ⇒ لا يُرسل", async () => {
    fake.on("post", "/auth/password/student", { found: true, via: "admin" });
    cardQr = "https://progres.mesrs.dz/check/202039099999";
    const app = renderApp("/ar/forgot-password");
    await app.user.type(await screen.findByTestId("recover-identifier"), REG);
    await lookupState("admin");
    await app.user.click(screen.getByTestId("recover-send"));
    await app.user.click(await screen.findByTestId("photo-card-take"));
    expect(screen.getByTestId("recover-request-qr")).toHaveAttribute("data-verdict", "other");
    expect(screen.getByTestId("recover-request-send")).toBeDisabled();
  });

  it("الرفض يقول سببه، ويعيد إلى البطاقة بالرقم نفسه", async () => {
    localStorage.setItem(STORE, JSON.stringify({ token: TOKEN, registrationNumber: REG }));
    fake.on("post", "/auth/password/request/status", { status: "rejected", reason: "الصورة غير واضحة", decidedAt: "2026-11-20T10:00:00.000Z" });
    const app = renderApp("/ar/forgot-password");
    expect(await screen.findByTestId("recover-request-rejected")).toHaveTextContent("الصورة غير واضحة");
    await app.user.click(screen.getByTestId("recover-request-again"));
    expect(await screen.findByTestId("recover-request-form")).toBeInTheDocument();
    expect(screen.getByTestId("recover-request-number")).toHaveTextContent(REG);
    expect(fake.find("post", "/auth/password/request/close")).toHaveLength(1);
    expect(localStorage.getItem(STORE)).toBeNull();
  });

  it("سحب الطلب وهو ينتظر ⇒ يُغلق ويعود النموذج؛ وطلبٌ انتهى ⇒ يقال ذلك", async () => {
    localStorage.setItem(STORE, JSON.stringify({ token: TOKEN, registrationNumber: REG }));
    const app = renderApp("/ar/forgot-password");
    await app.user.click(await screen.findByTestId("recover-request-cancel"));
    expect(await screen.findByTestId("recover-identifier")).toBeInTheDocument();
    expect(fake.find("post", "/auth/password/request/close")).toHaveLength(1);
    expect(localStorage.getItem(STORE)).toBeNull();
    app.unmount();

    localStorage.setItem(STORE, JSON.stringify({ token: TOKEN, registrationNumber: REG }));
    fake.on("post", "/auth/password/request/status", { status: "none" });
    renderApp("/ar/forgot-password");
    expect(await screen.findByTestId("recover-request-gone")).toHaveTextContent(t("auth.recover.gone.body"));
  });

  it("نسخٌ لم ينجح ⇒ يقال ذلك، وزرٌّ يتابع إلى الدخول", async () => {
    localStorage.setItem(STORE, JSON.stringify({ token: TOKEN, registrationNumber: REG }));
    fake.on("post", "/auth/password/request/status", { status: "approved", password: PASSWORD, registrationNumber: REG, decidedAt: null });
    const app = renderApp("/ar/forgot-password");
    await screen.findByTestId("recover-password");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
    await app.user.click(screen.getByTestId("recover-copy"));
    expect(await screen.findByTestId("recover-copy-failed")).toBeInTheDocument();
    await app.user.click(screen.getByTestId("recover-copied"));
    await waitFor(() => expect(app.location()).toBe("/ar/login"));
  });
});
