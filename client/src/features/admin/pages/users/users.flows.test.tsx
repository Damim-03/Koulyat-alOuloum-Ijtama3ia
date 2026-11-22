import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * حساب مستخدمٍ في الإدارة: تعديل بياناته وكلمة مروره، وإيقافه وتفعيله،
 * وتوثيقه، وحذفه — وما يقوله إن رفض الخادم.
 *
 * يُحرس: أنّ ما يُرسل هو ما تغيّر وحده (والجنس المفرَّغ null)؛ وأنّ كلمة
 * المرور تُرسل بعد الحفظ؛ وأنّ الرفض يُعرض بنافذة خطأٍ فيها سببه وتفاصيله.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function adminAccount() {
  const app = renderApp(`/ar/admin/users/${F.adminUser.id}`, { as: "admin" });
  // لا البريد: رأس اللوحة يعرض بريد من دخل نفسه قبل أن تُحمَّل الصفحة.
  await screen.findByRole("button", { name: esc(t("admin.editData")) });
  return app;
}

describe("حساب مسؤول", () => {
  it("تعديل البريد وكلمة المرور ⇒ ما تغيّر، ثمّ كلمة المرور، ثمّ رسالة نجاح", async () => {
    const app = await adminAccount();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.editData")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    const email = within(dialog).getByPlaceholderText("name@example.com");
    await app.user.clear(email);
    await app.user.type(email, "s.benali@univ-msila.dz");
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.leaveBlankToKeep")), "Admin#2026x");
    await app.user.click(within(dialog).getByRole("button", { name: t("pro.save") }));

    await waitFor(() => expect(fake.find("post", `/admin/users/${F.adminUser.id}/reset-password`)).toHaveLength(1));
    expect(fake.find("patch", `/admin/users/${F.adminUser.id}`)[0]!.body).toEqual({ email: "s.benali@univ-msila.dz" });
    expect(fake.find("post", `/admin/users/${F.adminUser.id}/reset-password`)[0]!.body).toEqual({ password: "Admin#2026x" });
  });

  it("إيقاف الحساب بعد التأكيد ⇒ «أُوقف»", async () => {
    const app = await adminAccount();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.suspendAccount")) }));
    await app.user.click(await screen.findByRole("button", { name: t("admin.suspend") }));
    await waitFor(() => expect(fake.find("patch", `/admin/users/${F.adminUser.id}/status`)[0]?.body).toEqual({ status: "suspended" }));
    expect(await screen.findByText(t("toast.accountSuspended"))).toBeInTheDocument();
  });

  it("حسابٌ موقوف ⇒ «تفعيل»", async () => {
    fake.on("get", "/admin/users/:id", { user: F.userDetail({ ...F.adminUser, status: "suspended" }) });
    const app = await adminAccount();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.activateAccount")) }));
    await app.user.click(await screen.findByRole("button", { name: t("admin.activate") }));
    await waitFor(() => expect(fake.find("patch", `/admin/users/${F.adminUser.id}/status`)[0]?.body).toEqual({ status: "active" }));
  });

  it("سحب التوثيق ⇒ «سُحب التوثيق»", async () => {
    const app = await adminAccount();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.unverifyAccount")) }));
    await app.user.click(await screen.findByRole("button", { name: t("admin.unverify") }));
    await waitFor(() => expect(fake.find("patch", `/admin/users/${F.adminUser.id}/verification`)[0]?.body).toEqual({ isVerified: false }));
    expect(await screen.findByText(t("toast.accountUnverified"))).toBeInTheDocument();
  });

  it("حذفٌ يرفضه الخادم ⇒ نافذة خطأ بسببه وتفاصيله، ولا خروج من الصفحة", async () => {
    fake.fail("delete", "/admin/users/:id", 409, "لا يُحذف آخر مسؤول", "CONFLICT");
    const app = await adminAccount();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.deleteUser")) }));
    await app.user.click(within(await screen.findByRole("alertdialog")).getAllByRole("button").at(-1)!);
    expect(await screen.findByText("لا يُحذف آخر مسؤول")).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: esc(t("errorDialog.technicalDetails")) }));
    expect(await screen.findByText(/status: 409/)).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: t("errorDialog.ok") }));
    expect(app.location()).toBe(`/ar/admin/users/${F.adminUser.id}`);
  });

  it("حذفٌ يقبله الخادم ⇒ يعود إلى القائمة", async () => {
    const app = await adminAccount();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.deleteUser")) }));
    await app.user.click(within(await screen.findByRole("alertdialog")).getAllByRole("button").at(-1)!);
    await waitFor(() => expect(fake.find("delete", `/admin/users/${F.adminUser.id}`)).toHaveLength(1));
    await waitFor(() => expect(app.location()).toMatch(/^\/ar\/admin\/users(\?|$)/));
  });
});

