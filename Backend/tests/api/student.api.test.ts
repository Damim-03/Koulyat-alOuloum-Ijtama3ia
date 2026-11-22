/**
 * وجه الطالب — التصفّح وطلب المجموعة والمشروع.
 *
 * سبعة مسارات فقط، لكنها **كل ما يراه الطالب من النظام**. ومنطقها مُختبَر
 * جزئياً في اختبارات التكامل التي تستدعي الخدمات مباشرة — أمّا هذه فتمرّ
 * بالـHTTP كاملاً: الترشيح والتحقّق من المدخلات وشكل الردّ.
 *
 * وثلاثة أسئلة تحكم الوحدة كلّها:
 *
 *   ماذا يرى الطالب؟ — المتاح وحده، لا المؤرشف ولا المحجوز ولا قيد الانتظار
 *   ماذا يستطيع؟   — طلبٌ واحد على موضوع متاح، بفريق صحيح
 *   وماذا يملك؟    — طلبه هو ومشروعه هو، لا طلب غيره
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { signAccessToken } from "../../src/core/auth/tokens";
import { tr } from "../../src/core/i18n";
import { lookupStudentByRegistrationService } from "../../src/modules/student/student.service";
// الرفضُ يُستدعى من خدمته لا بمحاكاته: المحاكاةُ تُثبّت افتراضَ كاتب
// الاختبار، والسقفُ إنّما يُقاس على ما يفعله مسارُ الإدارة الحقيقيّ.
import {
  acceptGroupRequestService,
  rejectGroupRequestService,
} from "../../src/modules/admin/admin.service";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  TAG,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
const tok: Record<string, string> = {};

const as = (r: request.Test, who: string) =>
  r.set("Authorization", `Bearer ${tok[who]}`);

const login = async (reg: string) =>
  (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken as string;

/** موضوعٌ بالحالة المطلوبة على تخصّص الطلبة. */
async function topic(
  title: string,
  status: string,
  maxStudents = 3,
  maxRequests: number | null = null,
) {
  return prisma.graduationTopic.create({
    data: {
      title: `${TAG} ${title}`,
      description: `${TAG} description`,
      maxStudents,
      maxRequests,
      status: status as never,
      publishedAt: status === "open" ? new Date() : null,
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
}

const rows = (body: unknown): Record<string, unknown>[] => {
  if (Array.isArray(body)) return body;
  const o = body as Record<string, unknown>;
  for (const v of Object.values(o)) if (Array.isArray(v)) return v;
  return [];
};
const ids = (body: unknown) => rows(body).map((r) => r.id as string);

let me: { id: string; userId: string; reg: string };
let mate: { id: string; userId: string; reg: string };
let stranger: { id: string; userId: string; reg: string };

beforeAll(async () => {
  await teardown();
  f = await seed(90);
  [me, mate, stranger] = f.nextStudents(3);

  tok.me = await login(me.reg);
  tok.mate = await login(mate.reg);
  tok.stranger = await login(stranger.reg);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ التصفّح: ماذا يرى الطالب ═══
//

describe("GET /api/student/topics", () => {
  it("يعرض المتاح — المعتمَد والمنشور", async () => {
    const approved = await topic("STU approved", "approved");
    const open = await topic("STU open", "open");

    const res = await as(request(app).get("/api/student/topics"), "me").expect(
      200,
    );
    expect(ids(res.body)).toEqual(
      expect.arrayContaining([approved.id, open.id]),
    );
  });

  it.each([
    ["pending", "قيد الانتظار"],
    ["rejected", "مرفوض"],
    ["archived", "مؤرشف"],
  ])("ولا يعرض ما هو %s", async (status) => {
    const hidden = await topic(`STU hidden-${status}`, status);

    const res = await as(request(app).get("/api/student/topics"), "me").expect(
      200,
    );
    expect(ids(res.body)).not.toContain(hidden.id);
  });

  /**
   * الموضوعُ المنشور تتقدّم إليه الفرق معاً حتى سقفه: طلبٌ معلّقٌ عليه لا
   * يُخفيه ما دام دون السقف، ويُخفيه حين يكتمل.
   */
  it("ولا يعرض موضوعاً اكتملت طلباته عند سقفه", async () => {
    const taken = await topic("STU claimed", "open", 3, 1);
    await as(
      request(app)
        .post("/api/student/group-requests")
        .send({
          topicId: taken.id,
          memberRegistrationNumbers: [mate.reg],
          priority: 1,
        }),
      "me",
    ).expect(201);

    const res = await as(
      request(app).get("/api/student/topics"),
      "stranger",
    ).expect(200);
    expect(ids(res.body)).not.toContain(taken.id);
  });

  it("ويعرض ما يزال دون سقفه وإن كان عليه طلب", async () => {
    const t = await topic("STU under-cap", "open", 3, 2);
    const [a] = f.nextStudents(1);
    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${await login(a!.reg)}`)
      .send({ topicId: t.id, memberRegistrationNumbers: [], priority: 1 })
      .expect(201);

    const res = await as(request(app).get("/api/student/topics"), "stranger").expect(200);
    expect(ids(res.body)).toContain(t.id);
  });

  it("ويُرشّح بالتخصّص والبحث", async () => {
    const t = await topic("STU searchable-xyzzy", "open");

    const bySearch = await as(
      request(app).get("/api/student/topics").query({ search: "xyzzy" }),
      "me",
    ).expect(200);
    expect(ids(bySearch.body)).toContain(t.id);

    const bySpec = await as(
      request(app)
        .get("/api/student/topics")
        .query({ specializationId: "00000000-0000-0000-0000-000000000000" }),
      "me",
    ).expect(200);
    expect(ids(bySpec.body)).not.toContain(t.id);
  });
});

describe("GET /api/student/topics/:id", () => {
  it("موضوع متاح ⇒ 200", async () => {
    const t = await topic("STU detail", "open");
    await as(request(app).get(`/api/student/topics/${t.id}`), "me").expect(200);
  });

  /** موضوع لم يُعتمد بعد ليس للطالب أن يراه ولو بالرابط المباشر. */
  it("وموضوع قيد الانتظار ⇒ يُرفض ولو بالرابط المباشر", async () => {
    const t = await topic("STU detail-pending", "pending");
    const res = await as(
      request(app).get(`/api/student/topics/${t.id}`),
      "me",
    );
    expect([401, 403, 404]).toContain(res.status);
  });

  it("وموضوع غير موجود ⇒ 404", async () => {
    await as(
      request(app).get(
        "/api/student/topics/00000000-0000-0000-0000-000000000000",
      ),
      "me",
    ).expect(404);
  });
});

//
// ═══ البحث عن زميل ═══
//

describe("GET /api/student/students/lookup", () => {
  it("رقم تسجيل موجود ⇒ اسمٌ ورقم، بلا بريد ولا كلمة سرّ", async () => {
    const res = await as(
      request(app).get("/api/student/students/lookup").query({ registration: mate.reg }),
      "me",
    ).expect(200);

    const body = JSON.stringify(res.body);
    expect(body).toContain(mate.reg);
    expect(body).not.toContain("password");
    expect(body).not.toContain("$2a$");
    expect(body).not.toContain("@test.local");
    expect(res.body.student.isSelf).toBe(false);
  });

  /** رقمي أنا ⇒ يُعلَّم، فيُرفض في المقعد قبل أن يصل الإرسال. */
  it("ورقمي أنا ⇒ isSelf", async () => {
    const res = await as(
      request(app).get("/api/student/students/lookup").query({ registration: me.reg }),
      "me",
    ).expect(200);
    expect(res.body.student.isSelf).toBe(true);
  });

  /**
   * زميلٌ في طلبٍ حيٍّ لفريقٍ آخر يُعلَّم، فيُرفض في مقعده قبل الإرسال.
   * أمّا طلباتُ المرسِل نفسه على مواضيع أخرى فلا تُعدّ: الفريقُ نفسه.
   */
  it("وزميلٌ في مجموعةٍ أخرى ⇒ otherGroup: request، ولمرسِلها لا شيء", async () => {
    const t = await topic("STU lookup-other-team", "open");
    const [lead, member, outsider] = f.nextStudents(3);
    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${await login(lead!.reg)}`)
      .send({ topicId: t.id, memberRegistrationNumbers: [member!.reg], priority: 1 })
      .expect(201);

    const look = async (asReg: string) =>
      (
        await request(app)
          .get("/api/student/students/lookup")
          .set("Authorization", `Bearer ${await login(asReg)}`)
          .query({ registration: member!.reg })
          .expect(200)
      ).body.student;

    expect((await look(outsider!.reg)).otherGroup).toBe("request");
    expect((await look(lead!.reg)).otherGroup).toBeNull();
  });

  it("وطالبٌ له مشروع ⇒ otherGroup: project", async () => {
    const t = await topic("STU lookup-project", "full");
    const group = await prisma.projectGroup.create({ data: { topicId: t.id } });
    const [placed] = f.nextStudents(1);
    await prisma.projectMember.create({
      data: { groupId: group.id, studentId: placed!.id, isLeader: true },
    });

    const res = await as(
      request(app)
        .get("/api/student/students/lookup")
        .query({ registration: placed!.reg }),
      "me",
    ).expect(200);
    expect(res.body.student.otherGroup).toBe("project");
  });

  it("ورقم غير موجود ⇒ 200 بنتيجة فارغة لا خطأ", async () => {
    const res = await as(
      request(app)
        .get("/api/student/students/lookup")
        .query({ registration: `${TAG}-NOBODY` }),
      "me",
    ).expect(200);
    expect(JSON.stringify(res.body)).not.toContain(`${TAG}-NOBODY`);
  });

  it("ورقم فارغ ⇒ 400", async () => {
    const res = await as(
      request(app).get("/api/student/students/lookup").query({ registration: "" }),
      "me",
    );
    expect([400, 422]).toContain(res.status);
  });
});

//
// ═══ طلب المجموعة ═══
//

describe("POST /api/student/group-requests", () => {
  it("موضوع متاح وفريق صحيح ⇒ 201، ويحجز الموضوع", async () => {
    const t = await topic("STU request-ok", "open");

    const res = await as(
      request(app)
        .post("/api/student/group-requests")
        .send({
          topicId: t.id,
          memberRegistrationNumbers: [mate.reg],
          priority: 1,
        }),
      "me",
    ).expect(201);

    const created = await prisma.groupRequest.findFirst({
      where: { topicId: t.id },
    });
    expect(created?.status).toBe("pending");
    expect(created?.leaderStudentId).toBe(me.id);
    // عدّادُ السقف يتحرّك مع الطلب.
    expect(
      (await prisma.graduationTopic.findUniqueOrThrow({ where: { id: t.id } })).pendingRequestCount,
    ).toBe(1);
    expect(res.body).toBeTruthy();
  });

  /**
   * الرفضُ يُعيد الخانة.
   *
   * الموضوعُ بعد الرفض حُرٌّ كما كان: لا فريقَ عليه ولا حجز. فلا معنى
   * لخانةٍ تبقى محجوزةً لمحاولةٍ انتهت.
   *
   * وأثرُ ذلك أنّ السقف يحدّ **المعلَّق** لا المتراكم: كم فريقاً ينتظر
   * القرار معاً.
   */
  it("ورفضُ الطلب يُعيد خانته إلى السقف، ويُبقي أثره", async () => {
    const t = await topic("STU cap frees", "open", 3, 2);
    const [a, b, c] = f.nextStudents(3);

    const send = async (reg: string) =>
      request(app)
        .post("/api/student/group-requests")
        .set("Authorization", `Bearer ${await login(reg)}`)
        .send({
          topicId: t.id,
          memberRegistrationNumbers: [],
          priority: 1,
        });

    const rejectLive = async () => {
      const live = await prisma.groupRequest.findFirstOrThrow({
        where: { topicId: t.id, status: "pending" },
      });
      await rejectGroupRequestService(live.id, "اختبار السقف");
    };

    const counted = async () =>
      (await prisma.graduationTopic.findUniqueOrThrow({ where: { id: t.id } })).pendingRequestCount;

    expect((await send(a!.reg)).status).toBe(201);
    expect(await counted()).toBe(1);

    await rejectLive();
    expect(await counted()).toBe(0); // الخانة عادت

    expect((await send(b!.reg)).status).toBe(201);
    await rejectLive();
    expect(await counted()).toBe(0);

    // ولا يُردّ ثالثٌ بحجّة السقف: المرفوضان لا يشغلان شيئاً.
    expect((await send(c!.reg)).status).toBe(201);

    // والصفوفُ الثلاثة باقية — الأثرُ لا يذهب، إنّما يخرج من الحساب.
    expect(
      await prisma.groupRequest.count({ where: { topicId: t.id } }),
    ).toBe(3);
  });

  it("وموضوعٌ بلا سقف لا يُردّ عليه شيء", async () => {
    const t = await topic("STU no-cap", "open");
    const [a, b] = f.nextStudents(2);

    const send = async (reg: string) =>
      request(app)
        .post("/api/student/group-requests")
        .set("Authorization", `Bearer ${await login(reg)}`)
        .send({ topicId: t.id, memberRegistrationNumbers: [], priority: 1 });

    expect((await send(a!.reg)).status).toBe(201);
    const live = await prisma.groupRequest.findFirstOrThrow({
      where: { topicId: t.id, status: "pending" },
    });
    await rejectGroupRequestService(live.id, "اختبار");
    expect((await send(b!.reg)).status).toBe(201);
  });

  /**
   * الرفضُ ليس باباً مغلقاً.
   *
   * قد يكون لنقصٍ يُستدرك — عضوٌ ناقص أو ورقةٌ لم تُرفق — وقد يكون خطأً من
   * الإدارة نفسها. وكان الفريدُ المركَّب `(leaderStudentId, topicId)` يمنع
   * المرسِل من المحاولة ثانيةً إلى الأبد يوم صار الرفضُ يُبقي الصفّ. والذي
   * يحدّ التكرار هو سقفُ المحاولات لا إغلاقُ الباب.
   */
  it("وإعادةُ الطلب بعد الرفض مسموحة، وتُحسب محاولةً جديدة", async () => {
    const t = await topic("STU re-request", "open");
    const [a] = f.nextStudents(1);
    const token = await login(a!.reg);

    const send = () =>
      request(app)
        .post("/api/student/group-requests")
        .set("Authorization", `Bearer ${token}`)
        .send({ topicId: t.id, memberRegistrationNumbers: [], priority: 1 });

    expect((await send()).status).toBe(201);

    const live = await prisma.groupRequest.findFirstOrThrow({
      where: { topicId: t.id, status: "pending" },
    });
    await rejectGroupRequestService(live.id, "الفريق غير مكتمل");

    // نفس المرسِل على نفس الموضوع ⇒ مقبول.
    expect((await send()).status).toBe(201);

    // والمرفوضُ باقٍ معه: محاولتان لا واحدة.
    expect(
      await prisma.groupRequest.count({ where: { topicId: t.id } }),
    ).toBe(2);
  });

  /**
   * طلبٌ واحدٌ لكلّ مجموعة على الموضوع — من أيّ أعضائها جاء.
   *
   * وكان الفحصُ على المرسِل وحده، فالعضوُ يُردّ بـ«هذا الموضوع محجوز
   * بالفعل» — وهو محجوزٌ لفريقه هو. فيبحث عمّن سبقه ولا أحد، أو يظنّ
   * أنّ فريقاً آخر خطف الموضوع.
   */
  it("وعضوُ الفريق يُردّ برسالةٍ تقول إنّ فريقه هو المرسِل", async () => {
    const t = await topic("STU one-per-group", "open");
    const [a, b] = f.nextStudents(2);

    const send = async (reg: string, mates: string[]) =>
      request(app)
        .post("/api/student/group-requests")
        .set("Authorization", `Bearer ${await login(reg)}`)
        .send({
          topicId: t.id,
          memberRegistrationNumbers: mates,
          priority: 1,
        });

    expect((await send(a!.reg, [b!.reg])).status).toBe(201);

    // العضوُ لا المرسِل.
    const byMate = await send(b!.reg, [a!.reg]);
    expect(byMate.status).toBe(400);
    const msg = JSON.stringify(byMate.body);
    expect(msg).toContain("أرسل فريقك طلباً");
    expect(msg).not.toContain("محجوز بالفعل");

    // ولم يُنشأ صفٌّ ثانٍ.
    expect(
      await prisma.groupRequest.count({ where: { topicId: t.id } }),
    ).toBe(1);
  });

  /**
   * وطلبي الحيّ يُردّ برسالةٍ تخصّني: «لك طلبٌ…» لا «محجوز بالفعل».
   *
   * الموضوع محجوزٌ فعلاً — لكنّه محجوزٌ لي أنا. والرسالةُ العامّة تدفع
   * صاحبَها إلى البحث عمّن سبقه ولا أحد.
   */
  it("وطلبي الحيّ يُردّ برسالةٍ تقول إنّه لي وبانتظار القرار", async () => {
    const t = await topic("STU pending-msg", "open");
    const [a] = f.nextStudents(1);
    const token = await login(a!.reg);

    const send = () =>
      request(app)
        .post("/api/student/group-requests")
        .set("Authorization", `Bearer ${token}`)
        .send({ topicId: t.id, memberRegistrationNumbers: [], priority: 1 });

    expect((await send()).status).toBe(201);

    const again = await send();
    expect(again.status).toBe(400);
    const body = JSON.stringify(again.body);
    expect(body).toContain("بانتظار قرار الإدارة");
    expect(body).not.toContain("محجوز بالفعل");
  });

  /**
   * الإلغاءُ يُعيد الخانة.
   *
   * الطالبُ سحب طلبه قبل أن يُبَتّ فيه — فلا محاولةَ جرت ولا قرارَ صدر.
   * ولو بقيت خانتُه مشغولةً لأغلق موضوعاً بسقفِ واحدٍ على الناس جميعاً
   * بطلبٍ تراجع عنه صاحبُه في دقيقته الأولى.
   */
  it("وإلغاءُ الطالب لطلبه يُعيد الخانة إلى السقف", async () => {
    const t = await topic("STU cancel frees", "open", 3, 1);
    const [a, b] = f.nextStudents(2);

    const send = async (reg: string) =>
      request(app)
        .post("/api/student/group-requests")
        .set("Authorization", `Bearer ${await login(reg)}`)
        .send({ topicId: t.id, memberRegistrationNumbers: [], priority: 1 });

    const created = await send(a!.reg);
    expect(created.status).toBe(201);

    const mine = await prisma.groupRequest.findFirstOrThrow({
      where: { topicId: t.id },
    });
    await request(app)
      .delete(`/api/student/group-requests/${mine.id}`)
      .set("Authorization", `Bearer ${await login(a!.reg)}`)
      .expect(200);

    // السقفُ واحد، ولولا تحرّر الخانة لَما مرّ هذا.
    expect((await send(b!.reg)).status).toBe(201);
  });

  it("وموضوعٌ اكتملت طلباته عند سقفه ⇒ 400 برسالة السقف", async () => {
    const t = await topic("STU request-taken", "open", 3, 1);
    const [a, b, c] = f.nextStudents(3);
    const first = await login(a.reg);

    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${first}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [b.reg],
        priority: 1,
      })
      .expect(201);

    const second = await login(c.reg);
    const res = await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${second}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [],
        priority: 1,
      });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("اكتمل عدد الطلبات");
  });

  it.each([["pending"], ["rejected"], ["archived"]])(
    "وموضوع %s لا يُطلَب",
    async (status) => {
      const t = await topic(`STU request-${status}`, status);
      const [x, y] = f.nextStudents(2);
      const who = await login(x.reg);

      const res = await request(app)
        .post("/api/student/group-requests")
        .set("Authorization", `Bearer ${who}`)
        .send({
          topicId: t.id,
          memberRegistrationNumbers: [y.reg],
          priority: 1,
        });
      expect(res.status).toBe(400);
    },
  );

  it("ورقم تسجيل غير موجود بين الأعضاء ⇒ 400", async () => {
    const t = await topic("STU request-badmember", "open");
    const [x] = f.nextStudents(1);
    const who = await login(x.reg);

    const res = await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${who}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [`${TAG}-GHOST`],
        priority: 1,
      });
    expect(res.status).toBe(400);
  });

  /**
   * المرسِل يُضاف تلقائيًا، فرقمُه في خانة زميلٍ خطأٌ أو تلاعب.
   *
   * وكان يُسقَط بصمتٍ عند توحيد الأعضاء فيمرّ الطلب. والردّ الآن صريح، ولا
   * يُنشأ شيءٌ ولا يُحجز الموضوع.
   */
  it("ورقمُ المرسِل نفسه بين الزملاء ⇒ 400، ولا يُحجز الموضوع", async () => {
    const t = await topic("STU request-self", "open");
    const [x, y] = f.nextStudents(2);
    const who = await login(x.reg);

    const res = await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${who}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [y.reg, ` ${x.reg} `],
        priority: 1,
      });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("رقم تسجيلك");
    expect(
      await prisma.groupRequest.count({ where: { topicId: t.id } }),
    ).toBe(0);
  });

  /**
   * طالبٌ واحد في مجموعةٍ واحدة.
   *
   * كان المسار يقبل زميلاً هو في طلبٍ حيٍّ لفريقٍ آخر — فلو قُبل الطلبان
   * لصار له مشروعان. والرفضُ يُحرّره: الطلبُ المرفوض انتهى ولا يحبس أحداً.
   */
  describe("زميلٌ في مجموعةٍ أخرى", () => {
    const send = async (leaderReg: string, topicId: string, mates: string[], priority = 1) =>
      request(app)
        .post("/api/student/group-requests")
        .set("Authorization", `Bearer ${await login(leaderReg)}`)
        .send({ topicId, memberRegistrationNumbers: mates, priority });

    it("في طلبٍ حيٍّ لفريقٍ آخر ⇒ 400، ويُقبل بعد رفض ذاك الطلب", async () => {
      const first = await topic("STU busy-first", "open");
      const second = await topic("STU busy-second", "open");
      const [a, b, c] = f.nextStudents(3);

      expect((await send(a!.reg, first.id, [b!.reg])).status).toBe(201);

      const res = await send(c!.reg, second.id, [b!.reg]);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain("مجموعة أخرى");
      expect(
        await prisma.groupRequest.count({ where: { topicId: second.id } }),
      ).toBe(0);

      const live = await prisma.groupRequest.findFirstOrThrow({
        where: { topicId: first.id, status: "pending" },
      });
      await rejectGroupRequestService(live.id, "اختبار");
      expect((await send(c!.reg, second.id, [b!.reg])).status).toBe(201);
    });

    it("وله مشروع ⇒ 400", async () => {
      const done = await topic("STU busy-project", "full");
      const group = await prisma.projectGroup.create({ data: { topicId: done.id } });
      const t = await topic("STU busy-project-next", "open");
      const [a, placed] = f.nextStudents(2);
      await prisma.projectMember.create({
        data: { groupId: group.id, studentId: placed!.id, isLeader: true },
      });

      const res = await send(a!.reg, t.id, [placed!.reg]);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain("مذكرة تخرّج");
    });

    /** الأولويات: الفريقُ نفسه يطلب موضوعاً ثانياً بالزملاء أنفسهم. */
    it("والفريقُ نفسه على موضوعٍ ثانٍ بأولويةٍ أخرى ⇒ 201", async () => {
      const first = await topic("STU same-team-1", "open");
      const second = await topic("STU same-team-2", "open");
      const [a, b] = f.nextStudents(2);

      expect((await send(a!.reg, first.id, [b!.reg], 1)).status).toBe(201);
      expect((await send(a!.reg, second.id, [b!.reg], 2)).status).toBe(201);
    });

    /**
     * والمرسِل يُفحص كزملائه. كان الفحص على الزملاء وحدهم: أيمن في فريق
     * أحمد يُرسل طلباً بنفسه ومعه علاء، فيُفحص علاء ولا يُفحص هو.
     */
    it("والمرسِل نفسه في طلبٍ حيٍّ لفريقٍ آخر ⇒ 400 يسمّي مرسِله وموضوعه", async () => {
      const first = await topic("STU self-busy-1", "open");
      const second = await topic("STU self-busy-2", "open");
      const [ahmed, ayman, alaa] = f.nextStudents(3);

      expect((await send(ahmed!.reg, first.id, [ayman!.reg])).status).toBe(201);

      const res = await send(ayman!.reg, second.id, [alaa!.reg]);
      expect(res.status).toBe(400);
      const leader = await prisma.user.findUniqueOrThrow({
        where: { id: ahmed!.userId },
        select: { firstName: true, lastName: true },
      });
      expect(res.body.message).toBe(
        tr("student.selfInOtherTeam", {
          name: [leader.firstName, leader.lastName].filter(Boolean).join(" "),
          title: first.title,
        }),
      );
      expect(await prisma.groupRequest.count({ where: { topicId: second.id } })).toBe(0);
    });

    it("والمرسِل نفسه له مشروع ⇒ 400 يسمّي مشروعه", async () => {
      const done = await topic("STU self-project", "full");
      const group = await prisma.projectGroup.create({ data: { topicId: done.id } });
      const t = await topic("STU self-project-next", "open");
      const [placed, other] = f.nextStudents(2);
      await prisma.projectMember.create({
        data: { groupId: group.id, studentId: placed!.id, isLeader: true },
      });

      const res = await send(placed!.reg, t.id, [other!.reg]);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(tr("student.selfHasProject", { title: done.title }));
      expect(await prisma.groupRequest.count({ where: { topicId: t.id } })).toBe(0);
    });
  });

  it("وجسم بلا موضوع ⇒ 400 لا 500", async () => {
    const res = await as(
      request(app).post("/api/student/group-requests").send({ priority: 1 }),
      "me",
    );
    expect(res.status).toBe(400);
  });

  it("وموضوع غير موجود ⇒ 404", async () => {
    const [x, y] = f.nextStudents(2);
    const who = await login(x.reg);

    const res = await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${who}`)
      .send({
        topicId: "00000000-0000-0000-0000-000000000000",
        memberRegistrationNumbers: [y.reg],
        priority: 1,
      });
    expect(res.status).toBe(404);
  });
});

/**
 * عدّة فرقٍ تتقدّم إلى الموضوع **معاً** حتى سقفه، والإدارة تختار.
 *
 * لا ينتظر الفريقُ الثاني قرار الإدارة في الأوّل. وحين يكتمل السقف يُغلق
 * الموضوع على غيرهم حتى تبتّ؛ والرفضُ يُفرِج عن خانة، والقبولُ يُلغي البقيّة
 * ليختار أصحابها موضوعاً آخر.
 */
describe("طلباتٌ متزامنة حتى سقف الموضوع", () => {
  const send = async (topicId: string, reg: string) =>
    request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${await login(reg)}`)
      .send({ topicId, memberRegistrationNumbers: [], priority: 1 });
  const pendingOn = async (topicId: string) =>
    (await prisma.graduationTopic.findUniqueOrThrow({ where: { id: topicId } })).pendingRequestCount;

  it("ثلاثُ فرقٍ معاً على سقف ٣، والرابعة تُردّ برسالة السقف", async () => {
    const t = await topic("STU concurrent-3", "open", 3, 3);
    const [a, b, c, d] = f.nextStudents(4);

    expect((await send(t.id, a!.reg)).status).toBe(201);
    expect((await send(t.id, b!.reg)).status).toBe(201);
    expect((await send(t.id, c!.reg)).status).toBe(201);
    expect(await pendingOn(t.id)).toBe(3);

    const fourth = await send(t.id, d!.reg);
    expect(fourth.status).toBe(400);
    expect(JSON.stringify(fourth.body)).toContain("اكتمل عدد الطلبات");
  });

  it("ورفضُ أحدها قبل الاختيار يُفرِج عن خانته لفريقٍ رابع", async () => {
    const t = await topic("STU concurrent-free", "open", 3, 2);
    const [a, b, c] = f.nextStudents(3);
    expect((await send(t.id, a!.reg)).status).toBe(201);
    expect((await send(t.id, b!.reg)).status).toBe(201);
    expect((await send(t.id, c!.reg)).status).toBe(400);

    const first = await prisma.groupRequest.findFirstOrThrow({
      where: { topicId: t.id, leaderStudentId: a!.id },
    });
    await rejectGroupRequestService(first.id, "اختبار");
    expect(await pendingOn(t.id)).toBe(1);
    expect((await send(t.id, c!.reg)).status).toBe(201);
  });

  it("وقبولُ فريقٍ يُلغي طلبات الآخرين على الموضوع ويُبلغهم", async () => {
    const t = await topic("STU concurrent-accept", "open", 3, 3);
    const [a, b, c] = f.nextStudents(3);
    for (const s of [a, b, c]) expect((await send(t.id, s!.reg)).status).toBe(201);

    const chosen = await prisma.groupRequest.findFirstOrThrow({
      where: { topicId: t.id, leaderStudentId: b!.id },
    });
    await acceptGroupRequestService(chosen.id);

    const all = await prisma.groupRequest.findMany({
      where: { topicId: t.id },
      select: { leaderStudentId: true, status: true, rejectionReason: true },
    });
    const of = (id: string) => all.find((r) => r.leaderStudentId === id)!;
    expect(of(b!.id).status).toBe("accepted");
    for (const s of [a, c]) {
      expect(of(s!.id).status).toBe("rejected");
      expect(of(s!.id).rejectionReason).toBeTruthy(); // يُقال لماذا
    }

    // يُبلَّغ أصحابُ الطلبات الملغاة — ليختاروا موضوعاً آخر.
    const told = await prisma.notification.count({
      where: { userId: { in: [a!.userId, c!.userId] }, link: "/topics" },
    });
    expect(told).toBe(2);

    const after = await prisma.graduationTopic.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.status).toBe("full");
    expect(after.pendingRequestCount).toBe(0);

    // والملغاةُ طلباتهم يتقدّمون إلى موضوعٍ آخر.
    const other = await topic("STU concurrent-next", "open", 3, 2);
    expect((await send(other.id, a!.reg)).status).toBe(201);
  });

  /**
   * فريقان يصلان في اللحظة نفسها على الخانة الأخيرة: يمرّ أحدهما. القراءةُ
   * قبل الكتابة لا تمنع ذلك وحدها — قفلُ صفّ الموضوع هو ما يحسمه.
   */
  it("ووصولٌ متزامن على الخانة الأخيرة: يمرّ فريقٌ واحد", async () => {
    const t = await topic("STU concurrent-race", "open", 3, 1);
    const [a, b, c] = f.nextStudents(3);
    const tokens = await Promise.all([a, b, c].map((s) => login(s!.reg)));

    const results = await Promise.all(
      tokens.map((tk) =>
        request(app)
          .post("/api/student/group-requests")
          .set("Authorization", `Bearer ${tk}`)
          .send({ topicId: t.id, memberRegistrationNumbers: [], priority: 1 }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 400)).toHaveLength(2);
    expect(await pendingOn(t.id)).toBe(1);
  });
});

