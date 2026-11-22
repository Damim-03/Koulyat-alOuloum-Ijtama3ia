import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";
import { formatDay, universityDay } from "../../lib/proposal-window";

/**
 * فضاء الأستاذ: يقترح موضوعاً (وحده أو بفريقٍ يسمّيه)، ويعدّله، ويحذفه؛
 * ويرسم لفريقه مراحل المشروع بمواعيدها.
 *
 * يُحرس: أنّ الاقتراح لا يُرسل ناقصاً؛ وأنّ الصفوف الفارغة (متطلّبٌ أو مرجعٌ
 * بلا رابط) لا تصل الخادم؛ وأنّ الفريق يُرسل بأرقام تسجيله ومرسِله؛ وأنّ موعد
 * المرحلة يُرسل بتوقيتٍ كامل لا بنصّ الحقل المحلّي.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function openTopicForm(label: string) {
  const app = renderApp("/ar/professor/topics", { as: "professor" });
  await screen.findAllByText(F.topicOpen.title);
  await app.user.click(screen.getByRole("button", { name: esc(label) }));
  return { app, dialog: (await screen.findAllByRole("dialog")).at(-1)! };
}

async function fillTopic(app: ReturnType<typeof renderApp>, dialog: HTMLElement) {
  await app.user.type(within(dialog).getByPlaceholderText(t("pro.titlePlaceholder")), "العمل عن بعد والانتماء المؤسّسي");
  await app.user.type(within(dialog).getByPlaceholderText(t("pro.descriptionPlaceholder")), "دراسة على عيّنة من الموظّفين");
  await app.user.type(within(dialog).getByPlaceholderText(t("pro.requirementItemPlaceholder")), "مقابلات نصف موجّهة{Enter}");
  await app.user.click(within(dialog).getByRole("combobox", { name: t("pro.academicYear") }));
  await app.user.click(await screen.findByRole("option", { name: esc(F.year.title) }));
  await app.user.click(within(dialog).getByRole("combobox", { name: t("pro.specialization") }));
  await app.user.click(await screen.findByRole("option", { name: esc(F.specialization.name) }));
}

describe("اقتراح موضوع", () => {
  it("وحده: يُرسل إلى الإدارة — ومرجعٌ بلا رابطٍ صالح يُقال قبل الإرسال", async () => {
    const { app, dialog } = await openTopicForm(t("pro.sendNewTopic"));
    await fillTopic(app, dialog);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.addReference")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.referenceTitlePlaceholder")), "دليل البحث");
    await app.user.type(within(dialog).getByPlaceholderText("https://…"), "ليس رابطاً");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) }));
    expect(await within(dialog).findByText(t("validation.urlInvalid"))).toBeInTheDocument();
    expect(fake.find("post", "/professor/topics")).toEqual([]);

    const url = within(dialog).getByPlaceholderText("https://…");
    await app.user.clear(url);
    await app.user.type(url, "https://example.org/guide");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) }));

    await waitFor(() => expect(fake.find("post", "/professor/topics")).toHaveLength(1));
    const body = fake.find("post", "/professor/topics")[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      title: "العمل عن بعد والانتماء المؤسّسي",
      description: "دراسة على عيّنة من الموظّفين",
      specializationId: F.specialization.id,
      academicYearId: F.year.id,
      requirements: ["مقابلات نصف موجّهة"],
      references: [{ title: "دليل البحث", url: "https://example.org/guide" }],
    });
    expect(body).not.toHaveProperty("facultyId");
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  });

  it("بلا عنوان ⇒ لا إرسال، ويُقال", async () => {
    const { app, dialog } = await openTopicForm(t("pro.sendNewTopic"));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) }));
    await waitFor(() => expect(within(dialog).getAllByText(/./).length).toBeGreaterThan(0));
    expect(fake.find("post", "/professor/topics")).toEqual([]);
  });

  it("بفريق: خطوتان، والطلبة بأرقام تسجيلهم، والمختار مرسِلاً", async () => {
    // طالبان: عدد الإدارة لمستوى الماستر — يُعرض ولا يُكتب، فالفريق يتّسع للاثنين.
    fake.on("get", "/common/academic-years", { academicYears: [{ ...F.year, teamSizes: { master: { n: 2, mode: "exact" } } }, F.pastYear] });
    const { app, dialog } = await openTopicForm(t("pro.newTopicWithGroup"));
    const next = within(dialog).getByRole("button", { name: esc(t("pro.next")) });
    expect(next).toBeDisabled();
    await fillTopic(app, dialog);
    expect(within(dialog).getByTestId("team-size")).toHaveTextContent(t("teamSize.count", { count: 2 }));
    await app.user.click(next);

    // مقعدٌ لكلّ طالب، كمقاعد الإدارة؛ والنتيجة خيارٌ باسم الطالب ورقمه — لا زرّ «استعمل ما كُتب».
    const seat = async (n: number) => within(await within(dialog).findByTestId(`team-seat-${n}`));
    await app.user.type((await seat(1)).getByRole("combobox"), "سارة");
    await app.user.click((await within(dialog).findAllByRole("option", { name: new RegExp(F.student2.registrationNumber) }))[0]!);
    await app.user.type((await seat(2)).getByRole("combobox"), "ياسين");
    await app.user.click((await within(dialog).findAllByRole("option", { name: new RegExp(F.student3.registrationNumber) }))[0]!);
    // المرسِل: الأوّل تلقائياً، ثمّ نجمة الثاني تجعله هو.
    expect(within(dialog).getByTestId("team-seat-1")).toHaveTextContent(t("pro.leader"));
    await app.user.click((await seat(2)).getByRole("button", { name: t("admin.setLeader") }));
    expect(within(dialog).getByTestId("team-seat-2")).toHaveTextContent(t("pro.leader"));
    expect(within(dialog).getByTestId("team-seat-1")).not.toHaveTextContent(t("pro.leader"));

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) }));
    await waitFor(() => expect(fake.find("post", "/professor/topics/with-group")).toHaveLength(1));
    expect(fake.find("post", "/professor/topics/with-group")[0]!.body).toMatchObject({
      memberRegistrationNumbers: [F.student2.registrationNumber, F.student3.registrationNumber],
      leaderRegistrationNumber: F.student3.registrationNumber,
      maxStudents: 2,
    });
  });
});

describe("نموذج الأستاذ كنموذج الإدارة", () => {
  it("عدد الطلبة فارغٌ قبل السنة والتخصّص، ثمّ ما قرّرته الإدارة؛ وملاحظات الفريق: الطرق الثلاث، والمرسِل، ومن يُقبل", async () => {
    fake.on("get", "/common/academic-years", { academicYears: [{ ...F.year, teamSizes: { master: { n: 2, mode: "exact" } } }, F.pastYear] });
    const { app, dialog } = await openTopicForm(t("pro.newTopicWithGroup"));
    const size = within(dialog).getByTestId("team-size");
    expect(size).toHaveAttribute("data-mode", "pending");
    expect(size).toHaveTextContent(/^$/);
    expect(within(dialog).getByTestId("team-size-hint")).toHaveTextContent(t("teamSize.pendingHint"));

    await fillTopic(app, dialog);
    expect(within(dialog).getByTestId("team-size")).toHaveTextContent(t("teamSize.count", { count: 2 }));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.next")) }));

    // A numbered seat per student — two — and the notes under them.
    expect(await within(dialog).findByTestId("team-seat-1")).toBeInTheDocument();
    expect(within(dialog).getByTestId("team-seat-2")).toBeInTheDocument();
    expect(within(dialog).queryByTestId("team-seat-3")).toBeNull();
    expect(within(dialog).getByText(t("pro.leaderHint"))).toBeInTheDocument();
    expect(within(dialog).getByTestId("team-seats-hint")).toHaveTextContent(t("pro.registrationNumbersHint"));
    expect(within(dialog).getByTestId("team-seats-hint")).toHaveTextContent(t("pro.numbersCheckedOnSubmit"));
  });
});

describe("فريق الأستاذ: القائمة والاسم بأيّ ترتيب", () => {
  it("الضغط على الحقل يعرض طلبة التخصّص وحدهم؛ والاختيار يضيف؛ والحروف بأيّ ترتيب تضيّق", async () => {
    fake.on("get", "/common/academic-years", { academicYears: [{ ...F.year, teamSizes: { master: { n: 2, mode: "exact" } } }, F.pastYear] });
    const { app, dialog } = await openTopicForm(t("pro.newTopicWithGroup"));
    await fillTopic(app, dialog);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.next")) }));

    const field = within(await within(dialog).findByTestId("team-seat-1")).getByRole("combobox");
    await app.user.click(field);
    const list = await within(dialog).findByRole("listbox");
    await waitFor(() =>
      expect(fake.find("get", "/professor/students/search").some((c) => !c.query.q && c.query.specializationId === F.specialization.id)).toBe(true),
    );
    await within(list).findByRole("option", { name: new RegExp(F.student3.registrationNumber) });
    expect(within(list).queryByRole("option", { name: new RegExp(F.student4.registrationNumber) })).toBeNull();
    await app.user.click(within(list).getByRole("option", { name: new RegExp(F.student3.registrationNumber) }));

    // Letters of the names, the last name first — in the next seat.
    await app.user.type(within(within(dialog).getByTestId("team-seat-2")).getByRole("combobox"), "رابط سا");
    await app.user.click(await within(dialog).findByRole("option", { name: new RegExp(F.student2.registrationNumber) }));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) }));
    await waitFor(() => expect(fake.find("post", "/professor/topics/with-group")).toHaveLength(1));
    expect(fake.find("post", "/professor/topics/with-group")[0]!.body).toMatchObject({
      memberRegistrationNumbers: [F.student3.registrationNumber, F.student2.registrationNumber],
    });
  });
});

describe("حقولٌ بأكثر من عنصر", () => {
  /**
   * داخل <label> تنتقل النقرة على أيّ نصٍّ فيه إلى أوّل عنصرٍ تفاعليّ: وكان
   * ذلك زرّ إزالة أوّل طالبٍ في الفريق، وزرّ أوّل متطلّبٍ في القائمة. فالنقر
   * على اسم الحقل أو شرحه كان يُخرج الطالب أو يُحرّك المتطلّب بصمت.
   */
  it("النقر على اسم الحقل وشرحه لا يزيل طالباً ولا متطلّباً", async () => {
    const { app, dialog } = await openTopicForm(t("pro.newTopicWithGroup"));
    await fillTopic(app, dialog);
    await app.user.click(within(dialog).getByText(t("pro.requirements")));
    expect(within(dialog).getByText("مقابلات نصف موجّهة")).toBeInTheDocument();

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.next")) }));
    const search = await within(dialog).findByPlaceholderText(t("pro.searchStudentToPropose"));
    await app.user.type(search, "سارة");
    await app.user.click((await within(dialog).findAllByRole("option", { name: new RegExp(F.student2.registrationNumber) }))[0]!);
    expect(within(dialog).getByText("1 / 1")).toBeInTheDocument();

    await app.user.click(within(dialog).getByText(t("pro.leaderHint")));
    await app.user.click(within(dialog).getByTestId("team-seats-hint"));
    expect(within(dialog).getByText("1 / 1")).toBeInTheDocument();
    // وزرّ الإزالة له اسمه، فيُقرأ ويُختار عمداً.
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.removeCover") }));
    expect(within(dialog).getByText("0 / 1")).toBeInTheDocument();
  });
});

