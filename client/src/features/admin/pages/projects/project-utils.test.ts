/**
 * تنبيهات صحّة المشروع — ما تعرضه صفحته أوّلاً.
 *
 * كلّ تنبيهٍ هنا كان إمّا غير مرئيّ أو يُستنتج من ثلاث بطاقات: مرحلةٌ فات
 * موعدها وعلامتها «قيد الانتظار»، ومناقشةٌ مضى تاريخها وهي «مبرمجة»، ولجنةٌ
 * بلا رئيس، ومقعد «المشرف» لأستاذٍ لم يعد يشرف. والترتيب مقصود: الأخطر أوّلاً.
 */
import { describe, it, expect } from "vitest";
import { isLate, projectAlerts, cardTone, gradeMention } from "./project-utils";

const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const ahead = (d: number) => new Date(Date.now() + d * DAY).toISOString();

const base = () => ({
  topic: { professorId: "p1", maxStudents: 2, specialization: { id: "s1" } },
  members: [
    { isLeader: true, student: { specialization: { id: "s1" } } },
    { isLeader: false, student: { specialization: { id: "s1" } } },
  ],
  milestones: [{ status: "completed", deadline: ago(5) }],
  defense: null as unknown,
});

const ids = (p: unknown) => projectAlerts(p).map((a) => a.id);

describe("isLate — بالعلامة أو بالتاريخ", () => {
  it("مرحلةٌ فات موعدها وعلامتها pending متأخرة، والمنجزة لا", () => {
    expect(isLate({ status: "pending", deadline: ago(1) })).toBe(true);
    expect(isLate({ status: "overdue", deadline: ahead(3) })).toBe(true);
    expect(isLate({ status: "completed", deadline: ago(9) })).toBe(false);
    expect(isLate({ status: "in_progress", deadline: ahead(2) })).toBe(false);
  });
});

describe("projectAlerts", () => {
  it("مشروعٌ سليم أنجز مراحله بلا مناقشة ⇒ «جاهز للمناقشة» وحده", () => {
    expect(ids(base())).toEqual(["ready"]);
  });

  it("والأخطر أوّلاً: المتأخّرة قبل ما دونها", () => {
    const p = base();
    p.members[0].isLeader = false;
    p.milestones = [{ status: "pending", deadline: ago(2) }];
    const out = projectAlerts(p);
    expect(out[0]).toMatchObject({ id: "late", level: "danger", params: { n: 1 }, target: "milestones" });
    expect(out.map((a) => a.id)).toContain("noLeader");
  });

  it("بلا مراحل ⇒ noPlan، ومقعدٌ شاغر ⇒ seats، وتخصّصٌ مختلف ⇒ spec", () => {
    const p = base();
    p.milestones = [];
    p.members = [{ isLeader: true, student: { specialization: { id: "other" } } }];
    expect(ids(p)).toEqual(expect.arrayContaining(["noPlan", "seats", "spec"]));
  });

  it("مناقشةٌ مضى موعدها وهي «مبرمجة» ⇒ خطر، ولجنة بلا رئيس ⇒ تنبيه", () => {
    const p = base();
    p.defense = {
      status: "scheduled",
      date: ago(2),
      committee: [{ role: "examiner", professorId: "p9" }],
    };
    const out = ids(p);
    expect(out[0]).toBe("stale");
    expect(out).toEqual(expect.arrayContaining(["noPresident", "supAbsent"]));
  });

  it("مقعد «المشرف» لأستاذٍ غير المشرف ⇒ يُقال", () => {
    const p = base();
    p.defense = {
      status: "scheduled",
      date: ahead(20),
      committee: [
        { role: "president", professorId: "p7" },
        { role: "supervisor", professorId: "p-old" },
      ],
    };
    expect(ids(p)).toContain("supSeat");
  });

  it("ونوقش بلا درجة ⇒ noGrade؛ وملغاة ⇒ لا يُطالَب بلجنة", () => {
    const p = base();
    p.defense = { status: "completed", date: ago(1), grade: null, committee: [{ role: "president", professorId: "p1" }] };
    expect(ids(p)).toContain("noGrade");

    p.defense = { status: "cancelled", date: ago(1), committee: [] };
    expect(ids(p)).toContain("cancelled");
    expect(ids(p)).not.toContain("noJury");
  });
});

describe("cardTone و gradeMention", () => {
  it("المتأخّر أحمر قبل كلّ شيء، والمنتهية خضراء", () => {
    expect(cardTone({ progress: { overdue: 1 }, defense: { status: "completed" } })).toBe("danger");
    expect(cardTone({ progress: { overdue: 0 }, defense: { status: "completed" } })).toBe("good");
    expect(cardTone({ progress: { overdue: 0 }, defense: { status: "scheduled", date: ahead(4) } })).toBe("gold");
    expect(cardTone({ progress: { overdue: 0 }, defense: { status: "scheduled", date: ago(4) } })).toBe("danger");
  });

  it("التقديرات على سلّم 20", () => {
    expect(gradeMention(16.5)).toBe("excellent");
    expect(gradeMention(14)).toBe("veryGood");
    expect(gradeMention(9.75)).toBe("fail");
    expect(gradeMention(null)).toBeNull();
  });
});
