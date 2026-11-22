import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";
import { ruleOf, seatsFor, type TeamSizes } from "../../../../lib/team-size";

/**
 * عدد الطلبة في كلّ موضوع — تقرّره الإدارة لكلّ سنةٍ ولكلّ مستوى: «حرّ»، أو
 * «بالضبط»، أو «حتى». ويُفرض في كلّ نموذج بمستوى تخصّص الموضوع.
 *
 * يُحرس: أنّ البطاقة تقول قاعدة كلّ مستوى أو أنّه حرّ؛ وأنّ النافذة تُري
 * أثرها قبل الحفظ وترسل ما اختير لكلّ مستوى، وعلى القائم أو الجديد وحده؛
 * وأنّ النماذج — الإدارة والأستاذ — تعرض «بالضبط» ثابتاً، و«حتى» قيمها
 * المسموحة وحدها، وترسل ما يوافقها.
 */
type App = ReturnType<typeof renderApp>;
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const ruled = (teamSizes: TeamSizes) => [{ ...F.year, teamSizes }, F.pastYear];
const putPath = `/admin/academic-years/${F.year.id}/team-size`;

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function choose(app: App, dialog: HTMLElement, field: string, option: string) {
  await app.user.click(within(dialog).getByRole("combobox", { name: field }));
  await app.user.click(await screen.findByRole("option", { name: esc(option) }));
}

async function openDialog() {
  const app = renderApp("/ar/admin/topics/settings", { as: "admin" });
  const card = await screen.findByTestId("team-size-card");
  await app.user.click(within(card).getByTestId("team-size-edit"));
  const dialog = await screen.findByRole("dialog", { name: esc(t("admin.teamSize.dialogTitle", { year: F.year.title })) });
  return { app, card, dialog };
}

/** A level's number in the dialog: its radio among ten — its level opened first, if folded. */
const pick = (dialog: HTMLElement, level: string, n: number) => {
  const toggle = within(dialog).getByTestId(`team-size-toggle-${level.toLowerCase()}`);
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
  return within(within(dialog).getByRole("radiogroup", { name: t(`admin.level${level}`) })).getByRole("radio", { name: t("teamSize.count", { count: n }) });
};

