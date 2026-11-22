import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";
import type { StudentDashboard } from "../../types/student.types";

/**
 * الطالب: يطلب موضوعاً بفريقه، ويتابع مرحلته من لوحته.
 *
 * الطلب يُرسل كاملاً أو لا يُرسل: لكلّ مقعدٍ زميلٌ وجده البحث برقم تسجيله —
 * لا فارغ، ولا رقم الطالب نفسه، ولا زميلٌ في مشروعٍ قائم. واللوحة تقول في كلّ
 * مرحلةٍ ما التالي: اختيار موضوع، انتظار القرار، مرحلةٌ متأخّرة، المناقشة.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function openRequest() {
  const app = renderApp(`/ar/topics/${F.topicOpen.id}`, { as: "student" });
  await screen.findAllByText(F.topicOpen.title);
  await app.user.click(screen.getByRole("button", { name: esc(t("public.applyRequest")) }));
  const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
  // الشروط أوّلاً، ثمّ المقاعد.
  await app.user.click(within(dialog).getByTestId("request-next"));
  return { app, dialog };
}
/** المقعد الأوّل للطالب نفسه؛ الزملاء من الثاني. */
const seatInput = (dialog: HTMLElement, n: number) =>
  within(within(dialog).getByTestId(`seat-${n}`)).getByPlaceholderText(t("stu.regNumberPlaceholder"));

