import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * صفحة التفعيل: رأسٌ يقول أين يقف الطلبة، و«الطلبة» — يُعثر فيه على الطالب
 * بالبطاقة أو الرقم أو الاسم أو الفلتر، فيظهر ملفّه كاملاً.
 *
 * يُحرس: أنّ أرقام الرأس أزرارٌ إلى ما تعدّه؛ وأنّ الرابط والرقم يفتحان ملفّ
 * صاحبهما — ولو بلا Enter، ولو لم يكن الحقل محدّداً — وأنّ ما سواهما بحثٌ
 * بالاسم؛ وأنّ الفلتر يصل الخادم ويسكن الرابط ويُطوى؛ وأنّ الملفّ يعرض البيانات
 * الشخصية والأكاديمية والمواضيع والنشاط، ولا رمز تفعيلٍ فيه؛ وأنّ الكاميرا حين
 * لا تتاح تقول السبب.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const lastStudents = () => fake.find("get", "/admin/activation/students").at(-1)!.query;

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function desk(path = "/ar/admin/users?view=desk") {
  const app = renderApp(path, { as: "admin" });
  const input = await screen.findByTestId("desk-input");
  return { app, input };
}

describe("رأس الصفحة", () => {
  it("يقول هل التفعيل مشترط، وأين يقف الطلبة؛ و«لم يُفعَّلوا» يفتح قائمتهم", async () => {
    const app = renderApp("/ar/admin/users?view=requests", { as: "admin" });
    const settings = await screen.findByTestId("desk-settings");
    expect(settings).toHaveTextContent(t("admin.activation.notRequired"));
    const stats = screen.getByTestId("desk-stats");
    expect(stats).toHaveTextContent("37");
    expect(stats).toHaveTextContent(t("admin.activation.stats.ofStudents", { count: 120 }));
    // Activated: everyone who chose a password — 120 less the 37.
    expect(within(stats).getByRole("button", { name: new RegExp(t("admin.activation.stats.activated")) })).toHaveTextContent("83");

    await app.user.click(within(stats).getByRole("button", { name: new RegExp(t("admin.activation.stats.notActivated")) }));
    await waitFor(() => expect(app.location()).toContain("state=notActivated"));
    expect(app.location()).toContain("view=desk");
    await waitFor(() => expect(lastStudents()).toMatchObject({ state: "notActivated" }));
  });
});

