import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * واجهة الموقع في لوحة الإدارة — ما يراه الزائر أوّلاً، يُكتب هنا.
 *
 * كلّ تبويبٍ استمارة: تُعدَّل فيُفعَّل «حفظ» و«تراجع»، والعربية أصلٌ لا يُحفظ
 * ناقصاً، والحفظ يرسل الصفحة كاملةً بما تغيّر. والأخبار والصور قوائم: تُنشر
 * وتُخفى وتُرتَّب وتُحذف بعد سؤال.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const panel = () => screen.getAllByRole("tabpanel").find((p) => !p.hidden)!;

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("التبويبات", () => {
  it("التبويب في الرابط، وما زير يبقى بما كُتب فيه", async () => {
    const app = renderApp("/ar/admin/homepage", { as: "admin" });
    await app.user.click(await screen.findByRole("tab", { name: esc(t("admin.site.tabDirector")) }));
    expect(app.location()).toBe("/ar/admin/homepage?tab=director");
    const title = await screen.findByDisplayValue("مرحباً بكم");
    await app.user.type(title, " جميعاً");

    await app.user.click(screen.getByRole("tab", { name: esc(t("admin.site.tabNews")) }));
    expect(app.location()).toBe("/ar/admin/homepage?tab=news");
    await app.user.click(screen.getByRole("tab", { name: esc(t("admin.site.tabDirector")) }));
    expect(screen.getByDisplayValue("مرحباً بكم جميعاً")).toBeInTheDocument();
  });
});