describe("موضوعي", () => {
  it("التعديل يُرسل إلى مساره بما تغيّر، والحذف بعد التأكيد يعيد إلى القائمة", async () => {
    const app = renderApp("/ar/professor/topics/t-pending", { as: "professor" });
    await screen.findAllByText(F.topicPending.title);
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.editTopic")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    const title = await within(dialog).findByDisplayValue(F.topicPending.title);
    await app.user.type(title, " وأسبابه");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.saveChanges")) }));
    await waitFor(() => expect(fake.find("put", "/professor/topics/t-pending")[0]?.body).toMatchObject({ title: `${F.topicPending.title} وأسبابه` }));

    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    await app.user.click(screen.getByRole("button", { name: t("pro.delete") }));
    await app.user.click(await screen.findByRole("button", { name: t("admin.yesDelete") }));
    await waitFor(() => expect(fake.find("delete", "/professor/topics/t-pending")).toHaveLength(1));
    await waitFor(() => expect(app.location()).toBe("/ar/professor/topics"));
  });
});

describe("المراحل", () => {
  async function manager() {
    const app = renderApp("/ar/professor/milestones", { as: "professor" });
    await app.user.click((await screen.findAllByText(F.topicFull.title))[0]!);
    await screen.findAllByText("الاستمارة");
    return app;
  }

  it("مرحلةٌ جديدة بموعدها ⇒ يُرسل الموعد بتوقيتٍ كامل", async () => {
    const app = await manager();
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.addMilestone")) }));
    const dialog = await screen.findByRole("dialog", { name: t("pro.addMilestone") });
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.milestoneTitlePlaceholder")), "تحليل النتائج");
    await app.user.type(dialog.querySelector('input[type="datetime-local"]')!, "2026-12-01T10:30");
    const order = within(dialog).getByRole("spinbutton");
    await app.user.clear(order);
    await app.user.type(order, "5");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.save")) }));

    await waitFor(() => expect(fake.find("post", `/professor/groups/${F.ID.g1}/milestones`)).toHaveLength(1));
    expect(fake.find("post", `/professor/groups/${F.ID.g1}/milestones`)[0]!.body).toMatchObject({
      title: "تحليل النتائج",
      deadline: new Date("2026-12-01T10:30").toISOString(),
      order: 5,
    });
  });

  it("تعديل مرحلةٍ يفتح بقيمها، وحذفها بعد التأكيد", async () => {
    const app = await manager();
    await app.user.click(screen.getAllByRole("button", { name: t("pro.edit") })[0]!);
    const dialog = await screen.findByRole("dialog", { name: t("pro.editMilestone") });
    // يُفتح بقيم المرحلة المختارة — أيّاً كان ترتيبها في القائمة.
    const title = within(dialog).getByPlaceholderText(t("pro.milestoneTitlePlaceholder")) as HTMLInputElement;
    const ms = F.milestones.find((m) => m.title === title.value)!;
    expect(ms).toBeDefined();
    await app.user.type(title, " (معدّلة)");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.save")) }));
    await waitFor(() => expect(fake.find("put", `/professor/milestones/${ms.id}`)[0]?.body).toMatchObject({ title: `${ms.title} (معدّلة)` }));

    await app.user.click(screen.getAllByRole("button", { name: t("pro.delete") })[0]!);
    await app.user.click((await screen.findAllByRole("button", { name: t("admin.delete") })).at(-1)!);
    await waitFor(() => expect(fake.find("delete", /^\/professor\/milestones\//)).toHaveLength(1));
  });

  it("البحث في المراحل بلا همزة يحصرها ويعلّمها، والحال بأعدادها؛ ولا شيء ⇒ إعادة الضبط", async () => {
    const app = await manager();
    const timeline = () => screen.getByTestId("ms-toolbar").parentElement!;
    const titles = () => within(timeline()).queryAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    const states = screen.getByRole("group", { name: t("pro.ms.msFilter") });
    const chip = (label: string) => within(states).getByRole("button", { name: new RegExp(`^${label}`) });
    expect(chip(t("status.overdue"))).toHaveTextContent("1");
    await app.user.click(chip(t("status.overdue")));
    expect(titles()).toEqual(["الدراسة الميدانية"]);
    await app.user.click(chip(t("status.overdue")));
    expect(titles()).toHaveLength(4);

    const search = screen.getByRole("searchbox", { name: t("pro.ms.msSearch") });
    await app.user.type(search, "استماره");
    expect(titles()).toEqual(["الاستمارة"]);
    expect(within(timeline()).getByRole("heading", { level: 3 }).querySelector("mark")?.textContent).toBe("استمارة");
    expect(chip(t("pro.ms.any"))).toHaveTextContent("1");

    // Escape يمسح، وكذا الزرّ.
    await app.user.keyboard("{Escape}");
    expect(search).toHaveValue("");
    await app.user.type(search, "استماره");
    await app.user.click(screen.getByRole("button", { name: t("pro.ms.clearSearch") }));
    expect(titles()).toHaveLength(4);
    await app.user.type(search, "استماره");

    await app.user.click(chip(t("status.completed")));
    expect(screen.getByTestId("ms-empty")).toHaveTextContent(t("pro.ms.msNoMatch"));
    await app.user.click(within(screen.getByTestId("ms-empty")).getByRole("button", { name: t("pro.ms.reset") }));
    expect(search).toHaveValue("");
    expect(titles()).toHaveLength(4);
  });

  it("«تغيير المشروع» يعيد إلى الاختيار", async () => {
    const app = await manager();
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.changeProject")) }));
    expect(screen.queryByRole("button", { name: esc(t("pro.addMilestone")) })).toBeNull();
  });
});

describe("لوحة المراحل: البحث والفلاتر والترتيب", () => {
  const tm = (k: string, o?: object) => t(`pro.ms.${k}`, o);
  const base = F.profGroups[0]!;
  const done = base.milestones!.map((m) => ({ ...m, status: "completed", _count: { submissions: 0 } }));
  const groups = [
    // مذكرةٌ فيها متأخّرة (الدراسة الميدانية) وأخرى بعد خمسة أيام، وثلاثة ملفات، ومناقشةٌ مبرمجة.
    base,
    { ...base, id: "gb", topic: { ...base.topic!, id: "t-gb", title: "مشروعٌ بلا مراحل" }, milestones: [], _count: { milestones: 0 }, defense: null, members: [base.members![0]!], createdAt: F.days(-5) },
    {
      ...base,
      id: "gd",
      topic: { ...base.topic!, id: "t-gd", title: "مشروعٌ مكتمل", academicYear: { id: F.pastYear.id, title: F.pastYear.title } },
      milestones: done,
      members: [base.members![1]!],
      defense: null,
    },
  ];
  const tile = (h: string) => screen.getByTestId("board-hero").querySelector<HTMLElement>(`[data-health="${h}"]`)!;
  const shown = () =>
    [...(screen.queryByTestId("board-grid")?.children ?? [])].map((li) => li.firstElementChild!.getAttribute("data-testid")!.replace("board-card-", ""));
  const param = (app: ReturnType<typeof renderApp>, k: string) => new URL(`http://x${app.location()}`).searchParams.get(k);
  async function board(path = "/ar/professor/milestones") {
    fake.on("get", "/professor/groups", { groups });
    const app = renderApp(path, { as: "professor" });
    await screen.findByTestId(`board-card-${base.id}`);
    return app;
  }

  it("الرأس يعدّ؛ والبحث بلا همزةٍ يحصر ويقول أين وقع ويُعلَّم؛ وهو في العنوان؛ وEscape يمسحه", async () => {
    const app = await board();
    expect(["all", "late", "soon", "done", "empty"].map((h) => tile(h).textContent)).toEqual([
      `3${tm("health.all")}`,
      `1${tm("health.late")}`,
      `1${tm("health.soon")}`,
      `1${tm("health.done")}`,
      `1${tm("health.empty")}`,
    ]);
    expect(screen.getByTestId("board-results")).toHaveTextContent(tm("results", { shown: 3, total: 3 }));

    const search = screen.getByTestId("board-search");
    await app.user.type(search, "امين");
    expect(shown().sort()).toEqual([base.id, "gb"].sort());
    const card = screen.getByTestId(`board-card-${base.id}`);
    expect(within(card).getByTestId("board-card-hits")).toHaveTextContent(`${tm("hit.student")}: ${F.student1.user!.firstName} ${F.student1.user!.lastName}`);
    expect(card.querySelector("mark")?.textContent).toBe(F.student1.user!.firstName);
    expect(param(app, "q")).toBe("امين");
    expect(screen.getByTestId("board-active")).toHaveTextContent(`${tm("searchChip")}:امين`);

    // ورقم التسجيل، واسم المرحلة.
    await app.user.clear(search);
    await app.user.type(search, F.student4.registrationNumber);
    expect(shown().sort()).toEqual([base.id, "gd"].sort());
    await app.user.clear(search);
    await app.user.type(search, "الاستماره");
    expect(shown().sort()).toEqual([base.id, "gd"].sort());

    await app.user.keyboard("{Escape}");
    expect(search).toHaveValue("");
    expect(shown()).toHaveLength(3);
    expect(param(app, "q")).toBeNull();
  });

  it("حال المراحل من الرأس تُلغى بنقرتها؛ والفلاتر بأعدادها وشاراتها؛ ولا نتيجة ⇒ إعادة الضبط", async () => {
    const app = await board();
    await app.user.click(tile("late"));
    expect(tile("late")).toHaveAttribute("aria-pressed", "true");
    expect(shown()).toEqual([base.id]);
    await app.user.click(tile("late"));
    expect(shown()).toHaveLength(3);

    const files = screen.getByRole("group", { name: tm("files") });
    await app.user.click(within(files).getByRole("button", { name: new RegExp(tm("filesOf.without")) }));
    expect(shown().sort()).toEqual(["gb", "gd"]);
    expect(param(app, "files")).toBe("without");

    await app.user.click(screen.getByRole("combobox", { name: tm("year") }));
    await app.user.click(screen.getByRole("option", { name: new RegExp(F.pastYear.title) }));
    expect(shown()).toEqual(["gd"]);
    expect(screen.getByTestId("board-filters-toggle")).toHaveTextContent("2");

    await app.user.click(screen.getByRole("button", { name: tm("remove", { name: tm("files") }) }));
    expect(shown()).toEqual(["gd"]);
    expect(param(app, "files")).toBeNull();

    // حالٌ لا تجتمع مع السنة: لا شيء، وزرّ إعادة الضبط.
    await app.user.click(tile("late"));
    expect(screen.getByTestId("board-empty")).toHaveTextContent(tm("noMatch"));
    await app.user.click(within(screen.getByTestId("board-empty")).getByRole("button", { name: tm("reset") }));
    expect(shown()).toHaveLength(3);
    expect(app.location()).toBe("/ar/professor/milestones");
    expect(screen.queryByTestId("board-active")).toBeNull();
  });

  it("الترتيب بالعنوان ثمّ بالإنجاز", async () => {
    const app = await board();
    await app.user.click(screen.getByRole("combobox", { name: tm("sort") }));
    await app.user.click(screen.getByRole("option", { name: tm("sortOf.title") }));
    const byTitle = [...groups].sort((a, b) => a.topic!.title.localeCompare(b.topic!.title, "ar")).map((g) => g.id);
    expect(shown()).toEqual(byTitle);
    await app.user.click(screen.getByRole("combobox", { name: tm("sort") }));
    await app.user.click(screen.getByRole("option", { name: tm("sortOf.progressDesc") }));
    expect(shown()).toEqual(["gd", base.id, "gb"]);
  });

  it("لوحة الفلاتر تُطوى فتخرج من قارئ الشاشة، وتُذكر مطويّةً بين الزيارات", async () => {
    const app = await board();
    const toggle = screen.getByTestId("board-filters-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("board-panel")).not.toHaveAttribute("aria-hidden");
    await app.user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("board-panel")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("board-panel")).toHaveAttribute("inert");
    expect(screen.queryByRole("group", { name: tm("files") })).toBeNull();
    expect(localStorage.getItem("pro.milestones.filtersOpen")).toBe("0");
    app.unmount();

    await board();
    expect(screen.getByTestId("board-filters-toggle")).toHaveAttribute("aria-expanded", "false");
  });

  it("البحث المفصّل: كلّ حقلٍ في نوعه وحده، بشارته وعدّه على زرّ الفلاتر وفي العنوان", async () => {
    const app = await board();
    const field = (k: string) => screen.getByRole("searchbox", { name: tm(`field.${k}`) });
    const toggle = screen.getByTestId("board-filters-toggle");
    expect(within(screen.getByTestId("board-panel")).getByText(tm("detailed"))).toBeInTheDocument();

    // العنوان في العناوين وحدها: «قاعة» في قاعة المناقشة، لا في عنوان.
    await app.user.type(field("title"), "قاعة");
    expect(screen.getByTestId("board-empty")).toBeInTheDocument();
    await app.user.clear(field("title"));
    await app.user.type(field("title"), "مكتمل");
    expect(shown()).toEqual(["gd"]);
    expect(param(app, "title")).toBe("مكتمل");
    expect(screen.getByTestId("board-active")).toHaveTextContent(`${tm("field.title")}:مكتمل`);
    expect(within(toggle).getByText("1")).toBeInTheDocument();
    expect(screen.getByTestId("board-card-gd").querySelector("mark")?.textContent).toBe("مكتمل");
    await app.user.keyboard("{Escape}");
    expect(field("title")).toHaveValue("");
    expect(shown()).toHaveLength(3);

    // اسم الطالب: كلمتان (والفراغ بينهما يبقى) في طالبٍ واحد.
    await app.user.type(field("student"), "امين حداد");
    expect(field("student")).toHaveValue("امين حداد");
    expect(shown().sort()).toEqual([base.id, "gb"].sort());
    expect(within(screen.getByTestId(`board-card-${base.id}`)).getByTestId("board-card-hits")).toHaveTextContent(
      `${tm("hit.student")}: ${F.student1.user!.firstName} ${F.student1.user!.lastName}`,
    );
    await app.user.clear(field("student"));
    await app.user.type(field("student"), "أمين قاسمي");
    expect(screen.getByTestId("board-empty")).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: tm("clearField", { name: tm("field.student") }) }));
    expect(field("student")).toHaveValue("");
    expect(field("student")).toHaveFocus();

    // رقم التسجيل والقاعة معاً؛ وشارةٌ تُزال وحدها.
    await app.user.type(field("registration"), F.student4.registrationNumber);
    expect(shown().sort()).toEqual([base.id, "gd"].sort());
    await app.user.type(field("room"), "12");
    expect(shown()).toEqual([base.id]);
    expect(within(toggle).getByText("2")).toBeInTheDocument();
    expect(param(app, "registration")).toBe(F.student4.registrationNumber);
    expect(param(app, "room")).toBe("12");
    await app.user.click(screen.getByRole("button", { name: tm("remove", { name: tm("field.registration") }) }));
    expect(field("registration")).toHaveValue("");
    expect(param(app, "registration")).toBeNull();
    expect(shown()).toEqual([base.id]);

    // والبحث العامّ يقبل كلمتين تُكتبان، ويجتمع مع الحقول.
    await app.user.click(screen.getByRole("button", { name: tm("clearAll") }));
    await app.user.type(screen.getByTestId("board-search"), "امين الاستماره");
    expect(screen.getByTestId("board-search")).toHaveValue("امين الاستماره");
    expect(shown()).toEqual([base.id]);
  });

  it("رابطٌ بحقول البحث المفصّل يفتح بها", async () => {
    fake.on("get", "/professor/groups", { groups });
    renderApp(`/ar/professor/milestones?registration=${F.student4.registrationNumber}&title=${encodeURIComponent("مكتمل")}`, { as: "professor" });
    await screen.findByTestId("board-card-gd");
    expect(screen.getByRole("searchbox", { name: tm("field.registration") })).toHaveValue(F.student4.registrationNumber);
    expect(shown()).toEqual(["gd"]);
  });

  it("«/» يأخذ إلى البحث، و«/» داخله حرفٌ يُكتب؛ وزرّ المسح؛ وعدد الطلبة", async () => {
    const app = await board();
    const search = screen.getByTestId("board-search");
    await app.user.keyboard("/");
    expect(search).toHaveFocus();
    await app.user.keyboard("2025/2026");
    expect(search).toHaveValue("2025/2026");
    expect(shown().sort()).toEqual([base.id, "gb"].sort());
    await app.user.click(screen.getByRole("button", { name: tm("clearSearch") }));
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();

    const size = screen.getByRole("group", { name: tm("size") });
    await app.user.click(within(size).getByRole("button", { name: new RegExp(tm("students", { count: 2 })) }));
    expect(shown()).toEqual([base.id]);
    expect(screen.getByTestId("board-active")).toHaveTextContent(`${tm("size")}:${tm("students", { count: 2 })}`);
    await app.user.click(within(size).getByRole("button", { name: tm("any") }));
    expect(shown()).toHaveLength(3);
  });

  it("تعذّر جلب المذكرات ⇒ رسالةٌ وإعادة محاولة، لا «لا مذكرات»", async () => {
    fake.fail("get", "/professor/groups", 500, "x");
    renderApp("/ar/professor/milestones", { as: "professor" });
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(screen.queryByText(t("pro.noProjectsYet"))).toBeNull();
    expect(screen.queryByTestId("board-filters")).toBeNull();
  });

  it("رابطٌ بفلاتره يفتح بها؛ وفتح مذكرةٍ والعودة منها يُبقيها", async () => {
    const app = await board("/ar/professor/milestones?files=with");
    expect(shown()).toEqual([base.id]);
    expect(within(screen.getByRole("group", { name: tm("files") })).getByRole("button", { name: new RegExp(tm("filesOf.with")) })).toHaveAttribute("aria-pressed", "true");

    await app.user.click(within(screen.getByTestId(`board-card-${base.id}`)).getByRole("button", { name: esc(t("pro.manageMilestones")) }));
    await screen.findAllByText("الاستمارة");
    expect([param(app, "group"), param(app, "files")]).toEqual([base.id, "with"]);

    await app.user.click(screen.getByRole("button", { name: esc(t("pro.changeProject")) }));
    await screen.findByTestId(`board-card-${base.id}`);
    expect(shown()).toEqual([base.id]);
    expect(app.location()).toBe("/ar/professor/milestones?files=with");
  });
});