describe("GET /api/student/group-requests", () => {
  it("يعرض طلبي أنا لا طلبات غيري", async () => {
    const t = await topic("STU mine", "open");
    const [x, y] = f.nextStudents(2);
    const who = await login(x.reg);

    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${who}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [y.reg],
        priority: 1,
      })
      .expect(201);

    const mineList = await request(app)
      .get("/api/student/group-requests")
      .set("Authorization", `Bearer ${who}`)
      .expect(200);
    expect(JSON.stringify(mineList.body)).toContain("STU mine");

    const other = await as(
      request(app).get("/api/student/group-requests"),
      "stranger",
    ).expect(200);
    expect(JSON.stringify(other.body)).not.toContain("STU mine");
  });

  it("والعضوُ يرى طلب فريقه — ويُعرف أنّه ليس مرسِله", async () => {
    const t = await topic("STU team", "open");
    const [lead, member] = f.nextStudents(2);

    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${await login(lead.reg)}`)
      .send({ topicId: t.id, memberRegistrationNumbers: [member.reg], priority: 1 })
      .expect(201);

    const read = async (reg: string) =>
      rows(
        (
          await request(app)
            .get("/api/student/group-requests")
            .set("Authorization", `Bearer ${await login(reg)}`)
            .expect(200)
        ).body,
      ).find((r) => (r.topic as { id: string }).id === t.id);

    const asLeader = await read(lead.reg);
    const asMember = await read(member.reg);

    expect(asLeader?.isLeader).toBe(true);
    expect(asMember?.isLeader).toBe(false);
    expect(asMember?.id).toBe(asLeader?.id);

    // المشرف والسنة يصلان مع الموضوع: الصفحة تسمّيهما.
    const tp = asMember!.topic as {
      professor: { id: string } | null;
      academicYear: { id: string } | null;
    };
    expect(tp.professor?.id).toBe(f.professor.id);
    expect(tp.academicYear?.id).toBe(f.academicYear.id);
  });
});

describe("DELETE /api/student/group-requests/:id", () => {
  /** يُنشئ طلباً ويُعيد معرّفه ورمز صاحبه. */
  async function aRequest(title: string) {
    const t = await topic(title, "open");
    const [leader, member] = f.nextStudents(2);
    const bearer = await login(leader.reg);

    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${bearer}`)
      .send({
        topicId: t.id,
        memberRegistrationNumbers: [member.reg],
        priority: 1,
      })
      .expect(201);

    const row = (await prisma.groupRequest.findFirst({
      where: { topicId: t.id },
    }))!;
    return { id: row.id, bearer, topicId: t.id };
  }

  it("المرسِل يلغي طلبه، فيتحرّر الموضوع", async () => {
    const { id, bearer, topicId } = await aRequest("STU cancel");

    await request(app)
      .delete(`/api/student/group-requests/${id}`)
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);

    expect(
      await prisma.groupRequest.findUnique({ where: { id } }),
    ).toBeNull();

    // والموضوع عاد للتداول.
    const res = await as(
      request(app).get("/api/student/topics"),
      "stranger",
    ).expect(200);
    expect(ids(res.body)).toContain(topicId);
  });

  it("وطالبٌ آخر لا يلغي طلباً ليس له", async () => {
    const { id } = await aRequest("STU cancel-other");

    const res = await as(
      request(app).delete(`/api/student/group-requests/${id}`),
      "stranger",
    );
    expect([401, 403]).toContain(res.status);
    expect(await prisma.groupRequest.findUnique({ where: { id } })).not.toBeNull();
  });

  it("وطلبٌ بُتَّ فيه لا يُلغى", async () => {
    const { id, bearer } = await aRequest("STU cancel-decided");
    await prisma.groupRequest.update({
      where: { id },
      data: { status: "accepted" },
    });

    const res = await request(app)
      .delete(`/api/student/group-requests/${id}`)
      .set("Authorization", `Bearer ${bearer}`);
    expect(res.status).toBe(400);
  });
});

