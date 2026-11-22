import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * صفحة المناقشة الواحدة: من في لجنتها وفريقها، وما يومُ قاعتها، وما يجب
 * إصلاحه قبل موعدها — ثمّ كلّ ما يُفعل بها.
 *
 * يُحرس: أنّ التنبيهات تُستنتج من حالها (مضى وقتها ولم تُسجَّل، تعارضٌ في
 * القاعة أو في أحد المحكّمين، لجنةٌ بلا رئيس أو بلا مشرف، انتهت بلا علامة)؛
 * وأنّ الإلغاء والحذف يُسأل عنهما، وأنّ الحذف يعود إلى القائمة؛ وأنّ الملغاة
 * تُستعاد ولا تُسجَّل نتيجتها.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

function withDefense(patch: Record<string, unknown>) {
  fake.on("get", "/admin/defenses/:id", { defense: { ...F.defenseDetail, ...patch } });
}

async function detail(id = F.defense.id) {
  const app = renderApp(`/ar/admin/defenses/${id}`, { as: "admin" });
  await screen.findByTestId("detail-title");
  return app;
}

describe("ما تعرضه", () => {
  it("اللجنة بأدوارها، والفريق بمرسِله، والمشرف «في اللجنة»، ويوم القاعة بروابطه، والتأخّر تنبيهاً", async () => {
    await detail();
    expect(screen.getByTestId("detail-title")).toHaveTextContent(F.topicFull.title);
    expect(screen.getByTestId("detail-phase")).toHaveTextContent(t("admin.defensesPage.phase.scheduled"));

    const jury = within(screen.getByTestId("detail-jury"));
    for (const role of ["president", "supervisor", "examiner"]) expect(jury.getByText(t(`committeeRole.${role}`))).toBeInTheDocument();
    expect(within(screen.getByTestId("detail-team")).getByText(t("admin.leader"))).toBeInTheDocument();
    expect(screen.getByText(t("admin.defenseDetail.onJury"))).toBeInTheDocument();

    const day = within(screen.getByTestId("detail-room-day"));
    expect(day.getByText("موضوعٌ قبله").closest("a")).toHaveAttribute("href", "/ar/admin/defenses/df0");
    expect(day.getByText(new RegExp(t("admin.defenseDetail.thisOne")))).toBeInTheDocument();

    expect(within(screen.getByTestId("detail-alerts")).getByText(t("admin.defenseDetail.lateMilestones", { n: 1 }))).toBeInTheDocument();
    expect(screen.getByText(F.defense.notes)).toBeInTheDocument();
  });

  it("مضى وقتها بلا تسجيل، وتعارضٌ في القاعة وفي محكّم، ولجنةٌ بلا رئيس ولا مشرف ⇒ تنبيهٌ لكلٍّ", async () => {
    const examiner = F.defense.committee.find((c) => c.role === "examiner")!;
    withDefense({
      date: iso(-3 * HOUR),
      endsAt: iso(-2 * HOUR),
      committee: [examiner],
      progress: { total: 4, completed: 4, late: 0, submissions: 6 },
      clashes: {
        room: [{ id: "x1", room: F.defense.room, title: "موضوعٌ آخر", date: iso(-3 * HOUR) }],
        professors: [{ id: "x2", name: "سمير", title: "موضوعٌ ثالث", date: iso(-3 * HOUR) }],
      },
    });
    await detail();
    expect(screen.getByTestId("detail-phase")).toHaveTextContent(t("admin.defensesPage.phase.stale"));
    const alerts = within(screen.getByTestId("detail-alerts"));
    expect(alerts.getByText(t("admin.proj.alert.defenseStale"))).toBeInTheDocument();
    expect(alerts.getByText(/موضوعٌ آخر/)).toBeInTheDocument();
    expect(alerts.getByText(/سمير/)).toBeInTheDocument();
    expect(alerts.getByText(t("admin.proj.alert.noPresident"))).toBeInTheDocument();
    expect(alerts.getByText(t("admin.proj.alert.supervisorNotOnCommittee"))).toBeInTheDocument();
    expect(screen.getByText(t("admin.defenseDetail.notOnJury"))).toBeInTheDocument();
  });

  it("انتهت بلا علامةٍ ولا لجنةٍ ولا فريق ⇒ «بلا علامة» و«بلا لجنة»، ولا «تسجيل النتيجة»", async () => {
    withDefense({ status: "completed", grade: null, committee: [], group: { ...F.defenseDetail.group, members: [] } });
    await detail();
    const alerts = within(screen.getByTestId("detail-alerts"));
    expect(alerts.getByText(t("admin.proj.alert.noGrade"))).toBeInTheDocument();
    expect(alerts.getByText(t("admin.proj.alert.noCommittee"))).toBeInTheDocument();
    expect(screen.getByText(t("admin.noMembers"))).toBeInTheDocument();
    expect(screen.queryByTestId("detail-result")).toBeNull();
    expect(screen.queryByRole("button", { name: esc(t("admin.defensesPage.cancelAction")) })).toBeNull();
  });

  it("انتهت بعلامتها ⇒ العلامة من عشرين وتقديرها", async () => {
    withDefense({ status: "completed", grade: 14.5 });
    await detail();
    expect(screen.getByText(t("admin.proj.mention.veryGood"))).toBeInTheDocument();
    expect(screen.getByText("/ 20")).toBeInTheDocument();
  });
});

