import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";
import { addDays, formatDay, universityDay } from "../../../../lib/proposal-window";
import { REASON_MAX } from "../../../../lib/limits";
import { SPEC_LEVEL_LABEL } from "../../../../lib/spec-level";

/**
 * دورة الموضوع في الإدارة: يُقبل أو يُرفض بسبب يصل أستاذه، ويُنشر للطلبة
 * ويُسحب، ويُؤرشف ويُستعاد، ويُحذف — والحذف معالجٌ يمرّ بما يمنعه.
 *
 * ما يُعرض من أزرار هو حكم الخادم (`actions`)، لا تخمين الشاشة من الحالة:
 * فالموضوع الذي ينتظره فريقٌ لا يُؤرشف ولا يُحذف، ويقال لماذا.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function detail(id: string) {
  const app = renderApp(`/ar/admin/topics/${id}`, { as: "admin" });
  await screen.findAllByText(F.topics.find((x) => x.id === id)!.title);
  return app;
}
const button = (name: string) => screen.getByRole("button", { name: esc(name) });

describe("قرار الإدارة في صفحة الموضوع", () => {
  it("مقترحٌ ينتظر ⇒ «قبول» يُرسل، ثمّ تُعاد قراءة الموضوع", async () => {
    const app = await detail("t-pending");
    const reads = fake.find("get", "/admin/topics/t-pending").length;
    await app.user.click(button(t("admin.approveTopicBtn")));
    await waitFor(() => expect(fake.find("patch", "/admin/topics/t-pending/approve")).toHaveLength(1));
    await waitFor(() => expect(fake.find("get", "/admin/topics/t-pending").length).toBeGreaterThan(reads));
  });

  it("الرفض بسببه — يصل الأستاذ كما كُتب، و«إلغاء» لا يرسل شيئاً", async () => {
    const app = await detail("t-pending");
    await app.user.click(button(t("admin.rejectTopicBtn")));
    await app.user.click(button(t("admin.cancel")));
    expect(fake.writes).toEqual([]);

    await app.user.click(button(t("admin.rejectTopicBtn")));
    await app.user.type(screen.getByPlaceholderText(t("admin.rejectionReasonPlaceholder")), "خارج تخصّص القسم");
    await app.user.click(button(t("admin.confirmReject")));
    await waitFor(() => expect(fake.find("patch", "/admin/topics/t-pending/reject")[0]?.body).toEqual({ reason: "خارج تخصّص القسم" }));
  });

  it("مقبولٌ ⇒ يُنشر؛ ومنشورٌ ⇒ يُسحب؛ ومؤرشفٌ ⇒ يُستعاد", async () => {
    let app = await detail("t-approved");
    await app.user.click(button(t("admin.publish")));
    await waitFor(() => expect(fake.find("patch", "/admin/topics/t-approved/publish")).toHaveLength(1));
    app.unmount();

    app = await detail("t-open");
    await app.user.click(button(t("admin.unpublish")));
    await waitFor(() => expect(fake.find("patch", "/admin/topics/t-open/unpublish")).toHaveLength(1));
    app.unmount();

    app = await detail("t-archived");
    await app.user.click(button(t("admin.unarchive")));
    await waitFor(() => expect(fake.find("patch", "/admin/topics/t-archived/unarchive")).toHaveLength(1));
  });

  it("فريقٌ ينتظر ⇒ الأرشفة والحذف مطفآن بسببهما، ورابطٌ إلى القرار في الطلب", async () => {
    await detail("t-open");
    expect(button(t("admin.archive"))).toBeDisabled();
    expect(screen.getByRole("button", { name: esc(t("admin.delete")) })).toBeDisabled();
    const links = screen.getAllByRole("link", { name: esc(t("admin.decideOnRequest")) });
    expect(links.map((l) => l.getAttribute("href"))).toContain("/ar/admin/group-requests?topic=t-open");
    // والطلب المرفوض سابقاً في سجلّه، بسببه.
    expect(screen.getByText(/الفريق تجاوز العدد المسموح/)).toBeInTheDocument();
  });

  it("ممتلئٌ بفريق ⇒ يُؤرشف، وفريقه بأسمائهم والمرسِل أوّلاً", async () => {
    const app = await detail("t-full");
    expect(screen.getAllByText(/أمين/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ليلى/).length).toBeGreaterThan(0);
    await app.user.click(button(t("admin.archive")));
    await waitFor(() => expect(fake.find("patch", "/admin/topics/t-full/archive")).toHaveLength(1));
  });
});

describe("تعديلا الموضوع من صفحته", () => {
  it("«تعديل الموضوع»: بياناته ثمّ المراجعة، والطلبة لا يُرسلون فلا يُمسّون", async () => {
    const app = await detail("t-full");
    expect(screen.getByTestId("edit-assigned-topic")).toHaveTextContent(t("admin.editAssignedTopicBtn"));
    await app.user.click(screen.getByTestId("edit-topic-only"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(t("admin.editTopicOnlyTitle"))).toBeInTheDocument();
    // Two steps only: the topic, then the review.
    expect(within(dialog).getAllByRole("listitem").filter((li) => li.closest("[data-testid='stepper']"))).toHaveLength(2);
    const title = await within(dialog).findByDisplayValue(F.topicFull.title);
    await app.user.type(title, " (معدّل)");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));

    const review = await within(dialog).findByTestId("topic-review");
    expect(within(review).getByTestId("topic-review-untouched")).toHaveTextContent(t("admin.topicReview.untouched"));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.confirmSave")) }));
    await waitFor(() => expect(fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)).toHaveLength(1));
    const body = fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({ title: `${F.topicFull.title} (معدّل)` });
    expect(body).not.toHaveProperty("memberStudentIds");
    expect(body).not.toHaveProperty("leaderStudentId");
  });

  it("«تعديل الموضوع المسند»: ثلاث مراحل — الموضوع، والطلبة، والمراجعة — ويُرسل الفريق", async () => {
    const app = await detail("t-full");
    await app.user.click(screen.getByTestId("edit-assigned-topic"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(t("admin.editAssignedTopicTitle"))).toBeInTheDocument();
    await within(dialog).findByDisplayValue(F.topicFull.title);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
    await within(dialog).findByTestId("seat-1");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
    const review = await within(dialog).findByTestId("topic-review");
    expect(within(review).getByTestId("topic-review-count")).toHaveTextContent(t("admin.topicReview.noChanges"));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.confirmSave")) }));
    await waitFor(() => expect(fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)[0]?.body).toHaveProperty("memberStudentIds"));
  });
});

describe("معالج الحذف", () => {
  it("بلا فريق: المشرف يُبلَّغ بسببٍ لا يُترك فارغاً، ثمّ يُحذف ويُعاد إلى القائمة", async () => {
    const app = await detail("t-pending");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.delete")) }));
    const dialog = await screen.findByRole("dialog");

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.sendReasonAndContinue")) }));
    expect(within(dialog).getByText(t("admin.reasonRequired"))).toBeInTheDocument();
    expect(fake.writes).toEqual([]);

    await app.user.type(within(dialog).getByPlaceholderText(t("admin.reasonPlaceholder")), "تكرّر الموضوع");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.sendReasonAndContinue")) }));
    await waitFor(() => expect(fake.find("post", "/messages")).toHaveLength(1));
    expect(fake.find("post", "/messages")[0]!.body).toMatchObject({ recipientIds: [F.profUsers[0]!.id], body: "تكرّر الموضوع" });
    expect((fake.find("post", "/messages")[0]!.body as { subject: string }).subject).toContain(F.topicPending.title);

    await app.user.click(await within(dialog).findByTestId("confirm-delete"));
    await waitFor(() => expect(fake.find("delete", "/admin/topics/t-pending")).toHaveLength(1));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/topics"));
  });

  /**
   * فسخ المجموعة يُبطل الموضوع فيُعاد جلبه بلا مجموعة. كانت الخطوات تُحسب
   * من جديد فتسقط خطوة المجموعة، وينزلق الفهرس من «المشرف» إلى «المراجعة»
   * فيُحذف الموضوع دون أن يُبلَّغ أستاذه.
   */
  it("بفريق: يُفسخ بسبب، ثمّ المشرف — لا قفز فوقه ولو أُعيد جلب الموضوع بلا فريق", async () => {
    const app = await detail("t-full");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.delete")) }));
    const dialog = await screen.findByRole("dialog");

    // بعد الفسخ يجيب الخادم بالموضوع بلا مجموعة، كما يفعل حقّاً.
    fake.on("delete", "/admin/projects/:id", () => {
      fake.on("get", "/admin/topics/t-full", { topic: { ...F.adminTopicDetail("t-full"), projectGroup: null } });
      return { message: "ok" };
    });
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.reasonPlaceholder")), "انسحب الطالبان");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.deleteGroupAndContinue")) }));
    await waitFor(() => expect(fake.find("delete", `/admin/projects/${F.ID.g1}`)[0]?.body).toEqual({ reason: "انسحب الطالبان" }));
    await waitFor(() => expect(fake.find("get", "/admin/topics/t-full").length).toBeGreaterThan(1));

    expect(await within(dialog).findByRole("button", { name: esc(t("admin.sendReasonAndContinue")) })).toBeInTheDocument();
    expect(within(dialog).queryByTestId("confirm-delete")).toBeNull();
  });

  it("الخادم يرفض الفسخ (تسليمات) ⇒ سببه، ولا يُراسَل أحد", async () => {
    fake.fail("delete", "/admin/projects/:id", 409, "للمشروع تسليمات — احذفها من صفحته أوّلاً");
    const app = await detail("t-full");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.delete")) }));
    const dialog = await screen.findByRole("dialog");
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.reasonPlaceholder")), "سبب");
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.deleteGroupAndContinue")) }));
    expect(await within(dialog).findByText("للمشروع تسليمات — احذفها من صفحته أوّلاً")).toBeInTheDocument();
    expect(fake.find("post", "/messages")).toEqual([]);
  });
});

