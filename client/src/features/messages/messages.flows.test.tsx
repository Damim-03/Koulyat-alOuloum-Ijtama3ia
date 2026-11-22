import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";

/**
 * الرسائل كما يستعملها صاحبها: يفتح محادثة فيُقرأ ما فيها، ويكتب فتصل،
 * ويفشل الإرسال فيرى السبب ويعيد المحاولة؛ ويكتب رسالةً جديدة لمن يختار،
 * والإدارةُ تعمّم على جمهورٍ يُعدّ قبل الإرسال.
 *
 * ما يُتحقَّق منه في كلّ خطوة: الطلب الذي خرج فعلاً (طريقته ومساره وجسمه)،
 * وما تغيّر على الشاشة بعده.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (x: string) => new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("المحادثات", () => {
  it("فتحُ محادثةٍ من القائمة ⇒ تُعرض رسائلها وتُعلَّم مقروءة، والرسالة تُرسل وتظهر", async () => {
    const app = renderApp("/ar/professor/messages", { as: "professor" });
    const rows = await screen.findAllByTestId("chat-row");
    // الطالبة أوّلاً؟ لا — المحادثات بترتيب الخادم، وأوّلها الإدارة للأستاذ.
    await app.user.click(rows[0]!);

    await screen.findByTestId("chat-view");
    expect(app.location()).toBe(`/ar/professor/messages?c=${F.adminUser.id}`);
    expect(await screen.findByText("السلام عليكم")).toBeInTheDocument();
    await waitFor(() => expect(fake.find("patch", `/messages/chat/${F.adminUser.id}/read`)).toHaveLength(1));

    await app.user.type(screen.getByTestId("chat-input"), "موعدنا غداً");
    await app.user.click(screen.getByTestId("chat-send"));
    await waitFor(() => expect(fake.find("post", "/messages")).toHaveLength(1));
    expect(fake.find("post", "/messages")[0]!.body).toEqual({ recipientIds: [F.adminUser.id], body: "موعدنا غداً" });
    expect(await screen.findByText("موعدنا غداً")).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toHaveValue("");
  });

  it("إرسالٌ يفشل ⇒ رسالة الخادم، وفقاعةٌ حمراء تُعاد فتصل", async () => {
    fake.fail("post", "/messages", 403, "لا يمكنك مراسلة هذا الحساب");
    const app = renderApp(`/ar/student/messages?c=${F.profUsers[0]!.id}`, { as: "student" });
    await screen.findByTestId("chat-view");

    await app.user.type(screen.getByTestId("chat-input"), "سؤال");
    await app.user.click(screen.getByTestId("chat-send"));
    expect(await screen.findByText("لا يمكنك مراسلة هذا الحساب")).toBeInTheDocument();
    expect(await screen.findByLabelText(t("msg.failed"))).toBeInTheDocument();

    fake.reset();
    await app.user.click(screen.getByRole("button", { name: new RegExp(t("msg.retry")) }));
    await waitFor(() => expect(fake.find("post", "/messages")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByLabelText(t("msg.failed"))).toBeNull());
  });

  it("رابطٌ قديم برسالةٍ واحدة (?m=) ⇒ يُفتح على محادثة مرسلها", async () => {
    const app = renderApp("/ar/student/messages?m=m1", { as: "student" });
    await waitFor(() => expect(app.location()).toBe(`/ar/student/messages?c=${F.profUsers[0]!.id}`));
    await screen.findByTestId("chat-view");
  });

  it("البحث في الشريط الجانبي يجد الأشخاص، وفلاتر الأدوار تُضيّق القائمة", async () => {
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await screen.findAllByTestId("chat-row");
    await app.user.click(screen.getByTestId("chat-filter-professor"));
    expect(screen.getAllByTestId("chat-row")).toHaveLength(1);
    await app.user.click(screen.getByTestId("chat-filter-all"));
    expect(screen.getAllByTestId("chat-row").length).toBeGreaterThan(1);

    await app.user.type(screen.getByTestId("chat-search"), "سارة");
    await waitFor(() => expect(fake.find("get", "/messages/contacts").some((c) => c.query.search === "سارة")).toBe(true));
  });
});

describe("رسالةٌ جديدة", () => {
  it("بلا نصّ ⇒ تُطلب كتابته؛ وبلا مستلم ⇒ يُطلب اختياره؛ ولا يخرج طلب", async () => {
    const app = renderApp("/ar/student/messages", { as: "student" });
    await app.user.click(await screen.findByTestId("open-compose"));
    const dialog = await screen.findByTestId("compose-dialog");

    await app.user.click(within(dialog).getByTestId("compose-send"));
    expect(within(dialog).getByTestId("compose-error")).toHaveTextContent(t("msg.compose.needBody"));
    await app.user.type(within(dialog).getByTestId("compose-body"), "مرحباً");
    await app.user.click(within(dialog).getByTestId("compose-send"));
    expect(within(dialog).getByTestId("compose-error")).toHaveTextContent(t("msg.compose.needRecipient"));
    expect(fake.writes).toEqual([]);
  });

  it("دورٌ ثمّ شخص ثمّ النصّ ⇒ تُرسل، وتُفتح المحادثة معه", async () => {
    const app = renderApp("/ar/student/messages", { as: "student" });
    await app.user.click(await screen.findByTestId("open-compose"));
    const dialog = await screen.findByTestId("compose-dialog");

    await app.user.click(within(dialog).getByTestId("role-card-professor"));
    const results = await within(dialog).findByTestId("contact-results");
    await app.user.click(await within(results).findByText(/كريم/));
    expect(within(dialog).getAllByTestId("picked-chip")).toHaveLength(1);

    await app.user.type(within(dialog).getByTestId("compose-subject"), "طلب موعد");
    await app.user.type(within(dialog).getByTestId("compose-body"), "متى يمكنني المرور؟");
    await app.user.click(within(dialog).getByTestId("compose-send"));

    await waitFor(() => expect(fake.find("post", "/messages")).toHaveLength(1));
    expect(fake.find("post", "/messages")[0]!.body).toEqual({
      recipientIds: [F.profUsers[0]!.id],
      subject: "طلب موعد",
      body: "متى يمكنني المرور؟",
    });
    await waitFor(() => expect(screen.queryByTestId("compose-dialog")).toBeNull());
    await waitFor(() => expect(app.location()).toBe(`/ar/student/messages?c=${F.profUsers[0]!.id}`));
  });

  it("المسودّة تبقى بعد الإغلاق، وتُفتح كما تُركت", async () => {
    const app = renderApp("/ar/professor/messages", { as: "professor" });
    await app.user.click(await screen.findByTestId("open-compose"));
    await app.user.type(screen.getByTestId("compose-body"), "مسودّة لم تكتمل");
    await new Promise((r) => setTimeout(r, 450));
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("compose-dialog")).toBeNull());

    await app.user.click(screen.getByTestId("open-compose"));
    expect(screen.getByTestId("compose-body")).toHaveValue("مسودّة لم تكتمل");
  });

  it("الإدارة تعمّم: الجمهور يُعدّ قبل الإرسال، ثمّ يُفتح التعميم بمن قرأه", async () => {
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-broadcast"));
    const dialog = await screen.findByTestId("compose-dialog");
    expect(within(dialog).getByTestId("compose-mode-audience")).toHaveAttribute("aria-selected", "true");

    await app.user.click(within(dialog).getByTestId("audience-professors"));
    await waitFor(() => expect(fake.find("get", "/messages/audience").some((c) => c.query.target === "professors")).toBe(true));
    await waitFor(() => expect(within(dialog).getByTestId("compose-reach")).toHaveTextContent("4"));

    await app.user.type(within(dialog).getByTestId("compose-body"), "اجتماع الأساتذة يوم الخميس");
    await app.user.click(within(dialog).getByTestId("compose-send"));
    await waitFor(() => expect(fake.find("post", "/messages/broadcast")).toHaveLength(1));
    expect(fake.find("post", "/messages/broadcast")[0]!.body).toEqual({ target: "professors", body: "اجتماع الأساتذة يوم الخميس" });
    await waitFor(() => expect(app.location()).toBe("/ar/admin/messages?b=b1"));
  });

  it("تعميمٌ يرفضه الخادم ⇒ سببه في النافذة، ولا تُغلق", async () => {
    fake.fail("post", "/messages/broadcast", 400, "الجمهور فارغ");
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-broadcast"));
    const dialog = await screen.findByTestId("compose-dialog");
    await waitFor(() => expect(within(dialog).getByTestId("compose-reach")).toHaveTextContent("4"));
    await app.user.type(within(dialog).getByTestId("compose-body"), "نصّ");
    await app.user.click(within(dialog).getByTestId("compose-send"));
    expect(await within(dialog).findByTestId("compose-error")).toHaveTextContent("الجمهور فارغ");
  });
});

describe("رسالةٌ جديدة: لوحة المفاتيح والجمهور", () => {

  it("الأسهم تنقل بين الأسماء وEnter يختار؛ والشارة تُزال؛ وEscape يعود إلى الأدوار", async () => {
    const app = renderApp("/ar/student/messages", { as: "student" });
    await app.user.click(await screen.findByTestId("open-compose"));
    const dialog = await screen.findByTestId("compose-dialog");
    await app.user.click(within(dialog).getByTestId("role-card-professor"));
    const results = await within(dialog).findByTestId("contact-results");
    await within(results).findAllByRole("option");

    const search = within(dialog).getByTestId("contact-search");
    await app.user.click(search);
    await app.user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");
    const options = within(results).getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    const name = options[1]!.querySelector("span span span")!.textContent!;
    await app.user.keyboard("{Enter}");
    const chip = within(dialog).getByTestId("picked-chip");
    expect(chip).toHaveTextContent(name);

    await app.user.click(within(chip).getByRole("button", { name: t("msg.remove") }));
    expect(within(dialog).queryAllByTestId("picked-chip")).toHaveLength(0);

    await app.user.click(search);
    await app.user.keyboard("{Escape}");
    expect(within(dialog).getByTestId("role-step")).toBeInTheDocument();
    expect(screen.getByTestId("compose-dialog")).toBeInTheDocument();
    await app.user.click(within(dialog).getByTestId("role-card-professor"));
    await app.user.click(within(dialog).getByTestId("change-role"));
    expect(within(dialog).getByTestId("role-step")).toBeInTheDocument();
  });

  it("Ctrl+Enter في النصّ يُرسل كزرّ «إرسال»", async () => {
    const app = renderApp("/ar/student/messages", { as: "student" });
    await app.user.click(await screen.findByTestId("open-compose"));
    const dialog = await screen.findByTestId("compose-dialog");
    await app.user.click(within(dialog).getByTestId("role-card-professor"));
    await app.user.click(await within(within(dialog).getByTestId("contact-results")).findByText(/كريم/));
    await app.user.type(within(dialog).getByTestId("compose-body"), "سؤالٌ قصير");
    await app.user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(fake.find("post", "/messages")[0]?.body).toMatchObject({ body: "سؤالٌ قصير" }));
  });

  it("الإدارة: من التعميم إلى رسالةٍ مباشرة بتبويبها", async () => {
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-broadcast"));
    const dialog = await screen.findByTestId("compose-dialog");
    await app.user.click(within(dialog).getByTestId("compose-mode-direct"));
    expect(within(dialog).getByTestId("compose-mode-direct")).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByTestId("role-step")).toBeInTheDocument();
  });

  it("الطلبة مضيَّقين بالبنية والمستوى والسنة والمذكرة ⇒ يُعدّون ويُعمَّم عليهم بذلك كلّه", async () => {
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-broadcast"));
    const dialog = await screen.findByTestId("compose-dialog");
    await app.user.click(within(dialog).getByTestId("audience-students"));
    const pick = async (field: string, option: string) => {
      await app.user.click(within(dialog).getByRole("combobox", { name: field }));
      await app.user.click(await screen.findByRole("option", { name: esc(option) }));
    };
    await pick(t("admin.faculty"), F.faculty.name);
    await pick(t("admin.department"), F.department.name);
    await pick(t("admin.filiere"), F.filiere.name);
    await pick(t("admin.specialization"), F.specialization.name);
    await pick(t("admin.specializationLevel"), t("msg.level.master"));
    await pick(t("admin.academicYear"), F.year.title);
    await app.user.click(within(dialog).getByRole("button", { name: t("msg.audience.project-with") }));

    const want = {
      target: "students",
      facultyId: F.faculty.id,
      departmentId: F.department.id,
      filiereId: F.filiere.id,
      specializationId: F.specialization.id,
      level: "master",
      academicYearId: F.year.id,
      project: "with",
    };
    await waitFor(() => expect(fake.find("get", "/messages/audience").at(-1)?.query).toEqual(want));
    await app.user.type(within(dialog).getByTestId("compose-body"), "موعد إيداع المذكرات");
    await app.user.click(within(dialog).getByTestId("compose-send"));
    await waitFor(() => expect(fake.find("post", "/messages/broadcast")[0]?.body).toEqual({ ...want, body: "موعد إيداع المذكرات" }));
  });

  it("الأساتذة يحتفظون بالكلّية والقسم وحدهما، والإدارة بلا تضييق", async () => {
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-broadcast"));
    const dialog = await screen.findByTestId("compose-dialog");
    await app.user.click(within(dialog).getByTestId("audience-students"));
    await app.user.click(within(dialog).getByRole("combobox", { name: t("admin.faculty") }));
    await app.user.click(await screen.findByRole("option", { name: esc(F.faculty.name) }));
    await app.user.click(within(dialog).getByRole("button", { name: t("msg.audience.project-without") }));
    await app.user.click(within(dialog).getByTestId("audience-professors"));
    expect(within(dialog).queryByRole("combobox", { name: t("admin.filiere") })).toBeNull();
    await waitFor(() => expect(fake.find("get", "/messages/audience").at(-1)?.query).toEqual({ target: "professors", facultyId: F.faculty.id }));
    await app.user.click(within(dialog).getByTestId("audience-admins"));
    expect(within(dialog).queryByRole("combobox", { name: t("admin.faculty") })).toBeNull();
    await waitFor(() => expect(fake.find("get", "/messages/audience").at(-1)?.query).toEqual({ target: "admins" }));
  });
});

describe("قارئ الرسالة", () => {
  it("التعميمات في تبويبها، وفتحُ واحدٍ يعرض من قرأه، ولا ردّ على تعميمٍ من صاحبه", async () => {
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await app.user.click(await screen.findByTestId("sidebar-tab-broadcasts"));
    await waitFor(() => expect(fake.find("get", "/messages/sent").some((c) => c.query.filter === "broadcast")).toBe(true));
    await app.user.click(await screen.findByText("رزنامة المناقشات"));
    expect(app.location()).toBe("/ar/admin/messages?b=m4");
    await screen.findByTestId("message-reader");
  });

  it("رسالةٌ واردة ⇒ تُقرأ عند فتحها، ويُردّ عليها، وتُعلَّم غير مقروءة", async () => {
    const app = renderApp("/ar/student/messages?b=m1", { as: "student" });
    await screen.findByTestId("message-reader");
    expect(screen.getByTestId("reader-subject")).toHaveTextContent("موعد الإشراف");
    await waitFor(() => expect(fake.find("patch", "/messages/m1/read")).toHaveLength(1));

    await app.user.type(screen.getByTestId("reply-input"), "شكراً أستاذ");
    await app.user.click(screen.getByTestId("reply-send"));
    await waitFor(() => expect(fake.find("post", /^\/messages\/.+\/reply$/)).toHaveLength(1));
    expect(fake.find("post", /\/reply$/)[0]!.body).toMatchObject({ body: "شكراً أستاذ" });

    await app.user.click(screen.getByTestId("reader-unread"));
    await waitFor(() => expect(fake.find("patch", "/messages/m1/unread")).toHaveLength(1));
    await waitFor(() => expect(app.location()).toBe("/ar/student/messages"));
  });

  it("الحذف من الوارد يُسأل عنه أوّلاً، ثمّ يُحذف ويُغلق القارئ", async () => {
    const app = renderApp("/ar/student/messages?b=m1", { as: "student" });
    await app.user.click(await screen.findByTestId("reader-delete"));
    expect(fake.find("delete", "/messages/m1")).toEqual([]);
    await app.user.click(await screen.findByRole("button", { name: t("messages.yesDelete") }));
    await waitFor(() => expect(fake.find("delete", "/messages/m1")).toHaveLength(1));
    await waitFor(() => expect(app.location()).toBe("/ar/student/messages"));
  });

  it("رسالةٌ لم تعد موجودة ⇒ «لم تعد متاحة» بدل شاشةٍ معطّلة", async () => {
    fake.fail("get", "/messages/:id", 404, "غير موجودة");
    renderApp("/ar/student/messages?b=gone", { as: "student" });
    expect(await screen.findByText(t("msg.gone"))).toBeInTheDocument();
  });
});

describe("الشريط الجانبيّ المطويّ", () => {
  it("يُطوى إلى صورٍ، والمرور على صورةٍ يُري بطاقتها، والنقر يفتح المحادثة، ويُذكر الطيّ", async () => {
    // الطيّ للشاشة العريضة وحدها؛ وjsdom يقول «لا» لكلّ استعلام وسائط.
    const real = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...real(q), matches: /min-width/.test(q) })) as typeof window.matchMedia;
    onTestFinished(() => void (window.matchMedia = real));
    let app = renderApp("/ar/professor/messages", { as: "professor" });
    await app.user.click(await screen.findByTestId("sidebar-collapse"));
    const avatars = await screen.findAllByTestId("rail-avatar");
    await app.user.hover(avatars[0]!);
    expect(await screen.findByTestId("rail-card")).toBeInTheDocument();
    await app.user.unhover(avatars[0]!);
    await app.user.click(avatars[0]!);
    await waitFor(() => expect(app.location()).toMatch(/\?c=/));
    app.unmount();

    // الطيّ محفوظ للزيارة التالية، ويُفتح من زرّه.
    app = renderApp("/ar/professor/messages", { as: "professor" });
    await app.user.click(await screen.findByTestId("sidebar-expand"));
    expect(await screen.findByTestId("chat-search")).toBeInTheDocument();
  });
});

describe("المحادثة: التمرير والأقدم وما فشل", () => {
  /** jsdom لا يرسم: أبعاد الحاوية تُعطى يدوياً، والتمرير يُطلق بحدثه. */
  function geometry(el: HTMLElement, start: { height: number; top: number }) {
    let height = start.height;
    Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => height });
    Object.defineProperty(el, "clientHeight", { configurable: true, get: () => 400 });
    el.scrollTop = start.top;
    return { grow: (h: number) => (height = h) };
  }

  it("قرب الأعلى ⇒ تُجلب الأقدم ويبقى القارئ حيث كان؛ و«إلى الأحدث» ينزل", async () => {
    const other = F.profUsers[0]!;
    // الصفحة الأقدم تُمسك حتى تُعطى الحاوية طولها الجديد، كما في متصفّحٍ يرسم.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fake.on("get", "/messages/chat/:userId", async (r) => {
      const base = F.chat(F.studentUsers[0]!, r.params.userId!);
      if (r.query.before) await gate;
      return r.query.before
        ? { ...base, hasMore: false, items: [{ ...base.items[0]!, id: "cm0", body: "رسالةٌ أقدم", createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString() }] }
        : { ...base, hasMore: true };
    });
    renderApp(`/ar/student/messages?c=${other.id}`, { as: "student" });
    await screen.findByText("السلام عليكم");
    const scroller = screen.getByTestId("chat-scroll");
    const g = geometry(scroller, { height: 2000, top: 50 });
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as never;

    fireEvent.scroll(scroller);
    await waitFor(() => expect(fake.find("get", `/messages/chat/${other.id}`).some((c) => c.query.before)).toBe(true));
    g.grow(2600);
    release();
    expect(await screen.findByText("رسالةٌ أقدم")).toBeInTheDocument();
    // ما أُضيف فوقه لا يحرّكه: الموضع يُزاح بقدر ما زاد.
    await waitFor(() => expect(scroller.scrollTop).toBe(650));

    const jump = screen.getByRole("button", { name: t("msg.chat.toLatest") });
    fireEvent.click(jump);
    expect(scrollTo).toHaveBeenCalledWith({ top: 2600, behavior: "smooth" });

    // في الأسفل ⇒ لا زرّ.
    scroller.scrollTop = 2600 - 400;
    fireEvent.scroll(scroller);
    await waitFor(() => expect(screen.queryByRole("button", { name: t("msg.chat.toLatest") })).toBeNull());
  });

  it("رسالةٌ فشل إرسالها ⇒ «تجاهل» يُزيلها بلا إعادة", async () => {
    fake.fail("post", "/messages", 403, "لا يمكنك مراسلة هذا الحساب");
    const app = renderApp(`/ar/student/messages?c=${F.profUsers[0]!.id}`, { as: "student" });
    await screen.findByTestId("chat-view");
    await app.user.type(screen.getByTestId("chat-input"), "سؤالٌ سيفشل");
    await app.user.click(screen.getByTestId("chat-send"));
    expect(await screen.findByLabelText(t("msg.failed"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: t("msg.discard") }));
    await waitFor(() => expect(screen.queryByText("سؤالٌ سيفشل")).toBeNull());
    expect(fake.find("post", "/messages")).toHaveLength(1);
  });

  it("Shift+Enter سطرٌ جديد لا إرسال، وEnter يُرسل", async () => {
    const app = renderApp(`/ar/student/messages?c=${F.profUsers[0]!.id}`, { as: "student" });
    await screen.findByTestId("chat-view");
    await app.user.type(screen.getByTestId("chat-input"), "سطرٌ أوّل{Shift>}{Enter}{/Shift}سطرٌ ثانٍ");
    expect(fake.find("post", "/messages")).toEqual([]);
    expect(screen.getByTestId("chat-input")).toHaveValue("سطرٌ أوّل\nسطرٌ ثانٍ");
    await app.user.keyboard("{Enter}");
    await waitFor(() => expect(fake.find("post", "/messages")[0]?.body).toMatchObject({ body: "سطرٌ أوّل\nسطرٌ ثانٍ" }));
  });
});