//
// ═══ مشروعي ═══
//

describe("GET /api/student/my-project", () => {
  it("بلا مشروع ⇒ 200 بقيمة فارغة، لا 404", async () => {
    const res = await as(
      request(app).get("/api/student/my-project"),
      "stranger",
    ).expect(200);

    // الردّ `{ project: null }` — والمفتاح موجود دائماً، فتعرف الواجهة
    // أن الطلب نجح وأن لا مشروع، لا أن شيئاً أخفق.
    expect(res.body).toHaveProperty("project");
    expect(res.body.project).toBeNull();
  });

  it("ومع مشروع ⇒ يُعيد مجموعته هو", async () => {
    const t = await topic("STU my-project", "full");
    const group = await prisma.projectGroup.create({
      data: { topicId: t.id },
    });
    const [member] = f.nextStudents(1);
    await prisma.projectMember.create({
      data: { groupId: group.id, studentId: member.id, isLeader: true },
    });
    const bearer = await login(member.reg);

    const res = await request(app)
      .get("/api/student/my-project")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);

    expect(JSON.stringify(res.body)).toContain("STU my-project");
  });

  it("ويحمل السنة والتخصّص، ولجنة المناقشة بأدوارها", async () => {
    const t = await topic("STU project details", "full");
    const group = await prisma.projectGroup.create({
      data: { topicId: t.id },
    });
    const [member] = f.nextStudents(1);
    await prisma.projectMember.create({
      data: { groupId: group.id, studentId: member.id, isLeader: true },
    });
    await prisma.defense.create({
      data: {
        groupId: group.id,
        date: new Date(Date.now() + 10 * 86_400_000),
        room: "B2",
        committee: {
          create: [
            { professorId: f.professor2.id, role: "president" },
            { professorId: f.professor.id, role: "supervisor" },
          ],
        },
      },
    });

    const { project } = (
      await request(app)
        .get("/api/student/my-project")
        .set("Authorization", `Bearer ${await login(member.reg)}`)
        .expect(200)
    ).body;

    expect(project.topic.academicYear.id).toBe(f.academicYear.id);
    expect(project.topic.specialization.id).toBe(f.specialization.id);
    expect(
      project.defense.committee.map((c: { role: string }) => c.role).sort(),
    ).toEqual(["president", "supervisor"]);
    // من اللجنة الاسم والصورة لا البريد: الطالب يحتاج أن يعرف من سيناقشه.
    expect(project.defense.committee[0].professor.user).not.toHaveProperty(
      "email",
    );
  });
});