describe("القائمة: إجراءاتٌ على عدّة مواضيع", () => {
  async function selectRows(app: ReturnType<typeof renderApp>, titles: string[]) {
    for (const title of titles) {
      const row = (await screen.findAllByText(title)).map((x) => x.closest("tr")).find(Boolean)!;
      await app.user.click(within(row).getByRole("checkbox"));
    }
  }

  it("قبولٌ دفعةً: ما يجوز قبوله وحده، ثمّ «تمّ» بعدده", async () => {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    await selectRows(app, [F.topicPending.title, F.topicRejected.title, F.topicOpen.title]);
    const approve = screen.getByRole("button", { name: esc(`${t("admin.approve")} (2)`) });
    await app.user.click(approve);
    await waitFor(() => expect(fake.find("patch", /\/approve$/).map((c) => c.path).sort()).toEqual(["/admin/topics/t-pending/approve", "/admin/topics/t-rejected/approve"]));
    expect(await screen.findByText(t("admin.bulkDone", { n: 2 }))).toBeInTheDocument();
  });

  it("رفضٌ دفعةً على خطوتين: المراجعة بما يُستثنى وسببه، ثمّ سببٌ واحد يصل الأستاذين؛ وفشلُ بعضها يقال بعدده", async () => {
    fake.fail("patch", "/admin/topics/t-approved/reject", 409, "لا");
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    // المنشور ينتظره فريق ⇒ لا يُرفض، ويُعرض مستثنىً بسببه.
    await selectRows(app, [F.topicPending.title, F.topicApproved.title, F.topicOpen.title]);
    await app.user.click(screen.getByRole("button", { name: esc(`${t("admin.reject")} (2)`) }));
    const dialog = await screen.findByRole("alertdialog");

    // ١ — المراجعة: ما سيُرفض بعنوانه، وما يُستثنى ولماذا؛ ولا حقل سببٍ بعد.
    const ready = within(dialog).getByTestId("bulk-ready");
    expect(within(ready).getByText(F.topicPending.title)).toBeInTheDocument();
    expect(within(ready).getByText(F.topicApproved.title)).toBeInTheDocument();
    const excluded = within(dialog).getByTestId("bulk-excluded");
    expect(within(excluded).getByText(F.topicOpen.title)).toBeInTheDocument();
    expect(within(excluded).getByText(t("topicBlocked.teamWaiting", { count: 2 }))).toBeInTheDocument();
    expect(within(dialog).queryByPlaceholderText(t("admin.rejectReasonPlaceholder"))).toBeNull();
    expect(fake.find("patch", /\/reject$/)).toEqual([]);

    // ٢ — التأكيد: العدد، والأستاذان اللذان يصلهما الإشعار، والسبب.
    await app.user.click(within(dialog).getByTestId("bulk-next"));
    expect(within(dialog).getByText(t("admin.bulkTopics.rejectSummary", { count: 2 }))).toBeInTheDocument();
    expect(within(dialog).getByTestId("bulk-professors").children).toHaveLength(2);
    const reason = within(dialog).getByPlaceholderText(t("admin.rejectReasonPlaceholder"));
    // حدّ الخادم للسبب: الحقل لا يتجاوزه، فلا يُردّ الرفض لطوله.
    expect(reason).toHaveAttribute("maxLength", String(REASON_MAX));
    await app.user.type(reason, "خارج التخصّص");
    await app.user.click(within(dialog).getByTestId("bulk-confirm"));
    await waitFor(() => expect(fake.find("patch", "/admin/topics/t-pending/reject")[0]?.body).toEqual({ reason: "خارج التخصّص" }));
    expect(fake.find("patch", "/admin/topics/t-open/reject")).toEqual([]);
    expect(await screen.findByText(t("admin.bulkPartial", { ok: 1, failed: 1 }))).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("حذفٌ دفعةً على خطوتين: ما له مجموعة مستثنى، والرجوع إلى المراجعة لا يحذف شيئاً", async () => {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    await selectRows(app, [F.topicPending.title, F.topicRejected.title, F.topicFull.title]);
    await app.user.click(screen.getByRole("button", { name: esc(`${t("admin.delete")} (2)`) }));
    const dialog = await screen.findByRole("alertdialog");

    const excluded = within(dialog).getByTestId("bulk-excluded");
    expect(within(excluded).getByText(F.topicFull.title)).toBeInTheDocument();
    expect(within(excluded).getByText(t("topicBlocked.hasGroup"))).toBeInTheDocument();

    await app.user.click(within(dialog).getByTestId("bulk-next"));
    expect(within(dialog).getByText(t("admin.bulkTopics.deleteSummary", { count: 2 }))).toBeInTheDocument();
    expect(within(dialog).getByText(t("admin.irreversibleWarning"))).toBeInTheDocument();

    // الرجوع: المراجعة كما كانت، ولم يُرسَل شيء.
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.back") }));
    expect(within(dialog).getByTestId("bulk-step-review")).toBeInTheDocument();
    expect(fake.find("delete", /\/admin\/topics\//)).toEqual([]);

    // وبطاقة الخطوة الأولى في الشريط ترجع إليها كذلك.
    await app.user.click(within(dialog).getByTestId("bulk-next"));
    await app.user.click(within(within(dialog).getByTestId("step-review")).getByRole("button"));
    expect(within(dialog).getByTestId("bulk-step-review")).toBeInTheDocument();

    await app.user.click(within(dialog).getByTestId("bulk-next"));
    await app.user.click(within(dialog).getByTestId("bulk-confirm"));
    await waitFor(() =>
      expect(fake.find("delete", /\/admin\/topics\//).map((c) => c.path).sort()).toEqual([
        "/admin/topics/t-pending",
        "/admin/topics/t-rejected",
      ]),
    );
    expect(await screen.findByText(t("admin.bulkDone", { n: 2 }))).toBeInTheDocument();
  });

  it("تحديد الكلّ ثمّ «إلغاء التحديد»", async () => {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByRole("checkbox", { name: t("admin.selectAll") }));
    expect(screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked).length).toBeGreaterThan(5);
    await app.user.click(button(t("admin.clearSelection")));
    expect(screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked)).toEqual([]);
  });
});

describe("قائمة العناوين للطباعة", () => {
  it("قبل الإسناد وبعده، باتّجاه الورقة، ثمّ الطباعة", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    await app.user.click(await screen.findByTestId("open-titles-list"));
    const dialog = await screen.findByRole("dialog", { name: t("admin.titlesList.title") });
    await waitFor(() => expect(fake.find("get", "/admin/topics/titles-list").map((c) => c.query.mode).sort()).toEqual(["after", "before"]));
    expect((await within(dialog).findAllByText(F.topicFull.title)).length).toBeGreaterThan(0);

    for (const tab of within(dialog).getAllByRole("tab")) await app.user.click(tab);
    for (const o of within(dialog).getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"))) await app.user.click(o);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.titlesList.print")) }));
    expect(print).toHaveBeenCalledTimes(1);

    await app.user.click(within(dialog).getByRole("button", { name: t("admin.titlesList.close") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("أعضاء المذكرة من صفحة موضوعها", () => {
  async function members() {
    const app = await detail("t-full");
    await app.user.click(button(t("admin.manageMembers")));
    const d = (await screen.findAllByRole("dialog")).at(-1)!;
    return { app, d };
  }
  const inD = (d: HTMLElement, name: string) => within(d).getAllByRole("button", { name: esc(name) }).at(-1)!;
  // التأكيد صندوقٌ فوق التذييل، وزرّ التذييل يُعطَّل ما دام مفتوحاً.
  async function dissolve(app: ReturnType<typeof renderApp>, d: HTMLElement) {
    await app.user.click(inD(d, t("admin.dissolveGroup")));
    const box = within(d).getByText(t("admin.dissolveGroupConfirm")).parentElement!;
    await app.user.click(within(box).getByRole("button", { name: esc(t("admin.dissolveGroup")) }));
  }

  it("مرسِلٌ آخر يُختار بنجمته، وإخراج المرسِل يُورث الإرسال لمن بعده", async () => {
    const { app, d } = await members();
    expect(within(d).getByRole("button", { name: esc(t("admin.saveMembers")) })).toBeDisabled();
    await app.user.click(within(d).getAllByRole("button", { name: t("admin.setLeader") })[1]!);
    expect(within(d).getByText(t("admin.unsavedChanges"))).toBeInTheDocument();
    await app.user.click(within(d).getAllByRole("button", { name: t("admin.setLeader") })[0]!);
    expect(within(d).queryByText(t("admin.unsavedChanges"))).toBeNull();

    await app.user.click(within(d).getAllByRole("button", { name: t("admin.removeCover") })[0]!);
    await app.user.click(inD(d, t("admin.saveMembers")));
    await waitFor(() => expect(fake.find("patch", "/admin/topics/t-full/assignment")[0]?.body).toEqual({
      memberStudentIds: [F.student4.id],
      leaderStudentId: F.student4.id,
    }));
    await waitFor(() => expect(screen.queryByText(t("admin.manageMembersTitle"))).toBeNull());
  });

  it("الحفظ يرفضه الخادم ⇒ سببه، والنافذة باقية", async () => {
    fake.fail("patch", "/admin/topics/t-full/assignment", 409, "الطالب في مذكرةٍ أخرى");
    const { app, d } = await members();
    await app.user.click(within(d).getAllByRole("button", { name: t("admin.setLeader") })[1]!);
    await app.user.click(inD(d, t("admin.saveMembers")));
    expect(await within(d).findByText("الطالب في مذكرةٍ أخرى")).toBeInTheDocument();
  });

  it("الفسخ بتأكيد (والتراجع ممكن) ⇒ لا طلبة، ثمّ الأرشفة تُغلق النافذة", async () => {
    const { app, d } = await members();
    await app.user.click(inD(d, t("admin.dissolveGroup")));
    expect(within(d).getByText(t("admin.dissolveGroupConfirm"))).toBeInTheDocument();
    await app.user.click(within(d).getByRole("button", { name: t("admin.cancel") }));
    expect(within(d).queryByText(t("admin.dissolveGroupConfirm"))).toBeNull();

    await dissolve(app, d);
    await waitFor(() => expect(fake.find("delete", `/admin/projects/${F.ID.g1}`)).toHaveLength(1));
    expect(await within(d).findByText(t("admin.noStudentsInProject"))).toBeInTheDocument();
    expect(within(d).queryByRole("button", { name: esc(t("admin.saveMembers")) })).toBeNull();

    await app.user.click(within(d).getByRole("button", { name: esc(t("admin.archive")) }));
    await waitFor(() => expect(fake.find("patch", "/admin/topics/t-full/archive")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText(t("admin.manageMembersTitle"))).toBeNull());
  });

  it("فسخٌ يرفضه الخادم ⇒ سببه كما قاله، والأعضاء باقون", async () => {
    fake.fail("delete", `/admin/projects/${F.ID.g1}`, 409, "على المذكرة تسليمات");
    const { app, d } = await members();
    await dissolve(app, d);
    expect(await within(d).findByText("على المذكرة تسليمات")).toBeInTheDocument();
    expect(within(d).queryByText(t("admin.dissolveGroupConfirm"))).toBeNull();
    expect(within(d).queryByText(t("admin.noStudentsInProject"))).toBeNull();
  });

  it("بعد الفسخ: «حذف الموضوع» يحذفه ويعود إلى القائمة", async () => {
    const { app, d } = await members();
    await dissolve(app, d);
    await app.user.click(await within(d).findByRole("button", { name: esc(t("admin.deleteTopic")) }));
    await waitFor(() => expect(fake.find("delete", "/admin/topics/t-full")).toHaveLength(1));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/topics"));
  });
});

describe("تنزيل المواضيع في Excel — ثلاث مراحل", () => {
  let downloads: string[] = [];
  beforeEach(() => {
    downloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const tx = (k: string, o?: object) => t(`admin.topicExport.${k}`, o);
  const today = () => new Date().toISOString().slice(0, 10);
  async function openExport(app: ReturnType<typeof renderApp>) {
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByTestId("open-topic-export"));
    return screen.findByRole("dialog", { name: tx("title") });
  }
  /** Through the preview to the last stage. */
  async function toDownload(app: ReturnType<typeof renderApp>, dialog: HTMLElement) {
    await app.user.click(within(dialog).getByTestId("topic-export-next"));
    await within(dialog).findByTestId("sheet-preview");
    await app.user.click(within(dialog).getByTestId("topic-export-next"));
    return within(dialog).findByTestId("topic-export-final");
  }

  it("الإعداد ثمّ المعاينة ثمّ التنزيل: بطلبتها، بالأعمدة كلّها، والمعاينةُ بالخيارات نفسها", async () => {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    const dialog = await openExport(app);
    expect(within(dialog).getByTestId("topic-export-count")).toHaveTextContent(tx("count", { count: F.topics.length }));
    expect(within(dialog).getByTestId("topic-export-scope")).toHaveTextContent(tx("scopeAll"));
    // بلا سنةٍ في الصفحة: كلّ السنوات، ولكلّ موضوعٍ سنته في عمود.
    expect(within(dialog).getByText(tx("allYears"))).toBeInTheDocument();
    expect(within(dialog).getByTestId("topic-export-col-year")).toBeInTheDocument();
    expect(within(dialog).queryByText(tx("colStudentsAll"))).toBeNull();

    await app.user.click(within(dialog).getByTestId("topic-export-with"));
    expect(within(dialog).getByTestId("topic-export-with")).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByText(tx("colStudentsAll"))).toBeInTheDocument();

    // Stage two: the file as it will open — asked for with the very same choices.
    await app.user.click(within(dialog).getByTestId("topic-export-next"));
    const sheet = await within(dialog).findByTestId("sheet-preview");
    const asked = { students: "with", lang: "ar", columns: "supervisor,coSupervisor,summary,type,capacity,status,faculty,department,filiere,level,specialization,year" };
    expect(fake.find("get", "/admin/topics/export/preview")[0]!.query).toEqual(asked);
    expect(within(sheet).getByTestId("sheet-preview-header")).toHaveTextContent("الأستاذ المشرف");
    // A sheet for each level: the licence one first, then the master's.
    const tabs = within(sheet).getAllByTestId("sheet-preview-tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["المواضيع - ليسانس", "المواضيع - ماستر"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(within(sheet).getAllByTestId("sheet-preview-row")).toHaveLength(1);
    expect(within(dialog).getByTestId("topic-export-preview-meta")).toHaveTextContent(tx("previewMeta", { shown: 1, total: 1, columns: 4 }));
    await app.user.click(tabs[1]!);
    expect(within(sheet).getAllByTestId("sheet-preview-tab")[1]).toHaveAttribute("aria-selected", "true");
    const rows = within(sheet).getAllByTestId("sheet-preview-row");
    expect(rows).toHaveLength(2);
    // The supervisor's single cell over their two topics; the type in its colour.
    expect(within(rows[0]!).getByText("كريم منصوري").closest("td")).toHaveAttribute("rowspan", "2");
    expect(within(rows[1]!).queryByText("كريم منصوري")).toBeNull();
    expect(within(rows[0]!).getByText("AI").closest("td")!.style.background).toBeTruthy();
    expect(within(dialog).getByTestId("topic-export-preview-meta")).toHaveTextContent(tx("previewMeta", { shown: 2, total: 2, columns: 4 }));

    // Stage three: the summary, then the file — and the dialog says it is done.
    await app.user.click(within(dialog).getByTestId("topic-export-next"));
    const final = await within(dialog).findByTestId("topic-export-final");
    expect(within(final).getByTestId("topic-export-filename")).toHaveTextContent(tx("fileNameWith", { date: today() }));
    await app.user.click(within(final).getByTestId("topic-export-download"));
    await waitFor(() => expect(fake.find("get", "/admin/topics/export")).toHaveLength(1));
    expect(fake.find("get", "/admin/topics/export")[0]!.query).toEqual(asked);
    await waitFor(() => expect(downloads).toEqual([tx("fileNameWith", { date: today() })]));
    expect(await screen.findByText(tx("done"))).toBeInTheDocument();
    expect(await within(final).findByText(tx("doneKicker"))).toBeInTheDocument();
    // The footer's «close», beside the header's ✕.
    await app.user.click(within(dialog).getAllByRole("button", { name: tx("close") }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: tx("title") })).toBeNull());
  });

  it("فلاتر الصفحة هي النطاق: تُرسل كما هي، وتظهر شاراتٍ، والسنة في العنوان لا في عمود", async () => {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    await screen.findAllByText(F.topicOpen.title);
    const pick = async (label: string, option: string) => {
      await app.user.click(screen.getByRole("combobox", { name: label }));
      await app.user.click(await screen.findByRole("option", { name: esc(option) }));
    };
    await pick(t("admin.statusAll"), t("status.full"));
    await pick(t("admin.allYears"), F.year.title);
    await app.user.type(screen.getByPlaceholderText(t("admin.searchTopic")), "القلق");
    // البحث يُرسل بعد سكون الكتابة — كالجدول.
    await waitFor(() => expect(fake.find("get", "/admin/topics").at(-1)?.query).toMatchObject({ search: "القلق" }));

    const dialog = await openExport(app);
    const scope = within(dialog).getByTestId("topic-export-scope");
    expect(scope).toHaveTextContent(t("status.full"));
    expect(scope).toHaveTextContent(tx("searchChip", { q: "القلق" }));
    expect(within(dialog).getByText(tx("ofYear", { year: F.year.title }))).toBeInTheDocument();
    expect(within(dialog).queryByTestId("topic-export-col-year")).toBeNull();

    const final = await toDownload(app, dialog);
    await app.user.click(within(final).getByTestId("topic-export-download"));
    await waitFor(() =>
      expect(fake.find("get", "/admin/topics/export")[0]?.query).toEqual({
        students: "without",
        lang: "ar",
        // A page of one year: no year column to ask for.
        columns: "supervisor,coSupervisor,summary,type,capacity,status,faculty,department,filiere,level,specialization",
        status: "full",
        academicYearId: F.ID.y1,
        search: "القلق",
      }),
    );
    await waitFor(() => expect(downloads).toEqual([tx("fileName", { date: today() })]));
  });

  it("لغة الملف وأعمدته تُختار، وتُرى في المعاينة، وتُذكر لمرّةٍ قادمة؛ و«#» والعنوان لا يُخفيان", async () => {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    let dialog = await openExport(app);
    const lang = within(dialog).getByRole("radiogroup", { name: tx("langTitle") });
    expect(within(lang).getByTestId("topic-export-lang-ar")).toHaveAttribute("aria-checked", "true");
    await app.user.click(within(lang).getByTestId("topic-export-lang-en"));
    expect(within(lang).getByTestId("topic-export-lang-en")).toHaveAttribute("aria-checked", "true");

    // «#» and the title are no buttons: they cannot be left out.
    expect(within(dialog).getByText(tx("colCode")).closest("button")).toBeNull();
    const counted = within(dialog).getByTestId("topic-export-columns-count");
    expect(counted).toHaveTextContent(tx("columnsCount", { count: 14 }));
    for (const c of ["summary", "faculty", "department", "filiere"]) {
      const tile = within(dialog).getByTestId(`topic-export-col-${c}`);
      expect(tile).toHaveAttribute("aria-pressed", "true");
      await app.user.click(tile);
      expect(tile).toHaveAttribute("aria-pressed", "false");
    }
    expect(counted).toHaveTextContent(tx("columnsCount", { count: 10 }));

    // The preview reads left to right, in English.
    await app.user.click(within(dialog).getByTestId("topic-export-next"));
    const sheet = await within(dialog).findByTestId("sheet-preview");
    expect(within(sheet).getByTestId("sheet-preview-header")).toHaveTextContent("Supervisor");
    expect(sheet.querySelector("[dir='ltr'] table")).not.toBeNull();
    // Back to the setup, everything as it was left.
    await app.user.click(within(dialog).getByRole("button", { name: esc(tx("back")) }));
    expect(within(dialog).getByTestId("topic-export-col-summary")).toHaveAttribute("aria-pressed", "false");

    const final = await toDownload(app, dialog);
    await app.user.click(within(final).getByTestId("topic-export-download"));
    await waitFor(() => expect(fake.find("get", "/admin/topics/export")).toHaveLength(1));
    expect(fake.find("get", "/admin/topics/export")[0]!.query).toEqual({
      students: "without",
      lang: "en",
      columns: "supervisor,coSupervisor,type,capacity,status,level,specialization,year",
    });
    await within(final).findByText(tx("doneKicker"));
    // The footer's «close», beside the header's ✕.
    await app.user.click(within(dialog).getAllByRole("button", { name: tx("close") }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: tx("title") })).toBeNull());

    // Opened again: the same language and the same columns; «none» then «all».
    dialog = await openExport(app);
    expect(within(dialog).getByTestId("topic-export-lang-en")).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByTestId("topic-export-col-summary")).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByTestId("topic-export-col-type")).toHaveAttribute("aria-pressed", "true");
    await app.user.click(within(dialog).getByRole("button", { name: tx("none") }));
    expect(within(dialog).getByTestId("topic-export-columns-count")).toHaveTextContent(tx("columnsCount", { count: 2 }));
    await app.user.click(within(dialog).getByRole("button", { name: tx("all") }));
    expect(within(dialog).getByTestId("topic-export-columns-count")).toHaveTextContent(tx("columnsCount", { count: 14 }));
  });

  it("رفض الخادم يأتي ملفّاً ⇒ تُقرأ رسالته منه، والنافذة باقية؛ وEscape وإلغاء يغلقانها", async () => {
    fake.fail("get", "/admin/topics/export", 400, "أكثر من الحدّ");
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    let dialog = await openExport(app);
    const final = await toDownload(app, dialog);
    await app.user.click(within(final).getByTestId("topic-export-download"));
    expect(await screen.findByText("أكثر من الحدّ")).toBeInTheDocument();
    expect(downloads).toEqual([]);
    expect(within(final).getByTestId("topic-export-download")).toBeEnabled();

    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: tx("title") })).toBeNull());
    dialog = await openExport(app);
    await app.user.click(within(dialog).getByRole("button", { name: tx("cancel") }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: tx("title") })).toBeNull());
  });

  it("المستوى يحصر الجدول وقائمة العناوين والملف: الليسانس والماستر والدكتوراه لا تُخلط", async () => {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByRole("combobox", { name: t("admin.allLevels") }));
    await app.user.click(await screen.findByRole("option", { name: esc(t("admin.levelMaster")) }));
    await waitFor(() => expect(fake.find("get", "/admin/topics").at(-1)?.query).toMatchObject({ level: "master" }));

    // The titles list: the same level.
    await app.user.click(screen.getByTestId("open-titles-list"));
    await waitFor(() => expect(fake.find("get", "/admin/topics/titles-list").at(-1)?.query).toMatchObject({ level: "master" }));
    await app.user.click(within(await screen.findByRole("dialog", { name: t("admin.titlesList.title") })).getByRole("button", { name: t("admin.titlesList.close") }));

    // The file: the level among its chips, and in what it asks for.
    const dialog = await openExport(app);
    expect(within(dialog).getByTestId("topic-export-scope")).toHaveTextContent(t("admin.levelMaster"));
    const final = await toDownload(app, dialog);
    expect(fake.find("get", "/admin/topics/export/preview").at(-1)?.query).toMatchObject({ level: "master" });
    await app.user.click(within(final).getByTestId("topic-export-download"));
    await waitFor(() => expect(fake.find("get", "/admin/topics/export")[0]?.query).toMatchObject({ level: "master" }));
  });

  it("معاينةٌ تعذّرت ⇒ يُقال، والمرحلة الثالثة لا تُفتح قبلها، والمحاولة تعيدها", async () => {
    fake.fail("get", "/admin/topics/export/preview", 500, "x");
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    const dialog = await openExport(app);
    await app.user.click(within(dialog).getByTestId("topic-export-next"));
    expect(await within(dialog).findByText(tx("previewFailed"))).toBeInTheDocument();
    expect(within(dialog).getByTestId("topic-export-next")).toBeDisabled();
  });
});