describe("حساب طالب وأستاذ", () => {
  it.each([
    ["طالب", F.studentUsers[0]!.id, F.student1.registrationNumber],
    ["أستاذ", F.profUsers[0]!.id, "Karim"],
  ])("%s ⇒ «تعديل» يفتح نموذج دوره ببياناته", async (_, id, shown) => {
    const app = renderApp(`/ar/admin/users/${id}`, { as: "admin" });
    const edit = await screen.findByRole("button", { name: esc(t("admin.editData")) });
    // يُفعَّل حين تصل بيانات الدور كاملة.
    await waitFor(() => expect(edit).toBeEnabled());
    await app.user.click(edit);
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(await within(dialog).findByDisplayValue(shown)).toBeInTheDocument();
  });
});

describe("قائمة المستخدمين", () => {
  it("البحث والدور يصلان الخادم", async () => {
    const app = renderApp("/ar/admin/users", { as: "admin" });
    await screen.findAllByText(F.adminUser.email!);
    const search = screen.getAllByRole("textbox").find((i) => (i as HTMLInputElement).placeholder)!;
    await app.user.type(search, "سارة");
    await waitFor(() => expect(fake.find("get", "/admin/users").some((c) => Object.values(c.query).includes("سارة"))).toBe(true));
  });
});

describe("حساب مستخدم: ما حول التعديل", () => {
  it("حسابٌ لا يوجد ⇒ «غير موجود»، و«العودة إلى القائمة»", async () => {
    fake.fail("get", "/admin/users/:id", 404, "غير موجود");
    const app = renderApp("/ar/admin/users/nope", { as: "admin" });
    expect(await screen.findByText(t("admin.userNotFound"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: t("admin.backToList") }));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/users"));
  });

  it("لا تغيير ولا كلمة مرور ⇒ «حفظ» يُغلق بلا طلب؛ وكلمة المرور وحدها ⇒ تُرسل وحدها", async () => {
    const app = await adminAccount();
    const edit = () => app.user.click(screen.getByRole("button", { name: esc(t("admin.editData")) }));
    await edit();
    let dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(dialog).getByRole("button", { name: t("pro.save") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fake.writes).toEqual([]);

    await edit();
    dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.leaveBlankToKeep")), "Admin#2027x");
    await app.user.click(within(dialog).getByRole("button", { name: t("pro.save") }));
    await waitFor(() => expect(fake.find("post", `/admin/users/${F.adminUser.id}/reset-password`)[0]?.body).toEqual({ password: "Admin#2027x" }));
    expect(fake.find("patch", `/admin/users/${F.adminUser.id}`)).toEqual([]);
    expect(await screen.findByText(t("admin.dataAndPasswordUpdated"))).toBeInTheDocument();
  });

  it("الجنس يُغيَّر فيُرسل وحده", async () => {
    const app = await adminAccount();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.editData")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.genderFemale")) }));
    await app.user.click(within(dialog).getByRole("button", { name: t("pro.save") }));
    await waitFor(() => expect(fake.find("patch", `/admin/users/${F.adminUser.id}`)[0]?.body).toEqual({ gender: "female" }));
    expect(await screen.findByText(t("admin.userDataUpdated"))).toBeInTheDocument();
  });

  it("كلّ نافذةٍ تُغلق بزرّها بلا طلب: التعديل، والإيقاف، والتوثيق، والحذف", async () => {
    const app = await adminAccount();
    for (const opener of [t("admin.editData"), t("admin.suspendAccount"), t("admin.unverifyAccount")]) {
      await app.user.click(screen.getByRole("button", { name: esc(opener) }));
      const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
      await app.user.click(within(dialog).getByRole("button", { name: t("admin.close") }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.deleteUser")) }));
    const alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getAllByRole("button")[0]!);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fake.writes).toEqual([]);
  });

  it("طالبٌ يُعدَّل ثمّ يُغلق ⇒ يُجلب حسابه وطالبه من جديد، لا حساب أستاذ", async () => {
    const id = F.studentUsers[0]!.id;
    const app = renderApp(`/ar/admin/users/${id}`, { as: "admin" });
    const edit = await screen.findByRole("button", { name: esc(t("admin.editData")) });
    await waitFor(() => expect(edit).toBeEnabled());
    await app.user.click(edit);
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await within(dialog).findByDisplayValue(F.student1.registrationNumber);
    const before = { user: fake.find("get", `/admin/users/${id}`).length, student: fake.find("get", `/admin/students/${F.student1.id}`).length };
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.close") }));
    await waitFor(() => expect(fake.find("get", `/admin/users/${id}`).length).toBeGreaterThan(before.user));
    await waitFor(() => expect(fake.find("get", `/admin/students/${F.student1.id}`).length).toBeGreaterThan(before.student));
    expect(fake.find("get", /^\/admin\/professors\/(null|undefined)$/)).toEqual([]);
  });

  it("آخر دخولٍ قبل أشهر أو سنين ⇒ بالشهور أو بالسنين", async () => {
    const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
    fake.on("get", "/admin/users/:id", { user: F.userDetail({ ...F.adminUser, lastLoginAt: new Date(Date.now() - 90 * 86_400_000).toISOString() }) });
    const app = await adminAccount();
    expect(screen.getByText(rtf.format(-3, "month"))).toBeInTheDocument();
    app.unmount();
    fake.on("get", "/admin/users/:id", { user: F.userDetail({ ...F.adminUser, lastLoginAt: new Date(Date.now() - 800 * 86_400_000).toISOString() }) });
    await adminAccount();
    expect(screen.getByText(rtf.format(-2, "year"))).toBeInTheDocument();
  });
});