describe("قائمة مواضيعي", () => {
  async function list() {
    const app = renderApp("/ar/professor/topics", { as: "professor" });
    await screen.findAllByText(F.topicOpen.title);
    return app;
  }

  it("الحالة والبحث يحصران القائمة، و«مسح الفلاتر» يعيدها", async () => {
    const app = await list();
    const status = screen.getByRole("group", { name: t("pro.statusLabel") });
    await app.user.click(within(status).getByRole("button", { name: esc(t("status.rejected")) }));
    await waitFor(() => expect(screen.queryAllByText(F.topicOpen.title)).toHaveLength(0));

    await app.user.click(within(status).getByRole("button", { name: esc(t("pro.allTopicsFilter")) }));
    await app.user.type(screen.getByPlaceholderText(t("pro.searchTopic")), "الهجرة");
    await waitFor(() => expect(screen.queryAllByText(F.topicOpen.title)).toHaveLength(0));
    expect(screen.getAllByText(F.topicFull.title).length).toBeGreaterThan(0);

    await app.user.click(screen.getByRole("button", { name: t("pro.clearFilters") }));
    expect((await screen.findAllByText(F.topicOpen.title)).length).toBeGreaterThan(0);
  });

  it("موضوعٌ لم يُقرَّر يُعدَّل ويُحذف من صفّه؛ والمقرَّر لا", async () => {
    const app = await list();
    const row = (title: string) => screen.getAllByText(title)[0]!.closest("tr, li, article") as HTMLElement;
    expect(within(row(F.topicOpen.title)).queryByRole("button", { name: t("pro.delete") })).toBeNull();
    await app.user.click(within(row(F.topicPending.title)).getByRole("button", { name: t("pro.delete") }));
    await app.user.click(await screen.findByRole("button", { name: t("admin.yesDelete") }));
    await waitFor(() => expect(fake.find("delete", "/professor/topics/t-pending")).toHaveLength(1));

    await app.user.click(within(row(F.topicRejected.title)).getByRole("button", { name: esc(t("pro.edit")) }));
    expect(await screen.findByDisplayValue(F.topicRejected.title)).toBeInTheDocument();
  });
});