describe("الطلبة", () => {
  it("رابط رمز البطاقة ⇒ ملفّ صاحبه كاملاً، ولا رمز تفعيلٍ فيه", async () => {
    const { app, input } = await desk();
    // No file open: the list alone, the whole width.
    expect(screen.getByTestId("desk-list")).toHaveAttribute("data-wide", "true");
    expect(screen.queryByTestId("desk-file")).toBeNull();
    // In one go, as a QR reader delivers it (typing it key by key is slow under a loaded run).
    await app.user.click(input);
    await app.user.paste(`https://progres.mesrs.dz/check/${F.deskStudent.registrationNumber}`);
    await app.user.keyboard("{Enter}");

    await waitFor(() => expect(fake.find("get", "/admin/activation/student")[0]?.query).toEqual({ registrationNumber: F.deskStudent.registrationNumber }));
    const profile = await screen.findByTestId("student-profile");
    await waitFor(() => expect(app.location()).toContain(`student=${F.deskStudent.id}`));
    // Who they are, where they study, what they asked for, what the account did.
    expect(profile).toHaveTextContent("ليلى بوزيد");
    expect(profile).toHaveTextContent(F.studentProfile.personal.email!);
    expect(profile).toHaveTextContent(F.studentProfile.academic.faculty);
    expect(profile).toHaveTextContent(F.studentProfile.academic.department);
    expect(within(screen.getByTestId("profile-requests")).getByText(F.studentProfile.requests[0]!.topic.title)).toBeInTheDocument();
    expect(screen.getByTestId("profile-requests")).toHaveTextContent(t("admin.activation.profile.role.leader"));
    expect(screen.getByTestId("profile-activity")).toHaveTextContent(t("admin.audit.op.auth_loginFailed"));

    // The student activates with photos, reviewed in «طلبات التفعيل»: nothing to hand out here.
    expect(screen.queryByTestId("desk-action")).toBeNull();
    expect(screen.queryByTestId("desk-issue")).toBeNull();
  });

  it("ما ليس رقماً ⇒ بحثٌ بالاسم في القائمة، لا بحثٌ برقم", async () => {
    const { app, input } = await desk();
    await app.user.type(input, "يوسف{Enter}");
    await waitFor(() => expect(lastStudents()).toMatchObject({ q: "يوسف" }));
    expect(fake.find("get", "/admin/activation/student")).toHaveLength(0);
    const rows = await screen.findAllByTestId("finder-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("يوسف حمادي");

    await app.user.click(rows[0]!);
    await waitFor(() => expect(app.location()).toContain("student=desk-student-2"));
    expect(await screen.findByTestId("student-profile")).toBeInTheDocument();
  });

  /** القائمة تملأ العرض حتى يُفتح ملفّ؛ فتضيق إلى جانبه، ويُغلق الملفّ بزرّه أو بـEsc فتعود. */
  it("فتح ملفٍّ يضيّق القائمة إلى جانبه؛ وإغلاقه — بزرّه أو بـEsc — يعيدها إلى العرض كلّه", async () => {
    const { app } = await desk();
    const list = screen.getByTestId("desk-list");
    const rows = await screen.findAllByTestId("finder-row");
    await app.user.click(rows[0]!);
    expect(await screen.findByTestId("student-profile")).toBeInTheDocument();
    expect(list).toHaveAttribute("data-wide", "false");

    await app.user.click(screen.getByTestId("desk-close"));
    await waitFor(() => expect(screen.queryByTestId("desk-file")).toBeNull());
    expect(list).toHaveAttribute("data-wide", "true");
    expect(app.location()).not.toContain("student=");

    await app.user.click((await screen.findAllByTestId("finder-row"))[1]!);
    await screen.findByTestId("student-profile");
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("desk-file")).toBeNull());
    expect(app.location()).not.toContain("student=");
  });

  it("رقمٌ لا طالب له ⇒ بحثٌ به في القائمة، بلا خطأ", async () => {
    const { app, input } = await desk();
    await app.user.type(input, "999000111{Enter}");
    await waitFor(() => expect(lastStudents()).toMatchObject({ q: "999000111" }));
    expect(await screen.findByText(t("admin.activation.finder.none"))).toBeInTheDocument();
    expect(screen.queryByText("الطالب غير موجود.")).toBeNull();
  });

  it("فلتر الحال قائمةٌ بأعدادها، يصل الخادم ويسكن الرابط، و«مسح الفلتر» يعيده", async () => {
    const { app } = await desk();
    await app.user.click(screen.getByRole("combobox", { name: t("admin.activation.finder.stateLabel") }));
    const verified = await screen.findByRole("option", { name: new RegExp(`^${t("admin.activation.finder.state.verified")}`) });
    expect(verified).toHaveTextContent("54");
    await app.user.click(verified);
    await waitFor(() => expect(lastStudents()).toMatchObject({ state: "verified" }));
    expect(app.location()).toContain("state=verified");
    const rows = await screen.findAllByTestId("finder-row");
    expect(rows).toHaveLength(1);

    await app.user.click(screen.getByRole("button", { name: new RegExp(t("admin.activation.finder.reset")) }));
    // The whole list again (from the cache — it was fetched first).
    await waitFor(() => expect(screen.getAllByTestId("finder-row")).toHaveLength(F.deskStudents.length));
    expect(app.location()).not.toContain("state=");
  });

  it("رقم التسجيل وحده — بلا Enter — يفتح صاحبه، مرّةً واحدة", async () => {
    const { app, input } = await desk();
    await app.user.type(input, F.deskStudent.registrationNumber);
    expect(await screen.findByTestId("student-profile")).toBeInTheDocument();
    await waitFor(() => expect(app.location()).toContain(`student=${F.deskStudent.id}`));
    expect(fake.find("get", "/admin/activation/student")).toHaveLength(1);
    // The list holds that student too, and the number is selected: the next card replaces it.
    await waitFor(() => expect(lastStudents()).toMatchObject({ q: F.deskStudent.registrationNumber }));
    await waitFor(() => expect((input as HTMLInputElement).selectionEnd! - (input as HTMLInputElement).selectionStart!).toBe(F.deskStudent.registrationNumber.length));
  });

  it("الحقل يستقبل القارئ ولو كان التركيز خارجه", async () => {
    const { app, input } = await desk();
    expect(screen.getByTestId("desk-listening")).toHaveTextContent(t("admin.activation.finder.ready"));
    await app.user.click(document.body);
    expect(input).not.toHaveFocus();
    expect(screen.getByTestId("desk-listening")).toHaveTextContent(t("admin.activation.finder.listening"));

    // A reader types the number, then Enter — while nothing holds the focus.
    await app.user.keyboard(`${F.deskStudent.registrationNumber}{Enter}`);
    expect(input).toHaveFocus();
    expect(input).toHaveValue(F.deskStudent.registrationNumber);
    expect(await screen.findByTestId("student-profile")).toBeInTheDocument();
    expect(fake.find("get", "/admin/activation/student")[0]?.query).toEqual({ registrationNumber: F.deskStudent.registrationNumber });
  });

  it("ما يُكتب في حقلٍ آخر يبقى له؛ والزرّ ليس حقلاً", async () => {
    const { app } = await desk(`/ar/admin/users?view=desk&student=${F.deskStudent.id}`);
    await screen.findByTestId("student-profile");
    const other = document.createElement("input");
    document.body.append(other);
    await app.user.click(other);
    await app.user.keyboard("12");
    expect(other).toHaveValue("12");
    expect(screen.getByTestId("desk-input")).toHaveValue("");
    other.remove();

    // Focus on a button (the filter's fold): a key pressed there belongs to the scan field.
    await app.user.click(screen.getByTestId("desk-filter-toggle"));
    await app.user.keyboard("7");
    expect(screen.getByTestId("desk-input")).toHaveValue("7");
  });

  it("رابطٌ من القارئ برقمٍ لا طالب له ⇒ يُقال، لا يُبحث به صامتاً", async () => {
    const { app, input } = await desk();
    await app.user.click(input);
    await app.user.paste("https://progres.mesrs.dz/check/999000111");
    await app.user.keyboard("{Enter}");
    expect(await screen.findByText("الطالب غير موجود.")).toBeInTheDocument();
    // The link becomes its number.
    expect(input).toHaveValue("999000111");
  });

  it("الفلتر يُطوى، وما بقي منه نشطاً يظهر تحت الحقل ويُزال من هناك", async () => {
    const { app } = await desk("/ar/admin/users?view=desk&state=notActivated");
    const toggle = screen.getByTestId("desk-filter-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("1");
    expect(screen.queryByTestId("desk-filter-chips")).toBeNull();

    await app.user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(localStorage.getItem("admin.activation.filtersOpen")).toBe("0");
    const chips = screen.getByTestId("desk-filter-chips");
    expect(chips).toHaveTextContent(t("admin.activation.finder.state.notActivated"));

    await app.user.click(within(chips).getByRole("button", { name: new RegExp(t("admin.activation.finder.removeFilter")) }));
    await waitFor(() => expect(app.location()).not.toContain("state="));
    expect(screen.queryByTestId("desk-filter-chips")).toBeNull();
  });

  it("طالبٌ موقوف ⇒ ملفّه يقول ذلك", async () => {
    fake.on("get", "/admin/activation/students/:id", { ...F.studentProfile, account: { ...F.studentProfile.account, status: "suspended" } });
    await desk(`/ar/admin/users?view=desk&student=${F.deskStudent.id}`);
    expect(await screen.findByTestId("student-profile")).toHaveTextContent(t("admin.activation.student.suspended"));
  });

  it("الكاميرا غير متاحة ⇒ تقول السبب، والحقل يبقى", async () => {
    const { app, input } = await desk();
    await app.user.click(screen.getByTestId("desk-camera-toggle"));
    const camera = await screen.findByTestId("desk-camera");
    expect(within(camera).getByRole("alert")).toHaveTextContent(t("admin.activation.camera.unavailable"));
    expect(input).toBeEnabled();
  });
});
