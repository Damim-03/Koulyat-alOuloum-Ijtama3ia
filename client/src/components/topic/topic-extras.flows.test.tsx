import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";

/**
 * نوعُ الموضوع ومشرفه المساعد ووصفه القصير — في نماذج الإدارة والأستاذ.
 *
 * يُحرس: أنّ الأنواع أنواعُ قسم التخصّص ولا تُعرض قبل اختياره، وأنّ المشرف
 * المساعد أستاذٌ من المنصّة لا يكون المشرفَ نفسه (ولا الأستاذَ الذي يكتب)،
 * وأنّ اختيارٌ لم يعد يصحّ يسقط بدل أن يُرسل؛ وأنّ ما اختير يُرسل، وأنّ
 * التعديل يمسح بـ`null` والإنشاء يترك الفارغ.
 */
type App = ReturnType<typeof renderApp>;
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const [ai, iot] = F.topicTypes as [(typeof F.topicTypes)[number], (typeof F.topicTypes)[number]];

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function choose(app: App, dialog: HTMLElement, field: string, option: string) {
  await app.user.click(within(dialog).getByRole("combobox", { name: field }));
  await app.user.click(await screen.findByRole("option", { name: esc(option) }));
}

/** The supervisor's picker — not the co-supervisor's. */
async function pickSupervisor(app: App, dialog: HTMLElement, name: RegExp) {
  const trigger = within(dialog)
    .getAllByRole("button")
    .find((b) => b.getAttribute("aria-haspopup") === "listbox" && b.dataset.testid !== "co-supervisor-trigger")!;
  await app.user.click(trigger);
  await app.user.type(await screen.findByPlaceholderText(t("admin.searchProfessorAny")), name.source);
  await app.user.click(await screen.findByRole("option", { name }));
}

async function pickCoSupervisor(app: App, dialog: HTMLElement, name: RegExp) {
  await app.user.click(within(dialog).getByTestId("co-supervisor-trigger"));
  await app.user.click(await screen.findByRole("option", { name }));
}

async function openAdminCreate() {
  const app = renderApp("/ar/admin/topics", { as: "admin" });
  await screen.findAllByText(F.topicOpen.title);
  await app.user.click(screen.getByRole("button", { name: t("admin.createTopicBtn") }));
  const dialog = await screen.findByRole("dialog");
  await app.user.type(within(dialog).getByPlaceholderText(t("admin.assignTopicTitlePlaceholder")), "تصنيف الصور الطبية");
  await app.user.type(within(dialog).getByPlaceholderText(t("admin.assignTopicDescPlaceholder")), "تعلّم عميق");
  await choose(app, dialog, t("admin.academicYear"), F.year.title);
  return { app, dialog };
}