describe("اقتراح موضوع: البنية والقوائم والتنقّل", () => {
  async function pick(app: ReturnType<typeof renderApp>, dialog: HTMLElement, field: string, option: string) {
    await app.user.click(within(dialog).getByRole("combobox", { name: field }));
    await app.user.click(await screen.findByRole("option", { name: esc(option) }));
  }

  it("الكلّية وحدها تحصر الشعب والتخصّصات في أقسامها؛ وتغيير الأعلى يُفرغ ما تحته", async () => {
    const { app, dialog } = await openTopicForm(t("pro.sendNewTopic"));
    await pick(app, dialog, t("pro.faculty"), F.faculty.name);
    await app.user.click(within(dialog).getByRole("combobox", { name: t("pro.filiere") }));
    expect(await screen.findByRole("option", { name: esc(F.filiere.name) })).toBeInTheDocument();
    await app.user.keyboard("{Escape}");
    await app.user.click(within(dialog).getByRole("combobox", { name: t("pro.specialization") }));
    expect(await screen.findByRole("option", { name: esc(F.specialization.name) })).toBeInTheDocument();
    await app.user.keyboard("{Escape}");

    await pick(app, dialog, t("pro.department"), F.department.name);
    await pick(app, dialog, t("pro.filiere"), F.filiere.name);
    await pick(app, dialog, t("pro.specialization"), F.specialization.name);
    const spec = () => within(dialog).getByRole("combobox", { name: t("pro.specialization") });
    expect(spec()).toHaveTextContent(F.specialization.name);
    await pick(app, dialog, t("pro.filiere"), F.filiere.name);
    expect(spec()).not.toHaveTextContent(F.specialization.name);
    await pick(app, dialog, t("pro.specialization"), F.specialization.name);
    await pick(app, dialog, t("pro.department"), F.department.name);
    expect(spec()).not.toHaveTextContent(F.specialization.name);
    await pick(app, dialog, t("pro.specialization"), F.specialization.name);
    await pick(app, dialog, t("pro.faculty"), F.faculty.name);
    expect(spec()).not.toHaveTextContent(F.specialization.name);
  });

  it("الأهداف تُرسل، ومرجعٌ يُضاف ثمّ يُحذف فلا يُرسل", async () => {
    const { app, dialog } = await openTopicForm(t("pro.sendNewTopic"));
    await fillTopic(app, dialog);
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.objectiveItemPlaceholder")), "قياس الانتماء{Enter}");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.addReference")) }));
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.referenceTitlePlaceholder")), "مرجعٌ زائد");
    await app.user.click(within(dialog).getByRole("button", { name: t("pro.delete") }));
    expect(within(dialog).queryByPlaceholderText(t("pro.referenceTitlePlaceholder"))).toBeNull();
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) }));
    await waitFor(() => expect(fake.find("post", "/professor/topics")).toHaveLength(1));
    const body = fake.find("post", "/professor/topics")[0]!.body as Record<string, unknown>;
    expect(body.objectives).toEqual(["قياس الانتماء"]);
    expect(body.references ?? []).toEqual([]);
  });

  it("بفريق: من الطلبة إلى الموضوع بالخطوة وبـ«تعديل» وبـ«رجوع»، وما كُتب باقٍ", async () => {
    const { app, dialog } = await openTopicForm(t("pro.newTopicWithGroup"));
    await fillTopic(app, dialog);
    const next = () => within(dialog).getByRole("button", { name: esc(t("pro.next")) });
    const title = () => within(dialog).getByPlaceholderText(t("pro.titlePlaceholder"));
    const toTeam = async () => {
      await app.user.click(next());
      await within(dialog).findByPlaceholderText(t("pro.searchStudentToPropose"));
    };

    await toTeam();
    await app.user.click(within(within(dialog).getByTestId("step-topic")).getByRole("button"));
    expect(title()).toHaveValue("العمل عن بعد والانتماء المؤسّسي");
    await toTeam();
    await app.user.click(within(dialog).getByRole("button", { name: t("pro.editStep") }));
    expect(title()).toHaveValue("العمل عن بعد والانتماء المؤسّسي");
    await toTeam();
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.back")) }));
    expect(title()).toHaveValue("العمل عن بعد والانتماء المؤسّسي");
  });

  it("يُغلق من رأسه ومن خلفيّته بلا إرسال", async () => {
    const opened = await openTopicForm(t("pro.sendNewTopic"));
    const app = opened.app;
    let dialog = opened.dialog;
    await app.user.click(within(dialog).getAllByRole("button", { name: t("pro.cancel") })[0]!);
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.sendNewTopic")) }));
    dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(dialog.querySelector(".backdrop-blur-sm") as HTMLElement);
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    expect(fake.writes).toEqual([]);
  });
});

