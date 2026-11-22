import { describe, expect, it } from "vitest";
import type { ProjectGroupListItem } from "../../../types/professor.types";
import { searchWords } from "../../../lib/search-text";
import {
  DEFAULT_FILTERS,
  bandOf,
  deriveRow,
  facets,
  fieldWords,
  healthOf,
  panelCount,
  passes,
  readFilters,
  searchHits,
  sortRows,
  writeFilters,
  type BoardFilters,
} from "./milestone-board";

/**
 * لوحة المراحل: حال كلّ مذكرةٍ من مراحلها، والفلاتر في العنوان، والبحث
 * في كلّ حقل، والترتيب، وأعداد الخيارات مع بقيّة الفلاتر.
 */
const NOW = Date.parse("2026-10-28T12:00:00Z");
const at = (days: number) => new Date(NOW + days * 86_400_000).toISOString();
const ms = (id: string, status: string, deadline: number, files = 0, order = 1) => ({
  id,
  title: `مرحلة ${id}`,
  status,
  deadline: at(deadline),
  order,
  _count: { submissions: files },
});
const person = (firstName: string, lastName: string, latin?: [string, string]) => ({
  firstName,
  lastName,
  ...(latin ? { firstNameLatin: latin[0], lastNameLatin: latin[1] } : {}),
});
function group(id: string, patch: Partial<ProjectGroupListItem> & { title?: string } = {}): ProjectGroupListItem {
  const { title = `مذكرة ${id}`, ...rest } = patch;
  return {
    id,
    topic: {
      id: `t-${id}`,
      title,
      status: "full",
      maxStudents: 3,
      specialization: { id: "sp1", name: "علم الاجتماع" },
      academicYear: { id: "y1", title: "2026/2027" },
    },
    members: [{ id: `m-${id}`, isLeader: true, student: { id: `s-${id}`, registrationNumber: `REG-${id}`, user: person("سارة", "بن علي") } }],
    milestones: [],
    defense: null,
    createdAt: at(-10),
    ...rest,
  } as ProjectGroupListItem;
}
const f = (patch: Partial<BoardFilters> = {}) => ({ ...DEFAULT_FILTERS, ...patch });

describe("حال المذكرة", () => {
  it("المتأخّرة بموعدها أو بحالها؛ والقريبة في أسبوع؛ والقادمة أقربها؛ والإنجاز والملفات", () => {
    const r = deriveRow(
      group("a", {
        milestones: [
          ms("1", "completed", -30, 2),
          ms("2", "in_progress", -1), // فات موعدها
          ms("3", "overdue", 5), // متأخّرة بحالها
          ms("4", "pending", 3, 1),
          ms("5", "pending", 20),
        ],
      }),
      NOW,
    );
    expect([r.total, r.completed, r.late, r.soon, r.percent, r.files]).toEqual([5, 1, 2, 1, 20, 3]);
    expect(r.next?.id).toBe("4");
    expect(r.oldestLate).toBe(Date.parse(at(-1)));
    expect(healthOf(r, "late") && healthOf(r, "soon") && !healthOf(r, "done") && !healthOf(r, "empty")).toBe(true);
  });

  it("بلا مراحل ⇒ «بلا مراحل» ولا ربع إنجاز؛ والمكتملة ⇒ «مكتملة» والربع الأعلى", () => {
    const empty = deriveRow(group("e"), NOW);
    expect([healthOf(empty, "empty"), healthOf(empty, "done"), bandOf(empty), empty.next, empty.oldestLate]).toEqual([true, false, null, null, null]);
    const done = deriveRow(group("d", { milestones: [ms("1", "completed", -3), ms("2", "completed", 4)] }), NOW);
    expect([healthOf(done, "done"), bandOf(done), done.soon]).toEqual([true, "q4", 0]);
    expect(healthOf(done, "all")).toBe(true);
  });

  it("الأرباع بحدودها", () => {
    const of = (done: number, total: number) =>
      bandOf(deriveRow(group("x", { milestones: Array.from({ length: total }, (_, i) => ms(String(i), i < done ? "completed" : "pending", 30)) }), NOW));
    expect([of(0, 4), of(1, 4), of(2, 4), of(3, 4), of(4, 4)]).toEqual(["q1", "q2", "q3", "q4", "q4"]);
  });

  it("المناقشة: مبرمجة، أو تمّت، أو لا — والملغاة كأن لم تكن", () => {
    const d = (status?: "scheduled" | "completed" | "cancelled") =>
      deriveRow(group("x", { defense: status ? { id: "d", date: at(5), room: "A1", status } : null }), NOW).defense;
    expect([d("scheduled"), d("completed"), d("cancelled"), d()]).toEqual(["scheduled", "completed", "none", "none"]);
  });
});

