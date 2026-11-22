import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../../i18n/i18n";
import { fake } from "../../../../../test/fake-api";
import { renderApp } from "../../../../../test/render-app";
import * as F from "../../../../../test/fixtures";

/**
 * إنشاء المواضيع من الإدارة — موضوعٌ يقصده الطلبة بطلباتهم، وموضوعٌ يُسنَد
 * بطلبته مباشرةً، وتعديل إسنادٍ قائم.
 *
 * يُحرس: أنّ «إنشاء» لا يُتاح قبل اكتمال المطلوب، وأنّ ما يُرسل هو ما اختير
 * (المشرف، والسنة، والتخصّص، والمتطلّبات، والنشر الفوريّ)، وأنّ مقاعد الطلبة
 * تتعرّف على الطالب برقم تسجيله وتقول لماذا لا تجده، وأنّ رفض الخادم يبقى
 * في النافذة بسببه.
 */
type App = ReturnType<typeof renderApp>;
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function open(label: string) {
  const app = renderApp("/ar/admin/topics", { as: "admin" });
  await screen.findAllByText(F.topicOpen.title);
  await app.user.click(screen.getByRole("button", { name: label }));
  return { app, dialog: await screen.findByRole("dialog") };
}

/** القائمة المنسدلة باسم حقلها ⇒ الخيار. */
async function choose(app: App, dialog: HTMLElement, field: string, option: string) {
  await app.user.click(within(dialog).getByRole("combobox", { name: field }));
  await app.user.click(await screen.findByRole("option", { name: esc(option) }));
}

async function pickSupervisor(app: App, dialog: HTMLElement) {
  const trigger = within(dialog)
    .getAllByRole("button")
    // The supervisor's picker, not the co-supervisor's beside it.
    .find((b) => b.getAttribute("aria-haspopup") === "listbox" && b.dataset.testid !== "co-supervisor-trigger")!;
  await app.user.click(trigger);
  await app.user.type(await screen.findByPlaceholderText(t("admin.searchProfessorAny")), "كريم");
  await app.user.click(await screen.findByRole("option", { name: /كريم/ }));
}

async function fillTopic(app: App, dialog: HTMLElement) {
  await app.user.type(within(dialog).getByPlaceholderText(t("admin.assignTopicTitlePlaceholder")), "  الذكاء الاصطناعي والعمل  ");
  await app.user.type(within(dialog).getByPlaceholderText(t("admin.assignTopicDescPlaceholder")), "دراسة ميدانية");
  await app.user.type(within(dialog).getByPlaceholderText(t("admin.requirementItemPlaceholder")), "SPSS{Enter}");
  await pickSupervisor(app, dialog);
  await choose(app, dialog, t("admin.academicYear"), F.year.title);
  await choose(app, dialog, t("admin.specialization"), F.specialization.name);
}