describe("قائمة مواضيعي: التخصّص والسنة والصفحات والمحضر", () => {
  async function pick(app: ReturnType<typeof renderApp>, field: string, option: string) {
    await app.user.click(screen.getByRole("combobox", { name: field }));
    await app.user.click(await screen.findByRole("option", { name: esc(option) }));
  }

  it("لوحة الفلاتر: التخصّص والسنة يحصران، وسنةٌ بلا مواضيع تُفرغ القائمة", async () => {
    fake.on("get", "/professor/topics", {
      topics: [
        ...F.profTopics,
        { ...F.profTopics[0]!, id: "t-old", title: "موضوعٌ من سنةٍ مضت", academicYearId: F.pastYear.id, specializationId: F.ID.spec2 },
      ],
    });
    const app = renderApp("/ar/professor/topics", { as: "professor" });
    await screen.findAllByText(F.topicOpen.title);
    const toggle = screen.getByRole("button", { name: esc(t("pro.filters")) });
    if (toggle.getAttribute("aria-expanded") !== "true") await app.user.click(toggle);

    await pick(app, t("pro.academicYear"), F.pastYear.title);
    await waitFor(() => expect(screen.queryAllByText(F.topicOpen.title)).toHaveLength(0));
    expect(screen.getAllByText("موضوعٌ من سنةٍ مضت").length).toBeGreaterThan(0);
    await pick(app, t("pro.specialization"), F.specialization.name);
    await waitFor(() => expect(screen.queryAllByText("موضوعٌ من سنةٍ مضت")).toHaveLength(0));

    await app.user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("أكثر من عشرة ⇒ صفحتان، والتالي والسابق", async () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ ...F.profTopics[0]!, id: `tp-${i}`, title: `موضوع رقم ${i + 1}` }));
    fake.on("get", "/professor/topics", { topics: many });
    const app = renderApp("/ar/professor/topics", { as: "professor" });
    await screen.findAllByText("موضوع رقم 1");
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.queryAllByText("موضوع رقم 11")).toHaveLength(0);
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.next") }));
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.getAllByText("موضوع رقم 11").length).toBeGreaterThan(0);
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.prev") }));
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("الحذف يُتراجع عنه بلا طلب؛ ومحضر الإشراف لموضوعٍ مكتمل يُفتح ويُغلق", async () => {
    const app = renderApp("/ar/professor/topics", { as: "professor" });
    await screen.findAllByText(F.topicOpen.title);
    const row = (title: string) => screen.getAllByText(title)[0]!.closest("tr, li, article") as HTMLElement;
    await app.user.click(within(row(F.topicPending.title)).getByRole("button", { name: t("pro.delete") }));
    const alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getAllByRole("button")[0]!);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fake.writes).toEqual([]);

    await app.user.click(within(row(F.topicFull.title)).getByRole("button", { name: esc(t("supervision.sheet")) }));
    const sheet = (await screen.findAllByRole("dialog")).at(-1)!;
    await waitFor(() => expect(fake.find("get", `/supervision-documents/topics/${F.topicFull.id}/preview`)).toHaveLength(1));
    await app.user.click(within(sheet).getAllByRole("button", { name: new RegExp(`${esc(t("admin.close")).source}|${esc(t("pro.cancel")).source}`) })[0]!);
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  });
});