describe("الفلاتر في العنوان", () => {
  it("تُقرأ كما كُتبت، وما لا يُعرف يعود إلى أصله", () => {
    const sp = new URLSearchParams(
      "q=أحمد&title=الهجرة&student=سارة&registration=0457&milestone=الاستمارة&room=A1&health=late&year=y1&spec=sp1&status=full&defense=scheduled&files=with&band=q2&size=2&sort=title",
    );
    expect(readFilters(sp)).toEqual({
      q: "أحمد",
      title: "الهجرة",
      student: "سارة",
      registration: "0457",
      milestone: "الاستمارة",
      room: "A1",
      health: "late",
      year: "y1",
      spec: "sp1",
      status: "full",
      defense: "scheduled",
      files: "with",
      band: "q2",
      size: "2",
      sort: "title",
    });
    expect(readFilters(new URLSearchParams("health=x&defense=x&files=x&band=x&size=two&sort=x"))).toEqual(DEFAULT_FILTERS);
  });

  it("تُكتب بما خالف الأصل وحده، والنصّ كما كُتب (ولو انتهى بفراغ)، وما سواها باقٍ", () => {
    const out = writeFilters(new URLSearchParams("group=g1&year=old"), f({ q: "سارة ", registration: "2021", band: "q3", year: "" }));
    expect(out.toString()).toBe(new URLSearchParams({ group: "g1", q: "سارة ", registration: "2021", band: "q3" }).toString());
    expect(writeFilters(new URLSearchParams("q=x&student=y&sort=title"), DEFAULT_FILTERS).toString()).toBe("");
    // فراغٌ وحده ليس بحثاً.
    expect(writeFilters(new URLSearchParams("q=x"), f({ q: "   ", room: " " })).toString()).toBe("");
  });

  it("وعدد فلاتر اللوحة يحسب البحث المفصّل، لا العامّ ولا الحال ولا الترتيب", () => {
    expect(panelCount(f({ q: "x", health: "late", sort: "title", student: " " }))).toBe(0);
    expect(panelCount(f({ year: "y1", files: "with", size: "2" }))).toBe(3);
    expect(panelCount(f({ student: "سارة", registration: "1" }))).toBe(2);
  });
});

