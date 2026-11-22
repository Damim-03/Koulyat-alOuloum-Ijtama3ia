import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * «واجهة الموقع ← رسائل البريد» (Backend core/mail/mail-templates).
 *
 * يُحرس: أنّ كلّ حقلٍ يبدأ بنصّ المنصة ولا يُحفظ منه إلّا ما تغيّر؛ وأنّ القيم
 * تُدرج بأزرارها وما ليس منها يوقف الحفظ والمعاينة؛ وأنّ «إرجاع الأصل» يعيد
 * نصّ المنصة؛ وأنّ الشكل (اللونان والختم) يُحفظ؛ وأنّ المعاينة تتبع الكتابة،
 * والتجربة ترسل ما يُرى.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const D = F.mailTemplates.defaults;
const field = (key: string) => screen.getByTestId(`mail-field-${key}`) as HTMLInputElement | HTMLTextAreaElement;
const save = () => screen.getAllByRole("button", { name: t("admin.mailTemplates.save") })[0]!;

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function open() {
  const app = renderApp("/ar/admin/homepage?tab=mail", { as: "admin" });
  await screen.findByTestId("mail-panel");
  return app;
}

describe("رسائل البريد", () => {
  it("الحقل يبدأ بنصّ المنصة؛ تعديل الموضوع ⇒ تتبعه المعاينة، والحفظ يرسل ما تغيّر وحده", async () => {
    const app = await open();
    // «ما يتكرّر» أوّلاً، ومعاينته رسالة الاستعادة.
    expect(field("mail.brand")).toHaveValue(D.ar["mail.brand"]);
    expect(await screen.findByTestId("mail-preview-subject")).toHaveTextContent(D.ar["mail.reset.subject"]!);
    expect(screen.getByTestId("mail-preview-frame")).toBeInTheDocument();
    expect(save()).toBeDisabled();

    await app.user.click(screen.getByTestId("mail-group-reset"));
    await app.user.clear(field("mail.reset.subject"));
    await app.user.type(field("mail.reset.subject"), "رابط كلمة مرورك");
    await waitFor(() => expect(screen.getByTestId("mail-preview-subject")).toHaveTextContent("رابط كلمة مرورك"), { timeout: 2000 });

    await app.user.click(save());
    await waitFor(() => expect(fake.find("put", "/admin/mail-templates")).toHaveLength(1));
    expect(fake.find("put", "/admin/mail-templates")[0]!.body).toEqual({
      ar: { "mail.reset.subject": "رابط كلمة مرورك" },
      en: {},
      fr: {},
      look: F.mailTemplates.look,
    });
  });

  it("القيمة تُدرج بزرّها؛ وقيمةٌ غريبة توقف الحفظ؛ و«إرجاع الأصل» يعيد نصّ المنصة", async () => {
    const app = await open();
    await app.user.click(screen.getByTestId("mail-group-reset"));
    const intro = field("mail.reset.intro");

    fireEvent.change(intro, { target: { value: "مرحباً " } });
    intro.setSelectionRange(7, 7);
    await app.user.click(screen.getByTestId("mail-var-mail.reset.intro-account"));
    expect(field("mail.reset.intro")).toHaveValue("مرحباً {{account}}");
    expect(save()).toBeEnabled();

    fireEvent.change(field("mail.reset.intro"), { target: { value: "كلمتك {{password}}" } });
    expect(screen.getByText(t("admin.mailTemplates.unknownVar", { name: "{{password}}", list: "{{account}}" }))).toBeInTheDocument();
    expect(save()).toBeDisabled();
    expect(screen.getByText(t("admin.mailTemplates.previewPaused"))).toBeInTheDocument();

    await app.user.click(screen.getByTestId("mail-restore-mail.reset.intro"));
    expect(field("mail.reset.intro")).toHaveValue(D.ar["mail.reset.intro"]);
    expect(save()).toBeDisabled();
  });

  it("كلّ لغةٍ وحدها: تعديل الفرنسية لا يمسّ العربية", async () => {
    const app = await open();
    await app.user.click(screen.getByTestId("mail-lang-fr"));
    expect(field("mail.footer")).toHaveValue(D.fr["mail.footer"]);
    fireEvent.change(field("mail.footer"), { target: { value: "Université d’El Oued" } });
    await app.user.click(save());
    await waitFor(() => expect(fake.find("put", "/admin/mail-templates")).toHaveLength(1));
    expect(fake.find("put", "/admin/mail-templates")[0]!.body).toMatchObject({ ar: {}, fr: { "mail.footer": "Université d’El Oued" } });
  });

  it("الشكل: لونٌ مقترح، وشعار المنصة للجامعة، وصورةٌ مرفوعة للكلّية ⇒ تُحفظ", async () => {
    const app = await open();
    await app.user.click(screen.getByRole("button", { name: `${t("admin.mailTemplates.header")} #1f3a5f` }));
    await app.user.click(screen.getByTestId("mail-logo-university-platform"));
    expect(screen.getByTestId("mail-logo-university-image")).toBeInTheDocument();

    await app.user.click(screen.getByTestId("mail-logo-faculty-upload"));
    // Where the browser cannot draw it (the test page), a small PNG goes as it is.
    await app.user.upload(screen.getByTestId("mail-logo-faculty-file"), new File(["png"], "kulliya.png", { type: "image/png" }));
    await waitFor(() => expect(fake.find("post", "/admin/uploads/image")).toHaveLength(1));
    expect(await screen.findByTestId("mail-logo-faculty-image")).toHaveAttribute("src", expect.stringContaining("/uploads/cards/new.jpg"));

    await app.user.click(save());
    await waitFor(() => expect(fake.find("put", "/admin/mail-templates")).toHaveLength(1));
    expect((fake.find("put", "/admin/mail-templates")[0]!.body as { look: object }).look).toEqual({
      header: "#1f3a5f",
      accent: "#c1965a",
      universityLogo: "platform",
      facultyLogo: "/uploads/cards/new.jpg",
    });
  });

  it("صورةٌ لا يرسمها البريد (WebP) ولا يصغّرها المتصفّح ⇒ لا تُرفع، ويقال ذلك", async () => {
    const app = await open();
    await app.user.click(screen.getByTestId("mail-logo-faculty-upload"));
    await app.user.upload(screen.getByTestId("mail-logo-faculty-file"), new File(["webp"], "kulliya.webp", { type: "image/webp" }));
    expect(await screen.findByText(t("admin.mailTemplates.logoUnfit"))).toBeInTheDocument();
    expect(fake.find("post", "/admin/uploads/image")).toHaveLength(0);
  });

  it("إعلانُ أنّ «mail-templates» تغيّرت لا يعيد رسم المعاينة — كانت تعيد نفسها بلا نهاية", async () => {
    const app = await open();
    await waitFor(() => expect(fake.find("post", "/admin/mail-templates/preview")).toHaveLength(1), { timeout: 2000 });
    // What the realtime sync does when the server announces a change (hooks/use-realtime-sync).
    await app.qc.invalidateQueries({ predicate: (q) => q.queryKey.some((part) => part === "mail-templates") });
    await app.settle();
    await new Promise((r) => setTimeout(r, 700));
    expect(fake.find("post", "/admin/mail-templates/preview")).toHaveLength(1);
  });

  it("التجربة ترسل الرسالة المعروضة إلى بريد المسؤول", async () => {
    const app = await open();
    expect(screen.getByTestId("mail-test-hint")).toHaveTextContent(F.mailTemplates.testTo!);
    await app.user.click(screen.getByTestId("mail-group-passwordChanged"));
    await app.user.click(screen.getByTestId("mail-by-admin"));
    await waitFor(() => expect(screen.getByTestId("mail-test")).toBeEnabled(), { timeout: 2000 });
    await waitFor(
      () =>
        expect(fake.find("post", "/admin/mail-templates/preview").at(-1)?.body).toMatchObject({ kind: "passwordChanged", byAdmin: true }),
      { timeout: 2000 },
    );
    await app.user.click(screen.getByTestId("mail-test"));
    await waitFor(() => expect(fake.find("post", "/admin/mail-templates/test")).toHaveLength(1));
    expect(fake.find("post", "/admin/mail-templates/test")[0]!.body).toMatchObject({ kind: "passwordChanged", lang: "ar", byAdmin: true });
  });
});