describe("طلب موضوع", () => {
  // Still choosing: no project yet (a student with one asks for no other topic).
  beforeEach(() => fake.on("get", "/student/my-project", { project: null }));
  it("زميلان برقمَي تسجيلهما ⇒ مراجعة ثمّ إرسالٌ بالفريق كاملاً", async () => {
    const { app, dialog } = await openRequest();
    expect(within(dialog).getByTestId("request-next")).toBeDisabled();

    await app.user.type(seatInput(dialog, 2), F.student2.registrationNumber);
    await app.user.type(seatInput(dialog, 3), F.student3.registrationNumber);
    await waitFor(() => expect(fake.find("get", "/student/students/lookup").map((c) => c.query.registration)).toEqual(
      expect.arrayContaining([F.student2.registrationNumber, F.student3.registrationNumber]),
    ));
    await waitFor(() => expect(within(dialog).getByTestId("request-next")).toBeEnabled());
    await app.user.click(within(dialog).getByTestId("request-next"));

    const review = await within(dialog).findByTestId("review-members");
    expect(review).toHaveTextContent("سارة");
    expect(review).toHaveTextContent("ياسين");
    await app.user.click(within(dialog).getByTestId("request-submit"));

    await waitFor(() => expect(fake.find("post", "/student/group-requests")).toHaveLength(1));
    expect(fake.find("post", "/student/group-requests")[0]!.body).toEqual({
      topicId: F.topicOpen.id,
      priority: 1,
      memberRegistrationNumbers: [F.student2.registrationNumber, F.student3.registrationNumber],
    });
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  });

  it("رقمُ الطالب نفسه، وزميلٌ في مشروعٍ قائم ⇒ يُقال في مقعده، ولا تقدّم", async () => {
    const { app, dialog } = await openRequest();
    await app.user.type(seatInput(dialog, 2), F.student1.registrationNumber);
    expect(await within(dialog).findByTestId("seat-2-self")).toBeInTheDocument();
    await app.user.type(seatInput(dialog, 3), F.student4.registrationNumber);
    expect(await within(dialog).findByTestId("seat-3-busy")).toBeInTheDocument();
    expect(within(dialog).getByTestId("request-next")).toBeDisabled();
  });

  it("الرجوع إلى الشروط لا يفقد المقاعد", async () => {
    const { app, dialog } = await openRequest();
    await app.user.type(seatInput(dialog, 2), F.student2.registrationNumber);
    await app.user.click(within(dialog).getByTestId("request-back"));
    await app.user.click(within(dialog).getByTestId("request-next"));
    expect(seatInput(dialog, 2)).toHaveValue(F.student2.registrationNumber);
  });

  it("رفض الخادم (السقف بلغ) ⇒ سببه، ولا يُغلق", async () => {
    fake.fail("post", "/student/group-requests", 409, "بلغ الموضوع سقف طلباته");
    const { app, dialog } = await openRequest();
    await app.user.type(seatInput(dialog, 2), F.student2.registrationNumber);
    await app.user.type(seatInput(dialog, 3), F.student3.registrationNumber);
    await waitFor(() => expect(within(dialog).getByTestId("request-next")).toBeEnabled());
    await app.user.click(within(dialog).getByTestId("request-next"));
    await app.user.click(await within(dialog).findByTestId("request-submit"));
    expect(await screen.findByText("بلغ الموضوع سقف طلباته")).toBeInTheDocument();
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(0);
  });

  it("الأستاذ يرى الزرّ مطفأً بسببه، والزائر يُرسل إلى الدخول ثمّ يعود", async () => {
    let app = renderApp(`/ar/topics/${F.topicOpen.id}`, { as: "professor" });
    expect((await screen.findAllByRole("button", { name: esc(t("public.applyRequest")) }))[0]).toBeDisabled();
    app.unmount();

    app = renderApp(`/ar/topics/${F.topicOpen.id}`);
    await app.user.click(await screen.findByRole("button", { name: esc(t("public.loginToApply")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/login"));
  });

  it("موضوعٌ محجوزٌ لفريقٍ آخر ⇒ يقال ذلك بدل «تعذّر التحميل»", async () => {
    fake.fail("get", "/public/topics/:id", 403, "الموضوع محجوز", "TOPIC_RESERVED");
    renderApp(`/ar/topics/${F.topicFull.id}`, { as: "student" });
    expect(await screen.findByText(t("public.reservedTitle", { defaultValue: "" }) || /محجوز/)).toBeInTheDocument();
  });
});

describe("لوحة الطالب بمراحلها", () => {
  const base = F.studentDashboard;
  const variants: [string, Partial<StudentDashboard>, string][] = [
    ["اختيار موضوع", { stage: "choose_topic", project: null, requests: [] }, t("stu.dash.chooseTitle")],
    [
      "انتظار القرار",
      { stage: "awaiting_decision", project: null, requests: [{ ...base.requests[2]!, status: "pending" }] },
      t("stu.dash.awaitingTitle"),
    ],
    [
      "مرحلةٌ متأخّرة",
      { stage: "in_progress", project: { ...base.project!, defense: null } },
      t("stu.dash.overdueTitle"),
    ],
    [
      "المرحلة التالية",
      {
        stage: "in_progress",
        project: { ...base.project!, defense: null, progress: { total: 4, completed: 1, overdue: 0, percent: 25 } },
        attention: { overdueMilestones: [], dueThisWeek: [], rejectedRequests: [] },
      },
      t("stu.dash.nextMilestoneTitle", { title: base.project!.nextMilestone!.title }),
    ],
    [
      "بلا مراحل",
      { stage: "in_progress", project: { ...base.project!, defense: null, milestones: [], nextMilestone: null, progress: { total: 0, completed: 0, overdue: 0, percent: 0 } }, attention: { overdueMilestones: [], dueThisWeek: [], rejectedRequests: [] } },
      t("stu.dash.noMilestonesTitle"),
    ],
    [
      "كلّ المراحل أُنجزت",
      {
        stage: "in_progress",
        project: { ...base.project!, defense: null, nextMilestone: null, progress: { total: 4, completed: 4, overdue: 0, percent: 100 } },
        attention: { overdueMilestones: [], dueThisWeek: [], rejectedRequests: [] },
      },
      t("stu.dash.allDoneTitle"),
    ],
    [
      "نوقشت",
      { stage: "defended", project: { ...base.project!, defense: { ...base.project!.defense!, status: "completed", grade: 16 } } },
      t("stu.dash.defendedTitle"),
    ],
  ];

  it.each(variants)("%s ⇒ ما التالي بحسبها", async (_, over, title) => {
    fake.on("get", "/student/dashboard", { ...base, ...over });
    renderApp("/ar/student", { as: "student" });
    expect((await screen.findAllByText(esc(title))).length).toBeGreaterThan(0);
  });
});

describe("لوحة الطالب: المشروع", () => {
  it("تبويب «التقدّم» يعرض المراحل بحالها", async () => {
    const app = renderApp("/ar/student", { as: "student" });
    await app.user.click(await screen.findByRole("tab", { name: esc(t("stu.dash.tabProgress")) }));
    const panel = screen.getAllByRole("tabpanel").find((p) => !p.hidden)!;
    for (const m of F.milestones) expect(within(panel).getAllByText(m.title).length).toBeGreaterThan(0);
  });

  it("وثيقة الإشراف تُفتح من لوحتها", async () => {
    const app = renderApp("/ar/student", { as: "student" });
    await app.user.click(await screen.findByRole("button", { name: esc(t("stu.dash.openDocument")) }));
    await waitFor(() => expect(fake.find("get", /^\/supervision-documents/).length).toBeGreaterThan(0));
    expect((await screen.findAllByText(F.supervisionDoc.documentNumber)).length).toBeGreaterThan(0);
  });
});

describe("لوحة الطالب: ما حولها", () => {
  it("رقم التسجيل يُنسخ ويقول «نُسخ» ثمّ يعود", async () => {
    const app = renderApp("/ar/student", { as: "student" });
    const copy = await screen.findByRole("button", { name: t("stu.dash.copy") });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await app.user.click(copy);
    expect(writeText).toHaveBeenCalledWith(F.student1.registrationNumber);
    expect(await screen.findByRole("button", { name: t("stu.dash.copied") })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: t("stu.dash.copy") }, { timeout: 3000 })).toBeInTheDocument();
  });

  it("طلبٌ رُفض ⇒ في «ما يحتاج انتباهك» بسببه، ويقود إلى الطلبات", async () => {
    fake.on("get", "/student/dashboard", {
      ...F.studentDashboard,
      attention: {
        ...F.studentDashboard.attention,
        rejectedRequests: [{ ...F.studentDashboard.requests[0]!, id: "gr-r", status: "rejected", rejectionReason: "التخصّص لا يوافق", topic: { ...F.studentDashboard.requests[0]!.topic, title: "موضوعٌ رُفض طلبه" } }],
      },
    });
    const app = renderApp("/ar/student", { as: "student" });
    expect(await screen.findByText("التخصّص لا يوافق")).toBeInTheDocument();
    await app.user.click(screen.getByText("موضوعٌ رُفض طلبه").closest("a")!);
    await waitFor(() => expect(app.location()).toBe("/ar/student/requests"));
  });

  it("وثيقة الإشراف تُغلق بزرّها", async () => {
    const app = renderApp("/ar/student", { as: "student" });
    await app.user.click(await screen.findByRole("button", { name: esc(t("stu.dash.openDocument")) }));
    const sheet = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(sheet).getAllByRole("button", { name: new RegExp(`${esc(t("admin.close")).source}|${esc(t("pro.cancel")).source}`) })[0]!);
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  });
});
