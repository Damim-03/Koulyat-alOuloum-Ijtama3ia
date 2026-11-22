import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../i18n/i18n";
import { fake } from "../../../test/fake-api";
import { renderApp } from "../../../test/render-app";
import * as F from "../../../test/fixtures";

/**
 * (قائمة المواضيع لمن دخل وحده، فالتنقّل إليها يُجرَّب بحساب طالب.)
 *
 * صفحة الموضوع العامّة في التطبيق كلّه: «العودة» إلى القائمة، ومشاركة الرابط،
 * وما بعد التقديم (طلبي قيد المراجعة ⇒ إلى طلباتي؛ مأخوذ ⇒ إلى المتاح)، وما
 * يقال حين لا يُعرض الموضوع (محجوزٌ لغيري، أو غير موجود، أو تعذّر).
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const withTopic = (patch: object) => fake.on("get", "/public/topics/:id", (r) => ({ topic: { ...F.publicTopicDetail(r.params.id!), ...patch } }));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function detail(as: "student" | null = null) {
  const app = renderApp(`/ar/topics/${F.topicOpen.id}`, { as });
  await screen.findAllByText(F.topicOpen.title);
  return app;
}

describe("صفحة الموضوع", () => {
  // Still choosing: no project yet (a student with one asks for no other topic).
  beforeEach(() => fake.on("get", "/student/my-project", { project: null }));
  it("«العودة» إلى المواضيع، والمشاركة تنسخ الرابط (ونجاحها وفشلها يقالان)", async () => {
    const app = await detail("student");
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await app.user.click(screen.getByRole("button", { name: esc(t("public.share")) }));
    expect(await screen.findByText(t("public.linkCopied"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: esc(t("public.share")) }));
    expect(await screen.findByText(t("admin.actionFailed"))).toBeInTheDocument();

    await app.user.click(screen.getAllByRole("button", { name: esc(t("public.backToTopics")) })[0]!);
    await waitFor(() => expect(app.location()).toBe("/ar/topics"));
  });

  it("طلبي عليه قيد المراجعة ⇒ «إلى طلباتي»", async () => {
    withTopic({ isAvailable: false, myRequestPending: true });
    const app = await detail("student");
    await app.user.click(screen.getByRole("button", { name: esc(t("public.panel.minePendingAction")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/student/requests"));
  });

  it("مأخوذٌ لغيري ⇒ «مواضيع متاحة أخرى» تفتح تبويب المتاح", async () => {
    withTopic({ isAvailable: false, myRequestPending: false });
    const app = await detail("student");
    await app.user.click(screen.getByRole("button", { name: esc(t("public.panel.browseOthers")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/topics?status=available"));
  });

  it("محجوزٌ لفريقٍ آخر بالرابط المباشر ⇒ لوحةٌ تقول ذلك، و«العودة» و«تصفّح المتاح»", async () => {
    fake.fail("get", "/public/topics/:id", 403, "محجوز", "TOPIC_RESERVED");
    const app = renderApp(`/ar/topics/${F.topicFull.id}`, { as: "student" });
    expect(await screen.findByText(t("public.reservedDialog.title"))).toBeInTheDocument();
    await app.user.click(screen.getByTestId("reserved-browse-available"));
    await waitFor(() => expect(app.location()).toBe("/ar/topics?status=available"));
  });

  it("وزرّ «العودة» في لوحة المحجوز يعيد إلى القائمة", async () => {
    fake.fail("get", "/public/topics/:id", 403, "محجوز", "TOPIC_RESERVED");
    const app = renderApp(`/ar/topics/${F.topicFull.id}`, { as: "student" });
    await screen.findByText(t("public.reservedDialog.title"));
    await app.user.click(screen.getByRole("button", { name: esc(t("public.backToTopics")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/topics"));
  });

  it("تعذّر التحميل ⇒ «إعادة»؛ وموضوعٌ لا يوجد ⇒ يقال", async () => {
    fake.fail("get", "/public/topics/:id", 500, "خطأ");
    const app = renderApp(`/ar/topics/${F.topicOpen.id}`, {});
    const retry = await screen.findByRole("button", { name: esc(t("admin.retry")) });
    const before = fake.find("get", `/public/topics/${F.topicOpen.id}`).length;
    await app.user.click(retry);
    await waitFor(() => expect(fake.find("get", `/public/topics/${F.topicOpen.id}`).length).toBeGreaterThan(before));
    app.unmount();

    fake.on("get", "/public/topics/:id", { topic: null });
    renderApp("/ar/topics/nope", {});
    expect(await screen.findByText(t("public.topicNotFound"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: esc(t("public.share")) })).toBeNull();
  });
});

describe("طالبٌ له مذكرة قائمة", () => {
  it("صفحة موضوعٍ آخر: «لك مذكرة قائمة» باسمها، و«عرض مذكرتي» مكان «تقديم طلب»", async () => {
    const app = await detail("student");
    expect(await screen.findByTestId("apply-placed")).toHaveTextContent(t("public.panel.placedBody", { title: F.myProject.topic!.title }));
    expect(screen.getByTestId("apply-panel-title")).toHaveTextContent(t("public.panel.placedTitle"));
    expect(screen.queryByRole("button", { name: esc(t("public.applyRequest")) })).toBeNull();
    expect(screen.getByText(t("public.panel.placedHint"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: esc(t("public.panel.placedAction")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/student/project"));
  });

  it("موضوعٌ آخر بالرابط المباشر ⇒ الخادم يقفله، والصفحة قفلٌ باسم مذكرته و«عرض مذكرتي»", async () => {
    fake.fail("get", "/public/topics/:id", 403, "مقفل", "TOPIC_PLACED");
    const app = renderApp(`/ar/topics/${F.topicOpen.id}`, { as: "student" });
    const panel = await screen.findByTestId("placed-panel");
    await waitFor(() => expect(panel).toHaveTextContent(t("public.placedDialog.body", { title: F.myProject.topic!.title })));
    expect(panel).toHaveTextContent(t("public.placedDialog.title"));
    await app.user.click(within(panel).getByTestId("placed-open-project"));
    await waitFor(() => expect(app.location()).toBe("/ar/student/project"));
  });

  it("وفي القائمة: بطاقاتُ غير موضوعه مقفلة، تفتح القفل نفسه لا الصفحة", async () => {
    const app = renderApp("/ar/topics", { as: "student" });
    const card = await screen.findByTestId(`topic-card-${F.topicOpen.id}`);
    await waitFor(() => expect(card).toHaveAttribute("data-locked", "true"));
    await app.user.click(card);
    const dialog = await screen.findByTestId("placed-dialog");
    expect(dialog).toHaveTextContent(t("public.placedDialog.body", { title: F.myProject.topic!.title }));
    expect(app.location()).toBe("/ar/topics");
    await app.user.click(within(dialog).getByTestId("placed-open-project"));
    await waitFor(() => expect(app.location()).toBe("/ar/student/project"));
  });

  it("قائمة المواضيع: المهلة ظاهرةٌ كما هي، وتحتها تنبيهٌ بمذكرته ورابطٌ إليها", async () => {
    fake.on("get", "/student/selection-window", { window: F.studentSelection(F.days(-1), F.days(5)) });
    renderApp("/ar/topics", { as: "student" });
    const notice = await screen.findByTestId("placed-notice");
    expect(notice).toHaveTextContent(t("public.placedNotice", { title: F.myProject.topic!.title }));
    expect(within(notice).getByRole("link", { name: t("public.panel.placedAction") })).toHaveAttribute("href", "/ar/student/project");
    expect(await screen.findByTestId("selection-banner")).toBeInTheDocument();
  });
});
