import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";
import { formatDay } from "../../lib/proposal-window";

/**
 * مهلة اختيار المواضيع كما يعيشها الطالب.
 *
 * يُحرس: أنّ المهلة تُرى فوق المواضيع وفي لوحته وفوق طلباته — مفتوحةً حتى
 * يومٍ وعدٌّ إلى نهايتها، أو تبدأ في يومٍ، أو انتهت — وأنّ لا شيء يُرى بلا
 * مهلة؛ وأنّ زرّ الطلب على الموضوع يقف خارجها ويقول لماذا؛ وأنّ طلبه
 * المعلّق بعد نهايتها لا يُسحب، ويُقال له ذلك بدل الزرّ.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
/** The deadline's day and hour as the banner writes them. */
const longDay = (iso: string) =>
  new Intl.DateTimeFormat("ar-DZ", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Algiers" }).format(new Date(iso));
const hourOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Algiers" }).format(new Date(iso));
const deadline = (open: string, close: string) => fake.on("get", "/student/selection-window", { window: F.studentSelection(open, close) });

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("مهلة اختيار المواضيع — عند الطالب", () => {
  // Still choosing: no project yet (a student with one asks for no other topic).
  beforeEach(() => fake.on("get", "/student/my-project", { project: null }));
  it("مفتوحة ⇒ فوق المواضيع: حتى يومها، وعدٌّ إلى نهايتها", async () => {
    deadline(F.days(-2), F.days(6.5));
    renderApp("/ar/topics", { as: "student" });
    const banner = await screen.findByTestId("selection-banner");
    expect(within(banner).getByTestId("selection-state")).toHaveTextContent(t("stu.selection.state.open"));
    expect(banner).toHaveTextContent(F.year.title);
    // The time in the middle: the countdown to its end, then the deadline by its day and hour.
    expect(within(banner).getByRole("timer", { name: new RegExp(`^${t("stu.selection.endsIn")}`) })).toBeInTheDocument();
    const due = within(banner).getByTestId("selection-deadline");
    expect(due).toHaveTextContent(t("stu.selection.deadline"));
    expect(due).toHaveTextContent(longDay(F.days(6.5)));
    expect(due).toHaveTextContent(hourOf(F.days(6.5)));
  });

  it("تُطوى فيبقى العدّ صغيراً في رأسها والتفاصيل خارج قارئ الشاشة؛ وتُذكر بين الزيارات وتُفتح", async () => {
    deadline(F.days(-2), F.days(6.5));
    let app = renderApp("/ar/topics", { as: "student" });
    let banner = await screen.findByTestId("selection-banner");
    const toggle = within(banner).getByTestId("selection-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName(t("stu.selection.collapse"));
    expect(within(banner).queryByTestId("selection-compact")).toBeNull();

    await app.user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(banner).getByTestId("selection-details")).toHaveAttribute("aria-hidden", "true");
    // One countdown read: the small one in the header.
    const timers = within(banner).getAllByRole("timer", { name: new RegExp(`^${t("stu.selection.endsIn")}`) });
    expect(timers).toHaveLength(1);
    expect(within(banner).getByTestId("selection-compact")).toContainElement(timers[0]!);
    expect(localStorage.getItem("stu.selectionBanner.collapsed")).toBe("1");
    app.unmount();

    app = renderApp("/ar/topics", { as: "student" });
    banner = await screen.findByTestId("selection-banner");
    expect(within(banner).getByTestId("selection-toggle")).toHaveAttribute("aria-expanded", "false");
    await app.user.click(within(banner).getByTestId("selection-toggle"));
    expect(within(banner).queryByTestId("selection-compact")).toBeNull();
    expect(localStorage.getItem("stu.selectionBanner.collapsed")).toBe("0");
  });

  it("وانتهت مطويّةً ⇒ يومُ انتهائها في رأسها بلا عدّ", async () => {
    deadline(F.days(-20), F.days(-2));
    localStorage.setItem("stu.selectionBanner.collapsed", "1");
    renderApp("/ar/topics", { as: "student" });
    const compact = await screen.findByTestId("selection-compact");
    expect(compact).toHaveTextContent(t("stu.selection.endedOn"));
    expect(compact).toHaveTextContent(longDay(F.days(-2)));
    expect(within(compact).queryByRole("timer")).toBeNull();
  });

  it("لم تبدأ ⇒ في لوحته: يوم بدايتها وعدٌّ إليها", async () => {
    deadline(F.days(3.5), F.days(20));
    // Still choosing: no project yet (with one, the deadline no longer concerns them).
    fake.empty = true;
    renderApp("/ar/student", { as: "student" });
    const banner = await screen.findByTestId("selection-banner");
    expect(within(banner).getByTestId("selection-state")).toHaveTextContent(t("stu.selection.state.upcoming"));
    const starts = within(banner).getByTestId("selection-deadline");
    expect(starts).toHaveTextContent(t("stu.selection.startsOn"));
    expect(starts).toHaveTextContent(longDay(F.days(3.5)));
    expect(within(banner).getByRole("timer", { name: new RegExp(`^${t("stu.selection.opensIn")}`) })).toBeInTheDocument();
  });

  it("بلا مهلة ⇒ لا شيء يُرى، وزرّ الطلب كما كان", async () => {
    const app = renderApp(`/ar/topics/${F.topicOpen.id}`, { as: "student" });
    const apply = (await screen.findAllByRole("button", { name: esc(t("public.applyRequest")) }))[0]!;
    expect(apply).toBeEnabled();
    expect(screen.queryByTestId("selection-banner")).toBeNull();
    expect(screen.getByText(t("public.applyReady"))).toBeInTheDocument();
    await app.user.click(apply);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("انتهت ⇒ زرّ الطلب يقف ويقول متى انتهت؛ ولم تبدأ ⇒ متى تبدأ", async () => {
    // Each moment read once: shown to the second, two readings could differ.
    const [ended, opens] = [F.days(-2), F.days(4)];
    deadline(F.days(-20), ended);
    const app = renderApp(`/ar/topics/${F.topicOpen.id}`, { as: "student" });
    const hint = t("stu.selection.applyClosed", { date: formatDay(ended, "ar") });
    expect(await screen.findByText(hint)).toBeInTheDocument();
    const apply = screen.getAllByRole("button", { name: esc(t("public.applyRequest")) })[0]!;
    expect(apply).toBeDisabled();
    expect(apply).toHaveAttribute("title", hint);
    app.unmount();

    deadline(opens, F.days(20));
    renderApp(`/ar/topics/${F.topicOpen.id}`, { as: "student" });
    expect(await screen.findByText(t("stu.selection.applyUpcoming", { date: formatDay(opens, "ar") }))).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: esc(t("public.applyRequest")) })[0]).toBeDisabled();
  });

  it("انتهت ⇒ فوق طلباته «انتهت»، وطلبه المعلّق لا يُسحب ويُقال له ذلك", async () => {
    deadline(F.days(-20), F.days(-2));
    fake.on("get", "/student/my-project", { project: null });
    renderApp("/ar/student/requests", { as: "student" });
    const banner = await screen.findByTestId("selection-banner");
    expect(within(banner).getByTestId("selection-state")).toHaveTextContent(t("stu.selection.state.closed"));
    expect(within(banner).getByTestId("selection-deadline")).toHaveTextContent(longDay(F.days(-2)));
    expect(within(banner).queryByRole("timer")).toBeNull();
    expect((await screen.findAllByTestId("request-locked"))[0]).toHaveTextContent(t("stu.selection.locked"));
    expect(screen.queryByRole("button", { name: esc(t("stu.cancelRequest")) })).toBeNull();
  });

  it("ومن له مذكرة ⇒ المهلة ظاهرةٌ له أيضاً، في لوحته وفوق طلباته", async () => {
    deadline(F.days(-2), F.days(6.5));
    expect(F.studentDashboard.project).not.toBeNull();
    const app = renderApp("/ar/student", { as: "student" });
    expect(await screen.findByTestId("selection-banner")).toBeInTheDocument();
    app.unmount();

    fake.on("get", "/student/my-project", { project: F.myProject });
    renderApp("/ar/student/requests", { as: "student" });
    expect(await screen.findByTestId("selection-banner")).toBeInTheDocument();
  });
});