describe("إعدادات المواضيع: سطرٌ فوق القائمة، وصفحتها", () => {
  it("لا بطاقات فوق القائمة: سطرٌ يلخّص الفترتين والعدد وما يخالفه؛ والزرّ يفتح صفحتها بسنة الصفحة", async () => {
    fake.on("get", "/admin/academic-years/:id/selection-window", () => F.selectionWindow(F.year, F.days(-3), F.days(6.5)));
    fake.on("get", "/admin/academic-years/:id/team-size", () =>
      F.teamSizeState(F.year, { licence: { n: 3, mode: "exact" }, master: { n: 2, mode: "exact" } }),
    );
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    const strip = await screen.findByTestId("topic-settings-strip");
    for (const id of ["proposal-timeline", "selection-timeline", "team-size-card"]) expect(screen.queryByTestId(id)).toBeNull();

    await waitFor(() => expect(within(strip).getByTestId("strip-proposals")).toHaveTextContent(t("admin.topicSettings.strip.unset")));
    expect(strip).toHaveTextContent(F.year.title);
    const selection = within(strip).getByTestId("strip-selection");
    // A whole phrase: whom it concerns, its state — six days and a half ahead: six whole days.
    await waitFor(() =>
      expect(selection).toHaveTextContent(t("admin.topicSettings.strip.open", { when: t("admin.topicSettings.days", { count: 6 }) })),
    );
    expect(selection).toHaveTextContent(t("admin.topicSettings.strip.selection"));
    expect(selection).toHaveAttribute("title", t("admin.topicSettings.strip.selectionTip"));
    await waitFor(() =>
      expect(within(strip).getByTestId("strip-team-size")).toHaveTextContent(
        `${t(SPEC_LEVEL_LABEL.licence)} 3 · ${t(SPEC_LEVEL_LABEL.master)} 2`,
      ),
    );
    expect(within(strip).getByTestId("strip-differing")).toHaveTextContent(t("admin.topicSettings.strip.differing", { count: 2 }));
    // The warning is what to act on: it leads to its section of the settings.
    expect(within(strip).getByTestId("strip-differing")).toHaveAttribute(
      "href",
      `/ar/admin/topics/settings?year=${F.year.id}#settings-team-size`,
    );

    await app.user.click(screen.getByTestId("open-topic-settings"));
    await waitFor(() => expect(app.location()).toBe(`/ar/admin/topics/settings?year=${F.year.id}`));
    expect(await screen.findByRole("heading", { name: t("admin.topicSettings.title") })).toBeInTheDocument();
    expect(await screen.findByTestId("proposal-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("selection-timeline")).toBeInTheDocument();
    expect(await screen.findByTestId("team-size-card")).toBeInTheDocument();
  });

  it("وبلا شيءٍ محدّد: «لم يُحدَّد» ولا تنبيه، ولا رابط في الشريط", async () => {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    const strip = await screen.findByTestId("topic-settings-strip");
    await waitFor(() => expect(within(strip).getByTestId("strip-team-size")).toHaveTextContent(t("admin.topicSettings.strip.teamUnset")));
    expect(within(strip).queryByTestId("strip-differing")).toBeNull();
    // No «settings» word in it: the page's own button leads there.
    expect(within(strip).queryByRole("link")).toBeNull();
    expect(strip).not.toHaveTextContent(t("admin.topicSettings.open"));
    await app.user.click(screen.getByTestId("open-topic-settings"));
    await waitFor(() => expect(app.location()).toBe(`/ar/admin/topics/settings?year=${F.year.id}`));
  });

  it("صفحتها: سنةٌ تُختار فتُقرأ إعداداتها — والمؤرشفة تُرى ولا تُعدَّل —؛ والعودة إلى المواضيع", async () => {
    const app = renderApp("/ar/admin/topics/settings", { as: "admin" });
    await waitFor(() => expect(within(screen.getByTestId("proposal-timeline")).getByText(F.year.title)).toBeInTheDocument());
    // Each setting at a glance on the header: its state, and what it means now.
    await waitFor(() => expect(screen.getByTestId("overview-proposals")).toHaveTextContent(t("admin.proposals.state.unset")));
    expect(screen.getByTestId("overview-proposals")).toHaveTextContent(t("admin.topicSettings.noLimit"));
    await waitFor(() => expect(screen.getByTestId("overview-team-size")).toHaveTextContent(t("admin.topicSettings.teamSizeUnset")));
    // Three numbered sections, each saying whom it concerns.
    expect(within(screen.getByTestId("topic-settings-section-selection")).getByText(t("admin.topicSettings.forStudents"))).toBeInTheDocument();
    await app.user.click(screen.getByTestId("overview-selection"));
    expect(screen.queryByTestId("topic-settings-archived")).toBeNull();

    await app.user.click(screen.getByRole("combobox", { name: t("admin.academicYear") }));
    await app.user.click(await screen.findByRole("option", { name: esc(t("admin.topicSettings.yearArchived", { year: F.pastYear.title })) }));
    await waitFor(() => expect(app.location()).toBe(`/ar/admin/topics/settings?year=${F.pastYear.id}`));
    await waitFor(() => expect(within(screen.getByTestId("proposal-timeline")).getByText(F.pastYear.title)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("proposal-edit")).toBeDisabled());
    expect(screen.getByTestId("topic-settings-archived")).toHaveTextContent(t("admin.topicSettings.archivedNote"));
    expect(screen.getByTestId("selection-edit")).toBeDisabled();
    await waitFor(() => expect(screen.getByTestId("team-size-edit")).toBeDisabled());

    await app.user.click(screen.getByTestId("topic-settings-back"));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/topics"));
  });
});

describe("فترة اقتراح المواضيع", () => {
  const tp = (k: string, o?: object) => t(`admin.proposals.${k}`, o);
  const today = universityDay(Date.now());
  const windowPath = `/admin/academic-years/:id/proposal-window`;
  const dates = (dialog: HTMLElement) => dialog.querySelectorAll<HTMLInputElement>('input[type="date"]');
  /** رقم وحدةٍ في العدّ التنازليّ («days»، «seconds»…). */
  const unit = (root: HTMLElement, key: string) => root.querySelector(`[data-unit="${key}"] span[dir="ltr"]`)?.textContent;

  async function timeline() {
    const app = renderApp("/ar/admin/topics/settings", { as: "admin" });
    const card = await screen.findByTestId("proposal-timeline");
    await within(card).findByTestId("proposal-state");
    return { app, card };
  }
  async function openDialog(app: ReturnType<typeof renderApp>, card: HTMLElement) {
    await app.user.click(within(card).getByTestId("proposal-edit"));
    return screen.findByRole("dialog", { name: tp("dialogTitle", { year: F.year.title }) });
  }

  it("بلا فترة: تبدأ من اليوم لشهر، و«أسبوعان» يملأ النهاية، والحفظ يرسل اليومين ويعرضها مفتوحة", async () => {
    const { app, card } = await timeline();
    expect(within(card).getByTestId("proposal-state")).toHaveTextContent(tp("state.unset"));
    expect(within(card).getByText(tp("unsetHint"))).toBeInTheDocument();
    expect(within(card).queryByRole("progressbar")).toBeNull();
    // لا تفاصيل تُطوى.
    expect(within(card).queryByTestId("proposal-toggle")).toBeNull();

    const dialog = await openDialog(app, card);
    const [from, to] = dates(dialog);
    expect([from!.value, to!.value]).toEqual([today, addDays(today, 29)]);
    // Whole days: thirty of them, to the second.
    const length = within(dialog).getByTestId("period-length");
    expect([unit(length, "days"), unit(length, "hours"), unit(length, "minutes"), unit(length, "seconds")]).toEqual(["30", "00", "00", "00"]);
    expect(within(dialog).getByTestId("period-preview")).toHaveTextContent(t("admin.period.preview.open"));
    // فترةٌ جديدة: لا تمديد ولا إنهاء ولا إلغاء.
    expect(within(dialog).queryByRole("button", { name: tp("extendWeek") })).toBeNull();
    expect(within(dialog).queryByTestId("proposal-clear")).toBeNull();

    await app.user.click(within(dialog).getByRole("button", { name: tp("twoWeeks") }));
    expect(to!.value).toBe(addDays(today, 13));
    await app.user.click(within(dialog).getByTestId("proposal-save"));
    await waitFor(() =>
      expect(fake.find("put", `/admin/academic-years/${F.ID.y1}/proposal-window`)[0]?.body).toEqual({
        opensOn: today,
        closesOn: addDays(today, 13),
        opensTime: "00:00:00",
        closesTime: "23:59:59",
      }),
    );
    expect(await screen.findByText(tp("saved"))).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: tp("dialogTitle", { year: F.year.title }) })).toBeNull());
    await waitFor(() => expect(within(card).getByTestId("proposal-state")).toHaveTextContent(tp("state.open")));
    // تنتهي آخر يومها الرابع عشر: ثلاثة عشر يوماً وما بقي من اليوم.
    const timer = within(card).getByRole("timer", { name: new RegExp(`^${tp("endsIn")}`) });
    expect(unit(timer, "days")).toBe("13");
    expect(within(card).getByRole("progressbar")).toBeInTheDocument();
  });

  it("مفتوحة: العدد ومن اقترح وما بقي؛ تمديدٌ أسبوعاً، وإنهاءٌ اليوم، والمقلوبة تُطفئ الحفظ؛ والإلغاء يحذفها", async () => {
    // نصف يومٍ فوق العشرة: لا يقع العدّ على حدّ يومٍ فيتأرجح بين رقمين.
    fake.on("get", windowPath, () => F.proposalWindow(F.year, F.days(-5), F.days(10.5)));
    const { app, card } = await timeline();
    expect(within(card).getByTestId("proposal-state")).toHaveTextContent(tp("state.open"));
    expect(within(card).getByText("7")).toBeInTheDocument();
    expect(within(card).getByText(tp("ofTotal", { n: 3, total: 5 }))).toBeInTheDocument();
    const timer = within(card).getByRole("timer", { name: new RegExp(`^${tp("endsIn")}`) });
    expect(unit(timer, "days")).toBe("10");
    expect(within(card).queryByTestId("proposal-relative")).toBeNull();
    // خمسة أيامٍ مضت من خمسة عشر ونصف.
    expect(within(card).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("32");

    const dialog = await openDialog(app, card);
    const [from, to] = dates(dialog);
    expect(to!.value).toBe(universityDay(F.days(10.5)));
    await app.user.click(within(dialog).getByRole("button", { name: tp("extendWeek") }));
    expect(to!.value).toBe(addDays(universityDay(F.days(10.5)), 7));
    await app.user.click(within(dialog).getByRole("button", { name: tp("closeToday") }));
    expect(to!.value).toBe(today);

    fireEvent.change(to!, { target: { value: addDays(from!.value, -1) } });
    expect(within(dialog).getByText(tp("orderError"))).toBeInTheDocument();
    expect(within(dialog).getByTestId("proposal-save")).toBeDisabled();
    fireEvent.change(to!, { target: { value: "" } });
    expect(within(dialog).getByText(tp("pickBoth"))).toBeInTheDocument();

    fake.on("get", windowPath, () => F.proposalWindow(F.year));
    await app.user.click(within(dialog).getByTestId("proposal-clear"));
    await waitFor(() => expect(fake.find("delete", `/admin/academic-years/${F.ID.y1}/proposal-window`)).toHaveLength(1));
    expect(await screen.findByText(tp("cleared"))).toBeInTheDocument();
    await waitFor(() => expect(within(card).getByTestId("proposal-state")).toHaveTextContent(tp("state.unset")));
  });

  it("لم تبدأ ⇒ عدٌّ إلى بدايتها؛ ومنتهية ⇒ «انتهت منذ يومين» بلا عدّ، والشريط ممتلئ", async () => {
    fake.on("get", windowPath, () => F.proposalWindow(F.year, F.days(3.5), F.days(20)));
    let { app, card } = await timeline();
    expect(within(card).getByTestId("proposal-state")).toHaveTextContent(tp("state.upcoming"));
    const timer = within(card).getByRole("timer", { name: new RegExp(`^${tp("opensIn")}`) });
    expect(unit(timer, "days")).toBe("03");
    app.unmount();

    fake.on("get", windowPath, () => F.proposalWindow(F.year, F.days(-20), F.days(-2)));
    ({ app, card } = await timeline());
    expect(within(card).getByTestId("proposal-state")).toHaveTextContent(tp("state.closed"));
    expect(within(card).getByTestId("proposal-relative")).toHaveTextContent(tp("endedAgo", { count: 2 }));
    expect(within(card).queryByRole("timer")).toBeNull();
    expect(within(card).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
    // وليست مفتوحة: لا «إنهاؤها اليوم».
    const dialog = await openDialog(app, card);
    expect(within(dialog).queryByRole("button", { name: tp("closeToday") })).toBeNull();
  });

  describe("الطيّ", () => {
    const KEY = "admin.proposalTimeline.collapsed";

    it("مطويّةً يبقى العدّ في رأسها صغيراً وخيطٌ بما مضى، والتفاصيل خارج قارئ الشاشة؛ وتُذكر بين الزيارات وتُفتح", async () => {
      fake.on("get", windowPath, () => F.proposalWindow(F.year, F.days(-5), F.days(10.5)));
      let { app, card } = await timeline();
      const toggle = within(card).getByTestId("proposal-toggle");
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(toggle).toHaveAccessibleName(tp("collapse"));
      expect(within(card).queryByTestId("proposal-compact")).toBeNull();
      expect(within(card).queryByTestId("proposal-thread")).toBeNull();

      await app.user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(toggle).toHaveAccessibleName(tp("expand"));
      const details = within(card).getByTestId("proposal-details");
      expect(details).toHaveAttribute("aria-hidden", "true");
      expect(details).toHaveAttribute("inert");
      // عدّادٌ واحدٌ يُقرأ — الذي في الرأس — بالمدّة نفسها.
      const timers = within(card).getAllByRole("timer", { name: new RegExp(`^${tp("endsIn")}`) });
      expect(timers).toHaveLength(1);
      expect(within(card).getByTestId("proposal-compact")).toContainElement(timers[0]!);
      expect(unit(timers[0]!, "days")).toBe("10");
      expect(within(card).queryByRole("progressbar")).toBeNull();
      expect(within(card).getByTestId("proposal-thread").firstElementChild).toHaveStyle({ width: "32%" });
      expect(localStorage.getItem(KEY)).toBe("1");
      app.unmount();

      ({ app, card } = await timeline());
      expect(within(card).getByTestId("proposal-toggle")).toHaveAttribute("aria-expanded", "false");
      expect(within(card).getByTestId("proposal-compact")).toBeInTheDocument();
      await app.user.click(within(card).getByTestId("proposal-toggle"));
      expect(within(card).queryByTestId("proposal-compact")).toBeNull();
      expect(within(card).queryByTestId("proposal-thread")).toBeNull();
      expect(within(card).getByTestId("proposal-details")).not.toHaveAttribute("aria-hidden");
      expect(within(card).getByRole("progressbar")).toBeInTheDocument();
      expect(localStorage.getItem(KEY)).toBe("0");
    });

    it("منتهيةً مطويّة: لا عدّ في الرأس، والخيط ممتلئ؛ وبلا فترةٍ لا طيّ ولو ذُكر", async () => {
      localStorage.setItem(KEY, "1");
      fake.on("get", windowPath, () => F.proposalWindow(F.year, F.days(-20), F.days(-2)));
      const first = await timeline();
      let card = first.card;
      expect(within(card).getByTestId("proposal-toggle")).toHaveAttribute("aria-expanded", "false");
      expect(within(card).queryByTestId("proposal-compact")).toBeNull();
      expect(within(card).queryByRole("timer")).toBeNull();
      expect(within(card).getByTestId("proposal-thread").firstElementChild).toHaveStyle({ width: "100%" });
      first.app.unmount();

      fake.on("get", windowPath, () => F.proposalWindow(F.year));
      ({ card } = await timeline());
      expect(within(card).queryByTestId("proposal-toggle")).toBeNull();
      expect(within(card).queryByTestId("proposal-thread")).toBeNull();
      expect(within(card).getByText(tp("unsetHint"))).toBeInTheDocument();
    });

    it("والتخزين ممنوع ⇒ مفتوحةٌ أوّل مرّة، والطيّ يعمل لهذه الزيارة", async () => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      const denied = () => {
        throw new DOMException("denied", "SecurityError");
      };
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, k: string) {
        return k === KEY ? denied() : get.call(this, k);
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
        return k === KEY ? denied() : set.call(this, k, v);
      });
      try {
        fake.on("get", windowPath, () => F.proposalWindow(F.year, F.days(-5), F.days(10.5)));
        const { app, card } = await timeline();
        const toggle = within(card).getByTestId("proposal-toggle");
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        await app.user.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(within(card).getByTestId("proposal-compact")).toBeInTheDocument();
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  it("الخادم يرفض الحفظ ⇒ رسالته والنافذة باقية، وEscape يغلقها؛ وبلا سنةٍ جارية ⇒ يُقال ذلك", async () => {
    fake.fail("put", windowPath, 400, "السنة مؤرشفة");
    const { app, card } = await timeline();
    const dialog = await openDialog(app, card);
    await app.user.click(within(dialog).getByTestId("proposal-save"));
    expect(await screen.findByText("السنة مؤرشفة")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: tp("dialogTitle", { year: F.year.title }) })).toBeInTheDocument();
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: tp("dialogTitle", { year: F.year.title }) })).toBeNull());
    app.unmount();

    fake.on("get", "/admin/academic-years", () => ({ academicYears: [F.pastYear] }));
    renderApp("/ar/admin/topics/settings", { as: "admin" });
    expect(await screen.findByText(tp("noYear"))).toBeInTheDocument();
  });
});