describe("مشروع فريقي: المراحل وتسليماتها", () => {
  async function group() {
    const app = renderApp(`/ar/professor/groups/${F.ID.g1}`, { as: "professor" });
    await screen.findAllByText(F.milestones[0]!.title);
    return app;
  }
  const card = (title: string) => screen.getAllByText(title)[0]!.closest("li, article, div.rounded-2xl, div.rounded-xl") as HTMLElement;

  it("التسليمات تُبسط وتُطوى بأسمائها، ومرحلةٌ بلا تسليم تقول ذلك", async () => {
    const app = await group();
    const first = card(F.milestones[0]!.title);
    const toggle = within(first).getByRole("button", { name: esc(t("pro.viewSubmissions", { n: 2 })) });
    await app.user.click(toggle);
    expect(within(first).getByText("الفصل-1.pdf")).toBeInTheDocument();
    expect(within(first).getByText("الفصل-2.pdf").closest("div")!.parentElement!.querySelector("a")).toHaveAttribute("href", "/uploads/submissions/sub2.pdf");
    await app.user.click(toggle);
    expect(within(first).queryByText("الفصل-1.pdf")).toBeNull();
    expect(screen.getAllByText(t("pro.noSubmissions")).length).toBeGreaterThan(0);
  });

  it("«إضافة مرحلة» تفتح نموذجاً فارغاً، و«تعديل» يفتحه بقيمها", async () => {
    const app = await group();
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.addMilestone")) }));
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByPlaceholderText(t("pro.milestoneTitlePlaceholder"))).toHaveValue("");
    await app.user.click(within(dialog).getAllByRole("button", { name: new RegExp(`${esc(t("pro.cancel")).source}|${esc(t("admin.close")).source}`) })[0]!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await app.user.click(within(card(F.milestones[1]!.title)).getByRole("button", { name: t("pro.edit") }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByDisplayValue(F.milestones[1]!.title)).toBeInTheDocument();
  });

  it("الحذف بتأكيد يسمّي المرحلة؛ والتراجع لا يحذف", async () => {
    const app = await group();
    const del = () => within(card(F.milestones[2]!.title)).getByRole("button", { name: t("pro.delete") });
    await app.user.click(del());
    let alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent(F.milestones[2]!.title);
    await app.user.click(within(alert).getAllByRole("button")[0]!);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fake.writes).toEqual([]);

    await app.user.click(del());
    alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getByRole("button", { name: t("admin.delete") }));
    await waitFor(() => expect(fake.find("delete", `/professor/milestones/${F.milestones[2]!.id}`)).toHaveLength(1));
  });

  it("«رجوع» إلى المشاريع؛ وتعذّرٌ ⇒ «إعادة»؛ ومشروعٌ لا يوجد ⇒ يقال", async () => {
    // «رجوع» يعود في التاريخ: يُدخل إليه من قائمة المشاريع.
    const app = renderApp("/ar/professor/groups", { as: "professor" });
    await screen.findAllByText(F.topicFull.title);
    const link = screen.getAllByRole("link").find((a) => a.getAttribute("href")?.endsWith(`/groups/${F.ID.g1}`))!;
    await app.user.click(link);
    await waitFor(() => expect(app.location()).toBe(`/ar/professor/groups/${F.ID.g1}`));
    await screen.findAllByText(F.milestones[0]!.title);
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.backToProjects")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/professor/groups"));
    app.unmount();

    fake.fail("get", "/professor/groups/:id", 500, "خطأ");
    const other = renderApp(`/ar/professor/groups/${F.ID.g1}`, { as: "professor" });
    const retry = await screen.findByRole("button", { name: esc(t("admin.retry")) });
    const before = fake.find("get", `/professor/groups/${F.ID.g1}`).length;
    await other.user.click(retry);
    await waitFor(() => expect(fake.find("get", `/professor/groups/${F.ID.g1}`).length).toBeGreaterThan(before));
    other.unmount();

    fake.on("get", "/professor/groups/:id", { group: null });
    renderApp(`/ar/professor/groups/nope`, { as: "professor" });
    expect(await screen.findByText(t("pro.projectNotFound"))).toBeInTheDocument();
  });
});