describe("البطاقة والنافذة", () => {
  it("حرٌّ ⇒ لكلّ مستوى عددٌ بالضبط — ليسانس 3، وماستر ودكتوراه 2 — ويُرى أثرها مستوىً مستوى ثمّ تُحفظ", async () => {
    const { app, card, dialog } = await openDialog();
    expect(within(card).getByTestId("team-size-state")).toHaveTextContent(t("admin.teamSize.free"));
    // Two by default, for every level; no «free», no «up to».
    for (const level of ["Licence", "Master", "Doctorate"]) expect(pick(dialog, level, 2)).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).queryByText(t("admin.teamSize.free"))).toBeNull();

    await app.user.click(pick(dialog, "Licence", 3));
    expect(pick(dialog, "Licence", 3)).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByTestId("team-size-summary-licence")).toHaveTextContent(t("teamSize.count", { count: 3 }));
    await waitFor(() =>
      expect(
        fake.find("get", `${putPath}/preview`).some((c) => c.query.licence === "exact-3" && c.query.master === "exact-2" && c.query.doctorate === "exact-2"),
      ).toBe(true),
    );

    // Each level: its topics now, and the rule's effect, side by side.
    const licence = within(dialog).getByTestId("team-size-level-licence");
    expect(await within(licence).findByTestId("team-size-topics-licence")).toHaveTextContent(t("admin.teamSize.levelTopics", { n: 3 }));
    expect(licence).toHaveTextContent(t("admin.teamSize.sizeChip", { what: t("teamSize.count", { count: 4 }), n: 1 }));
    expect(within(dialog).getByTestId("team-size-level-doctorate")).toHaveTextContent(t("admin.teamSize.noTopics"));
    const master = within(dialog).getByTestId("team-size-row-master");
    expect(within(master).getAllByRole("cell").map((c) => c.textContent)).toEqual(["4", "2", "1", "1", "1"]);
    const impact = within(dialog).getByTestId("team-size-impact");
    expect(within(impact).getByTestId("impact-changes")).toHaveTextContent("2");
    expect(within(impact).getByText(t("admin.teamSize.changesTitle", { n: 2 }))).toBeInTheDocument();
    expect(within(impact).getByText(t("admin.teamSize.overTitle", { n: 1 }))).toBeInTheDocument();
    // Nobody leaves: the topic with more students keeps them, its free seat closed.
    expect(impact).toHaveTextContent(t("admin.teamSize.overClosing", { n: 1 }));
    expect(fake.find("put", putPath)).toEqual([]);

    await app.user.click(within(dialog).getByTestId("team-size-save"));
    await waitFor(() => expect(fake.find("put", putPath)).toHaveLength(1));
    expect(fake.find("put", putPath)[0]!.body).toEqual({
      rules: { licence: { n: 3, mode: "exact" }, master: { n: 2, mode: "exact" }, doctorate: { n: 2, mode: "exact" } },
      applyToExisting: true,
    });
    expect(await screen.findByText(t("admin.teamSize.savedApplied", { n: 3 }))).toBeInTheDocument();
  });

  it("«على الجديدة وحدها» ⇒ يُرسل ذلك، والحفظ «حفظ» لا «حفظ وتطبيق»", async () => {
    const { app, dialog } = await openDialog();
    await within(dialog).findByTestId("team-size-table");
    expect(within(dialog).getByTestId("team-size-save")).toHaveTextContent(t("admin.teamSize.saveApply"));
    await app.user.click(within(dialog).getByTestId("team-size-apply"));
    expect(within(dialog).getByText(t("admin.teamSize.newOnlyHint"))).toBeInTheDocument();
    expect(within(dialog).getByTestId("team-size-save")).toHaveTextContent(t("admin.teamSize.save"));
    await app.user.click(within(dialog).getByTestId("team-size-save"));
    await waitFor(() => expect(fake.find("put", putPath)[0]?.body).toMatchObject({ applyToExisting: false }));
  });

  it("مقرَّرةٌ ⇒ البطاقة بعدد كلّ مستوى، والنافذة تُفتح عليه؛ و«إلغاء القواعد كلّها» يعيدها حرّة", async () => {
    fake.on("get", "/admin/academic-years/:id/team-size", F.teamSizeState(F.year, { licence: { n: 3, mode: "exact" }, master: { n: 2, mode: "exact" } }));
    const { app, card, dialog } = await openDialog();
    expect(within(card).getByTestId("team-size-rule-licence")).toHaveTextContent(`${t("admin.levelLicence")}: ${t("teamSize.count", { count: 3 })}`);
    expect(within(card).getByTestId("team-size-rule-master")).toHaveTextContent(t("teamSize.count", { count: 2 }));
    expect(within(card).queryByTestId("team-size-rule-doctorate")).toBeNull();
    expect(pick(dialog, "Licence", 3)).toHaveAttribute("aria-checked", "true");

    await app.user.click(within(dialog).getByTestId("team-size-clear"));
    await waitFor(() => expect(fake.find("delete", putPath)).toHaveLength(1));
    expect(await screen.findByText(t("admin.teamSize.cleared"))).toBeInTheDocument();
  });

  it("ولا شيء يتغيّر ⇒ يُقال ذلك بدل القوائم", async () => {
    fake.on("get", "/admin/academic-years/:id/team-size/preview", {
      ...F.teamSizeImpact({}),
      levels: { ...F.teamSizeImpact({}).levels },
    });
    const { dialog } = await openDialog();
    expect(await within(dialog).findByTestId("impact-none")).toHaveTextContent(t("admin.teamSize.nothingChanges"));
  });
});