describe("البحث", () => {
  const g = group("a", {
    title: "الهجرة الداخلية",
    members: [
      { id: "m1", isLeader: true, student: { id: "s1", registrationNumber: "2021-0457", user: person("أحمد", "قاسمي", ["Ahmed", "Kacemi"]) } },
      { id: "m2", student: { id: "s2", registrationNumber: "2021-0999", user: person("مريم", "بوزيد") } },
    ],
    milestones: [ms("1", "pending", 3)],
    defense: { id: "d", date: at(30), room: "قاعة المناقشات 2", status: "scheduled" },
  });
  g.milestones![0]!.title = "الاستمارة";
  const hits = (q: string) => searchHits(g, searchWords(q));

  it("بلا بحث ⇒ تطابق بلا مواضع", () => expect(hits("")).toEqual([]));

  it("العنوان لا يُذكر موضعاً؛ وكلّ كلمةٍ في أيّ حقلٍ ولو تفرّقت", () => {
    expect(hits("الهجره")).toEqual([]);
    expect(hits("احمد الاستماره")).toEqual([
      { kind: "student", text: "أحمد قاسمي" },
      { kind: "milestone", text: "الاستمارة" },
    ]);
  });

  it("بالاسم اللاتيني، ورقم التسجيل، والتخصّص، والسنة، والقاعة", () => {
    expect(hits("kacemi")).toEqual([{ kind: "student", text: "أحمد قاسمي" }]);
    expect(hits("0999")).toEqual([{ kind: "registration", text: "2021-0999" }]);
    expect(hits("الاجتماع")).toEqual([{ kind: "specialization", text: "علم الاجتماع" }]);
    expect(hits("2026/2027")).toEqual([{ kind: "year", text: "2026/2027" }]);
    expect(hits("المناقشات")).toEqual([{ kind: "room", text: "قاعة المناقشات 2" }]);
  });

  it("كلمةٌ لا تقع في شيء ⇒ لا تطابق، ولو وقعت أخواتها", () => {
    expect(hits("أحمد فيزياء")).toBeNull();
  });

  it("الحقل نفسه يُذكر مرّةً واحدة", () => {
    expect(hits("2021")).toEqual([
      { kind: "registration", text: "2021-0457" },
      { kind: "registration", text: "2021-0999" },
    ]);
    const twins = group("t", { members: [g.members![0]!, { ...g.members![0]!, id: "m9" }] });
    expect(searchHits(twins, searchWords("احمد"))).toEqual([{ kind: "student", text: "أحمد قاسمي" }]);
  });

  describe("المفصّل: كلّ حقلٍ في نوعه وحده", () => {
    const by = (patch: Partial<BoardFilters>, q = "") => searchHits(g, searchWords(q), fieldWords(f(patch)));

    it("رقم التسجيل في أرقام التسجيل وحدها، لا في السنة ولا في العنوان", () => {
      expect(by({ registration: "0457" })).toEqual([{ kind: "registration", text: "2021-0457" }]);
      // «2026» في السنة، لا في رقم تسجيل.
      expect(by({ registration: "2026" })).toBeNull();
      expect(hits("2026")).not.toBeNull();
    });

    it("اسم الطالب: كلماته في طالبٍ واحد، بالعربية أو اللاتينية", () => {
      expect(by({ student: "احمد قاسمي" })).toEqual([{ kind: "student", text: "أحمد قاسمي" }]);
      expect(by({ student: "ahmed" })).toEqual([{ kind: "student", text: "أحمد قاسمي" }]);
      // «أحمد» في طالبٍ و«بوزيد» في آخر: لا.
      expect(by({ student: "أحمد بوزيد" })).toBeNull();
      // واسم الطالب ليس في عنوان المذكرة.
      expect(by({ student: "الهجرة" })).toBeNull();
    });

    it("العنوان، والمرحلة، والقاعة — كلٌّ في موضعه", () => {
      expect(by({ title: "الداخليه" })).toEqual([]);
      expect(by({ title: "الاستمارة" })).toBeNull();
      expect(by({ milestone: "استماره" })).toEqual([{ kind: "milestone", text: "الاستمارة" }]);
      expect(by({ milestone: "الهجرة" })).toBeNull();
      expect(by({ room: "2" })).toEqual([{ kind: "room", text: "قاعة المناقشات 2" }]);
      expect(by({ room: "قاسمي" })).toBeNull();
    });

    it("تجتمع الحقول بينها ومع البحث العامّ، وكلّ موضعٍ يُذكر", () => {
      expect(by({ student: "مريم", registration: "0999" }, "الاستمارة")).toEqual([
        { kind: "student", text: "مريم بوزيد" },
        { kind: "registration", text: "2021-0999" },
        { kind: "milestone", text: "الاستمارة" },
      ]);
      // كلّ حقلٍ شرطٌ على المذكرة: مريم فيها، ورقم أحمد فيها.
      expect(by({ student: "مريم", registration: "0457" })).toEqual([
        { kind: "registration", text: "2021-0457" },
        { kind: "student", text: "مريم بوزيد" },
      ]);
      expect(by({ student: "مريم", registration: "0111" })).toBeNull();
      expect(by({ student: "مريم" }, "فيزياء")).toBeNull();
    });
  });

  it("مذكرةٌ بلا موضوعٍ ولا طلبةٍ ولا تخصّص: يُبحث فيما بقي", () => {
    const bare = { id: "b", createdAt: at(0), milestones: [ms("1", "pending", 1)] } as ProjectGroupListItem;
    bare.members = [{ id: "m", student: { id: "s", registrationNumber: "", user: undefined } }];
    expect(searchHits(bare, searchWords("مرحلة"))).toEqual([{ kind: "milestone", text: "مرحلة 1" }]);
    expect(searchHits(bare, searchWords("x"))).toBeNull();
  });
});