describe("ما يُفعل بها", () => {
  it("«تسجيل النتيجة» يفتح النموذج على «انتهت»، و«تعديل» يفتحه عليها", async () => {
    const app = await detail();
    await app.user.click(screen.getByTestId("detail-result"));
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: esc(t("admin.proj.defenseState.completed")) })).toHaveAttribute("aria-checked", "true");
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.close") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.editCommittee")) }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("defense-room")).toHaveValue(F.defense.room);
  });

  it("الإلغاء يُسأل عنه ثمّ تُحفظ «ملغاة»", async () => {
    const app = await detail();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.defensesPage.cancelAction")) }));
    expect(fake.writes).toEqual([]);
    await app.user.click((await screen.findAllByRole("button", { name: t("admin.defensesPage.cancelAction") })).at(-1)!);
    await waitFor(() => expect(fake.find("patch", `/admin/defenses/${F.defense.id}`)[0]?.body).toEqual({ status: "cancelled" }));
  });

  it("الحذف بتأكيد ⇒ يُحذف ويعود إلى القائمة", async () => {
    const app = await detail();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.deleteDefense")) }));
    await app.user.click(await screen.findByRole("button", { name: t("admin.confirmDelete") }));
    await waitFor(() => expect(fake.find("delete", `/admin/defenses/${F.defense.id}`)).toHaveLength(1));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/defenses"));
  });

  it("ملغاةٌ ⇒ «استعادة» تعيدها مبرمجة، ولا «تسجيل النتيجة»", async () => {
    withDefense({ status: "cancelled" });
    const app = await detail();
    expect(screen.queryByTestId("detail-result")).toBeNull();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.defensesPage.restore")) }));
    await waitFor(() => expect(fake.find("patch", `/admin/defenses/${F.defense.id}`)[0]?.body).toEqual({ status: "scheduled" }));
  });

  it("«رجوع» يعود إلى القائمة، ورابط المشروع إليه", async () => {
    const app = await detail();
    expect(screen.getAllByRole("link", { name: esc(t("admin.defenseDetail.openProject")) })[0]).toHaveAttribute("href", `/ar/admin/projects/${F.ID.g1}`);
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.defenseDetail.back")) })[0]!);
    await waitFor(() => expect(app.location()).toBe("/ar/admin/defenses"));
  });

  it("مناقشةٌ لا توجد ⇒ «غير موجودة»، و«إعادة» تطلبها، و«رجوع» إلى القائمة", async () => {
    fake.fail("get", "/admin/defenses/:id", 404, "غير موجودة");
    const app = renderApp("/ar/admin/defenses/nope", { as: "admin" });
    expect(await screen.findByText(t("admin.defenseDetail.notFound"))).toBeInTheDocument();
    const before = fake.find("get", "/admin/defenses/nope").length;
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.retry")) }));
    await waitFor(() => expect(fake.find("get", "/admin/defenses/nope").length).toBeGreaterThan(before));
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.defenseDetail.back")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/defenses"));
  });
});