describe("في نموذج الإدارة", () => {
  it("الأنواع بعد التخصّص؛ ونوعٌ ومشرفٌ مساعد ووصفٌ قصير تُرسل مع الموضوع", async () => {
    const { app, dialog } = await openAdminCreate();
    const extras = within(dialog).getByTestId("topic-extras");
    // No specialization yet: no types, and a word on why.
    expect(within(extras).getByText(t("topicExtras.typePickSpec"))).toBeInTheDocument();
    expect(within(extras).queryByRole("radio", { name: esc(ai.name) })).toBeNull();

    await pickSupervisor(app, dialog, /كريم/);
    await choose(app, dialog, t("admin.specialization"), F.specialization.name);
    await waitFor(() => expect(fake.find("get", "/common/topic-types").some((c) => c.query.specializationId === F.specialization.id)).toBe(true));
    const none = await within(extras).findByRole("radio", { name: esc(t("topicExtras.typeNone")) });
    expect(none).toHaveAttribute("aria-checked", "true");
    await app.user.click(within(extras).getByRole("radio", { name: esc(iot.name) }));
    expect(within(extras).getByRole("radio", { name: esc(iot.name) })).toHaveAttribute("aria-checked", "true");

    // The supervisor is not among the co-supervisors.
    await app.user.click(within(dialog).getByTestId("co-supervisor-trigger"));
    expect(screen.queryByRole("option", { name: /كريم/ })).toBeNull();
    await app.user.click(await screen.findByRole("option", { name: /نادية/ }));
    expect(within(dialog).getByTestId("co-supervisor-trigger")).toHaveTextContent("نادية");

    const typed = "  نظامٌ يصنّف الصور الطبية  ";
    await app.user.type(within(dialog).getByTestId("topic-summary"), typed);
    expect(within(extras).getByTestId("char-count")).toHaveTextContent(`${typed.length} / 300`);

    await app.user.click(within(dialog).getByRole("button", { name: t("admin.createTopicBtn") }));
    await waitFor(() => expect(fake.find("post", "/admin/topics")).toHaveLength(1));
    expect(fake.find("post", "/admin/topics")[0]!.body).toMatchObject({
      typeId: iot.id,
      coSupervisorId: F.prof2.id,
      summary: "نظامٌ يصنّف الصور الطبية",
    });
  });

  it("بلا اختيارٍ منها ⇒ لا تُرسل أصلاً", async () => {
    const { app, dialog } = await openAdminCreate();
    await pickSupervisor(app, dialog, /كريم/);
    await choose(app, dialog, t("admin.specialization"), F.specialization.name);
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.createTopicBtn") }));
    await waitFor(() => expect(fake.find("post", "/admin/topics")).toHaveLength(1));
    const body = fake.find("post", "/admin/topics")[0]!.body as Record<string, unknown>;
    expect(body).not.toHaveProperty("typeId");
    expect(body).not.toHaveProperty("coSupervisorId");
    expect(body).not.toHaveProperty("summary");
  });

  it("المشرف المساعد يصير هو المشرف ⇒ يسقط من خانته", async () => {
    const { app, dialog } = await openAdminCreate();
    await pickCoSupervisor(app, dialog, /نادية/);
    expect(within(dialog).getByTestId("co-supervisor-trigger")).toHaveTextContent("نادية");
    await pickSupervisor(app, dialog, /نادية/);
    await waitFor(() => expect(within(dialog).getByTestId("co-supervisor-trigger")).toHaveTextContent(t("topicExtras.coSupervisorPick")));
  });

  it("قسمٌ بلا أنواع ⇒ يُقال ذلك بدل القائمة", async () => {
    fake.on("get", "/common/topic-types", { types: [] });
    const { app, dialog } = await openAdminCreate();
    await choose(app, dialog, t("admin.specialization"), F.specialization.name);
    expect(await within(dialog).findByTestId("topic-types-empty")).toHaveTextContent(t("topicExtras.typeEmpty"));
  });

  it("وفي تعديل إسنادٍ: ما يُختار يُرسل، وما بقي فارغاً يُرسل `null` فيُمسح", async () => {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    const row = (await screen.findAllByText(F.topicFull.title)).map((x) => x.closest("tr")).find(Boolean)!;
    await app.user.click(within(row).getByRole("button", { name: t("admin.edit") }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByDisplayValue(F.topicFull.title);
    await app.user.click(await within(dialog).findByRole("radio", { name: esc(ai.name) }));
    await pickCoSupervisor(app, dialog, /رشيد/);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
    // Through the review: the co-supervisor and the type among what changes.
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.next")) }));
    const review = await within(dialog).findByTestId("topic-review");
    expect(within(review).getByTestId("topic-review-changes")).toHaveTextContent(t("topicExtras.coSupervisor"));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.confirmSave")) }));
    await waitFor(() => expect(fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)).toHaveLength(1));
    expect(fake.find("patch", `/admin/topics/${F.topicFull.id}/assignment`)[0]!.body).toMatchObject({
      typeId: ai.id,
      coSupervisorId: F.prof3.id,
      summary: null,
    });
  });
});

describe("في نموذج الأستاذ", () => {
  it("لا يرى نفسه بين المشرفين المساعدين؛ ويُرسل النوع والمشرف المساعد", async () => {
    fake.on("get", "/common/professors", { professors: F.professorOptions.map((p) => ({ ...p, isMe: p.id === F.prof1.id })) });
    const app = renderApp("/ar/professor/topics", { as: "professor" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.sendNewTopic")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.titlePlaceholder")), "إنترنت الأشياء في الزراعة");
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.descriptionPlaceholder")), "حسّاسات ورطوبة التربة");
    await choose(app, dialog, t("pro.academicYear"), F.year.title);
    // The level: shown from the specialization, as in the administration's forms.
    expect(within(dialog).getByTestId("topic-level")).toHaveTextContent(t("admin.levelFromSpec"));
    await choose(app, dialog, t("pro.specialization"), F.specialization.name);
    expect(within(dialog).getByTestId("topic-level")).toHaveTextContent(t("admin.levelMaster"));

    await app.user.click(await within(dialog).findByRole("radio", { name: esc(iot.name) }));
    await app.user.click(within(dialog).getByTestId("co-supervisor-trigger"));
    expect(screen.queryByRole("option", { name: /كريم/ })).toBeNull();
    await app.user.click(await screen.findByRole("option", { name: /نادية/ }));

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) }));
    await waitFor(() => expect(fake.find("post", "/professor/topics")).toHaveLength(1));
    expect(fake.find("post", "/professor/topics")[0]!.body).toMatchObject({ typeId: iot.id, coSupervisorId: F.prof2.id });
  });
});