describe("الطيّ ونظرةُ المذكّرة", () => {
  it("المستويات مطويّةٌ ورؤوسها بعددها؛ يُفتح واحدٌ، وفتحُ غيره أو الضغطُ خارجه يطويه", async () => {
    const { app, dialog } = await openDialog();
    const licence = within(dialog).getByTestId("team-size-toggle-licence");
    const master = within(dialog).getByTestId("team-size-toggle-master");
    // Folded at first: the heads still say the number.
    expect(licence).toHaveAttribute("aria-expanded", "false");
    expect(licence).toHaveTextContent(t("teamSize.count", { count: 2 }));

    await app.user.click(licence);
    expect(licence).toHaveAttribute("aria-expanded", "true");
    // Opening another folds this one.
    await app.user.click(master);
    expect(master).toHaveAttribute("aria-expanded", "true");
    expect(licence).toHaveAttribute("aria-expanded", "false");
    // A choice inside keeps it open; a press outside — the table — folds it.
    await app.user.click(pick(dialog, "Master", 3));
    expect(master).toHaveAttribute("aria-expanded", "true");
    await app.user.click(within(dialog).getByTestId("team-size-table"));
    expect(master).toHaveAttribute("aria-expanded", "false");
    expect(master).toHaveTextContent(t("teamSize.count", { count: 3 }));
  });

  it("موضوعٌ فيه طلبةٌ أكثر ⇒ يُفتح بجانب النافذة بتفاصيله، ومنه إلى صفحته", async () => {
    const { app, dialog } = await openDialog();
    const over = await within(dialog).findByRole("button", { name: t("admin.teamSize.peekOf", { title: "نظام توصية للمكتبة" }) });
    expect(over).toHaveTextContent(t("teamSize.count", { count: 3 }));
    expect(over).toHaveTextContent(t("admin.teamSize.overBy", { what: t("teamSize.count", { count: 2 }), n: 1 }));
    // Its supervisor first, then its small details: specialization and status.
    expect(within(over).getByTestId("team-size-topic-professor")).toHaveTextContent("كريم منصوري");
    expect(over).toHaveTextContent("هندسة البرمجيات");
    expect(over).toHaveTextContent(t("status.full"));
    await app.user.click(over);
    expect(over).toHaveAttribute("aria-pressed", "true");

    const peek = await screen.findByTestId("topic-peek");
    await waitFor(() => expect(fake.find("get", `/admin/topics/${F.topicFull.id}`)).toHaveLength(1));
    expect(await within(peek).findByTestId("topic-peek-name")).toHaveTextContent(F.topicFull.title);
    expect(within(peek).getByTestId("topic-peek-rule")).toHaveTextContent(t("teamSize.count", { count: 2 }));
    expect(within(peek).getByTestId("topic-peek-supervisor")).toHaveTextContent(t("admin.teamSize.peekSupervisor"));
    // The dialog stays as it was, beside it.
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Escape closes the glance first, then the dialog.
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("topic-peek")).toBeNull());
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await app.user.click(over);
    await app.user.click(await screen.findByTestId("topic-peek-open"));
    await waitFor(() => expect(app.location()).toBe(`/ar/admin/topics/${F.topicFull.id}`));
  });

  it("وموضوعٌ سيتغيّر عدده يُفتح كذلك", async () => {
    const { app, dialog } = await openDialog();
    await app.user.click(await within(dialog).findByRole("button", { name: t("admin.teamSize.peekOf", { title: "منصة تعليمية تكيفية" }) }));
    expect(await screen.findByTestId("topic-peek")).toBeInTheDocument();
    await waitFor(() => expect(fake.find("get", `/admin/topics/${F.topicOpen.id}`)).toHaveLength(1));
  });
});