describe("الفلترة والترتيب والأوجه", () => {
  const rows = [
    group("late", { title: "ب", milestones: [ms("1", "overdue", -9), ms("2", "pending", -2), ms("3", "completed", -20, 3)], createdAt: at(-3) }),
    group("soon", { title: "أ", milestones: [ms("1", "pending", 2)], defense: { id: "d", date: at(9), room: "", status: "scheduled" }, createdAt: at(-1) }),
    group("done", {
      title: "ج",
      milestones: [ms("1", "completed", -5, 1)],
      defense: { id: "d", date: at(-1), room: "", status: "completed", grade: 15 },
      topic: { id: "t", title: "ج", status: "archived", maxStudents: 2, specialization: { id: "sp2", name: "الديموغرافيا" }, academicYear: { id: "y0", title: "2025/2026" } },
      members: [],
      createdAt: at(-30),
    }),
    group("empty", { title: "د", createdAt: at(-2) }),
    group("late2", { title: "هـ", milestones: [ms("1", "in_progress", -1), ms("2", "pending", 40)], createdAt: at(-3) }),
  ].map((g) => deriveRow(g, NOW));
  const ids = (list: typeof rows) => list.map((r) => r.g.id);
  const only = (patch: Partial<BoardFilters>) => ids(rows.filter((r) => passes(r, f(patch))));

  it("كلّ فلترٍ يحصر بما يقول", () => {
    expect(only({ health: "late" })).toEqual(["late", "late2"]);
    expect(only({ health: "soon" })).toEqual(["soon"]);
    expect(only({ health: "done" })).toEqual(["done"]);
    expect(only({ health: "empty" })).toEqual(["empty"]);
    expect(only({ year: "y0" })).toEqual(["done"]);
    expect(only({ spec: "sp1" })).toEqual(["late", "soon", "empty", "late2"]);
    expect(only({ status: "archived" })).toEqual(["done"]);
    expect(only({ defense: "scheduled" })).toEqual(["soon"]);
    expect(only({ defense: "none" })).toEqual(["late", "empty", "late2"]);
    expect(only({ files: "with" })).toEqual(["late", "done"]);
    expect(only({ files: "without" })).toEqual(["soon", "empty", "late2"]);
    expect(only({ band: "q2" })).toEqual(["late"]);
    expect(only({ band: "q1" })).toEqual(["soon", "late2"]);
    expect(only({ size: "0" })).toEqual(["done"]);
    expect(only({ health: "late", files: "with" })).toEqual(["late"]);
  });

  it("الترتيب بكلّ وجوهه؛ والمتساويات على الأحدث", () => {
    const by = (s: BoardFilters["sort"]) => ids(sortRows(rows, s, "ar"));
    expect(by("recent")).toEqual(["soon", "empty", "late", "late2", "done"]);
    expect(by("oldest")).toEqual(["done", "late", "late2", "empty", "soon"]);
    // بلا موعدٍ قادم في الآخر، على الأحدث.
    expect(by("deadline")).toEqual(["soon", "late2", "empty", "late", "done"]);
    expect(by("late")).toEqual(["late", "late2", "soon", "empty", "done"]);
    expect(by("progressDesc")).toEqual(["done", "late", "late2", "soon", "empty"]);
    expect(by("progressAsc")).toEqual(["late2", "soon", "empty", "late", "done"]);
    expect(by("title")).toEqual(["soon", "late", "done", "empty", "late2"]);
  });

  it("الترتيب لا يغيّر الأصل، ويثبت بالمعرّف عند التساوي التامّ", () => {
    const twins = [deriveRow(group("b"), NOW), deriveRow(group("a"), NOW)];
    expect(ids(sortRows(twins, "recent", "ar"))).toEqual(["a", "b"]);
    expect(ids(twins)).toEqual(["b", "a"]);
  });

  it("الأوجه من المذكرات، وعدد كلّ خيارٍ مع بقيّة الفلاتر لا مع فلتره", () => {
    const fx = facets(rows, f({ health: "late", year: "y1" }), []);
    expect(fx.health).toEqual({ all: 4, late: 2, soon: 1, done: 0, empty: 1 });
    expect(fx.years).toEqual([
      { value: "y1", label: "2026/2027", count: 2 },
      { value: "y0", label: "2025/2026", count: 0 },
    ]);
    expect(fx.specs.map((s) => s.label)).toEqual(["الديموغرافيا", "علم الاجتماع"]);
    expect(fx.statuses).toEqual([
      { value: "full", label: "full", count: 2 },
      { value: "archived", label: "archived", count: 0 },
    ]);
    expect(fx.defense.find((d) => d.value === "none")?.count).toBe(2);
    expect(fx.files).toEqual([
      { value: "with", label: "with", count: 1 },
      { value: "without", label: "without", count: 1 },
    ]);
    expect(fx.bands.map((b) => [b.value, b.count])).toEqual([
      ["q2", 1],
      ["q1", 1],
      ["q4", 0],
    ]);
    expect(fx.sizes.map((s) => s.value)).toEqual(["0", "1"]);
  });

  it("والبحث يحصر الأوجه أيضاً، عامّاً ومفصّلاً", () => {
    const fx = facets(rows, f(), searchWords("الديموغرافيا"));
    expect(fx.health.all).toBe(1);
    expect(fx.years.map((y) => y.value)).toEqual(["y0"]);
    const byTitle = f({ title: "ج" });
    expect(facets(rows, byTitle, [], fieldWords(byTitle)).health.all).toBe(1);
    const byReg = f({ registration: "REG-late2" });
    expect(facets(rows, byReg, [], fieldWords(byReg)).health).toMatchObject({ all: 1, late: 1, soon: 0 });
  });
});