describe("مشاريعي: البطاقات والفلاتر والبحث", () => {
  const base = F.profGroups[0]!;
  const group = (id: string, title: string, patch: object = {}) => ({ ...base, id, topic: { ...base.topic!, id: `t-${id}`, title }, ...patch });
  const groups = [
    group("ga", "مشروعٌ متأخّر"),
    group("gb", "مشروعٌ بلا مراحل", { milestones: [], _count: { milestones: 0 }, defense: null }),
    // «متأخّر» بالموعد لا بالحالة: مواعيد هذا كلّها قادمة.
    group("gc", "مشروعٌ يسير", {
      milestones: base.milestones!.map((m) => ({ ...m, status: m.status === "completed" ? "completed" : "in_progress", deadline: new Date(Date.now() + 20 * 86_400_000).toISOString() })),
      defense: null,
    }),
    group("gd", "مشروعٌ مكتمل", { milestones: base.milestones!.map((m) => ({ ...m, status: "completed" })), defense: null }),
  ];
  const tile = (label: string) =>
    within(screen.getByRole("group", { name: t("pro.filters") })).getAllByRole("button").find((b) => b.textContent?.includes(label))!;
  const titles = () => ["مشروعٌ متأخّر", "مشروعٌ بلا مراحل", "مشروعٌ يسير", "مشروعٌ مكتمل"].filter((x) => screen.queryAllByText(x).length > 0);

  it("حال كلّ مشروع على بطاقته؛ والفلاتر تحصرها وتُلغى بالنقرة نفسها", async () => {
    fake.on("get", "/professor/groups", { groups });
    const app = renderApp("/ar/professor/groups", { as: "professor" });
    await screen.findAllByText("مشروعٌ مكتمل");
    for (const key of ["stateLate", "stateEmpty", "stateActive", "stateDone"]) expect(screen.getAllByText(t(`pro.pj.${key}`)).length).toBeGreaterThan(0);

    await app.user.click(tile(t("pro.pj.filterLate")));
    expect(titles()).toEqual(["مشروعٌ متأخّر"]);
    await app.user.click(tile(t("pro.pj.filterEmpty")));
    expect(titles()).toEqual(["مشروعٌ بلا مراحل"]);
    await app.user.click(tile(t("pro.pj.filterEmpty")));
    expect(titles()).toHaveLength(4);
    await app.user.click(tile(t("pro.pj.filterDefense")));
    expect(titles()).toEqual(["مشروعٌ متأخّر"]);
  });

  it("البحث بالعنوان أو باسم عضو؛ وبحثٌ بلا نتيجة ⇒ «مسح الفلاتر» يعيد الكلّ", async () => {
    fake.on("get", "/professor/groups", { groups });
    const app = renderApp("/ar/professor/groups", { as: "professor" });
    await screen.findAllByText("مشروعٌ مكتمل");
    const search = screen.getByPlaceholderText(t("pro.pj.search"));
    await app.user.type(search, "يسير");
    expect(titles()).toEqual(["مشروعٌ يسير"]);
    await app.user.clear(search);
    await app.user.type(search, F.student1.user!.firstName!);
    expect(titles()).toHaveLength(4);
    await app.user.clear(search);
    await app.user.type(search, "لا شيء بهذا");
    expect(await screen.findByText(t("pro.pj.noMatch"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.clearFilters")) }));
    expect(titles()).toHaveLength(4);
    expect(search).toHaveValue("");
  });

  it("محضر الإشراف يُفتح من البطاقة ويُغلق؛ وتعذّرٌ ⇒ «إعادة»؛ ولا مشاريع ⇒ يقال", async () => {
    let app = renderApp("/ar/professor/groups", { as: "professor" });
    await screen.findAllByText(F.topicFull.title);
    await app.user.click(screen.getByRole("button", { name: esc(t("supervision.sheet")) }));
    const sheet = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(sheet).getAllByRole("button", { name: new RegExp(`${esc(t("admin.close")).source}|${esc(t("pro.cancel")).source}`) })[0]!);
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
    app.unmount();

    fake.fail("get", "/professor/groups", 500, "خطأ");
    app = renderApp("/ar/professor/groups", { as: "professor" });
    const retry = await screen.findByRole("button", { name: esc(t("admin.retry")) });
    fake.on("get", "/professor/groups", { groups: [] });
    await app.user.click(retry);
    expect(await screen.findByText(t("pro.noProjectsYet"))).toBeInTheDocument();
  });
});

describe("لوحة الأستاذ: الرتبة كما خُزّنت", () => {
  it("رتبةٌ نصّاً واحداً (صفوفٌ قديمة) تُعرض؛ ورتبةٌ فارغة لا تُعرض شيئاً", async () => {
    fake.on("get", "/professor/dashboard", { ...F.professorDashboard, profile: { ...F.professorDashboard.profile!, grade: "  أستاذ مساعد ب  " as never } });
    const app = renderApp("/ar/professor", { as: "professor" });
    expect((await screen.findAllByText("أستاذ مساعد ب")).length).toBeGreaterThan(0);
    app.unmount();

    fake.on("get", "/professor/dashboard", { ...F.professorDashboard, profile: { ...F.professorDashboard.profile!, grade: "   " as never } });
    renderApp("/ar/professor", { as: "professor" });
    await screen.findAllByText(F.prof1.employeeNumber);
    expect(screen.queryByText("أستاذ محاضر أ")).toBeNull();
  });
});

describe("فترة اقتراح المواضيع", () => {
  const withYears = (...academicYears: object[]) => fake.on("get", "/common/academic-years", () => ({ academicYears }));
  const day = (iso: string) => formatDay(iso, "ar");
  const unit = (root: HTMLElement, key: string) => root.querySelector(`[data-unit="${key}"] span[dir="ltr"]`)?.textContent;
  async function page() {
    const app = renderApp("/ar/professor/topics", { as: "professor" });
    await screen.findAllByText(F.topicOpen.title);
    return app;
  }

  it("مفتوحة: تُقال بيوم نهايتها وكم بقي، والسنة في النموذج تقول حتى متى", async () => {
    const open = { ...F.year, proposalsOpenAt: F.days(-2), proposalsCloseAt: F.days(10.5) };
    withYears(open);
    const app = await page();
    const banner = await screen.findByTestId("proposal-banner");
    expect(banner).toHaveTextContent(t("pro.proposals.open", { year: open.title, date: day(open.proposalsCloseAt) }));
    const timer = within(banner).getByRole("timer", { name: new RegExp(`^${t("admin.proposals.endsIn")}`) });
    expect(unit(timer, "days")).toBe("10");

    await app.user.click(screen.getByRole("button", { name: esc(t("pro.sendNewTopic")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(dialog).getByRole("combobox", { name: t("pro.academicYear") }));
    expect(await screen.findByRole("option", { name: esc(t("pro.proposals.openUntil", { date: day(open.proposalsCloseAt) })) })).toBeInTheDocument();
  });

  it("وآخر يومٍ منها: أصفار الأيام، والثواني تعدّ والصفحة مفتوحة", async () => {
    // تنتهي آخر لحظةٍ من اليوم بتوقيت الجامعة.
    const tonight = new Date(`${universityDay(Date.now())}T23:59:59.999+01:00`).toISOString();
    withYears({ ...F.year, proposalsOpenAt: F.days(-9), proposalsCloseAt: tonight });
    await page();
    const timer = within(await screen.findByTestId("proposal-banner")).getByRole("timer");
    expect(unit(timer, "days")).toBe("00");
    const first = `${unit(timer, "minutes")}:${unit(timer, "seconds")}`;
    await waitFor(() => expect(`${unit(timer, "minutes")}:${unit(timer, "seconds")}`).not.toBe(first), { timeout: 2500 });
  });

  it("انتهت: زرّا الاقتراح مطفآن ويقولان لماذا — والتعديل باقٍ", async () => {
    const closed = { ...F.year, proposalsOpenAt: F.days(-30), proposalsCloseAt: F.days(-1) };
    withYears(closed);
    const app = await page();
    expect(await screen.findByTestId("proposal-banner")).toHaveTextContent(
      t("pro.proposals.closed", { year: closed.title, date: day(closed.proposalsCloseAt) }),
    );
    for (const name of [t("pro.sendNewTopic"), t("pro.newTopicWithGroup")]) {
      const b = screen.getByRole("button", { name: esc(name) });
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute("title", t("pro.proposals.closedButton"));
    }

    // موضوعٌ لم يُقرَّر يُعدَّل كما كان، وسنته في القائمة ولو انتهت فترتها.
    const row = screen.getAllByText(F.topicRejected.title)[0]!.closest("tr, li, article") as HTMLElement;
    await app.user.click(within(row).getByRole("button", { name: esc(t("pro.edit")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(dialog).getByRole("combobox", { name: t("pro.academicYear") }));
    expect(await screen.findByRole("option", { name: esc(closed.title) })).toBeInTheDocument();
  });

  it("لم تبدأ في السنة الجارية، وسنةٌ أخرى مفتوحة ⇒ الاقتراح متاح، والنموذج لا يعرض إلا المفتوحة", async () => {
    const upcoming = { ...F.year, proposalsOpenAt: F.days(5), proposalsCloseAt: F.days(30) };
    const next = { id: "y-next", title: "2026/2027", isActive: false, proposalsOpenAt: F.days(-1), proposalsCloseAt: F.days(9) };
    withYears(upcoming, next);
    const app = await page();
    expect(await screen.findByTestId("proposal-banner")).toHaveTextContent(
      t("pro.proposals.upcoming", { year: upcoming.title, date: day(upcoming.proposalsOpenAt) }),
    );
    const propose = screen.getByRole("button", { name: esc(t("pro.sendNewTopic")) });
    expect(propose).toBeEnabled();

    await app.user.click(propose);
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(dialog).getByRole("combobox", { name: t("pro.academicYear") }));
    expect(await screen.findByRole("option", { name: esc(next.title) })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: esc(upcoming.title) })).toBeNull();
  });

  it("بلا فترة: لا شريط، والاقتراح كما كان", async () => {
    await page();
    expect(screen.queryByTestId("proposal-banner")).toBeNull();
    expect(screen.getByRole("button", { name: esc(t("pro.sendNewTopic")) })).toBeEnabled();
  });
});
