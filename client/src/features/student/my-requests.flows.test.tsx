import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";

/**
 * طلبات الطالب: كلّ طلبٍ ببطاقته، وما يُفعل به بحسب حاله.
 *
 * يُحرس: أنّ المقبول يقود إلى المشروع ومحضر الإشراف؛ وأنّ المرفوض يقود إلى
 * الموضوع ليُعاد التقديم ما دام يستقبل، وإلى المواضيع الأخرى إن أُسند لغيره،
 * ولا إلى شيءٍ لمن له مشروع؛ وأنّ المنتظَر لا يُلغيه إلّا مرسِله، وبعد تأكيدٍ
 * يقول إنّ الموضوع يتحرّر لغيره؛ وأنّ بطاقات الأعداد فلاتر.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function requests() {
  const app = renderApp("/ar/student/requests", { as: "student" });
  await screen.findAllByText(F.topicApproved.title);
  return app;
}
const card = (title: string) => screen.getAllByText(title).map((el) => el.closest("article, li, section")).find(Boolean) as HTMLElement;

describe("بطاقات الطلبات", () => {
  it("المقبول ⇒ المشروع والمحضر؛ المرفوض ولي مشروع ⇒ لا شيء يُرسل؛ المنتظَر من غيري ⇒ لا إلغاء", async () => {
    await requests();
    const accepted = card(F.topicFull.title);
    expect(within(accepted).getByRole("link", { name: esc(t("stu.viewProjectDetails")) })).toHaveAttribute("href", "/ar/student/project");
    expect(within(accepted).getByRole("button", { name: esc(t("supervision.sheet")) })).toBeInTheDocument();

    // A student in a project sends no request again — the server would refuse it.
    const rejected = card(F.topicOpen.title);
    expect(within(rejected).queryByRole("link", { name: esc(t("stu.editResubmit")) })).toBeNull();
    expect(within(rejected).queryByTestId("choose-another-topic")).toBeNull();

    const pending = card(F.topicApproved.title);
    expect(within(pending).getByText(t("stu.req.onlyLeaderCancels"))).toBeInTheDocument();
    expect(within(pending).queryByRole("button", { name: esc(t("stu.cancelRequest")) })).toBeNull();
  });

  it("محضر الإشراف يُفتح من الطلب المقبول ويُغلق", async () => {
    const app = await requests();
    await app.user.click(within(card(F.topicFull.title)).getByRole("button", { name: esc(t("supervision.sheet")) }));
    const sheet = (await screen.findAllByRole("dialog")).at(-1)!;
    await waitFor(() => expect(fake.find("get", `/supervision-documents/topics/${F.topicFull.id}/preview`)).toHaveLength(1));
    await app.user.click(within(sheet).getAllByRole("button", { name: new RegExp(`${esc(t("admin.close")).source}|${esc(t("pro.cancel")).source}`) })[0]!);
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  });

  it("طلبٌ منتظَر أرسلتُه ⇒ «إلغاء» يُسأل عنه (والتراجع لا يُلغي)، ثمّ يُحذف", async () => {
    fake.on("get", "/student/group-requests", { requests: F.studentRequests.map((r) => (r.status === "pending" ? { ...r, isLeader: true } : r)) });
    const app = await requests();
    const cancel = () => within(card(F.topicApproved.title)).getByRole("button", { name: esc(t("stu.cancelRequest")) });

    await app.user.click(cancel());
    let alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getAllByRole("button")[0]!);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fake.writes).toEqual([]);

    await app.user.click(cancel());
    alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getAllByRole("button").at(-1)!);
    await waitFor(() => expect(fake.find("delete", "/student/group-requests/gr5")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});

describe("المرفوض: ما بعده", () => {
  beforeEach(() => fake.on("get", "/student/my-project", { project: null }));

  it("والموضوع ما يزال يستقبل ⇒ «تعديل وإعادة الإرسال» إليه", async () => {
    await requests();
    const rejected = card(F.topicOpen.title);
    expect(within(rejected).getByRole("link", { name: esc(t("stu.editResubmit")) })).toHaveAttribute("href", `/ar/topics/${F.topicOpen.id}`);
    expect(within(rejected).queryByTestId("choose-another-topic")).toBeNull();
  });

  it("والموضوع أُسند لفريقٍ آخر ⇒ «اختر موضوعاً آخر» إلى المواضيع، لا إليه", async () => {
    fake.on("get", "/student/group-requests", {
      requests: F.studentRequests.map((r) =>
        r.status === "rejected"
          ? { ...r, rejectionReason: "اختارت الإدارة فريقاً آخر لهذا الموضوع — اختر موضوعاً غيره.", topic: { ...r.topic!, status: "full" as const } }
          : r,
      ),
    });
    await requests();
    const rejected = card(F.topicOpen.title);
    const next = within(rejected).getByTestId("choose-another-topic");
    expect(next).toHaveAttribute("href", "/ar/topics");
    expect(next).toHaveTextContent(t("stu.chooseAnotherTopic"));
    expect(within(rejected).queryByRole("link", { name: esc(t("stu.editResubmit")) })).toBeNull();
  });
});

describe("الفلاتر والحالات", () => {
  it("بطاقات الأعداد فلاتر: المرفوضة وحدها، ثمّ الكلّ", async () => {
    fake.on("get", "/student/my-project", { project: null });
    const app = await requests();
    const group = screen.getByRole("group", { name: t("stu.req.filterBy") });
    const tile = (label: string) => within(group).getAllByRole("button").find((b) => b.textContent?.includes(label))!;
    await app.user.click(tile(t("stu.reqStatus.rejected")));
    expect(tile(t("stu.reqStatus.rejected"))).toHaveAttribute("aria-pressed", "true");
    // عنوان المقبول يبقى في رأس الصفحة (مشروعي)، فالعلامة بطاقته: رابط المشروع.
    const projectLink = () => screen.queryByRole("link", { name: esc(t("stu.viewProjectDetails")) });
    await waitFor(() => expect(projectLink()).toBeNull());
    expect(screen.getByRole("link", { name: esc(t("stu.editResubmit")) })).toBeInTheDocument();
    await app.user.click(within(group).getAllByRole("button")[0]!);
    expect(await screen.findByRole("link", { name: esc(t("stu.viewProjectDetails")) })).toBeInTheDocument();
  });

  it("فلترٌ بلا طلبات ⇒ «لا شيء في هذا الفلتر»", async () => {
    fake.on("get", "/student/group-requests", { requests: F.studentRequests.filter((r) => r.status !== "pending") });
    const app = renderApp("/ar/student/requests", { as: "student" });
    await screen.findAllByText(F.topicFull.title);
    const group = screen.getByRole("group", { name: t("stu.req.filterBy") });
    await app.user.click(within(group).getAllByRole("button").find((b) => b.textContent?.includes(t("stu.reqStatus.pending")))!);
    expect(await screen.findByText(t("stu.req.noneInFilter"))).toBeInTheDocument();
  });

  it("تعذّر التحميل ⇒ «إعادة» تطلب من جديد", async () => {
    fake.fail("get", "/student/group-requests", 500, "خطأ");
    const app = renderApp("/ar/student/requests", { as: "student" });
    const retry = await screen.findByRole("button", { name: esc(t("admin.retry")) });
    const before = fake.find("get", "/student/group-requests").length;
    await app.user.click(retry);
    await waitFor(() => expect(fake.find("get", "/student/group-requests").length).toBeGreaterThan(before));
  });
});