describe("مهلة اختيار المواضيع — بطاقتها تحت فترة الاقتراح", () => {
  const ts = (k: string, o?: object) => t(`admin.selection.${k}`, o);
  /** رقم وحدةٍ في لوحات المدّة («days»، «seconds»…). */
  const unit = (root: HTMLElement, key: string) => root.querySelector(`[data-unit="${key}"] span[dir="ltr"]`)?.textContent;
  const today = universityDay(Date.now());
  const windowPath = `/admin/academic-years/:id/selection-window`;
  const dates = (dialog: HTMLElement) => dialog.querySelectorAll<HTMLInputElement>('input[type="date"]');

  async function selectionCard() {
    const app = renderApp("/ar/admin/topics/settings", { as: "admin" });
    const card = await screen.findByTestId("selection-timeline");
    await within(card).findByTestId("selection-state");
    return { app, card };
  }
  async function openDialog(app: ReturnType<typeof renderApp>, card: HTMLElement) {
    await app.user.click(within(card).getByTestId("selection-edit"));
    return screen.findByRole("dialog", { name: ts("dialogTitle", { year: F.year.title }) });
  }

  it("بلا مهلة: تبدأ من اليوم لأسبوعين، والحفظ يرسل اليومين ويعرضها مفتوحة بما فيها", async () => {
    const { app, card } = await selectionCard();
    expect(within(card).getByTestId("selection-state")).toHaveTextContent(ts("state.unset"));
    expect(within(card).getByText(ts("unsetHint"))).toBeInTheDocument();
    // Both periods on the page, each its own card.
    expect(screen.getByTestId("proposal-timeline")).not.toBe(card);

    const dialog = await openDialog(app, card);
    const [from, to] = dates(dialog);
    expect([from!.value, to!.value]).toEqual([today, addDays(today, 13)]);
    expect(unit(within(dialog).getByTestId("period-length"), "days")).toBe("14");
    expect(within(dialog).getByText(ts("notifyHint"))).toBeInTheDocument();
    // No proposal period set: nothing to warn of.
    expect(within(dialog).queryByTestId("selection-too-early")).toBeNull();

    await app.user.click(within(dialog).getByTestId("selection-save"));
    await waitFor(() =>
      expect(fake.find("put", `/admin/academic-years/${F.ID.y1}/selection-window`)[0]?.body).toEqual({
        opensOn: today,
        closesOn: addDays(today, 13),
        opensTime: "00:00:00",
        closesTime: "23:59:59",
      }),
    );
    expect(await screen.findByText(ts("saved"))).toBeInTheDocument();
    await waitFor(() => expect(within(card).getByTestId("selection-state")).toHaveTextContent(ts("state.open")));
    // What is in it: topics to choose, students who asked of all, requests awaiting.
    // In its own box: the countdown beside it can show 12 too, at noon.
    expect(within(card).getByText(ts("statTopics")).closest("div")).toHaveTextContent("12");
    expect(within(card).getByText(ts("ofTotal", { n: 18, total: 40 }))).toBeInTheDocument();
    expect(within(card).getByText(ts("statPending"))).toBeInTheDocument();
    expect(within(card).getByRole("timer", { name: new RegExp(`^${ts("endsIn")}`) })).toBeInTheDocument();
  });

  it("بالثانية: ساعتا البداية والنهاية تُضبطان، والمدّة بالأيام والساعات والدقائق والثواني، و«أيّامٌ كاملة» تعيدهما", async () => {
    const { app, card } = await selectionCard();
    const dialog = await openDialog(app, card);
    const [from, to] = dates(dialog);
    const startTime = within(dialog).getByLabelText(t("admin.period.startTime"));
    const endTime = within(dialog).getByLabelText(t("admin.period.endTime"));
    expect([(startTime as HTMLInputElement).value, (endTime as HTMLInputElement).value]).toEqual(["00:00:00", "23:59:59"]);
    // Whole days already: nothing to bring back.
    expect(within(dialog).queryByRole("button", { name: t("admin.period.wholeDays") })).toBeNull();

    fireEvent.change(from!, { target: { value: addDays(today, 2) } });
    fireEvent.change(to!, { target: { value: addDays(today, 3) } });
    fireEvent.change(startTime, { target: { value: "08:15:00" } });
    fireEvent.change(endTime, { target: { value: "10:45:30" } });
    // From 08:15:00 to the end of 10:45:30 the next day: 1 day, 2 hours, 30 minutes, 31 seconds.
    const length = within(dialog).getByTestId("period-length");
    expect([unit(length, "days"), unit(length, "hours"), unit(length, "minutes"), unit(length, "seconds")]).toEqual(["01", "02", "30", "31"]);
    expect(within(dialog).getByTestId("period-preview")).toHaveTextContent(t("admin.period.preview.upcoming"));
    expect(dialog).toHaveTextContent("08:15:00");

    // The end before the start, on the same day: said, and not saved.
    fireEvent.change(to!, { target: { value: addDays(today, 2) } });
    fireEvent.change(endTime, { target: { value: "08:00:00" } });
    expect(within(dialog).getByText(ts("orderError"))).toBeInTheDocument();
    expect(within(dialog).getByTestId("selection-save")).toBeDisabled();
    fireEvent.change(endTime, { target: { value: "18:00" } });

    await app.user.click(within(dialog).getByTestId("selection-save"));
    await waitFor(() =>
      expect(fake.find("put", `/admin/academic-years/${F.ID.y1}/selection-window`)[0]?.body).toEqual({
        opensOn: addDays(today, 2),
        closesOn: addDays(today, 2),
        opensTime: "08:15:00",
        closesTime: "18:00:00",
      }),
    );
  });

  it("«أيّامٌ كاملة» تعيد الساعتين؛ وموعدٌ مضى يُقال إنّها ستكون مغلقة", async () => {
    fake.on("get", windowPath, () => F.selectionWindow(F.year, F.days(-1.3), F.days(5.2)));
    const { app, card } = await selectionCard();
    const dialog = await openDialog(app, card);
    const startTime = within(dialog).getByLabelText(t("admin.period.startTime")) as HTMLInputElement;
    expect(startTime.value).not.toBe("00:00:00");
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.period.wholeDays") }));
    expect(startTime.value).toBe("00:00:00");
    expect((within(dialog).getByLabelText(t("admin.period.endTime")) as HTMLInputElement).value).toBe("23:59:59");

    const [from, to] = dates(dialog);
    fireEvent.change(from!, { target: { value: addDays(today, -10) } });
    fireEvent.change(to!, { target: { value: addDays(today, -3) } });
    expect(within(dialog).getByTestId("period-preview")).toHaveTextContent(t("admin.period.preview.closed"));
  });

  it("تبدأ قبل نهاية فترة الاقتراح ⇒ تنبيهٌ بيومها، ويزول إن بدأت بعدها؛ والإلغاء يحذفها", async () => {
    // One moment, read once: shown to the second, two readings a second apart would differ.
    const [opened, closes, proposalsEnd] = [F.days(-1), F.days(10.5), F.days(5)];
    fake.on("get", windowPath, () => F.selectionWindow(F.year, opened, closes, proposalsEnd));
    const { app, card } = await selectionCard();
    expect(within(card).getByTestId("selection-state")).toHaveTextContent(ts("state.open"));

    const dialog = await openDialog(app, card);
    const warning = within(dialog).getByTestId("selection-too-early");
    expect(warning).toHaveTextContent(ts("beforeProposalsEnd", { date: formatDay(proposalsEnd, "ar") }));
    const [from] = dates(dialog);
    fireEvent.change(from!, { target: { value: addDays(universityDay(proposalsEnd), 1) } });
    expect(within(dialog).queryByTestId("selection-too-early")).toBeNull();

    fake.on("get", windowPath, () => F.selectionWindow(F.year));
    await app.user.click(within(dialog).getByTestId("selection-clear"));
    await waitFor(() => expect(fake.find("delete", `/admin/academic-years/${F.ID.y1}/selection-window`)).toHaveLength(1));
    expect(await screen.findByText(ts("cleared"))).toBeInTheDocument();
    await waitFor(() => expect(within(card).getByTestId("selection-state")).toHaveTextContent(ts("state.unset")));
  });

  it("انتهت ⇒ «انتهت منذ يومين» بلا عدّ؛ وسنةٌ مؤرشفة لا تُعدَّل مهلتها", async () => {
    fake.on("get", windowPath, () => F.selectionWindow(F.year, F.days(-20), F.days(-2)));
    const { app, card } = await selectionCard();
    expect(within(card).getByTestId("selection-state")).toHaveTextContent(ts("state.closed"));
    expect(within(card).getByTestId("selection-relative")).toHaveTextContent(ts("endedAgo", { count: 2 }));
    expect(within(card).queryByRole("timer")).toBeNull();
    app.unmount();

    fake.on("get", windowPath, () => F.selectionWindow({ ...F.year, archivedAt: F.days(-1) }));
    const archived = (await selectionCard()).card;
    expect(within(archived).getByTestId("selection-edit")).toBeDisabled();
    expect(within(archived).getByTestId("selection-edit")).toHaveAttribute("title", ts("archived"));
  });
});