describe("موضوعٌ جديد", () => {
  it("لا «إنشاء» قبل المطلوب؛ وبعده يُرسل ما اختير، منشوراً إن طُلب", async () => {
    const { app, dialog } = await open(t("admin.createTopicBtn"));
    const create = () => within(dialog).getByRole("button", { name: t("admin.createTopicBtn") });
    expect(create()).toBeDisabled();

    await fillTopic(app, dialog);
    await app.user.click(within(dialog).getByText(t("admin.publishNow")));
    expect(create()).toBeEnabled();
    await app.user.click(create());

    await waitFor(() => expect(fake.find("post", "/admin/topics")).toHaveLength(1));
    expect(fake.find("post", "/admin/topics")[0]!.body).toEqual({
      title: "الذكاء الاصطناعي والعمل",
      description: "دراسة ميدانية",
      maxStudents: 1,
      maxRequests: null,
      requirements: ["SPSS"],
      objectives: [],
      professorId: F.prof1.id,
      specializationId: F.specialization.id,
      academicYearId: F.year.id,
      publish: true,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("رفض الخادم ⇒ سببه في النافذة، ولا تُغلق", async () => {
    fake.fail("post", "/admin/topics", 409, "عنوانٌ مكرّر لهذا الأستاذ");
    const { app, dialog } = await open(t("admin.createTopicBtn"));
    await fillTopic(app, dialog);
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.createTopicBtn") }));
    expect(await within(dialog).findByText("عنوانٌ مكرّر لهذا الأستاذ")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("المستوى يُعرض من التخصّص ولا يُختار ولا يُلمس ولا يُرسل؛ والتخصّصات بأسمائها وحدها", async () => {
    const { app, dialog } = await open(t("admin.createTopicBtn"));
    const level = within(dialog).getByTestId("topic-level");
    // Before a specialization: what it waits for.
    expect(level).toHaveTextContent(t("admin.levelFromSpec"));
    // A text, not a field: nothing to type in, and a click focuses nothing — no ring, no caret.
    expect(level.tagName).toBe("DIV");
    expect(level.closest("label")).toBeNull();
    await app.user.click(level);
    expect(document.activeElement === level || level.contains(document.activeElement)).toBe(false);
    expect(document.activeElement?.tagName).not.toBe("INPUT");

    // Each specialization by its name alone: the level has its field.
    await app.user.click(within(dialog).getByRole("combobox", { name: t("admin.specialization") }));
    expect(await screen.findByRole("option", { name: F.specialization.name })).toBeInTheDocument();
    await app.user.click(screen.getByRole("option", { name: F.specialization2.name }));
    expect(level).toHaveTextContent(t("admin.levelLicence"));
    // Another specialization: its level follows.
    await choose(app, dialog, t("admin.specialization"), F.specialization.name);
    expect(level).toHaveTextContent(t("admin.levelMaster"));

    // And it is never sent: the topic's level is its specialization's.
    await fillTopic(app, dialog);
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.createTopicBtn") }));
    await waitFor(() => expect(fake.find("post", "/admin/topics")).toHaveLength(1));
    expect(fake.find("post", "/admin/topics")[0]!.body).not.toHaveProperty("level");
  });

  it("تضييق البنية: الكلّية ثمّ القسم يحصران التخصّصات", async () => {
    const { app, dialog } = await open(t("admin.createTopicBtn"));
    await choose(app, dialog, t("admin.faculty"), F.faculty.name);
    await choose(app, dialog, t("admin.department"), F.department2.name);
    await app.user.click(within(dialog).getByRole("combobox", { name: t("admin.specialization") }));
    expect(screen.queryByRole("option", { name: esc(F.specialization.name) })).toBeNull();
  });
});

describe("موضوعٌ يُسنَد بطلبته", () => {
  it("خطوتان: الموضوع ثمّ الطلبة، ورقم التسجيل يجد الطالب، والأوّل مرسِل", async () => {
    const { app, dialog } = await open(t("admin.assignTopicBtn"));
    const next = within(dialog).getByRole("button", { name: esc(t("admin.next")) });
    expect(next).toBeDisabled();
    await fillTopic(app, dialog);
    await app.user.click(next);

    const seat = await within(dialog).findByTestId("seat-1");
    await app.user.type(within(seat).getByPlaceholderText(t("admin.seatPlaceholder")), F.student2.registrationNumber);
    await waitFor(() => expect(fake.find("get", "/admin/students").some((c) => c.query.quickSearch === F.student2.registrationNumber)).toBe(true));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: esc(t("admin.assignCreateBtn")) })).toBeEnabled());

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.assignCreateBtn")) }));
    await waitFor(() => expect(fake.find("post", "/admin/topics/assigned")).toHaveLength(1));
    expect(fake.find("post", "/admin/topics/assigned")[0]!.body).toMatchObject({
      title: "الذكاء الاصطناعي والعمل",
      professorId: F.prof1.id,
      memberStudentIds: [F.student2.id],
      leaderStudentId: F.student2.id,
    });
  });

  it("بنيةٌ كاملة وسعةٌ لمقعدين؛ ونجمة الثاني تجعله المرسِل، والعودة لا تُضيّع شيئاً", async () => {
    // Two seats: the administration's number for the master's level — not typed.
    fake.on("get", "/admin/academic-years", { academicYears: [{ ...F.year, teamSizes: { master: { n: 2, mode: "exact" } } }, F.pastYear] });
    const { app, dialog } = await open(t("admin.assignTopicBtn"));
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.assignTopicTitlePlaceholder")), "العمل عن بعد");
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.assignTopicDescPlaceholder")), "دراسة حالة");
    await pickSupervisor(app, dialog);
    await choose(app, dialog, t("admin.academicYear"), F.year.title);
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.maxRequestsNone")), "3");
    await choose(app, dialog, t("admin.faculty"), F.faculty.name);
    // الكلّية وحدها: الشعب من أقسامها.
    await app.user.click(within(dialog).getByRole("combobox", { name: t("admin.filiere") }));
    expect(await screen.findByRole("option", { name: esc(F.filiere.name) })).toBeInTheDocument();
    await app.user.keyboard("{Escape}");
    await choose(app, dialog, t("admin.department"), F.department.name);
    await choose(app, dialog, t("admin.filiere"), F.filiere.name);
    await choose(app, dialog, t("admin.specialization"), F.specialization.name);
    expect(within(dialog).getByTestId("team-size")).toHaveTextContent(t("teamSize.count", { count: 2 }));

    const next = () => within(dialog).getByRole("button", { name: esc(t("admin.next")) });
    await app.user.click(next());
    for (const [n, s] of [[1, F.student2], [2, F.student3]] as const) {
      const seat = await within(dialog).findByTestId(`seat-${n}`);
      await app.user.type(within(seat).getByPlaceholderText(t("admin.seatPlaceholder")), s.registrationNumber);
    }
    const second = within(dialog).getByTestId("seat-2");
    await app.user.click(await within(second).findByRole("button", { name: t("admin.setLeader") }));

    await app.user.click(within(dialog).getByRole("button", { name: t("admin.editStep") }));
    expect(within(dialog).getByDisplayValue("العمل عن بعد")).toBeInTheDocument();
    await app.user.click(next());
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.back")) }));
    await app.user.click(next());

    const create = within(dialog).getByRole("button", { name: esc(t("admin.assignCreateBtn")) });
    await waitFor(() => expect(create).toBeEnabled());
    await app.user.click(create);
    await waitFor(() => expect(fake.find("post", "/admin/topics/assigned")).toHaveLength(1));
    expect(fake.find("post", "/admin/topics/assigned")[0]!.body).toMatchObject({
      title: "العمل عن بعد",
      specializationId: F.specialization.id,
      maxStudents: 2,
      maxRequests: 3,
      memberStudentIds: [F.student2.id, F.student3.id],
      leaderStudentId: F.student3.id,
    });
  });

  it("رفض الخادم للإسناد ⇒ سببه في النافذة، ولا تُغلق", async () => {
    fake.fail("post", "/admin/topics/assigned", 409, "الأستاذ بلغ حدّه من المذكّرات");
    const { app, dialog } = await open(t("admin.assignTopicBtn"));
    await fillTopic(app, dialog);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
    const seat = await within(dialog).findByTestId("seat-1");
    await app.user.type(within(seat).getByPlaceholderText(t("admin.seatPlaceholder")), F.student2.registrationNumber);
    const create = within(dialog).getByRole("button", { name: esc(t("admin.assignCreateBtn")) });
    await waitFor(() => expect(create).toBeEnabled());
    await app.user.click(create);
    expect(await within(dialog).findByText("الأستاذ بلغ حدّه من المذكّرات")).toBeInTheDocument();
  });

  it("طالبٌ في مشروعٍ قائم ⇒ لا يُقبل في المقعد، ولا «إنشاء»", async () => {
    const { app, dialog } = await open(t("admin.assignTopicBtn"));
    await fillTopic(app, dialog);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
    const seat = await within(dialog).findByTestId("seat-1");
    await app.user.type(within(seat).getByPlaceholderText(t("admin.seatPlaceholder")), F.student1.registrationNumber);
    await waitFor(() => expect(fake.find("get", "/admin/students").some((c) => c.query.registrationNumber === F.student1.registrationNumber)).toBe(true));
    expect(within(dialog).getByRole("button", { name: esc(t("admin.assignCreateBtn")) })).toBeDisabled();
  });
});

/** From the students to the review, then «تأكيد وحفظ». */
describe("ملءُ المقعد بثلاث طرق: القائمة، والاسم بأيّ ترتيب، ورقم التسجيل", () => {
  async function toSeats() {
    const { app, dialog } = await open(t("admin.assignTopicBtn"));
    await fillTopic(app, dialog);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
    return { app, dialog, seat: await within(dialog).findByTestId("seat-1") };
  }

  it("القائمة: طلبة تخصّص الموضوع الأحرار وحدهم، والاختيار يملأ رقم التسجيل", async () => {
    const { app, dialog, seat } = await toSeats();
    await app.user.click(within(seat).getByTestId("seat-1-browse"));
    const list = await within(seat).findByRole("listbox");
    await waitFor(() =>
      expect(
        fake.find("get", "/admin/students").some((c) => c.query.specializationId === F.specialization.id && c.query.unassigned === "true"),
      ).toBe(true),
    );
    // The other specialization's student is not offered.
    await within(list).findByRole("option", { name: new RegExp(F.student2.registrationNumber) });
    expect(within(list).queryByRole("option", { name: new RegExp(F.student4.registrationNumber) })).toBeNull();

    await app.user.click(within(list).getByRole("option", { name: new RegExp(F.student2.registrationNumber) }));
    expect(within(seat).getByRole("combobox")).toHaveValue(F.student2.registrationNumber);
    await waitFor(() => expect(within(dialog).getByRole("button", { name: esc(t("admin.assignCreateBtn")) })).toBeEnabled());
    expect(within(seat).queryByRole("listbox")).toBeNull();
  });

  it("حروفٌ من الاسم واللقب بأيّ ترتيب تضيّقها، والأسهم وEnter تختار", async () => {
    const { app, seat } = await toSeats();
    const field = within(seat).getByRole("combobox");
    await app.user.type(field, "رابط سا");
    const list = await within(seat).findByRole("listbox");
    await waitFor(() => expect(fake.find("get", "/admin/students").some((c) => c.query.quickSearch === "رابط سا")).toBe(true));
    // Once the whole term is asked: her alone.
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(1));
    const option = within(list).getByRole("option", { name: new RegExp(F.student2.registrationNumber) });
    expect(option).toHaveAttribute("aria-selected", "true");
    await app.user.keyboard("{Enter}");
    expect(field).toHaveValue(F.student2.registrationNumber);
  });

  it("وما لا يطابق أحداً يُقال؛ وEscape يُغلق القائمة", async () => {
    const { app, seat } = await toSeats();
    const field = within(seat).getByRole("combobox");
    await app.user.type(field, "لا أحد بهذا الاسم");
    expect(await within(seat).findByText(t("studentOptions.none"))).toBeInTheDocument();
    await app.user.keyboard("{Escape}");
    expect(within(seat).queryByRole("listbox")).toBeNull();
  });
});

async function confirm(app: App, dialog: HTMLElement) {
  await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
  await within(dialog).findByTestId("topic-review");
  await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.confirmSave")) }));
}

describe("تعديل إسنادٍ قائم", () => {
  async function openEdit() {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    const row = (await screen.findAllByText(F.topicFull.title)).map((x) => x.closest("tr")).find(Boolean)!;
    await app.user.click(within(row).getByRole("button", { name: t("admin.edit") }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByDisplayValue(F.topicFull.title);
    return { app, dialog };
  }

  it("يُفتح بما هو عليه — وطلبته في مقاعدهم — ويُحفظ ما غُيّر معهم", async () => {
    const { app, dialog } = await openEdit();
    const title = within(dialog).getByDisplayValue(F.topicFull.title);
    await app.user.type(title, " في الجزائر");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));

    expect(await within(dialog).findByDisplayValue(F.student1.registrationNumber)).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue(F.student4.registrationNumber)).toBeInTheDocument();
    // الطلبة المبذورون لا يُسأل عنهم الخادم: البحث لمن لا موضوع له، فيُفرغ مقاعدهم.
    expect(fake.find("get", "/admin/students").filter((c) => c.query.quickSearch)).toEqual([]);

    await confirm(app, dialog);
    await waitFor(() => expect(fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)).toHaveLength(1));
    expect(fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)[0]!.body).toMatchObject({
      title: `${F.topicFull.title} في الجزائر`,
      professorId: F.prof1.id,
      specializationId: F.specialization.id,
      academicYearId: F.year.id,
      memberStudentIds: [F.student1.id, F.student4.id],
      leaderStudentId: F.student1.id,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("الوصف والسنة وسقف الطلبات والبنية تُحفظ؛ وعدد الطلبة يبقى كما هو — يُعرض ولا يُكتب", async () => {
    const { app, dialog } = await openEdit();
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.assignTopicDescPlaceholder")), " ميدانيّة");
    await choose(app, dialog, t("admin.academicYear"), F.pastYear.title);
    const cap = within(dialog).getByPlaceholderText(t("admin.maxRequestsNone"));
    await app.user.clear(cap);
    await app.user.type(cap, "4");
    await choose(app, dialog, t("admin.faculty"), F.faculty.name);
    await choose(app, dialog, t("admin.department"), F.department.name);
    await choose(app, dialog, t("admin.filiere"), F.filiere.name);
    await choose(app, dialog, t("admin.specialization"), F.specialization.name);
    // No rule for the year's level: the topic's own number, shown — and where the administration sets it.
    const size = within(dialog).getByTestId("team-size");
    expect(size).toHaveAttribute("data-mode", "unset");
    expect(size).toHaveTextContent(t("teamSize.count", { count: F.topicFull.maxStudents }));
    expect(within(size).queryByRole("spinbutton")).toBeNull();
    expect(within(dialog).getByTestId("team-size-hint")).toHaveTextContent(t("admin.teamSize.title"));

    const next = () => within(dialog).getByRole("button", { name: esc(t("admin.next")) });
    await app.user.click(next());
    expect(await within(dialog).findByTestId("seat-1")).toBeInTheDocument();
    expect(within(dialog).getByTestId("seat-2")).toBeInTheDocument();
    // العودة من التذييل ومن «تعديل» في المراجعة كلتاهما إلى الخطوة الأولى.
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.back")) }));
    await app.user.click(next());
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.editStep") }));
    expect(within(dialog).getByPlaceholderText(t("admin.assignTopicDescPlaceholder"))).toBeInTheDocument();
    await app.user.click(next());

    await confirm(app, dialog);
    await waitFor(() => expect(fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)).toHaveLength(1));
    const body = fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      academicYearId: F.pastYear.id,
      specializationId: F.specialization.id,
      maxStudents: F.topicFull.maxStudents,
      maxRequests: 4,
      memberStudentIds: [F.student1.id, F.student4.id],
      leaderStudentId: F.student1.id,
    });
    expect(String(body.description)).toMatch(/ميدانيّة$/);
  });

  it("الكلّية وحدها تحصر الشعب والتخصّصات في أقسامها، والقسم يحصرها فيه", async () => {
    const { app, dialog } = await openEdit();
    await choose(app, dialog, t("admin.faculty"), F.faculty.name);
    await app.user.click(within(dialog).getByRole("combobox", { name: t("admin.filiere") }));
    expect(await screen.findByRole("option", { name: esc(F.filiere.name) })).toBeInTheDocument();
    await app.user.keyboard("{Escape}");
    await choose(app, dialog, t("admin.department"), F.department2.name);
    await app.user.click(within(dialog).getByRole("combobox", { name: t("admin.specialization") }));
    expect(screen.queryByRole("option", { name: esc(F.specialization.name) })).toBeNull();
  });

  it("مقعدٌ يُفرغ ويُملأ بطالبٍ آخر، ونجمته تجعله المرسِل", async () => {
    const { app, dialog } = await openEdit();
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
    const seat = await within(dialog).findByTestId("seat-2");
    await app.user.click(within(seat).getByRole("button", { name: t("admin.clear") }));
    await app.user.type(within(seat).getByPlaceholderText(t("admin.seatPlaceholder")), F.student2.registrationNumber);
    const star = await within(seat).findByRole("button", { name: t("admin.setLeader") });
    expect(star).toBeEnabled();
    await app.user.click(star);
    await confirm(app, dialog);
    await waitFor(() => expect(fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)[0]?.body).toMatchObject({
      memberStudentIds: [F.student1.id, F.student2.id],
      leaderStudentId: F.student2.id,
    }));
  });

  it("المراجعة والتأكيد: ما تغيّر بقيمتيه، والطلبة بمرسِلهم، ولا حفظ قبل التأكيد؛ و«تعديل» يعيد إلى مرحلته", async () => {
    const { app, dialog } = await openEdit();
    await app.user.type(within(dialog).getByDisplayValue(F.topicFull.title), " — جديد");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
    await within(dialog).findByTestId("seat-1");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));

    const review = await within(dialog).findByTestId("topic-review");
    expect(within(review).getByTestId("topic-review-count")).toHaveTextContent(t("admin.topicReview.changes", { count: 1 }));
    const changes = within(review).getByTestId("topic-review-changes");
    expect(changes).toHaveTextContent(t("admin.topicTitle"));
    expect(changes).toHaveTextContent(F.topicFull.title);
    expect(changes).toHaveTextContent(`${F.topicFull.title} — جديد`);
    // The team as it will be saved, its sender marked.
    expect(within(review).getByText(t("admin.topicReview.leader"))).toBeInTheDocument();
    expect(fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)).toEqual([]);

    // «تعديل» on the topic's card: back to its step, everything kept.
    await app.user.click(within(review).getAllByRole("button", { name: esc(t("admin.editStep")) })[0]!);
    expect(within(dialog).getByDisplayValue(`${F.topicFull.title} — جديد`)).toBeInTheDocument();
  });

  it("رفض الخادم ⇒ سببه في النافذة", async () => {
    fake.fail("patch", "/admin/topics/:id/assignment", 409, "للفريق تسليمات — لا يُغيَّر أعضاؤه");
    const { app, dialog } = await openEdit();
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
    await confirm(app, dialog);
    expect(await within(dialog).findByText("للفريق تسليمات — لا يُغيَّر أعضاؤه")).toBeInTheDocument();
  });
});
