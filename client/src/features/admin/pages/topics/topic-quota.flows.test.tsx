import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * حدّ المواضيع لكلّ أستاذ في السنة — تقرّره الإدارة في إعدادات المواضيع،
 * ويُفرض على ما يرسله الأستاذ.
 *
 * يُحرس: أنّ البطاقة تقول الحدّ أو أنّه لا حدّ، ومن اقترح؛ وأنّ النافذة تُري
 * أثر كلّ رقمٍ قبل الحفظ — من بلغه ومن تجاوزه بأسمائهم — وترسل ما اختير، أو
 * تلغيه؛ وأنّ الأستاذ يرى كم له منه، ولا يرسل حين يبلغه — من صفحته ومن النموذج،
 * ولا بإعادة إرسال موضوعٍ مرفوض —، ويُعدّل ما سبق في مكانه كما كان.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const quotaPath = `/admin/academic-years/${F.year.id}/topic-quota`;

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function settings() {
  const app = renderApp("/ar/admin/topics/settings", { as: "admin" });
  const card = await screen.findByTestId("topic-quota-card");
  return { app, card };
}

describe("حدّ المواضيع لكلّ أستاذ — في إعدادات المواضيع", () => {
  it("بلا حدّ ⇒ يُحدَّد: كلّ رقمٍ يُري من يبلغه ومن يتجاوزه بأسمائهم، ثمّ يُحفظ", async () => {
    const { app, card } = await settings();
    expect(within(card).getByTestId("topic-quota-state")).toHaveTextContent(t("admin.topicQuota.none"));
    expect(card).toHaveTextContent(t("admin.topicQuota.ofTotal", { n: 3, total: 5 }));
    // The section, numbered, says whom it concerns; and the header's tile says it at a glance.
    expect(within(screen.getByTestId("topic-settings-section-quota")).getByText(t("admin.topicSettings.forProfessors"))).toBeInTheDocument();
    expect(screen.getByTestId("overview-quota")).toHaveTextContent(t("admin.topicQuota.none"));

    await app.user.click(within(card).getByTestId("topic-quota-edit"));
    const dialog = await screen.findByRole("dialog", { name: t("admin.topicQuota.dialogTitle", { year: F.year.title }) });
    // Three by default: one over it (four), nobody at it.
    expect(within(dialog).getByTestId("topic-quota-value")).toHaveTextContent("3");
    expect(within(dialog).getByTestId("topic-quota-impact-at")).toHaveTextContent("0");
    expect(within(dialog).getByTestId("topic-quota-impact-over")).toHaveTextContent("1");

    await app.user.click(within(dialog).getByRole("radio", { name: t("admin.topicQuota.perProfessor", { count: 2 }) }));
    expect(within(dialog).getByTestId("topic-quota-value")).toHaveTextContent("2");
    expect(within(dialog).getByTestId("topic-quota-impact-at")).toHaveTextContent("1");
    expect(within(dialog).getByTestId("topic-quota-impact-over")).toHaveTextContent("1");
    const list = within(dialog).getByTestId("topic-quota-professors");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("كريم منصوري").closest("li")).toHaveTextContent(t("admin.topicQuota.overChip"));
    expect(within(list).getByText("سعاد بن علي").closest("li")).toHaveTextContent(t("admin.topicQuota.atChip"));
    expect(within(dialog).getByText(t("admin.topicQuota.overHint"))).toBeInTheDocument();

    // Past ten, by the buttons — never typed.
    for (let i = 0; i < 3; i++) await app.user.click(within(dialog).getByTestId("topic-quota-more"));
    expect(within(dialog).getByTestId("topic-quota-value")).toHaveTextContent("5");
    expect(within(dialog).getByText(t("admin.topicQuota.nobody"))).toBeInTheDocument();
    await app.user.click(within(dialog).getByTestId("topic-quota-less"));

    await app.user.click(within(dialog).getByTestId("topic-quota-save"));
    await waitFor(() => expect(fake.find("put", quotaPath)).toHaveLength(1));
    expect(fake.find("put", quotaPath)[0]!.body).toEqual({ max: 4 });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(within(screen.getByTestId("topic-quota-card")).getByTestId("topic-quota-state")).toHaveTextContent(
        t("admin.topicQuota.perProfessor", { count: 4 }),
      ),
    );
    expect(await screen.findByText(t("admin.topicQuota.saved", { n: 4 }))).toBeInTheDocument();
  });

  it("بحدٍّ ⇒ من بلغه ومن تجاوزه في البطاقة والسطر؛ ويُلغى", async () => {
    fake.on("get", "/admin/academic-years/:id/topic-quota", () => F.topicQuotaState(F.year, 2));
    const { app, card } = await settings();
    expect(within(card).getByTestId("topic-quota-state")).toHaveTextContent(t("admin.topicQuota.perProfessor", { count: 2 }));
    expect(card).toHaveTextContent(t("admin.topicQuota.statOver"));
    expect(screen.getByTestId("overview-quota")).toHaveTextContent(t("admin.topicSettings.quotaOver", { count: 1 }));

    await app.user.click(within(card).getByTestId("topic-quota-edit"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("topic-quota-value")).toHaveTextContent("2");
    await app.user.click(within(dialog).getByTestId("topic-quota-clear"));
    await waitFor(() => expect(fake.find("delete", quotaPath)).toHaveLength(1));
    expect(await screen.findByText(t("admin.topicQuota.cleared"))).toBeInTheDocument();
    app.unmount();

    // The topics page's line says it too.
    renderApp("/ar/admin/topics", { as: "admin" });
    const strip = await screen.findByTestId("topic-settings-strip");
    await waitFor(() => expect(within(strip).getByTestId("strip-quota")).toHaveTextContent(t("admin.topicSettings.strip.quotaMax", { count: 2 })));
  });

  it("سنةٌ مؤرشفة ⇒ يُرى حدّها ولا يُعدَّل", async () => {
    const app = renderApp(`/ar/admin/topics/settings?year=${F.pastYear.id}`, { as: "admin" });
    const card = await screen.findByTestId("topic-quota-card");
    await waitFor(() => expect(within(card).getByTestId("topic-quota-edit")).toBeDisabled());
    expect(within(card).getByTestId("topic-quota-edit")).toHaveAttribute("title", t("admin.topicQuota.archived"));
    app.unmount();
  });
});