describe("في النماذج — بمستوى تخصّص الموضوع", () => {
  it("نموذج الإدارة: «بالضبط» ⇒ يُعرض ثابتاً بعد التخصّص، ويُرسل هو لا ما كُتب قبله", async () => {
    fake.on("get", "/admin/academic-years", { academicYears: ruled({ master: { n: 2, mode: "exact" } }) });
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByRole("button", { name: t("admin.createTopicBtn") }));
    const dialog = await screen.findByRole("dialog");
    // Never a typed field — and before the year and the specialization, empty, and why.
    expect(within(dialog).queryByRole("spinbutton", { name: t("admin.maxStudents") })).toBeNull();
    expect(within(dialog).getByTestId("team-size")).toHaveAttribute("data-mode", "pending");
    expect(within(dialog).getByTestId("team-size")).toHaveTextContent(/^$/);
    expect(within(dialog).getByTestId("team-size-hint")).toHaveTextContent(t("teamSize.pendingHint"));

    await app.user.type(within(dialog).getByPlaceholderText(t("admin.assignTopicTitlePlaceholder")), "تصنيف الصور الطبية");
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.assignTopicDescPlaceholder")), "تعلّم عميق");
    await choose(app, dialog, t("admin.academicYear"), F.year.title);
    // The year alone: the level is not known yet — still empty.
    expect(within(dialog).getByTestId("team-size")).toHaveTextContent(/^$/);
    await choose(app, dialog, t("admin.specialization"), F.specialization.name);
    expect(within(dialog).getByTestId("team-size")).toHaveTextContent(t("teamSize.count", { count: 2 }));
    expect(within(dialog).getByTestId("team-size-hint")).toHaveTextContent(F.year.title);
    expect(within(dialog).queryByRole("spinbutton", { name: t("admin.maxStudents") })).toBeNull();

    const trigger = within(dialog)
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-haspopup") === "listbox" && b.dataset.testid !== "co-supervisor-trigger")!;
    await app.user.click(trigger);
    await app.user.type(await screen.findByPlaceholderText(t("admin.searchProfessorAny")), "كريم");
    await app.user.click(await screen.findByRole("option", { name: /كريم/ }));
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.createTopicBtn") }));
    await waitFor(() => expect(fake.find("post", "/admin/topics")).toHaveLength(1));
    expect(fake.find("post", "/admin/topics")[0]!.body).toMatchObject({ maxStudents: 2 });
  });

  it("ولا قاعدة لمستواه بعد ⇒ لا يُكتب أيضاً: طالبٌ واحد، ويُقال للأستاذ أنّ الإدارة لم تحدّده", async () => {
    fake.on("get", "/common/academic-years", { academicYears: ruled({ licence: { n: 3, mode: "exact" } }) });
    const app = renderApp("/ar/professor/topics", { as: "professor" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.sendNewTopic")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.titlePlaceholder")), "إنترنت الأشياء في الزراعة");
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.descriptionPlaceholder")), "حسّاسات ورطوبة التربة");
    await choose(app, dialog, t("pro.academicYear"), F.year.title);
    await choose(app, dialog, t("pro.specialization"), F.specialization.name);

    const size = within(dialog).getByTestId("team-size");
    expect(size).toHaveAttribute("data-mode", "unset");
    expect(size).toHaveTextContent(t("teamSize.count", { count: 1 }));
    expect(within(dialog).queryByRole("spinbutton", { name: t("pro.maxStudents") })).toBeNull();
    const hint = within(dialog).getByTestId("team-size-hint");
    expect(hint).toHaveTextContent(F.year.title);
    // The professor is not told where the administration sets it.
    expect(hint).not.toHaveTextContent(t("admin.teamSize.title"));

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) }));
    await waitFor(() => expect(fake.find("post", "/professor/topics")).toHaveLength(1));
    expect(fake.find("post", "/professor/topics")[0]!.body).toMatchObject({ maxStudents: 1 });
  });

  it("نموذج الأستاذ: «حتى 3» ⇒ القيم المسموحة وحدها، ويُرسل ما اختير منها", async () => {
    fake.on("get", "/common/academic-years", { academicYears: ruled({ master: { n: 3, mode: "max" } }) });
    fake.on("get", "/common/professors", { professors: F.professorOptions.map((p) => ({ ...p, isMe: p.id === F.prof1.id })) });
    const app = renderApp("/ar/professor/topics", { as: "professor" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByRole("button", { name: esc(t("pro.sendNewTopic")) }));
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.titlePlaceholder")), "إنترنت الأشياء في الزراعة");
    await app.user.type(within(dialog).getByPlaceholderText(t("pro.descriptionPlaceholder")), "حسّاسات ورطوبة التربة");
    await choose(app, dialog, t("pro.academicYear"), F.year.title);
    await choose(app, dialog, t("pro.specialization"), F.specialization.name);

    const seats = within(dialog).getByRole("radiogroup", { name: t("teamSize.choose") });
    expect(within(seats).getAllByRole("radio")).toHaveLength(3);
    expect(within(dialog).getByTestId("team-size-hint")).toHaveTextContent(t("teamSize.upTo", { n: 3 }).replace(/\d/, "").trim());
    await app.user.click(within(seats).getByRole("radio", { name: t("teamSize.count", { count: 2 }) }));
    expect(within(seats).getByRole("radio", { name: t("teamSize.count", { count: 2 }) })).toHaveAttribute("aria-checked", "true");

    await app.user.click(within(dialog).getByRole("button", { name: esc(t("pro.sendToAdmin")) }));
    await waitFor(() => expect(fake.find("post", "/professor/topics")).toHaveLength(1));
    expect(fake.find("post", "/professor/topics")[0]!.body).toMatchObject({ maxStudents: 2 });
  });
});

describe("lib/team-size", () => {
  const years = [{ id: "y", title: "2025/2026", teamSizes: { licence: { n: 3, mode: "max" as const }, master: { n: 2, mode: "exact" as const } } }];

  it("قاعدة السنة والمستوى — ولا قاعدة قبل أن يُعرفا", () => {
    expect(ruleOf(years, "y", "master")).toEqual({ n: 2, mode: "exact" });
    expect([ruleOf(years, "y", "doctorate"), ruleOf(years, "y", undefined), ruleOf(years, "", "master"), ruleOf(undefined, "y", "master")]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("«بالضبط» يغلب ما كُتب؛ و«حتى» يحدّه؛ وبلا قاعدة يبقى", () => {
    expect(seatsFor({ n: 2, mode: "exact" }, 4)).toBe(2);
    expect(seatsFor({ n: 3, mode: "max" }, 2)).toBe(2);
    expect(seatsFor({ n: 3, mode: "max" }, 5)).toBe(3);
    expect(seatsFor(null, 4)).toBe(4);
  });

  it("وموضوعٌ سبق القاعدة وفيه طلبةٌ أكثر يبقى بعدده", () => {
    expect(seatsFor({ n: 2, mode: "exact" }, 3, { members: 3, current: 3 })).toBe(3);
    expect(seatsFor({ n: 2, mode: "exact" }, 3, { members: 2, current: 3 })).toBe(2);
    expect(seatsFor({ n: 3, mode: "max" }, 4, { members: 1, current: 4 })).toBe(3);
  });
});