describe("قارئ الرسالة: النسخ والمستلمون والردّ الفاشل", () => {
  async function reader() {
    const app = renderApp("/ar/student/messages?b=m1", { as: "student" });
    await screen.findByTestId("message-reader");
    await screen.findByText("حاضر، شكراً.");
    return app;
  }

  it("«نسخ» ينسخ المحادثة كلّها بأسماء أصحابها", async () => {
    const app = await reader();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await app.user.click(screen.getByRole("button", { name: t("msg.copy") }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0]![0] as string;
    expect(text).toContain("نلتقي يوم الأحد في المكتب.");
    expect(text).toContain("حاضر، شكراً.");
    expect(await screen.findByText(t("msg.copied"))).toBeInTheDocument();
  });

  it("ردّي يُري من استلمه بفتح قائمته", async () => {
    const app = await reader();
    const toggle = screen.getByTestId("receipts");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await app.user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByTestId("recipient-list")).getByText(/كريم/)).toBeInTheDocument();
  });

  it("ردٌّ فشل ⇒ فقاعةٌ حمراء؛ «تجاهل» يُزيلها، و«إعادة» تُرسله من جديد؛ وCtrl+Enter يُرسل", async () => {
    fake.fail("post", "/messages/:id/reply", 403, "لا يمكن الردّ الآن");
    const app = await reader();
    await app.user.type(screen.getByTestId("reply-input"), "ردٌّ أوّل");
    await app.user.keyboard("{Control>}{Enter}{/Control}");
    expect(await screen.findByText(t("msg.failed"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: t("msg.discard") }));
    await waitFor(() => expect(screen.queryByText("ردٌّ أوّل")).toBeNull());

    await app.user.type(screen.getByTestId("reply-input"), "ردٌّ ثانٍ");
    await app.user.click(screen.getByTestId("reply-send"));
    expect(await screen.findByText(t("msg.failed"))).toBeInTheDocument();
    fake.reset();
    await app.user.click(screen.getByRole("button", { name: new RegExp(t("msg.retry")) }));
    await waitFor(() => expect(fake.find("post", /\/reply$/)[0]?.body).toMatchObject({ body: "ردٌّ ثانٍ" }));
    await waitFor(() => expect(screen.queryByText(t("msg.failed"))).toBeNull());
  });

  it("تعميمي أنا ⇒ لا ردّ عليه، ويقال لماذا", async () => {
    fake.on("get", "/messages/:id", (r) => {
      const th = F.thread(F.adminUser, r.params.id!);
      const root = { ...th.message, mine: true, broadcast: "professors", sender: F.messageUser(F.adminUser) };
      return { ...th, message: root, thread: [root] };
    });
    renderApp("/ar/admin/messages?b=m4", { as: "admin" });
    await screen.findByTestId("message-reader");
    expect(await screen.findByText(t("msg.cannotReplyOwnBroadcast"))).toBeInTheDocument();
    expect(screen.queryByTestId("reply-box")).toBeNull();
  });
});