describe("حدّ المواضيع — عند الأستاذ", () => {
  async function professorPage() {
    const app = renderApp("/ar/professor/topics", { as: "professor" });
    await screen.findAllByText(F.topicOpen.title);
    return app;
  }

  it("تحت الحدّ ⇒ يرى كم له منه، في صفحته وفي النموذج بعد اختيار السنة؛ ويرسل", async () => {
    fake.on("get", "/professor/topic-quota", () => ({ year: { id: F.year.id, title: F.year.title }, max: 3, used: 1 }));
    const app = await professorPage();
    expect(await screen.findByTestId("topic-quota-meter")).toHaveTextContent(t("pro.quota.meter", { year: F.year.title, used: 1, max: 3 }));

    await app.user.click(screen.getByRole("button", { name: esc(t("pro.sendNewTopic")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(dialog).queryByTestId("topic-quota-line")).toBeNull();
    await app.user.click(within(dialog).getByRole("combobox", { name: t("pro.academicYear") }));
    await app.user.click(await screen.findByRole("option", { name: esc(F.year.title) }));
    const line = await within(dialog).findByTestId("topic-quota-line");
    expect(line).toHaveTextContent(t("pro.quota.left", { year: F.year.title, used: 1, max: 3 }));
    expect(line).not.toHaveAttribute("data-full");
    expect(fake.find("get", "/professor/topic-quota").some((c) => c.query.academicYearId === F.year.id)).toBe(true);
    expect(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) })).toBeEnabled();
  });

  it("بلغه ⇒ زرّا الاقتراح مطفآن بسببه؛ وإعادة إرسال المرفوض لا تُحفظ؛ وما ينتظر يُعدَّل في مكانه", async () => {
    fake.on("get", "/professor/topic-quota", () => ({ year: { id: F.year.id, title: F.year.title }, max: 2, used: 2 }));
    // The year he is at the limit of is the only one taking proposals (the server lists no archived year).
    fake.on("get", "/common/academic-years", () => ({ academicYears: [F.year] }));
    const app = await professorPage();
    const meter = await screen.findByTestId("topic-quota-meter");
    expect(meter).toHaveAttribute("data-full", "true");
    expect(meter).toHaveTextContent(t("pro.quota.reached"));
    for (const name of [t("pro.sendNewTopic"), t("pro.newTopicWithGroup")]) {
      const b = screen.getByRole("button", { name: esc(name) });
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute("title", t("pro.quota.fullButton"));
    }

    const row = (title: string) => screen.getAllByText(title)[0]!.closest("tr, li, article") as HTMLElement;
    await app.user.click(within(row(F.topicRejected.title)).getByRole("button", { name: esc(t("pro.edit")) }));
    let dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    const line = await within(dialog).findByTestId("topic-quota-line");
    expect(line).toHaveAttribute("data-full", "true");
    expect(line).toHaveTextContent(t("pro.quota.full", { year: F.year.title, used: 2, max: 2 }));
    const save = within(dialog).getByRole("button", { name: esc(t("pro.saveChanges")) });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute("title", t("pro.quota.fullButton"));
    await app.user.click(within(dialog.querySelector("footer")!).getByRole("button", { name: t("pro.cancel") }));
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));

    await app.user.click(within(row(F.topicPending.title)).getByRole("button", { name: esc(t("pro.edit")) }));
    dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await within(dialog).findByDisplayValue(F.topicPending.title);
    expect(within(dialog).queryByTestId("topic-quota-line")).toBeNull();
    expect(within(dialog).getByRole("button", { name: esc(t("pro.saveChanges")) })).toBeEnabled();
  });

  it("وسنةٌ أخرى تقبل الاقتراح ⇒ الزرّان متاحان، فالحدّ لتلك السنة وحدها", async () => {
    fake.on("get", "/professor/topic-quota", () => ({ year: { id: F.year.id, title: F.year.title }, max: 2, used: 2 }));
    fake.on("get", "/common/academic-years", () => ({
      academicYears: [F.year, { id: "y-next", title: "2026/2027", isActive: false, proposalsOpenAt: null, proposalsCloseAt: null }],
    }));
    await professorPage();
    expect(await screen.findByTestId("topic-quota-meter")).not.toHaveAttribute("data-full");
    expect(screen.getByRole("button", { name: esc(t("pro.sendNewTopic")) })).toBeEnabled();
  });

  it("رفضُ الخادم بسبب الحدّ يُقال كما قاله", async () => {
    fake.fail("post", "/professor/topics", 400, "بلغتَ حدّ المواضيع للسنة");
    const app = await professorPage();
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.sendNewTopic")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.titlePlaceholder")), "موضوعٌ زائد");
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.descriptionPlaceholder")), "وصف");
    await app.user.click(within(dialog).getByRole("combobox", { name: t("pro.academicYear") }));
    await app.user.click(await screen.findByRole("option", { name: esc(F.year.title) }));
    await app.user.click(within(dialog).getByRole("combobox", { name: t("pro.specialization") }));
    await app.user.click(await screen.findByRole("option", { name: esc(F.specialization.name) }));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) }));
    expect(await screen.findByText("بلغتَ حدّ المواضيع للسنة")).toBeInTheDocument();
  });
});
