import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";
import { personName } from "../../../../lib/person-name";

/**
 * طلبات المجموعات: القرار فيها للإدارة — قبولٌ يُكوّن الفريق، ورفضٌ بسبب،
 * وتعديل الفريق قبل القرار (المرسِل والأعضاء)، وحذف ما رُفض من السجلّ.
 *
 * يُحرس: أنّ القبول من عرض المواضيع يُسأل عنه (فقبول طلبٍ يردّ من ينتظر
 * غيره)؛ وأنّ ما لا يجوز (طلبٌ قُبل) زرّه مطفأٌ بسببه؛ وأنّ كلّ إجراءٍ يصل
 * مساره بمعرّف الطلب والطالب.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("القائمة", () => {
  it("عرض المواضيع: القبول يُسأل عنه ثمّ يُرسل", async () => {
    const app = renderApp("/ar/admin/group-requests", { as: "admin" });
    const topic = (await screen.findAllByTestId("request-topic"))[0]!;
    await app.user.click(within(topic).getAllByRole("button", { name: esc(t("admin.accept")) })[0]!);
    expect(fake.writes).toEqual([]);
    await app.user.click((await screen.findAllByRole("button", { name: t("admin.accept") })).at(-1)!);
    await waitFor(() => expect(fake.find("patch", "/admin/group-requests/gr1/accept")).toHaveLength(1));
  });

  it("عرض القائمة: قبولٌ ورفضٌ من الصفّ، والمقبول زرّاه مطفآن", async () => {
    const app = renderApp("/ar/admin/group-requests", { as: "admin" });
    await app.user.click(await screen.findByTestId("requests-view-list"));
    const rejects = await screen.findAllByRole("button", { name: esc(t("admin.reject")) });
    const enabled = rejects.filter((b) => !(b as HTMLButtonElement).disabled);
    expect(enabled.length).toBeLessThan(rejects.length);
    await app.user.click(enabled[0]!);
    await waitFor(() => expect(fake.find("patch", /\/admin\/group-requests\/.+\/reject$/)).toHaveLength(1));
  });

  it("طلبٌ مرفوض يُحذف من السجلّ بعد التأكيد", async () => {
    const app = renderApp("/ar/admin/group-requests", { as: "admin" });
    await app.user.click(await screen.findByTestId("requests-view-list"));
    await app.user.click((await screen.findAllByTitle(t("admin.delete")))[0]!);
    await app.user.click((await screen.findAllByRole("button", { name: t("admin.delete") })).at(-1)!);
    await waitFor(() => expect(fake.find("delete", "/admin/group-requests/gr3")).toHaveLength(1));
  });

  it("عرض المواضيع: المُسند يقول لمن أُسند، والمفتوح يعدّ من ينتظر", async () => {
    renderApp("/ar/admin/group-requests", { as: "admin" });
    const [open, full] = await screen.findAllByTestId("request-topic");
    expect(within(open!).getByTestId("topic-waiting")).toHaveTextContent("1/3");
    expect(within(open!).queryByTestId("topic-assigned")).toBeNull();

    const assigned = within(full!).getByTestId("topic-assigned");
    expect(assigned).toHaveTextContent(t("admin.grt.assignedTo"));
    expect(assigned).toHaveTextContent(t("admin.grt.teamOf", { name: personName(F.groupRequests[1]!.leader!.user as never) }));
    expect(within(full!).queryByTestId("topic-waiting")).toBeNull();
  });

  it("عرض المواضيع: عدد الطلاب بصيغته — «طالب واحد» لا «1 طلاب»", async () => {
    fake.on("get", "/admin/group-requests/by-topic", () => ({
      items: [{ ...F.requestTopics[0]!, maxStudents: 1 }, { ...F.requestTopics[1]!, maxStudents: 2 }],
      total: 2,
      page: 1,
      limit: 20,
      counts: { pending: 1, accepted: 1, rejected: 1, all: 3 },
      pageTotal: 2,
    }));
    renderApp("/ar/admin/group-requests", { as: "admin" });
    const [one, two] = await screen.findAllByTestId("request-topic");
    expect(within(one!).getByText("طالب واحد")).toBeInTheDocument();
    expect(within(two!).getByText("حتى طالبين")).toBeInTheDocument();
  });

  it("البحث في الطلبات يصل الخادم", async () => {
    const app = renderApp("/ar/admin/group-requests", { as: "admin" });
    await screen.findAllByTestId("request-topic");
    const search = screen.getAllByRole("textbox").find((i) => (i as HTMLInputElement).placeholder)!;
    await app.user.type(search, "الرقمنة");
    await waitFor(() => expect(fake.find("get", /^\/admin\/group-requests/).some((c) => Object.values(c.query).includes("الرقمنة"))).toBe(true));
  });
});

describe("تفاصيل الطلب", () => {
  async function open() {
    const app = renderApp("/ar/admin/group-requests/gr1", { as: "admin" });
    await screen.findByRole("button", { name: esc(t("admin.acceptAndFormTeam")) });
    return app;
  }

  it("القبول يكوّن الفريق", async () => {
    const app = await open();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.acceptAndFormTeam")) }));
    await waitFor(() => expect(fake.find("patch", "/admin/group-requests/gr1/accept")).toHaveLength(1));
  });

  it("الرفض بسببه", async () => {
    const app = await open();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.rejectRequest")) }));
    await app.user.type(screen.getByPlaceholderText(t("admin.rejectionReasonPlaceholder")), "الفريق ناقص");
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.confirmReject")) }));
    await waitFor(() => expect(fake.find("patch", "/admin/group-requests/gr1/reject")[0]?.body).toEqual({ reason: "الفريق ناقص" }));
  });

  it("قبل القرار: عضوٌ يُجعل مرسِلاً، وآخر يُخرج", async () => {
    const app = await open();
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.setAsLeader")) })[0]!);
    await waitFor(() => expect(fake.find("patch", `/admin/group-requests/gr1/leader/${F.student3.id}`)).toHaveLength(1));
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.removeCover")) }).at(-1)!);
    await waitFor(() => expect(fake.find("delete", /^\/admin\/group-requests\/gr1\/members\//)).toHaveLength(1));
  });

  it("طلبٌ قُبل ⇒ «تراجع ورفض» بدل الرفض، والقبول مطفأ", async () => {
    renderApp("/ar/admin/group-requests/gr2", { as: "admin" });
    expect(await screen.findByRole("button", { name: esc(t("admin.undoAndReject")) })).toBeDisabled();
  });
});

describe("تفاصيل الطلب: ما حول القرار", () => {
  it("طلبٌ لا يوجد ⇒ يقال، و«العودة إلى الطلبات»", async () => {
    fake.on("get", "/admin/group-requests/:id", { groupRequest: null });
    const app = renderApp("/ar/admin/group-requests/nope", { as: "admin" });
    expect(await screen.findByText(t("admin.requestNotFound"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.backToRequests")) }));
    await waitFor(() => expect(app.location()).toMatch(/^\/ar\/admin\/group-requests(\?|$)/));
  });

  it("الرفض يُتراجع عنه فيُفرغ السبب؛ واسم العضو يفتح الطالب، والموضوع يُفتح من رأس الصفحة", async () => {
    const app = renderApp("/ar/admin/group-requests/gr1", { as: "admin" });
    await app.user.click(await screen.findByRole("button", { name: esc(t("admin.rejectRequest")) }));
    await app.user.type(screen.getByPlaceholderText(t("admin.rejectionReasonPlaceholder")), "سببٌ مؤقّت");
    await app.user.click(screen.getByRole("button", { name: t("admin.cancel") }));
    expect(screen.queryByPlaceholderText(t("admin.rejectionReasonPlaceholder"))).toBeNull();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.rejectRequest")) }));
    expect(screen.getByPlaceholderText(t("admin.rejectionReasonPlaceholder"))).toHaveValue("");
    expect(fake.find("patch", /\/reject$/)).toEqual([]);

    await app.user.click(screen.getAllByText(/سارة/)[0]!.closest("button")!);
    await waitFor(() => expect(app.location()).toBe(`/ar/admin/students/${F.student2.id}`));
  });

  it("زرّ الموضوع في الرأس يفتحه", async () => {
    const app = renderApp("/ar/admin/group-requests/gr1", { as: "admin" });
    await screen.findByRole("button", { name: esc(t("admin.acceptAndFormTeam")) });
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.topicDetails")) }));
    await waitFor(() => expect(app.location()).toBe(`/ar/admin/topics/${F.topicOpen.id}`));
  });

  it("عضوٌ في مشروعٍ آخر، أو ينتظر طلباً آخر ⇒ وسمٌ بذلك على بطاقته", async () => {
    const gr = F.groupRequests[0]!;
    const [leader, member] = gr.members!;
    fake.on("get", "/admin/group-requests/:id", {
      groupRequest: {
        ...gr,
        members: [
          leader,
          { ...member, project: { id: "p9", topic: { id: "t-x", title: "مشروعٌ قائم" } }, otherPending: [{ id: "gr9", topic: { id: "t-y", title: "طلبٌ آخر" } }] },
        ],
      },
    });
    renderApp("/ar/admin/group-requests/gr1", { as: "admin" });
    expect(await screen.findByText(t("admin.grd.inProject", { title: "مشروعٌ قائم" }))).toBeInTheDocument();
    expect(screen.getByText(t("admin.grd.alsoWaiting", { title: "طلبٌ آخر" }))).toBeInTheDocument();
  });

  it("طلبٌ مرفوض ⇒ الخطوة الأخيرة «رُفض» وسببه ظاهر", async () => {
    renderApp("/ar/admin/group-requests/gr3", { as: "admin" });
    expect((await screen.findAllByText(t("stu.req.stepRejected"))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/الفريق تجاوز العدد المسموح/).length).toBeGreaterThan(0);
  });
});
