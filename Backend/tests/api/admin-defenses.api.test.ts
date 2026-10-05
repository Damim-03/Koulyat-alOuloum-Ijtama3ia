/**
 * الإدارة — المناقشات واللجان والدرجات.
 *
 * مجالٌ كامل بلا اختبار واحد حتى الآن، وهو يحمل **آخر ما يُنتجه النظام**:
 * موعد المناقشة، ولجنتها، ودرجة الطالب. وهذه بيانات لا تُستعاد إن ضاعت —
 * لا من سجلّ ولا من ذاكرة أحد.
 *
 * وثلاث قواعد تحكمه:
 *
 *   **مناقشة واحدة لكل مشروع** — يفرضها `@unique` على `groupId` في المخطّط،
 *   ويفحصها الكود قبلها. والاثنان يجب أن يتّفقا.
 *
 *   **الدرجة بين ٠ و٢٠** — حدٌّ في المخطّط لا في الواجهة، فيُختبَر هنا.
 *
 *   **واللجنة تُستبدَل كاملةً** عند التحديث، لا تُدمَج. سلوكٌ مقصود
 *   وموثَّق، وسهلُ الانقلاب إلى «إضافة» في أوّل إعادة كتابة.
 */
import request from "supertest";
import app from "../../src/app";
import ExcelJS from "exceljs";
import { prisma } from "../../src/core/prisma/client";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  TAG,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let adminToken = "";

const as = (r: request.Test) =>
  r.set("Authorization", `Bearer ${adminToken}`);

const rows = (body: unknown): Record<string, unknown>[] => {
  if (Array.isArray(body)) return body;
  const o = body as Record<string, unknown>;
  for (const v of Object.values(o)) if (Array.isArray(v)) return v;
  return [];
};

const soon = (days = 7) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

