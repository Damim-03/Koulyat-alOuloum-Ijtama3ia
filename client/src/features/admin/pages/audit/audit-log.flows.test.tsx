import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";
import { day } from "./audit-catalog";

/**
 * سجلّ العمليات: كلّ ما يُغيَّر في المنصّة وكلّ حدثٍ يمسّ أمان حساب، الأحدث
 * أوّلاً، مجمّعاً بالأيّام — يُقرأ ولا يُعدَّل.
 *
 * يُحرس: أنّ العملية تُقرأ جملةً بلغة الصفحة لا مساراً، وما وقعت عليه باسمه،
 * وما تغيّر فيها حقلاً حقلاً من ماذا إلى ماذا؛ وأنّ كلّ فلترٍ يصل الخادم
 * ويسكن الرابط ويُرى شريحةً تُزيله؛ وأنّ كلّ صفٍّ بابٌ إلى غيره: كلّ ما
 * فعله هذا الشخص، وسجلّ هذا العنصر، وكلّ ما جاء من هذا العنوان.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const last = () => fake.find("get", "/admin/audit-logs").at(-1)!.query;
const rowWith = (text: string) => screen.getAllByTestId("audit-row").find((r) => r.textContent?.includes(text))!;

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function audit(path = "/ar/admin/users?view=audit") {
  const app = renderApp(path, { as: "admin" });
  await screen.findAllByTestId("audit-row");
  return app;
}

async function choose(app: Awaited<ReturnType<typeof audit>>, label: string, option: string | RegExp) {
  await app.user.click(screen.getByRole("combobox", { name: label }));
  await app.user.click(screen.getByRole("option", { name: option }));
}

describe("سجلّ العمليات — ما يقوله كلّ صفّ", () => {
  it("العملية بكلماتها، وما وقعت عليه باسمه، وما تغيّر فيها؛ والفاشل مميَّز؛ وعمليةٌ لا يعرفها بفعلها ونوعها", async () => {
    await audit();
    const edit = rowWith(t("admin.audit.op.PATCH_students_id"));
    expect(edit).toHaveTextContent("أسامة بلقاسم · 202039012345");
    // Three fields named, the rest counted.
    expect(edit).toHaveTextContent(`${t("admin.audit.field.phone")} · ${t("admin.audit.field.status")} · ${t("admin.audit.field.specialization")}`);
    expect(edit).toHaveTextContent(t("admin.audit.more", { count: 2 }));
    expect(edit).not.toHaveTextContent("PATCH /students/:id");

    const failed = rowWith(t("admin.audit.op.auth_loginFailed"));
    expect(failed).toHaveTextContent("202039012349");
    // Where from, at a glance: the city, the country in the page's language.
    expect(failed).toHaveTextContent("Remchi · الجزائر");
    expect(failed).toHaveTextContent(t("admin.audit.failedBadge"));
    expect(failed.className).toMatch(/border-rose/);

    // A professor's own route, by its own words and the role beside the name.
    expect(rowWith(t("admin.audit.op.DELETE_professor_topics_id"))).toHaveTextContent(t("admin.audit.role.professor"));

    const unknown = rowWith("something-new");
    expect(unknown).toHaveTextContent(`${t("admin.audit.verb.PATCH")} · something-new`);
  });

  it("الأيّام: اليوم وأمس بأسمائهما، وكم عمليةً في كلّ يوم", async () => {
    await audit();
    const days = screen.getAllByTestId("audit-day");
    expect(days[0]).toHaveTextContent(t("admin.audit.day.today"));
    expect(days[0]).toHaveTextContent(t("admin.audit.dayCount", { count: 1 }));
    expect(days[1]).toHaveTextContent(t("admin.audit.day.yesterday"));
  });

  it("مصدر مواقع العناوين مذكورٌ أسفل السجلّ، كما يشترط ترخيصه", async () => {
    await audit();
    expect(screen.getByRole("link", { name: t("admin.audit.geoCreditBy") })).toHaveAttribute("href", "https://db-ip.com");
  });

  it("حصيلة آخر 24 ساعة في الرأس", async () => {
    await audit();
    const summary = await screen.findByTestId("audit-summary");
    expect(summary).toHaveTextContent(t("admin.audit.last24"));
    for (const [key, value] of Object.entries(F.auditSummary)) {
      expect(summary).toHaveTextContent(t(`admin.audit.stat.${key}`));
      expect(summary).toHaveTextContent(value.toLocaleString("ar"));
    }
  });
});

describe("سجلّ العمليات — التفاصيل", () => {
  it("ما تغيّر جدولاً: الحقل، وقبل، وبعد — بأسماء الحقول وقيمها المقروءة", async () => {
    const app = await audit();
    const edit = rowWith(t("admin.audit.op.PATCH_students_id"));
    const toggle = within(edit).getByRole("button", { name: esc(t("admin.audit.details")) });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await app.user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const changes = within(edit).getAllByTestId("audit-change");
    expect(changes).toHaveLength(5);
    const [phone, status, spec, verified, avatar] = changes as [HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    expect(phone).toHaveTextContent(t("admin.audit.field.phone"));
    expect(phone).toHaveTextContent(t("admin.audit.emptyValue"));
    expect(phone).toHaveTextContent("0550112233");
    expect(status).toHaveTextContent(`${t("admin.audit.value.active")}`);
    expect(status).toHaveTextContent(`${t("admin.audit.value.suspended")}`);
    expect(spec).toHaveTextContent("علم الاجتماع");
    expect(spec).toHaveTextContent("علم النفس");
    expect(verified).toHaveTextContent(t("admin.audit.no"));
    expect(verified).toHaveTextContent(t("admin.audit.yes"));
    // A picture as a picture (decorative: its file name is said beside it).
    expect(avatar.querySelector("img")).toHaveAttribute("src", expect.stringContaining("/uploads/cards/a.jpg"));
    expect(avatar).toHaveTextContent("a.jpg");

    // Who, on what, from where, when; and what was sent, folded.
    const panel = within(edit).getByTestId("audit-details");
    expect(panel).toHaveTextContent(t("admin.audit.sec.who"));
    expect(panel).toHaveTextContent(t("admin.audit.res.students"));
    expect(panel).toHaveTextContent(F.student1.id);
    expect(panel).toHaveTextContent(t("admin.audit.sec.raw"));
    expect(within(panel).getByText(/"phone": "0550112233"/)).toBeInTheDocument();

    await app.user.click(toggle);
    expect(within(edit).queryByTestId("audit-details")).toBeNull();
  });

  it("ما حُذف، وما أُرسل من ملفّ وما أُجيب به، ومن عُني بالعملية، ومعلومات الحدث", async () => {
    const app = await audit();
    const open = async (text: string) => {
      const row = rowWith(text);
      await app.user.click(within(row).getByRole("button", { name: esc(t("admin.audit.details")) }));
      return within(row).getByTestId("audit-details");
    };

    const deleted = await open(t("admin.audit.op.DELETE_professor_topics_id"));
    expect(deleted).toHaveTextContent(t("admin.audit.sec.deleted"));
    expect(deleted).toHaveTextContent(t("admin.audit.field.maxStudents"));
    expect(deleted).toHaveTextContent(t("admin.audit.value.pending"));

    const imported = await open(t("admin.audit.op.POST_students_import"));
    expect(imported).toHaveTextContent("students.xlsx");
    expect(imported).toHaveTextContent("(20 KB)");
    expect(imported).toHaveTextContent(t("admin.audit.sec.result"));
    expect(imported).toHaveTextContent(t("admin.audit.field.created"));
    expect(imported).toHaveTextContent("42");

    const leader = await open(t("admin.audit.op.PATCH_group_requests_id_leader_studentId"));
    expect(leader).toHaveTextContent(t("admin.audit.sec.refs"));
    expect(leader).toHaveTextContent("مريم سعدي · 202039012346");
    // Saved with nothing changed: said so.
    expect(leader).toHaveTextContent(t("admin.audit.noChange"));

    const login = await open(t("admin.audit.op.auth_login"));
    expect(login).toHaveTextContent(t("admin.audit.sec.info"));
    expect(login).toHaveTextContent(t("admin.audit.field.secondFactor"));
    expect(login).toHaveTextContent(t("admin.audit.value.totp"));
    expect(login).toHaveTextContent("Chrome · Windows");
    // The address said for what it is; signing in is done to no other item.
    expect(login).toHaveTextContent(t("admin.audit.ip.private"));
    expect(within(login).queryByText(t("admin.audit.sec.target"))).toBeNull();

    // A refused sign-in to no account: why, for the log; no one to follow, only the address — and where it was.
    const refused = await open(t("admin.audit.op.auth_loginFailed"));
    expect(refused).toHaveTextContent(t("admin.audit.reason.unknownAccount"));
    for (const text of ["الجزائر", "Tlemcen", "Remchi", "Telecom Algeria", t("admin.audit.field.isp"), t("admin.audit.field.region")]) {
      expect(refused).toHaveTextContent(text);
    }
    expect(refused).toHaveTextContent(t("admin.audit.noActorId"));
    expect(within(refused).queryByRole("button", { name: esc(t("admin.audit.act.byActor")) })).toBeNull();

    // A sign-out: how long the session lasted; from the machine itself.
    const out = await open(t("admin.audit.op.auth_logout"));
    expect(out).toHaveTextContent(t("admin.audit.field.duration"));
    expect(out).toHaveTextContent(t("admin.audit.hoursMinutes", { h: 2, m: 15 }));
    expect(out).toHaveTextContent(t("admin.audit.ip.local"));
  });

  it("كلّ صفٍّ بابٌ: كلّ ما فعله هذا الشخص، وسجلّ هذا العنصر، وكلّ ما جاء من هذا العنوان", async () => {
    const app = await audit();
    const edit = rowWith(t("admin.audit.op.PATCH_students_id"));
    await app.user.click(within(edit).getByRole("button", { name: esc(t("admin.audit.details")) }));
    await app.user.click(within(edit).getByRole("button", { name: esc(t("admin.audit.act.byActor")) }));
    await waitFor(() => expect(last()).toMatchObject({ actorId: F.adminUser.id }));
    expect(screen.getByTestId("audit-chips")).toHaveTextContent("سمير بن علي");

    const again = rowWith(t("admin.audit.op.PATCH_students_id"));
    await app.user.click(within(again).getByRole("button", { name: "أسامة بلقاسم · 202039012345" }));
    await waitFor(() => expect(last()).toMatchObject({ targetType: "students", targetId: F.student1.id }));
    expect(screen.getByTestId("audit-chips")).toHaveTextContent(t("admin.audit.filters.target", { name: "أسامة بلقاسم · 202039012345" }));

    // The row stays open while the list narrows around it.
    const row = rowWith(t("admin.audit.op.PATCH_students_id"));
    expect(within(row).getByTestId("audit-details")).toBeInTheDocument();
    await app.user.click(within(row).getByRole("button", { name: esc(t("admin.audit.act.byIp")) }));
    await waitFor(() => expect(last()).toMatchObject({ ip: "10.0.0.5" }));
    // The address shows in its box too, under the advanced filters.
    expect(screen.getByLabelText(t("admin.audit.filters.ip"))).toHaveValue("10.0.0.5");

    // Everything from that row's country.
    const refused = rowWith(t("admin.audit.op.auth_loginFailed"));
    await app.user.click(within(refused).getByRole("button", { name: esc(t("admin.audit.details")) }));
    await app.user.click(within(refused).getByRole("button", { name: esc(t("admin.audit.act.byCountry")) }));
    await waitFor(() => expect(last()).toMatchObject({ country: "DZ" }));
    expect(screen.getByTestId("audit-chips")).toHaveTextContent("الجزائر");

    // Each chip removes its own filter; «clear all» the rest.
    await app.user.click(screen.getByRole("button", { name: esc(`${t("admin.audit.filters.remove")}: ${t("admin.audit.filters.ipChip", { ip: "10.0.0.5" })}`) }));
    // (The list without it was read already: it is not asked for again.)
    await waitFor(() => expect(app.location()).not.toContain("ip="));
    expect(screen.getByLabelText(t("admin.audit.filters.ip"))).toHaveValue("");
    await app.user.click(screen.getByRole("button", { name: t("admin.audit.filters.clear") }));
    await waitFor(() => expect(app.location()).not.toMatch(/actor=|tid=/));
    expect(screen.queryByTestId("audit-chips")).toBeNull();
  });

  it("الجهاز من وكيل المستخدم: المتصفّح ونظامه", async () => {
    const ua = {
      edge: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/130 Safari/537 Edg/130",
      firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:131) Gecko Firefox/131",
      safari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14) AppleWebKit Version/17 Safari/605",
      chromeIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17) AppleWebKit CriOS/130 Mobile Safari/604",
      opera: "Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/130 Mobile Safari/537 OPR/80",
      unknown: "curl/8.4",
    };
    fake.on("get", "/admin/audit-logs", (r) => ({
      items: Object.entries(ua).map(([id, userAgent]) => ({ ...F.auditLogs[0]!, id, userAgent })),
      total: 6,
      page: Number(r.query.page ?? 1),
      limit: 25,
    }));
    await audit();
    const text = screen.getAllByTestId("audit-row").map((r) => r.textContent ?? "");
    expect(text[0]).toContain("Edge · Windows");
    expect(text[1]).toContain("Firefox · Linux");
    expect(text[2]).toContain("Safari · macOS");
    expect(text[3]).toContain("Chrome · iOS");
    expect(text[4]).toContain("Opera · Android");
    expect(text[5]).not.toMatch(/ · (Windows|Linux|macOS|iOS|Android)/);
  });
});

describe("سجلّ العمليات — الفلاتر", () => {
  it("النوع والبحث والمدّة تصل الخادم وتسكن الرابط — والمسافة بين كلمتين تبقى", async () => {
    const app = await audit();
    await app.user.click(screen.getByRole("tab", { name: esc(t("admin.audit.kind.failed")) }));
    await waitFor(() => expect(app.location()).toContain("kind=failed"));
    await waitFor(() => expect(last()).toMatchObject({ kind: "failed", page: 1 }));

    const box = screen.getByPlaceholderText(t("admin.audit.search"));
    await app.user.type(box, "أسامة ");
    await waitFor(() => expect(last()).toMatchObject({ search: "أسامة" }));
    await app.user.type(box, "بلقاسم");
    await waitFor(() => expect(last()).toMatchObject({ search: "أسامة بلقاسم" }));
    expect(box).toHaveValue("أسامة بلقاسم");

    fireEvent.change(screen.getByLabelText(t("admin.audit.from")), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText(t("admin.audit.to")), { target: { value: "2026-10-01" } });
    await waitFor(() => expect(last()).toMatchObject({ from: "2026-09-01", to: "2026-10-01", kind: "failed" }));
    expect(screen.getByLabelText(t("admin.audit.to"))).toHaveAttribute("min", "2026-09-01");
    // The period said as dates, not as the address writes them.
    const medium = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });
    const noon = (d: string) => new Date(`${d}T12:00:00`);
    expect(screen.getByTestId("audit-chips")).toHaveTextContent(medium.formatRange(noon("2026-09-01"), noon("2026-10-01")));
    fireEvent.change(screen.getByLabelText(t("admin.audit.to")), { target: { value: "" } });
    await waitFor(() => expect(screen.getByTestId("audit-chips")).toHaveTextContent(t("admin.audit.filters.since", { date: medium.format(noon("2026-09-01")) })));
    fireEvent.change(screen.getByLabelText(t("admin.audit.from")), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(t("admin.audit.to")), { target: { value: "2026-10-01" } });
    await waitFor(() => expect(screen.getByTestId("audit-chips")).toHaveTextContent(t("admin.audit.filters.until", { date: medium.format(noon("2026-10-01")) })));
    fireEvent.change(screen.getByLabelText(t("admin.audit.from")), { target: { value: "2026-10-01" } });
    await waitFor(() => expect(screen.getByTestId("audit-chips")).toHaveTextContent(medium.format(noon("2026-10-01"))));

    await app.user.click(screen.getByRole("button", { name: t("admin.audit.filters.today") }));
    await waitFor(() => expect(last()).toMatchObject({ from: day(), to: day() }));
    expect(screen.getByTestId("audit-chips")).toHaveTextContent(t("admin.audit.filters.today"));

    // Today, a week, a month: a click.
    await app.user.click(screen.getByRole("button", { name: t("admin.audit.filters.week") }));
    await waitFor(() => expect(last()).toMatchObject({ from: day(-6), to: day() }));
    expect(screen.getByRole("button", { name: t("admin.audit.filters.week") })).toHaveAttribute("aria-pressed", "true");

    await app.user.click(screen.getByRole("tab", { name: esc(t("admin.audit.kind.all")) }));
    await waitFor(() => expect(app.location()).not.toContain("kind="));
  });

  it("الفلاتر المتقدّمة: المجال والدور والشخص والعملية ونوع الفعل والترتيب وحجم الصفحة — كلٌّ يصل الخادم ويُرى شريحة", async () => {
    const app = await audit();
    expect(screen.queryByTestId("audit-advanced")).toBeNull();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.audit.filters.advanced")) }));
    expect(screen.getByTestId("audit-advanced")).toBeInTheDocument();

    await choose(app, t("admin.audit.filters.area"), t("admin.audit.area.structure"));
    await waitFor(() => expect(last()).toMatchObject({ area: "structure" }));
    await choose(app, t("admin.audit.filters.role"), t("admin.audit.role.professor"));
    await waitFor(() => expect(last()).toMatchObject({ role: "professor" }));
    await choose(app, t("admin.audit.filters.actor"), /يوسف حمادي/);
    await waitFor(() => expect(last()).toMatchObject({ actorId: F.profUsers[0]!.id }));
    await choose(app, t("admin.audit.filters.op"), esc(t("admin.audit.op.PUT_professor_topics_id")));
    await waitFor(() => expect(last()).toMatchObject({ action: "PUT /professor/topics/:id" }));
    await choose(app, t("admin.audit.filters.verb"), t("admin.audit.verbs.delete"));
    await waitFor(() => expect(last()).toMatchObject({ verb: "delete" }));
    await choose(app, t("admin.audit.filters.order"), t("admin.audit.filters.oldest"));
    await waitFor(() => expect(last()).toMatchObject({ order: "asc" }));
    await choose(app, t("admin.audit.filters.perPage"), "100");
    await waitFor(() => expect(last()).toMatchObject({ limit: 100 }));
    await choose(app, t("admin.audit.filters.country"), /فرنسا/);
    await waitFor(() => expect(last()).toMatchObject({ country: "FR" }));
    await app.user.type(screen.getByLabelText(t("admin.audit.filters.ip")), "41.100.1.1");
    await waitFor(() => expect(last()).toMatchObject({ ip: "41.100.1.1" }));

    const chips = screen.getByTestId("audit-chips");
    for (const label of [
      t("admin.audit.area.structure"),
      t("admin.audit.role.professor"),
      "يوسف حمادي",
      t("admin.audit.op.PUT_professor_topics_id"),
      t("admin.audit.verbs.delete"),
      t("admin.audit.filters.ipChip", { ip: "41.100.1.1" }),
      "فرنسا",
    ]) {
      expect(chips).toHaveTextContent(label);
    }
    // The fold says how many of its filters apply.
    expect(screen.getByRole("button", { name: esc(t("admin.audit.filters.advanced")) })).toHaveTextContent("7");

    await app.user.click(screen.getByRole("button", { name: esc(`${t("admin.audit.filters.remove")}: ${t("admin.audit.verbs.delete")}`) }));
    await waitFor(() => expect(last().verb).toBeUndefined());

    // Back to the defaults: the order and the size leave the address.
    await choose(app, t("admin.audit.filters.order"), t("admin.audit.filters.newest"));
    await choose(app, t("admin.audit.filters.perPage"), "25");
    await waitFor(() => expect(app.location()).not.toMatch(/order=|per=/));
  });

  it("رابطٌ بفلاتره يفتح الطيّة، ويُظهر شخصاً لا تعرفه القائمة باسمه المحفوظ — وبلداً لا تعرفه باسمه", async () => {
    await audit("/ar/admin/users?view=audit&actor=someone-else&who=%D8%B9%D9%84%D9%8A&tt=topics&tid=t9&country=MA");
    expect(screen.getByTestId("audit-chips")).toHaveTextContent("المغرب");
    expect(screen.getByTestId("audit-advanced")).toBeInTheDocument();
    expect(screen.getByTestId("audit-chips")).toHaveTextContent("علي");
    // A target named by its id when its name was not kept.
    expect(screen.getByTestId("audit-chips")).toHaveTextContent(t("admin.audit.filters.target", { name: "t9" }));
    expect(last()).toMatchObject({ actorId: "someone-else", targetType: "topics", targetId: "t9" });
  });

  it("صفحاتٌ كثيرة ⇒ التالي والسابق؛ ولا سجلّات ⇒ «فارغ»؛ وتعذّرٌ ⇒ «إعادة»", async () => {
    fake.on("get", "/admin/audit-logs", (r) => ({ items: F.auditLogs, total: 60, page: Number(r.query.page ?? 1), limit: 25 }));
    let app = await audit();
    expect(screen.getByText(t("admin.audit.pageOf", { page: 1, pages: 3 }))).toBeInTheDocument();
    // Above the results: which of them are shown.
    expect(screen.getByTestId("audit-display")).toHaveTextContent(t("admin.audit.range", { first: 1, last: 25, total: 60 }));
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.next") }));
    await waitFor(() => expect(app.location()).toContain("page=2"));
    expect(screen.getByTestId("audit-display")).toHaveTextContent(t("admin.audit.range", { first: 26, last: 50, total: 60 }));
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.prev") }));
    await waitFor(() => expect(app.location()).toContain("page=1"));
    app.unmount();

    fake.on("get", "/admin/audit-logs", { items: [], total: 0, page: 1, limit: 25 });
    app = renderApp("/ar/admin/users?view=audit", { as: "admin" });
    expect(await screen.findByText(t("admin.audit.empty"))).toBeInTheDocument();
    app.unmount();

    fake.fail("get", "/admin/audit-logs", 500, "خطأ");
    app = renderApp("/ar/admin/users?view=audit&kind=security", { as: "admin" });
    const retry = await screen.findByRole("button", { name: esc(t("admin.retry")) });
    const before = fake.find("get", "/admin/audit-logs").length;
    await app.user.click(retry);
    await waitFor(() => expect(fake.find("get", "/admin/audit-logs").length).toBeGreaterThan(before));
  });
});