describe("الشريط الجانبيّ: البحث والأقسام", () => {
  it("Enter في البحث يفتح أوّل محادثةٍ مطابقة؛ وEscape وزرّ المسح يُفرغانه", async () => {
    const app = renderApp("/ar/professor/messages", { as: "professor" });
    await screen.findAllByTestId("chat-row");
    const search = screen.getByTestId("chat-search");
    await app.user.type(search, F.adminUser.firstName!);
    await app.user.keyboard("{Enter}");
    await waitFor(() => expect(app.location()).toBe(`/ar/professor/messages?c=${F.adminUser.id}`));
    expect(search).toHaveValue("");

    await app.user.type(search, "س");
    await app.user.keyboard("{Escape}");
    expect(search).toHaveValue("");
    await app.user.type(search, "س");
    await app.user.click(screen.getByRole("button", { name: t("msg.clearSearch") }));
    expect(search).toHaveValue("");
  });

  it("شخصٌ بلا محادثةٍ بعد يظهر في «أشخاص»، والنقر عليه يفتح محادثته", async () => {
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await screen.findAllByTestId("chat-row");
    await app.user.type(screen.getByTestId("chat-search"), "ليلى");
    const person = (await screen.findAllByTestId("person-result"))[0]!;
    await app.user.click(person);
    await waitFor(() => expect(app.location()).toMatch(/\?c=/));
    expect(screen.getByTestId("chat-search")).toHaveValue("");
  });

  it("محادثةٌ قديمة ⇒ في قسم «أقدم»", async () => {
    fake.on("get", "/messages/conversations", () => {
      const list = F.conversations(F.profUsers[0]!);
      return { items: list.map((c, i) => (i === 1 ? { ...c, last: { ...c.last!, createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString() } } : c)), unread: 2 };
    });
    renderApp("/ar/professor/messages", { as: "professor" });
    await screen.findAllByTestId("chat-row");
    expect(screen.getByText(t("msg.chat.when.older"))).toBeInTheDocument();
  });

  it("القائمة تتعذّر ⇒ «إعادة» تطلبها من جديد", async () => {
    fake.fail("get", "/messages/conversations", 500, "خطأ");
    const app = renderApp("/ar/professor/messages", { as: "professor" });
    await screen.findByText(t("msg.listFailed"));
    const before = fake.find("get", "/messages/conversations").length;
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.retry")) }));
    await waitFor(() => expect(fake.find("get", "/messages/conversations").length).toBeGreaterThan(before));
  });

  it("الإدارة: «تعميمٌ جديد» من تبويب التعميمات، ومن الشريط المطويّ «رسالة» و«تعميم»", async () => {
    const real = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...real(q), matches: /min-width/.test(q) })) as typeof window.matchMedia;
    onTestFinished(() => void (window.matchMedia = real));
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await app.user.click(await screen.findByTestId("sidebar-tab-broadcasts"));
    // في رأس الصفحة زرٌّ بالاسم نفسه؛ هذا زرّ قائمة التعميمات.
    await app.user.click((await screen.findAllByRole("button", { name: esc(t("msg.broadcastNew")) })).at(-1)!);
    const dialog = await screen.findByTestId("compose-dialog");
    expect(within(dialog).getByTestId("compose-mode-audience")).toHaveAttribute("aria-selected", "true");
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("compose-dialog")).toBeNull());

    await app.user.click(screen.getByTestId("sidebar-collapse"));
    await screen.findAllByTestId("rail-avatar");
    // وفي الرأس «رسالة جديدة» أيضاً: هذه أزرار الشريط المطويّ.
    await app.user.click(screen.getAllByRole("button", { name: t("messages.newMessage") }).at(-1)!);
    expect(within(await screen.findByTestId("compose-dialog")).getByTestId("role-step")).toBeInTheDocument();
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("compose-dialog")).toBeNull());
    await app.user.click(screen.getAllByRole("button", { name: t("msg.broadcastNew") }).at(-1)!);
    expect(within(await screen.findByTestId("compose-dialog")).getByTestId("compose-mode-audience")).toHaveAttribute("aria-selected", "true");
  });
});