//
// ═══ على الحافّة ═══
//

describe("الطالب على الحافّة", () => {
  const NONE = "00000000-0000-0000-0000-000000000000";

  /** يُرسل `leader` طلباً على الموضوع بزملائه. */
  const send = async (leaderReg: string, topicId: string, members: string[]) =>
    request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${await login(leaderReg)}`)
      .send({ topicId, memberRegistrationNumbers: members, priority: 1 });

  /** طلبٌ مقبولٌ مكتوبٌ مباشرةً — كما تتركه الإدارة بعد قرارها. */
  const accepted = (topicId: string, leaderId: string) =>
    prisma.groupRequest.create({
      data: { topicId, leaderStudentId: leaderId, status: "accepted", members: { create: [{ studentId: leaderId }] } },
    });

  /** حسابٌ بدور الطالب لم يُربط بملفّ طالب: كلّ ما يخصّ «طالبه» غير موجود، لا عطلٌ بـ500. */
  it("حسابٌ بدور طالبٍ بلا ملفّ طالب ⇒ 404 «الطالب غير موجود»", async () => {
    const u = await prisma.user.create({
      data: { email: `${TAG}.stu-no-profile@test.local`, password: "x", role: "student" },
    });
    const bearer = `Bearer ${signAccessToken({ userId: u.id, role: "student" as never, refId: u.id, tokenVersion: 0 })}`;

    for (const path of ["/api/student/topics", "/api/student/dashboard"]) {
      const res = await request(app).get(path).set("Authorization", bearer).expect(404);
      expect(res.body.message).toBe(tr("notFound.student"));
    }
  });

  it("التصفّح بالسنة الدراسية", async () => {
    const t = await topic("STU by-year", "open");
    expect(ids((await as(request(app).get("/api/student/topics").query({ academicYearId: f.academicYear.id }), "me").expect(200)).body)).toContain(t.id);
    expect(ids((await as(request(app).get("/api/student/topics").query({ academicYearId: NONE }), "me").expect(200)).body)).not.toContain(t.id);
  });

  /** الخدمة لا تبحث عن رقمٍ فارغ ولو نوديت بلا المخطّط الذي يمنعه. */
  it("البحث برقمٍ فارغ (مسافاتٍ) ⇒ 400 قبل أيّ بحث", async () => {
    await expect(lookupStudentByRegistrationService(me.userId, "   ")).rejects.toMatchObject({
      statusCode: 400,
      message: tr("student.registrationRequired"),
    });
  });

  /** موضوعٌ قبلت الإدارة فريقاً عليه محجوز — ولو بلا سقف، ولو بقيت حالته «منشوراً». */
  it("موضوعٌ قُبل عليه فريقٌ آخر ⇒ 400 «محجوز»", async () => {
    const t = await topic("STU taken-by-other", "open");
    const [owner, a, b] = f.nextStudents(3);
    await accepted(t.id, owner!.id);

    const res = await send(a!.reg, t.id, [b!.reg]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(tr("student.topicReserved"));
  });

  it("ومرسِلٌ قُبل طلبه على الموضوع نفسه يُعيد الإرسال ⇒ 400 «طلبك مقبول»", async () => {
    const t = await topic("STU own-accepted", "open");
    const [a, b] = f.nextStudents(2);
    await accepted(t.id, a!.id);

    const res = await send(a!.reg, t.id, [b!.reg]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(tr("student.ownAccepted"));
  });

  /** وعضوٌ (لا مرسِل) في فريقٍ قُبل على الموضوع يحاول إرساله من جديد. */
  it("وعضوٌ في فريقٍ قُبل على الموضوع نفسه ⇒ 400 «فريقك مقبول»", async () => {
    const t = await topic("STU team-accepted", "open");
    const [owner, member, b] = f.nextStudents(3);
    await prisma.groupRequest.create({
      data: {
        topicId: t.id,
        leaderStudentId: owner!.id,
        status: "accepted",
        members: { create: [{ studentId: owner!.id }, { studentId: member!.id }] },
      },
    });

    const res = await send(member!.reg, t.id, [b!.reg]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(tr("student.teamAccepted"));
  });

  /** بعض الأرقام لطلبةٍ في المنصّة وبعضها لا: يُسمّى المفقود وحده. */
  it("ورقمٌ مجهولٌ بين أرقامٍ صحيحة ⇒ يُسمّى المجهول وحده", async () => {
    const t = await topic("STU partly-unknown", "open");
    const [a, b] = f.nextStudents(2);

    const res = await send(a!.reg, t.id, [b!.reg, "99999999999"]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(tr("student.unknownRegistrations", { list: "99999999999" }));
  });

  it("وفريقٌ أكبر من سعة الموضوع ⇒ 400 يذكر السعة", async () => {
    const t = await topic("STU too-big", "open", 2);
    const [a, b, c] = f.nextStudents(3);

    const res = await send(a!.reg, t.id, [b!.reg, c!.reg]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(tr("student.teamTooBig", { max: 2 }));
    expect(await prisma.groupRequest.count({ where: { topicId: t.id } })).toBe(0);
  });

  it("وسحبُ طلبٍ غير موجود ⇒ 404", async () => {
    const res = await as(request(app).delete(`/api/student/group-requests/${NONE}`), "me").expect(404);
    expect(res.body.message).toBe(tr("notFound.groupRequest"));
  });
});