describe("كلمة رئيس القسم", () => {
  it("تعديلٌ ⇒ «حفظ» يرسل الكلمة كاملةً بما تغيّر", async () => {
    const app = renderApp("/ar/admin/homepage?tab=director", { as: "admin" });
    const save = await screen.findAllByRole("button", { name: esc(t("admin.director.save")) });
    expect(save[0]).toBeDisabled();

    const title = await screen.findByDisplayValue("مرحباً بكم");
    await app.user.clear(title);
    await app.user.type(title, "أهلاً بالطلبة");
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.director.save")) })[0]!);

    await waitFor(() => expect(fake.find("put", "/admin/director-message")).toHaveLength(1));
    const body = fake.find("put", "/admin/director-message")[0]!.body as typeof F.director;
    expect(body.ar.title).toBe("أهلاً بالطلبة");
    expect(body.ar.fullName).toBe(F.director.ar.fullName);
    expect(body.isVisible).toBe(true);
    expect(await screen.findByText(t("admin.director.toastSaved"))).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button", { name: esc(t("admin.director.save")) })[0]).toBeDisabled());
  });

  it("حقلٌ عربيٌّ مطلوب فارغ ⇒ لا حفظ، ويُعلَّم مكانه", async () => {
    const app = renderApp("/ar/admin/homepage?tab=director", { as: "admin" });
    const name = await screen.findByDisplayValue(F.director.ar.fullName);
    await app.user.clear(name);
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.director.save")) })[0]!);
    expect(await screen.findByText(t("admin.director.arabicRequired"))).toBeInTheDocument();
    expect(screen.getAllByText(t("admin.site.required")).length).toBeGreaterThan(0);
    expect(fake.find("put", "/admin/director-message")).toEqual([]);
  });

  it("«تراجع» يعيد ما كان محفوظاً", async () => {
    const app = renderApp("/ar/admin/homepage?tab=director", { as: "admin" });
    const quote = await screen.findByDisplayValue(F.director.ar.quote);
    await app.user.type(quote, "!!");
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.site.undo")) })[0]!);
    expect(screen.getByDisplayValue(F.director.ar.quote)).toBeInTheDocument();
  });

  it("إخفاء القسم يُحفظ معه", async () => {
    const app = renderApp("/ar/admin/homepage?tab=director", { as: "admin" });
    await screen.findByDisplayValue("مرحباً بكم");
    await app.user.click(within(panel()).getByRole("switch", { name: esc(t("admin.director.sectionShown")) }));
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.director.save")) })[0]!);
    await waitFor(() => expect(fake.find("put", "/admin/director-message")[0]?.body).toMatchObject({ isVisible: false }));
  });

  it.each([
    ["بنوعٍ غير مدعوم", new File(["x"], "cv.pdf", { type: "application/pdf" }), "admin.slides.badType"],
    ["لا تُقرأ", new File(["BROKEN png"], "photo.png", { type: "image/png" }), "admin.slides.unreadable"],
  ])("صورةٌ %s ⇒ تُرفض قبل الرفع، بسببها", async (_, file, reason) => {
    renderApp("/ar/admin/homepage?tab=director", { as: "admin" });
    await screen.findByDisplayValue("مرحباً بكم");
    // لا عبر `user.upload`: يُسقط ما لا يطابق `accept` قبل أن يصل الصفحة.
    fireEvent.change(panel().querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(await screen.findByText(t(reason))).toBeInTheDocument();
    expect(fake.find("post", "/admin/uploads/image")).toEqual([]);
  });

  it("صورةٌ صالحة ⇒ تُرفع، وتُحفظ مع الكلمة، و«الافتراضية» تعيدها", async () => {
    const app = renderApp("/ar/admin/homepage?tab=director", { as: "admin" });
    await screen.findByDisplayValue("مرحباً بكم");
    await app.user.upload(panel().querySelector('input[type="file"]') as HTMLInputElement, new File(["png"], "me.png", { type: "image/png" }));
    await waitFor(() => expect(fake.find("post", "/admin/uploads/image")).toHaveLength(1));
    expect(fake.find("post", "/admin/uploads/image")[0]!.body).toMatchObject({ image: expect.any(File) });
    await app.user.click((await screen.findAllByRole("button", { name: esc(t("admin.director.save")) }))[0]!);
    await waitFor(() => expect(fake.find("put", "/admin/director-message")[0]?.body).toMatchObject({ photoUrl: "/uploads/cards/new.jpg" }));
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.director.resetPhoto")) }));
    expect(screen.getByText(t("admin.director.defaultPhoto"))).toBeInTheDocument();
  });

  it("الترجمة الفارغة تُعرض بالعربية — ويقال ذلك في الحقل", async () => {
    fake.on("get", "/admin/director-message", { director: { ...F.director, fr: { ...F.director.fr, title: "" } } });
    const app = renderApp("/ar/admin/homepage?tab=director", { as: "admin" });
    await screen.findByDisplayValue("مرحباً بكم");
    await app.user.click(within(panel()).getByRole("tab", { name: /Français/ }));
    expect(screen.getByPlaceholderText(esc(`${t("admin.site.fallsBackTo")} مرحباً بكم`))).toBeInTheDocument();
  });
});

describe("عن المنصة وصفحة الدخول", () => {
  it("عن المنصة: تعديل العنوان يُحفظ بالصفحة كلّها", async () => {
    const app = renderApp("/ar/admin/homepage?tab=about", { as: "admin" });
    const title = await screen.findByDisplayValue(F.about.ar.title);
    await app.user.type(title, " الجامعية");
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.about.save")) })[0]!);
    await waitFor(() => expect(fake.find("put", "/admin/about-page")).toHaveLength(1));
    const body = fake.find("put", "/admin/about-page")[0]!.body as typeof F.about;
    expect(body.ar.title).toBe(`${F.about.ar.title} الجامعية`);
    expect(body.ar.features).toEqual(F.about.ar.features);
    expect(await screen.findByText(t("admin.about.toastSaved"))).toBeInTheDocument();
  });

  it("عن المنصة: جزء الصور وجزء الخلفية بصورهما", async () => {
    const app = renderApp("/ar/admin/homepage?tab=about", { as: "admin" });
    await app.user.click(await screen.findByRole("tab", { name: esc(t("admin.about.partImages")) }));
    expect(app.location()).toBe("/ar/admin/homepage?tab=about&part=images");
    await waitFor(() => expect(fake.find("get", "/admin/home-slides").some((c) => c.query.placement === "about")).toBe(true));
    await app.user.click(screen.getByRole("tab", { name: esc(t("admin.about.partBackground")) }));
    await waitFor(() => expect(fake.find("get", "/admin/home-slides").some((c) => c.query.placement === "aboutHero")).toBe(true));
  });

  it("صفحة الدخول: الترحيب يُحفظ", async () => {
    const app = renderApp("/ar/admin/homepage?tab=login", { as: "admin" });
    const welcome = await screen.findByDisplayValue(F.loginContent.ar.welcome);
    await app.user.clear(welcome);
    await app.user.type(welcome, "أهلاً بك");
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.loginPage.save")) })[0]!);
    await waitFor(() => expect((fake.find("put", "/admin/login-page")[0]?.body as typeof F.loginContent)?.ar.welcome).toBe("أهلاً بك"));
    expect(await screen.findByText(t("admin.loginPage.toastSaved"))).toBeInTheDocument();
  });

  it("صفحة الدخول: الجامعة فارغة ⇒ لا حفظ", async () => {
    const app = renderApp("/ar/admin/homepage?tab=login", { as: "admin" });
    await app.user.clear(await screen.findByDisplayValue(F.loginContent.ar.university));
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.loginPage.save")) })[0]!);
    expect(await screen.findByText(t("admin.loginPage.arabicRequired"))).toBeInTheDocument();
    expect(fake.find("put", "/admin/login-page")).toEqual([]);
  });
});

describe("النصوص", () => {
  it("البحث يجد العبارة، وتغييرها يُحفظ بمفتاحها وحده", async () => {
    const app = renderApp("/ar/admin/homepage?tab=texts", { as: "admin" });
    const search = await screen.findByPlaceholderText(t("admin.texts.search"));
    await app.user.type(search, "منصة إدارة مذكرات");
    const field = await screen.findByDisplayValue(t("hero.title"));
    await app.user.clear(field);
    await app.user.type(field, "منصّة المذكّرات");
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.texts.save")) })[0]!);
    await waitFor(() => expect(fake.find("put", "/admin/site-texts")).toHaveLength(1));
    const body = fake.find("put", "/admin/site-texts")[0]!.body as { ar: Record<string, string>; fr: object; hidden: string[] };
    expect(body.ar).toEqual({ "hero.title": "منصّة المذكّرات" });
    expect(body.hidden).toEqual([]);
  });
});

describe("آخر الأخبار", () => {
  it("خبرٌ جديد بنصّه وتاريخه ⇒ يُنشر", async () => {
    const app = renderApp("/ar/admin/homepage?tab=news", { as: "admin" });
    await app.user.click((await screen.findAllByRole("button", { name: esc(t("admin.news.add")) }))[0]!);
    const text = await screen.findByPlaceholderText(t("admin.news.textPlaceholder"));
    await app.user.type(text, "تمديد آجال التسجيل");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.news.publish")) }));
    await waitFor(() => expect(fake.find("post", "/admin/news")).toHaveLength(1));
    expect(fake.find("post", "/admin/news")[0]!.body).toMatchObject({ text: "تمديد آجال التسجيل" });
    expect((fake.find("post", "/admin/news")[0]!.body as { date: string }).date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("رابطٌ لا يصلح ⇒ يُقال، ولا يُنشر", async () => {
    const app = renderApp("/ar/admin/homepage?tab=news", { as: "admin" });
    await app.user.click((await screen.findAllByRole("button", { name: esc(t("admin.news.add")) }))[0]!);
    await app.user.type(await screen.findByPlaceholderText(t("admin.news.textPlaceholder")), "خبر");
    await app.user.type(screen.getByPlaceholderText(/topics/), "javascript:alert(1)");
    expect(await screen.findByText(t("admin.news.linkInvalid"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.news.publish")) }));
    expect(fake.find("post", "/admin/news")).toEqual([]);
  });

  it("الإخفاء من الشريط والحذف بعد السؤال", async () => {
    const app = renderApp("/ar/admin/homepage?tab=news", { as: "admin" });
    await screen.findAllByText(F.news[0]!.text);
    await app.user.click(screen.getAllByRole("switch", { name: esc(t("admin.news.showInTicker")) })[0]!);
    await waitFor(() => expect(fake.find("patch", "/admin/news/n1")[0]?.body).toEqual({ isActive: false }));

    await app.user.click(screen.getAllByRole("button", { name: t("admin.delete") })[0]!);
    expect(fake.find("delete", /^\/admin\/news\//)).toEqual([]);
    const confirm = await screen.findAllByRole("button", { name: esc(t("admin.delete")) });
    await app.user.click(confirm.at(-1)!);
    await waitFor(() => expect(fake.find("delete", "/admin/news/n1")).toHaveLength(1));
  });

  it("تعديل خبرٍ يُرسل إلى مساره", async () => {
    const app = renderApp("/ar/admin/homepage?tab=news", { as: "admin" });
    await screen.findAllByText(F.news[0]!.text);
    await app.user.click(screen.getAllByRole("button", { name: t("admin.edit") })[0]!);
    const text = await screen.findByDisplayValue(F.news[0]!.text);
    await app.user.type(text, " الجديدة");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.slides.saveChanges")) }));
    await waitFor(() => expect(fake.find("patch", "/admin/news/n1")[0]?.body).toMatchObject({ text: `${F.news[0]!.text} الجديدة` }));
  });
});

describe("صور الرئيسية", () => {
  it("إخفاء صورة، وتأخيرها، وحذفها بعد السؤال", async () => {
    const app = renderApp("/ar/admin/homepage", { as: "admin" });
    await screen.findAllByText("حفل التخرّج");
    await app.user.click(within(panel()).getAllByRole("switch")[0]!);
    await waitFor(() => expect(fake.find("patch", "/admin/home-slides/sl1")[0]?.body).toEqual({ isActive: false }));

    await app.user.click(screen.getAllByRole("button", { name: t("admin.slides.moveLater") })[0]!);
    await waitFor(() => expect(fake.find("patch", "/admin/home-slides/order")[0]?.body).toEqual({ ids: ["sl2", "sl1"], placement: "home" }));

    await app.user.click(screen.getAllByRole("button", { name: t("admin.delete") })[0]!);
    expect(await screen.findByText(t("admin.slides.deleteTitle"))).toBeInTheDocument();
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.delete")) }).at(-1)!);
    await waitFor(() => expect(fake.find("delete", "/admin/home-slides/sl1")).toHaveLength(1));
  });

  it("بلا صور ⇒ دعوةٌ لإضافة الأولى", async () => {
    fake.empty = true;
    renderApp("/ar/admin/homepage", { as: "admin" });
    expect(await screen.findByText(t("admin.slides.addFirst"))).toBeInTheDocument();
  });
});

describe("النصوص: الإخفاء والتحقّق والإرجاع", () => {
  async function texts() {
    const app = renderApp("/ar/admin/homepage?tab=texts", { as: "admin" });
    const search = await screen.findByPlaceholderText(t("admin.texts.search"));
    return { app, search };
  }
  const save = () => screen.getAllByRole("button", { name: esc(t("admin.texts.save")) })[0]!;

  it("بريدٌ لا يصلح في التذييل ⇒ لا حفظ، ويُنقل إليه بسببه", async () => {
    const { app, search } = await texts();
    await app.user.type(search, String(i18n.t("footer.email")));
    // والبحث نفسه يحمل العنوان: الحقل غيره.
    const email = (await within(panel()).findAllByDisplayValue(String(i18n.t("footer.email")))).find((el) => el !== search)!;
    await app.user.clear(email);
    await app.user.type(email, "ليس-بريداً");
    await app.user.click(save());
    expect(await screen.findByText(t("admin.texts.fixErrors"))).toBeInTheDocument();
    expect(fake.find("put", "/admin/site-texts")).toEqual([]);
  });

  it("عبارةٌ تُغيَّر ثمّ «إرجاع» يعيدها إلى أصلها، و«المعدَّلة وحدها» تحصر القائمة", async () => {
    const { app, search } = await texts();
    await app.user.type(search, "منصة إدارة مذكرات");
    const field = await screen.findByDisplayValue(t("hero.title"));
    await app.user.type(field, "!");
    await app.user.clear(search);
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.texts.onlyChanged")) }));
    expect(screen.getByDisplayValue(`${t("hero.title")}!`)).toBeInTheDocument();
    await app.user.click(screen.getAllByTitle(t("admin.texts.reset"))[0]!);
    expect(screen.queryByDisplayValue(`${t("hero.title")}!`)).toBeNull();
  });

  it("إخفاء عنصرٍ من الموقع يُحفظ في «hidden» للّغات كلّها، و«تراجع» يلغيه", async () => {
    const { app } = await texts();
    // مفاتيح الإظهار في التبويب — لا مفتاح السمة في رأس اللوحة.
    const toggles = () => within(panel()).getAllByRole("switch");
    await waitFor(() => expect(toggles().length).toBeGreaterThan(0));
    await app.user.click(toggles()[0]!);
    expect(toggles()[0]).toHaveAttribute("aria-checked", "false");
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.site.undo")) })[0]!);
    expect(toggles()[0]).toHaveAttribute("aria-checked", "true");

    await app.user.click(toggles()[0]!);
    await app.user.click(save());
    await waitFor(() => expect(fake.find("put", "/admin/site-texts")).toHaveLength(1));
    expect((fake.find("put", "/admin/site-texts")[0]!.body as { hidden: string[] }).hidden.length).toBe(1);
  });

  it("الأقسام والتبديل إلى الفرنسية: عبارةٌ فرنسية تُحفظ في لغتها", async () => {
    const { app } = await texts();
    const nav = screen.getByRole("navigation", { name: t("admin.texts.sections") });
    const sections = within(nav).getAllByRole("button");
    await app.user.click(sections.at(-1)!);
    expect(app.location()).toContain("part=");
    await app.user.click(sections[0]!);
    await app.user.click(screen.getAllByRole("tab", { name: /Français/ })[0]!);
    const fr = screen.getAllByRole("textbox").find((x) => (x as HTMLInputElement).dir === "ltr" && (x as HTMLInputElement).value)! as HTMLInputElement;
    await app.user.type(fr, " !");
    await app.user.click(save());
    await waitFor(() => expect(Object.keys((fake.find("put", "/admin/site-texts")[0]!.body as { fr: object }).fr).length).toBe(1));
  });
});