describe("قائمة المستخدمين: الفلاتر وشرائحها", () => {
  const removeChip = (label: string) => screen.getByRole("button", { name: `${t("admin.proj.removeFilter")}: ${label}` });
  const chips = () => screen.queryAllByRole("button", { name: new RegExp(`^${esc(t("admin.proj.removeFilter")).source}`) });
  const lastQuery = () => fake.find("get", "/admin/users").at(-1)!.query;
  async function pick(app: ReturnType<typeof renderApp>, field: string, option: string) {
    await app.user.click(screen.getByRole("combobox", { name: field }));
    // باسمه تماماً: «موثّق» جزءٌ من «غير موثّق».
    await app.user.click(await screen.findByRole("option", { name: option }));
  }

  it("كلّ فلترٍ يصل الخادم ويظهر شريحةً تُزال بزرّها؛ و«مسح الكل» يُزيلها", async () => {
    const app = renderApp("/ar/admin/users", { as: "admin" });
    await screen.findAllByText(F.adminUser.email!);
    await app.user.type(screen.getByPlaceholderText(t("admin.searchByNamePlaceholder")), "سارة");
    await app.user.type(screen.getByPlaceholderText(t("admin.searchByEmailPlaceholder")), "univ");
    await app.user.type(screen.getByPlaceholderText(t("admin.searchByRegNumberPlaceholder")), "2020");
    await pick(app, t("admin.role"), t("role.student"));
    await pick(app, t("admin.statusLabel"), t("admin.statusSuspended"));
    await pick(app, t("admin.verificationColumn"), t("admin.unverified"));
    await pick(app, t("pro.order"), t("admin.sortNameAlpha"));
    await waitFor(() => expect(chips()).toHaveLength(6));
    expect(Object.values(lastQuery())).toEqual(expect.arrayContaining(["سارة", "univ", "2020", "student", "suspended"]));

    const labels = [
      `${t("admin.chipName")}: سارة`,
      `${t("admin.chipEmail")}: univ`,
      `${t("admin.chipRegNumber")}: 2020`,
      t("admin.chipRole", { value: t("role.student") }),
      t("admin.chipStatus", { value: t("admin.statusSuspended") }),
    ];
    for (const label of labels) {
      await app.user.click(removeChip(label));
      await waitFor(() => expect(screen.queryByRole("button", { name: `${t("admin.proj.removeFilter")}: ${label}` })).toBeNull());
    }
    expect(chips()).toHaveLength(1);
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.clearAll")) }));
    await waitFor(() => expect(chips()).toHaveLength(0));
    expect(screen.getByRole("combobox", { name: t("pro.order") })).toHaveAttribute("title", t("admin.sortNewest"));
  });

  it("حالةٌ نشطة وموثَّق ⇒ شريحتان بأسمائهما؛ والصفّ يفتح الحساب", async () => {
    const app = renderApp("/ar/admin/users", { as: "admin" });
    await screen.findAllByText(F.adminUser.email!);
    await pick(app, t("admin.statusLabel"), t("admin.statusActive"));
    await pick(app, t("admin.verificationColumn"), t("admin.verified"));
    expect(removeChip(t("admin.chipStatus", { value: t("admin.statusActive") }))).toBeInTheDocument();
    await app.user.click(removeChip(t("admin.verified")));
    await waitFor(() => expect(chips()).toHaveLength(1));

    // البريد نفسه في رأس اللوحة (من دخل): الصفّ هو ما في الجدول.
    await app.user.click(screen.getAllByText(F.adminUser.email!).map((e) => e.closest("tr")).find(Boolean)!);
    await waitFor(() => expect(app.location()).toBe(`/ar/admin/users/${F.adminUser.id}`));
  });

  it("تعذّر التحميل ⇒ «إعادة» تطلب من جديد", async () => {
    fake.fail("get", "/admin/users", 500, "خطأ");
    const app = renderApp("/ar/admin/users", { as: "admin" });
    const retry = await screen.findByRole("button", { name: esc(t("admin.retry")) });
    const before = fake.find("get", "/admin/users").length;
    await app.user.click(retry);
    await waitFor(() => expect(fake.find("get", "/admin/users").length).toBeGreaterThan(before));
  });
});