/** مشروعٌ جاهز لجدولة مناقشة عليه. */
async function project(title: string) {
  const t = await prisma.graduationTopic.create({
    data: {
      title: `${TAG} ${title}`,
      description: `${TAG} description`,
      maxStudents: 3,
      status: "full",
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
  const group = await prisma.projectGroup.create({ data: { topicId: t.id } });
  const [member] = f.nextStudents(1);
  await prisma.projectMember.create({
    data: { groupId: group.id, studentId: member.id, isLeader: true },
  });
  return { topic: t, group, member };
}

/** مناقشة مجدولة على مشروع جديد. */
async function scheduled(title: string, body: Record<string, unknown> = {}) {
  const { group, topic: t } = await project(title);
  const res = await as(
    request(app)
      .post("/api/admin/defenses")
      .send({ groupId: group.id, date: soon(), room: `${TAG}-A1`, ...body }),
  );
  expect([200, 201]).toContain(res.status);
  const defense = (await prisma.defense.findUnique({
    where: { groupId: group.id },
  }))!;
  return { group, topic: t, defense, res };
}

beforeAll(async () => {
  await teardown();
  f = await seed(60);

  adminToken = (
    await request(app)
      .post("/api/auth/admin/login")
      .send({ email: f.admin.email, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken;
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ الجدولة ═══
//

describe("POST /api/admin/defenses", () => {
  it("مشروعٌ بلا مناقشة ⇒ تُجدوَل بموعدها وقاعتها", async () => {
    const { group } = await project("DEF create");

    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({ groupId: group.id, date: soon(), room: `${TAG}-قاعة 3` }),
    );
    expect([200, 201]).toContain(res.status);

    const saved = await prisma.defense.findUnique({
      where: { groupId: group.id },
    });
    expect(saved).not.toBeNull();
    expect(saved!.room).toBe(`${TAG}-قاعة 3`);
    expect(saved!.status).toBe("scheduled"); // الافتراضي
  });

  /**
   * القاعدة مفروضة طبقتين، ولكلٍّ دورها:
   *
   *   `@unique` على `groupId` هو **الضمان** — لا يسقط أمام طلبين متزامنين.
   *   وفحص الخدمة هو **الرسالة** — يقول «مناقشة مجدولة بالفعل» بدل
   *   «القيمة مستعمَلة» التي يقولها القيد.
   *
   * فالتأكيد الأوّل يحرس الضمان، والثاني يحرس الرسالة. وأثبتُّ ذلك بإزالة
   * فحص الخدمة: المنع بقي (القيد أمسكه) والرسالة وحدها تغيّرت.
   */
  it("ومناقشة ثانية لنفس المشروع ⇒ تُرفض، ولا تُنشأ", async () => {
    const { group } = await scheduled("DEF duplicate");

    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({ groupId: group.id, date: soon(9), room: `${TAG}-B2` }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    expect(
      await prisma.defense.count({ where: { groupId: group.id } }),
    ).toBe(1);
  });

  it("وبرسالةٍ تقول ما المشكلة، لا «القيمة مستعمَلة»", async () => {
    const { group } = await scheduled("DEF duplicate-message");

    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({ groupId: group.id, date: soon(9), room: `${TAG}-B3` }),
    );
    expect(res.body.message).toMatch(/already scheduled|مجدولة/i);
  });

  it("ومشروعٌ غير موجود ⇒ 404", async () => {
    await as(
      request(app).post("/api/admin/defenses").send({
        groupId: "00000000-0000-0000-0000-000000000000",
        date: soon(),
        room: `${TAG}-C3`,
      }),
    ).expect(404);
  });

  it.each([
    ["بلا موعد", { room: `${TAG}-D4` }],
    ["بلا قاعة", { date: soon() }],
    ["بقاعة فارغة", { date: soon(), room: "   " }],
    ["بموعد ليس ISO", { date: "غداً", room: `${TAG}-D4` }],
  ])("و%s ⇒ 400 لا 500", async (_label, partial) => {
    const { group } = await project(`DEF invalid ${_label}`);
    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({ groupId: group.id, ...partial }),
    );
    expect(res.status).toBe(400);
  });
});

//
// ═══ الدرجة ═══
//

describe("الدرجة محدودة بين ٠ و٢٠", () => {
  it.each([[-1], [20.5], [100]])("درجة %s ⇒ 400", async (grade) => {
    const { defense } = await scheduled(`DEF grade ${grade}`);
    const res = await as(
      request(app).patch(`/api/admin/defenses/${defense.id}`).send({ grade }),
    );
    expect(res.status).toBe(400);
  });

  it.each([[0], [12.5], [20]])("ودرجة %s ⇒ تُقبل وتُحفظ", async (grade) => {
    const { defense } = await scheduled(`DEF grade-ok ${grade}`);
    await as(
      request(app).patch(`/api/admin/defenses/${defense.id}`).send({ grade }),
    ).expect(200);

    expect(
      (await prisma.defense.findUnique({ where: { id: defense.id } }))!.grade,
    ).toBe(grade);
  });

  it("والمناقشة تُنشأ بلا درجة — تُوضع بعد الجلسة لا قبلها", async () => {
    const { defense } = await scheduled("DEF no-grade");
    expect(defense.grade).toBeNull();
  });
});

//
// ═══ اللجنة ═══
//

describe("اللجنة", () => {
  it("تُسنَد مع الجدولة بأدوارها", async () => {
    const { group } = await project("DEF committee");

    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({
          groupId: group.id,
          date: soon(),
          room: `${TAG}-E5`,
          committee: [
            { professorId: f.professor.id, role: "president" },
            { professorId: f.professor2.id, role: "examiner" },
          ],
        }),
    );
    expect([200, 201]).toContain(res.status);

    const saved = await prisma.defense.findUnique({
      where: { groupId: group.id },
      include: { committee: true },
    });
    expect(saved!.committee).toHaveLength(2);
    expect(saved!.committee.map((c) => c.role).sort()).toEqual([
      "examiner",
      "president",
    ]);
  });

  it("ودورٌ غير معروف ⇒ 400", async () => {
    const { group } = await project("DEF bad-role");
    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({
          groupId: group.id,
          date: soon(),
          room: `${TAG}-F6`,
          committee: [{ professorId: f.professor.id, role: "chairman" }],
        }),
    );
    expect(res.status).toBe(400);
  });

  it("وأستاذٌ مكرّر في نفس اللجنة ⇒ يُرفض لا ينهار", async () => {
    const { group } = await project("DEF dup-member");
    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({
          groupId: group.id,
          date: soon(),
          room: `${TAG}-G7`,
          committee: [
            { professorId: f.professor.id, role: "president" },
            { professorId: f.professor.id, role: "examiner" },
          ],
        }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  /**
   * كان هذا يردّ **500**: مفتاحٌ أجنبي مخروق (P2003) بلا فرع في معالج
   * الأخطاء. والأثر أوسع من اللجان — كل مسار يقبل معرّفاً من العميل ولا
   * يتحقّق منه بيده: قسمٌ في تخصّص، سنةٌ دراسية، شعبةٌ في تخصّص…
   */
  it("وأستاذٌ غير موجود ⇒ 400 يقول «مرجع غير موجود» لا «خطأ خادم»", async () => {
    const { group } = await project("DEF fk-message");
    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({
          groupId: group.id,
          date: soon(),
          room: `${TAG}-J10`,
          committee: [
            {
              professorId: "00000000-0000-0000-0000-000000000000",
              role: "president",
            },
          ],
        }),
    ).expect(400);

    expect(res.body.message).toContain("مرجع");
    expect(res.body.message).not.toContain("Internal");
  });

  it("وأستاذٌ غير موجود ⇒ يُرفض لا ينهار", async () => {
    const { group } = await project("DEF ghost-member");
    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({
          groupId: group.id,
          date: soon(),
          room: `${TAG}-H8`,
          committee: [
            {
              professorId: "00000000-0000-0000-0000-000000000000",
              role: "president",
            },
          ],
        }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  /**
   * التحديث **يستبدل** اللجنة كاملةً ولا يُضيف إليها. سلوكٌ مقصود وموثَّق في
   * الخدمة، وسهلُ الانقلاب إلى «إضافة» في أوّل إعادة كتابة — فيُثبَّت هنا.
   */
  it("والتحديث يستبدل اللجنة كاملةً لا يُضيف إليها", async () => {
    const { defense } = await scheduled("DEF replace", {
      committee: [
        { professorId: f.professor.id, role: "president" },
        { professorId: f.professor2.id, role: "examiner" },
      ],
    });

    await as(
      request(app)
        .patch(`/api/admin/defenses/${defense.id}`)
        .send({
          committee: [{ professorId: f.professor2.id, role: "president" }],
        }),
    ).expect(200);

    const after = await prisma.defense.findUnique({
      where: { id: defense.id },
      include: { committee: true },
    });
    expect(after!.committee).toHaveLength(1);
    expect(after!.committee[0].professorId).toBe(f.professor2.id);
    expect(after!.committee[0].role).toBe("president");
  });

  it("وتحديثٌ بلا ذكر اللجنة يتركها كما هي", async () => {
    const { defense } = await scheduled("DEF keep-committee", {
      committee: [{ professorId: f.professor.id, role: "president" }],
    });

    await as(
      request(app)
        .patch(`/api/admin/defenses/${defense.id}`)
        .send({ room: `${TAG}-قاعة أخرى` }),
    ).expect(200);

    const after = await prisma.defense.findUnique({
      where: { id: defense.id },
      include: { committee: true },
    });
    expect(after!.committee).toHaveLength(1);
    expect(after!.room).toBe(`${TAG}-قاعة أخرى`);
  });
});

//
// ═══ التحديث والحذف ═══
//

describe("اللجنة — قواعدها تُقال بلسانها", () => {
  it("رئيسان ⇒ 400 برسالةٍ تقول ذلك", async () => {
    const { group } = await project("DEF two-presidents");
    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({
          groupId: group.id,
          date: soon(),
          room: `${TAG}-P2`,
          committee: [
            { professorId: f.professor.id, role: "president" },
            { professorId: f.professor2.id, role: "president" },
          ],
        }),
    ).expect(400);
    expect(JSON.stringify(res.body)).toContain("رئيس");
  });

  it("وأستاذٌ مكرّر ⇒ 400 يقول «مكرّر»", async () => {
    const { group } = await project("DEF dup-message");
    const res = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({
          groupId: group.id,
          date: soon(),
          room: `${TAG}-P3`,
          committee: [
            { professorId: f.professor.id, role: "president" },
            { professorId: f.professor.id, role: "examiner" },
          ],
        }),
    ).expect(400);
    expect(JSON.stringify(res.body)).toContain("مكرّر");
  });

  it("ولجنةٌ مرفوضة في التحديث لا تمحو اللجنة القائمة", async () => {
    const { defense } = await scheduled("DEF atomic-committee", {
      committee: [{ professorId: f.professor.id, role: "president" }],
    });
    await as(
      request(app)
        .patch(`/api/admin/defenses/${defense.id}`)
        .send({
          committee: [
            { professorId: "00000000-0000-0000-0000-000000000000", role: "examiner" },
          ],
        }),
    ).expect(400);
    const seats = await prisma.defenseCommitteeMember.findMany({
      where: { defenseId: defense.id },
    });
    expect(seats).toHaveLength(1);
  });
});

describe("المناقشة تُعلم أهلها", () => {
  it("الجدولة تصل الطالب والمشرف وعضو اللجنة، كلٌّ برابط فضائه", async () => {
    const { group, member } = await project("DEF notify-create");
    await as(
      request(app)
        .post("/api/admin/defenses")
        .send({
          groupId: group.id,
          date: soon(),
          room: `${TAG}-N1`,
          committee: [{ professorId: f.professor2.id, role: "examiner" }],
        }),
    ).expect(201);

    const studentUser = (await prisma.student.findUnique({ where: { id: member.id } }))!.userId;
    const notes = await prisma.notification.findMany({
      where: {
        type: "defense_scheduled",
        message: { contains: `${TAG}-N1` },
      },
    });
    const byUser = new Map(notes.map((n) => [n.userId, n.link]));
    expect(byUser.get(studentUser)).toBe("/student/project");
    expect(byUser.get(f.professor.userId)).toBe(`/professor/groups/${group.id}`);
    expect(byUser.get(f.professor2.userId)).toBe("/professor");
  });

  it("وتغيير القاعة يُعلَن، وتصحيح الملاحظة لا", async () => {
    const { defense } = await scheduled("DEF notify-update");
    const count = () =>
      prisma.notification.count({ where: { title: "تغيّر موعد المناقشة", userId: f.professor.userId } });
    const before = await count();

    await as(request(app).patch(`/api/admin/defenses/${defense.id}`).send({ notes: "x" })).expect(200);
    expect(await count()).toBe(before);

    await as(
      request(app).patch(`/api/admin/defenses/${defense.id}`).send({ room: `${TAG}-N2` }),
    ).expect(200);
    expect(await count()).toBe(before + 1);
  });

  it("والدرجة تُمحى بـ null", async () => {
    const { defense } = await scheduled("DEF clear-grade", { grade: 14 });
    await as(request(app).patch(`/api/admin/defenses/${defense.id}`).send({ grade: null })).expect(200);
    expect((await prisma.defense.findUnique({ where: { id: defense.id } }))!.grade).toBeNull();
  });
});

describe("PATCH /api/admin/defenses/:id", () => {
  it("يُغيّر الموعد والقاعة والحالة", async () => {
    const { defense } = await scheduled("DEF update");
    const newDate = soon(20);

    await as(
      request(app).patch(`/api/admin/defenses/${defense.id}`).send({
        date: newDate,
        room: `${TAG}-قاعة جديدة`,
        status: "completed",
      }),
    ).expect(200);

    const after = (await prisma.defense.findUnique({
      where: { id: defense.id },
    }))!;
    expect(after.room).toBe(`${TAG}-قاعة جديدة`);
    expect(after.status).toBe("completed");
    expect(after.date.toISOString()).toBe(newDate);
  });

  it("وحالةٌ غير معروفة ⇒ 400", async () => {
    const { defense } = await scheduled("DEF bad-status");
    const res = await as(
      request(app)
        .patch(`/api/admin/defenses/${defense.id}`)
        .send({ status: "postponed" }),
    );
    expect(res.status).toBe(400);
  });

  it("ومناقشة غير موجودة ⇒ 404", async () => {
    await as(
      request(app)
        .patch("/api/admin/defenses/00000000-0000-0000-0000-000000000000")
        .send({ room: `${TAG}-X` }),
    ).expect(404);
  });
});

describe("DELETE /api/admin/defenses/:id", () => {
  it("يحذفها ويحذف لجنتها معها، ولا يمسّ المشروع", async () => {
    const { defense, group } = await scheduled("DEF delete", {
      committee: [
        { professorId: f.professor.id, role: "president" },
        { professorId: f.professor2.id, role: "examiner" },
      ],
    });

    await as(request(app).delete(`/api/admin/defenses/${defense.id}`)).expect(
      200,
    );

    expect(
      await prisma.defense.findUnique({ where: { id: defense.id } }),
    ).toBeNull();
    // اللجنة تتعاقب بـonDelete: Cascade — ولا صفّ يتيم يبقى.
    expect(
      await prisma.defenseCommitteeMember.count({
        where: { defenseId: defense.id },
      }),
    ).toBe(0);
    // والمشروع باقٍ: حذف المناقشة ليس حذفاً للمشروع.
    expect(
      await prisma.projectGroup.findUnique({ where: { id: group.id } }),
    ).not.toBeNull();
  });

  it("ومناقشة غير موجودة ⇒ 404", async () => {
    await as(
      request(app).delete(
        "/api/admin/defenses/00000000-0000-0000-0000-000000000000",
      ),
    ).expect(404);
  });

  /** بعد الحذف يصير المشروع قابلاً للجدولة ثانيةً — لا يبقى محجوزاً. */
  it("وبعد الحذف يُجدوَل المشروع من جديد", async () => {
    const { defense, group } = await scheduled("DEF reschedule");

    await as(request(app).delete(`/api/admin/defenses/${defense.id}`)).expect(
      200,
    );

    const again = await as(
      request(app)
        .post("/api/admin/defenses")
        .send({ groupId: group.id, date: soon(30), room: `${TAG}-I9` }),
    );
    expect([200, 201]).toContain(again.status);
  });
});

//
// ═══ القائمة ═══
//

describe("GET /api/admin/defenses", () => {
  it("تعرض المناقشات بمشاريعها ولجانها", async () => {
    const { topic: t } = await scheduled("DEF listed", {
      committee: [{ professorId: f.professor.id, role: "president" }],
    });

    const res = await as(request(app).get("/api/admin/defenses")).expect(200);
    const body = JSON.stringify(res.body);

    expect(body).toContain(t.title);
    expect(rows(res.body).length).toBeGreaterThan(0);
  });

  it("ولا تُسرّب كلمات سرّ أعضاء اللجنة", async () => {
    await scheduled("DEF no-secrets", {
      committee: [{ professorId: f.professor.id, role: "president" }],
    });

    const res = await as(request(app).get("/api/admin/defenses")).expect(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("$2a$");
    expect(body).not.toContain("$2b$");
    expect(body).not.toContain("password");
  });
});

//
// ═══ الترابط مع الفسخ ═══
//

describe("المناقشة تحمي المشروع من الفسخ", () => {
  /**
   * الرابط بين المجالين: مشروعٌ له مناقشة مبرمجة لا يُفسَخ — لأن الفسخ
   * يمحوها ومعها قرار لجنة. وهذا التأكيد يحرس الطرفين معاً.
   */
  it("مشروعٌ له مناقشة لا يُفسَخ، وبعد حذفها يُفسَخ", async () => {
    const { defense, group } = await scheduled("DEF blocks-dissolve");

    const blocked = await as(
      request(app).delete(`/api/admin/projects/${group.id}`),
    ).expect(400);
    expect(blocked.body.message).toContain("مناقشة");

    await as(request(app).delete(`/api/admin/defenses/${defense.id}`)).expect(
      200,
    );

    await as(request(app).delete(`/api/admin/projects/${group.id}`)).expect(200);
  });
});


//
// ═══ الجدول: البحث والتصفية والأرقام والتعارض والتصدير ═══
//

describe("GET /api/admin/defenses — التصفية والأرقام", () => {
  it("البحث بعنوان الموضوع وبالقاعة يصل الخادم فعلاً", async () => {
    const { group } = await scheduled("DEF search-needle", { room: `${TAG}-NEEDLE` });
    const byTitle = await as(request(app).get("/api/admin/defenses").query({ search: "search-needle" })).expect(200);
    expect(byTitle.body.items.map((d: any) => d.groupId)).toContain(group.id);
    const byRoom = await as(request(app).get("/api/admin/defenses").query({ search: `${TAG}-NEEDLE` })).expect(200);
    expect(byRoom.body.items.every((d: any) => d.room === `${TAG}-NEEDLE` || d.group.topic.title.includes("NEEDLE"))).toBe(true);
    expect(byRoom.body.items.length).toBeGreaterThan(0);
  });

  it("«فات موعدها» = مبرمجة وتاريخها مضى، و«بلا لجنة» تُصفّى", async () => {
    const { group } = await project("DEF stale");
    await as(
      request(app)
        .post("/api/admin/defenses")
        .send({ groupId: group.id, date: new Date(Date.now() - 2 * 86_400_000).toISOString(), room: `${TAG}-OLD` }),
    ).expect(201);

    const stale = await as(request(app).get("/api/admin/defenses").query({ when: "stale", limit: 100 })).expect(200);
    expect(stale.body.items.map((d: any) => d.groupId)).toContain(group.id);
    expect(stale.body.items.every((d: any) => d.status === "scheduled" && new Date(d.date) < new Date())).toBe(true);

    const noJury = await as(request(app).get("/api/admin/defenses").query({ issue: "noCommittee", limit: 100 })).expect(200);
    expect(noJury.body.items.map((d: any) => d.groupId)).toContain(group.id);
    expect(noJury.body.items.every((d: any) => d.committee.length === 0)).toBe(true);
  });

  it("والأرقام من الجدول كلّه لا من الصفحة", async () => {
    const res = await as(request(app).get("/api/admin/defenses").query({ limit: 1 })).expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.stats.total).toBe(await prisma.defense.count());
    expect(res.body.stats.stale).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.stats.readyToSchedule).toBe("number");
  });

  it("والمدّة تُحفظ، ونهاية الجلسة تُحسب منها", async () => {
    const { defense } = await scheduled("DEF duration", { durationMinutes: 90 });
    expect(defense.durationMinutes).toBe(90);
    const res = await as(request(app).get("/api/admin/defenses").query({ search: "DEF duration" })).expect(200);
    const d = res.body.items[0];
    expect(new Date(d.endsAt).getTime() - new Date(d.date).getTime()).toBe(90 * 60_000);
  });
});

describe("التعارض: القاعة نفسها أو عضو اللجنة نفسه في وقتٍ متداخل", () => {
  const at = new Date(Date.now() + 30 * 86_400_000);
  at.setHours(9, 0, 0, 0);

  it("يُكشف قبل الحفظ، ولا يتعارض الموعد مع نفسه", async () => {
    const { defense } = await scheduled("DEF clash-a", {
      date: at.toISOString(),
      room: `${TAG}-CLASH`,
      durationMinutes: 60,
      committee: [{ professorId: f.professor2.id, role: "president" }],
    });

    // 09:30 في القاعة نفسها ⇒ تعارض قاعة
    const half = new Date(at.getTime() + 30 * 60_000).toISOString();
    const room = await as(request(app).get("/api/admin/defenses/conflicts").query({ date: half, room: `${TAG}-clash` })).expect(200);
    expect(room.body.room.map((c: any) => c.id)).toContain(defense.id);

    // قاعةٌ أخرى، لكن بعضو اللجنة نفسه ⇒ تعارض أستاذ
    const prof = await as(
      request(app).get("/api/admin/defenses/conflicts").query({ date: half, room: `${TAG}-OTHER`, professorIds: f.professor2.id }),
    ).expect(200);
    expect(prof.body.room).toHaveLength(0);
    expect(prof.body.professors[0]).toMatchObject({ id: defense.id, professorId: f.professor2.id });

    // 10:00 تماماً ⇒ تتلو الأولى ولا تتعارض معها
    const after = new Date(at.getTime() + 60 * 60_000).toISOString();
    const none = await as(request(app).get("/api/admin/defenses/conflicts").query({ date: after, room: `${TAG}-CLASH` })).expect(200);
    expect(none.body.room).toHaveLength(0);

    // وتعديل المناقشة نفسها لا يتعارض معها
    const self = await as(
      request(app).get("/api/admin/defenses/conflicts").query({ date: at.toISOString(), room: `${TAG}-CLASH`, excludeId: defense.id }),
    ).expect(200);
    expect(self.body.room).toHaveLength(0);
  });

  it("والقائمة تحمل التعارض على المناقشتين معاً", async () => {
    const other = await scheduled("DEF clash-b", {
      date: new Date(at.getTime() + 15 * 60_000).toISOString(),
      room: `${TAG}-CLASH`,
    });
    const res = await as(request(app).get("/api/admin/defenses").query({ search: "DEF clash", limit: 100 })).expect(200);
    const b = res.body.items.find((d: any) => d.id === other.defense.id);
    expect(b.clashes.room.length).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/admin/defenses/export", () => {
  it("يُعيد ملف Excel بالجدول المُصفّى", async () => {
    const res = await as(request(app).get("/api/admin/defenses/export").query({ search: "DEF" }))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as Buffer);
    const ws = wb.getWorksheet("المناقشات")!;
    expect(ws.getRow(1).getCell(6).value).toBe("الموضوع");
    expect(ws.rowCount).toBeGreaterThan(1);
  });

  it("والتصدير والتعارض للإدارة وحدها", async () => {
    await request(app).get("/api/admin/defenses/export").expect(401);
  });
});


describe("GET /api/admin/defenses/:id — التفاصيل", () => {
  it("تحمل الفريق واللجنة والتقدّم ويوم القاعة، بلا كلمات سرّ", async () => {
    const at = new Date(Date.now() + 40 * 86_400_000);
    at.setHours(10, 0, 0, 0);
    const first = await scheduled("DEF detail-a", {
      date: at.toISOString(),
      room: `${TAG}-DAY`,
      committee: [{ professorId: f.professor2.id, role: "president" }],
    });
    const later = await scheduled("DEF detail-b", {
      date: new Date(at.getTime() + 2 * 60 * 60_000).toISOString(),
      room: `${TAG}-DAY`,
    });

    const res = await as(request(app).get(`/api/admin/defenses/${first.defense.id}`)).expect(200);
    const d = res.body.defense;
    expect(d.group.topic.title).toContain("DEF detail-a");
    expect(d.group.members[0].student.registrationNumber).toBeTruthy();
    expect(d.committee[0].professor.user.firstName).toBeTruthy();
    expect(d.progress).toEqual({ total: 0, completed: 0, late: 0, submissions: 0 });
    expect(d.roomDay.map((r: any) => r.id)).toEqual([first.defense.id, later.defense.id]);
    expect(d.roomDay[0].current).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("password");

    await as(request(app).get("/api/admin/defenses/00000000-0000-0000-0000-000000000000")).expect(404);
  });
});
