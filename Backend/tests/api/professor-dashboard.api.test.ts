/**
 * وحدة الأستاذ — اللوحة والبحث والاقتراح والمراحل.
 *
 * خمسة مسارات بقيت بلا وعدٍ موصوف، وأكبرها `getDashboardService`: كتلةٌ من
 * ١٧٨ سطراً تقرأ خمسة جداول وتشتقّ منها عدّاداتٍ وقوائمَ «تحتاج انتباهك»
 * وجدولَ أعمال. وكلّ سطرٍ فيها اشتقاق — والاشتقاق بلا اختبارٍ حسابٌ لا يُراجعه
 * أحد.
 *
 * وثلاثة أسئلة تحكم هذا الملفّ:
 *
 *   **هل الأرقام صحيحة؟** المتأخّر متأخّر، والمكتمل ليس متأخّراً وإن فات
 *     موعده، و«هذا الأسبوع» سبعة أيام لا أكثر.
 *
 *   **هل تقف اللوحة عند حدّ صاحبها؟** لوحةٌ تُظهر مشروع أستاذٍ آخر تسريبٌ،
 *     ولا يكشفه إلا وجود أستاذين في البيانات.
 *
 *   **هل ما يُقترح ممكن؟** الاقتراح يحجز الموضوع ويُدخل طلبةً لم يطلبوا شيئاً،
 *     فشروطه — الوجود والسعة وألّا يكون للطالب مشروع — تُفحص قبل الكتابة لا
 *     بعدها.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import { signAccessToken } from "../../src/core/auth/tokens";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  TAG,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let mine = ""; // الأستاذ صاحب البيانات
let other = ""; // أستاذٌ ثانٍ، شرعيّ، وليس له شيء هنا

const asMine = (r: request.Test) => r.set("Authorization", `Bearer ${mine}`);
const asOther = (r: request.Test) => r.set("Authorization", `Bearer ${other}`);

const NO_SUCH_ID = "00000000-0000-0000-0000-000000000000";

const DAY = 86_400_000;
const days = (n: number) => new Date(Date.now() + n * DAY);

let n = 0;

async function loginProfessor(universityEmail: string) {
  const res = await request(app)
    .post("/api/auth/professor/login")
    .send({ universityEmail, password: TEST_PASSWORD })
    .expect(200);
  return res.body.accessToken as string;
}

/** موضوعٌ لأحد الأستاذين، بالحالة المطلوبة. */
async function topicFor(
  professorId: string,
  status = "pending",
  extra: { title?: string; maxStudents?: number } = {},
) {
  return prisma.graduationTopic.create({
    data: {
      title: `${TAG} ${extra.title ?? `موضوع ${++n}`}`,
      description: `${TAG} وصف`,
      maxStudents: extra.maxStudents ?? 3,
      status: status as never,
      publishedAt: status === "open" || status === "full" ? new Date() : null,
      professorId,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
}

/** مشروعٌ قائم على موضوعٍ لهذا الأستاذ، بأعضائه. */
async function projectFor(professorId: string, memberCount = 2) {
  const topic = await topicFor(professorId, "full");
  const group = await prisma.projectGroup.create({ data: { topicId: topic.id } });
  const students = f.nextStudents(memberCount);
  await prisma.projectMember.createMany({
    data: students.map((s, i) => ({
      groupId: group.id,
      studentId: s.id,
      isLeader: i === 0,
    })),
  });
  return { topic, group, students };
}

const milestone = (
  groupId: string,
  deadline: Date,
  status: "pending" | "in_progress" | "completed" | "overdue" = "pending",
  order = 1,
) =>
  prisma.milestone.create({
    data: { title: `${TAG} مرحلة ${++n}`, deadline, status, order, groupId },
  });

/** يقرأ اللوحة ويُرجعها مكتوبةَ النوع بالقدر الذي تحتاجه التأكيدات. */
type Dashboard = {
  topics: { id: string; status: string; title: string }[];
  stats: Record<string, number>;
  topicBreakdown: Record<string, number>;
  attention: Record<string, { id: string }[]>;
  agenda: { kind: string; id: string; date: string; room: string | null }[];
  projects: {
    id: string;
    members: unknown[];
    milestones: { total: number; completed: number; overdue: number };
    nextDeadline: { id: string; title: string } | null;
  }[];
};

const dashboard = async (token = mine) =>
  (
    await request(app)
      .get("/api/professor/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
  ).body as Dashboard;

beforeAll(async () => {
  await teardown();
  f = await seed(90);
  mine = await loginProfessor(f.professor.universityEmail);
  other = await loginProfessor(f.professor2.universityEmail);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ اللوحة: البنية ═══
//

describe("لوحة الأستاذ — البنية", () => {
  it("تصل كاملةً حتى حين لا يملك الأستاذ شيئاً", async () => {
    // الأستاذ الثاني لم يُنشأ له شيءٌ بعد.
    const d = await dashboard(other);

    expect(d.topics).toEqual([]);
    expect(d.projects).toEqual([]);
    expect(d.agenda).toEqual([]);
    expect(d.stats).toEqual({
      myTopics: 0,
      supervisedProjects: 0,
      supervisedStudents: 0,
      overdueMilestones: 0,
      upcomingDefenses: 0,
    });
    // العدّادات تبدأ من صفرٍ معلنٍ لا من غياب المفتاح: شاشةٌ تقرأ
    // `breakdown.rejected` يجب أن تجد صفراً لا `undefined`.
    expect(d.topicBreakdown).toEqual({
      pending: 0,
      approved: 0,
      open: 0,
      full: 0,
      rejected: 0,
      archived: 0,
    });
  });

  /**
   * حسابٌ دورُه «أستاذ» ولا ملفّ أستاذ له في القاعدة. حالةٌ لا يبلغها تسجيل
   * الدخول — فهو يبحث بالبريد الجامعي في جدول الأساتذة — لكنها تبلغها
   * البوّابة، إذ تقرأ الدور من `User` وحده. ولذلك تبدأ كل خدمةٍ في هذه
   * الوحدة بـ`getProfessor`، وهذا هو فرعها الغائب.
   */
  it("وحسابٌ بدور أستاذٍ بلا ملفّ أستاذ ⇒ 404 لا 500", async () => {
    const ghost = await prisma.user.create({
      data: {
        firstName: TAG,
        lastName: "GhostProf",
        email: `${TAG}.ghost@test.local`,
        password: f.admin.password,
        role: "professor",
      },
    });

    const token = signAccessToken({
      userId: ghost.id,
      role: "professor" as never,
      refId: ghost.id,
      tokenVersion: 0,
      sid: `${TAG}-ghost-sid`,
    });

    await request(app)
      .get("/api/professor/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });
});

//
// ═══ اللوحة: العدّ والاشتقاق ═══
//

describe("لوحة الأستاذ — الأرقام", () => {
  it("توزيع المواضيع يعدّ كل حالةٍ على حدة", async () => {
    const before = (await dashboard()).topicBreakdown;

    await topicFor(f.professor.id, "pending");
    await topicFor(f.professor.id, "pending");
    await topicFor(f.professor.id, "approved");
    await topicFor(f.professor.id, "rejected");
    await topicFor(f.professor.id, "open");

    const d = await dashboard();
    expect(d.topicBreakdown.pending).toBe(before.pending! + 2);
    expect(d.topicBreakdown.approved).toBe(before.approved! + 1);
    expect(d.topicBreakdown.rejected).toBe(before.rejected! + 1);
    expect(d.topicBreakdown.open).toBe(before.open! + 1);
    expect(d.stats.myTopics).toBe(d.topics.length);
  });

  /**
   * «متأخّرة» اشتقاقٌ لا حقل: موعدٌ فات وحالةٌ ليست «مكتملة». والفرق بين
   * الشرطين يظهر في مرحلةٍ مكتملةٍ فات موعدها — أُنجزت متأخّرة، ولم تعد
   * تحتاج انتباهاً. وعدّها متأخّرة يملأ الشاشة بإنذاراتٍ عن عملٍ تمّ.
   */
  it("والمتأخّر: فات موعده ولم يكتمل — والمكتمل ليس متأخّراً وإن فات", async () => {
    const { group } = await projectFor(f.professor.id, 2);
    const before = (await dashboard()).stats.overdueMilestones!;

    await milestone(group.id, days(-3), "pending"); // متأخّرة
    await milestone(group.id, days(-2), "in_progress", 2); // متأخّرة
    await milestone(group.id, days(-1), "completed", 3); // فاتت لكنها تمّت
    await milestone(group.id, days(+5), "pending", 4); // لم يحن موعدها

    const d = await dashboard();
    expect(d.stats.overdueMilestones).toBe(before + 2);
    expect(d.attention.overdueMilestones).toHaveLength(before + 2);
  });

  it("و«هذا الأسبوع» سبعة أيامٍ من الآن، لا ما بعدها", async () => {
    const { group } = await projectFor(f.professor.id, 1);
    const inWeek = await milestone(group.id, days(3), "pending", 1);
    const later = await milestone(group.id, days(10), "pending", 2);

    const d = await dashboard();
    const ids = d.attention.dueThisWeek!.map((m) => m.id);

    expect(ids).toContain(inWeek.id);
    expect(ids).not.toContain(later.id);
  });

  it("وعدد الطلبة المشرَف عليهم مجموعُ أعضاء المشاريع", async () => {
    const before = (await dashboard()).stats;
    await projectFor(f.professor.id, 3);

    const d = await dashboard();
    expect(d.stats.supervisedProjects).toBe(before.supervisedProjects! + 1);
    expect(d.stats.supervisedStudents).toBe(before.supervisedStudents! + 3);
  });

  it("وبطاقة المشروع تحمل عدّاد مراحله وموعده القادم", async () => {
    const { group } = await projectFor(f.professor.id, 2);
    await milestone(group.id, days(-4), "completed", 1);
    await milestone(group.id, days(-2), "pending", 2); // متأخّرة
    const next = await milestone(group.id, days(6), "pending", 3);
    await milestone(group.id, days(20), "pending", 4);

    const d = await dashboard();
    const card = d.projects.find((p) => p.id === group.id)!;

    expect(card.milestones).toEqual({ total: 4, completed: 1, overdue: 1 });
    // «القادم» أقربُ ما لم يكتمل ولم يفت — لا أقربُ ما لم يكتمل.
    expect(card.nextDeadline!.id).toBe(next.id);
    expect(card.members).toHaveLength(2);
  });

  it("ومشروعٌ بلا مراحل: موعده القادم لا شيء لا عطل", async () => {
    const { group } = await projectFor(f.professor.id, 1);

    const card = (await dashboard()).projects.find((p) => p.id === group.id)!;
    expect(card.milestones).toEqual({ total: 0, completed: 0, overdue: 0 });
    expect(card.nextDeadline).toBeNull();
  });
});

//
// ═══ اللوحة: «تحتاج انتباهك» ═══
//

describe("لوحة الأستاذ — ما يحتاج انتباهاً", () => {
  it("المرفوض والمعلَّق يظهران في قائمتيهما", async () => {
    const rejected = await topicFor(f.professor.id, "rejected");
    const pending = await topicFor(f.professor.id, "pending");

    const a = (await dashboard()).attention;
    expect(a.rejectedTopics!.map((t) => t.id)).toContain(rejected.id);
    expect(a.pendingTopics!.map((t) => t.id)).toContain(pending.id);
  });

  /**
   * «مقبولٌ ولم يُنشر» هو الحالة التي لا تقولها الشاشة من نفسها: الأستاذ يرى
   * موضوعه «مقبولاً» فيظنّه معروضاً على الطلبة، وهو غير مرئيّ لأحد حتى تنشره
   * الإدارة. وهو لا يملك نشره — يملك أن يسأل.
   */
  it("و«مقبولٌ ولم يُنشر» يظهر، والمنشور لا يظهر معه", async () => {
    const approved = await topicFor(f.professor.id, "approved");
    const open = await topicFor(f.professor.id, "open");

    const a = (await dashboard()).attention;
    const ids = a.approvedNotPublished!.map((t) => t.id);

    expect(ids).toContain(approved.id);
    expect(ids).not.toContain(open.id);
  });

  it("والمنشور بلا طلبات يظهر، وبطلبٍ واحد يختفي", async () => {
    const quiet = await topicFor(f.professor.id, "open");
    const asked = await topicFor(f.professor.id, "open");

    const [leader] = f.nextStudents(1);
    await prisma.groupRequest.create({
      data: {
        topicId: asked.id,
        activeTopicId: asked.id,
        leaderStudentId: leader!.id,
        priority: 1,
        status: "pending",
        members: { create: [{ studentId: leader!.id }] },
      },
    });

    const ids = (await dashboard()).attention.openWithoutRequests!.map(
      (t) => t.id,
    );
    expect(ids).toContain(quiet.id);
    expect(ids).not.toContain(asked.id);
  });

  it("والتسليمات على مرحلةٍ لم تُغلق تُعدّ «بانتظار المراجعة»", async () => {
    const { group, students } = await projectFor(f.professor.id, 1);
    const open = await milestone(group.id, days(2), "in_progress", 1);
    const done = await milestone(group.id, days(3), "completed", 2);

    const uploader = students[0]!.userId;
    await prisma.submission.create({
      data: {
        fileUrl: `${TAG}/a.pdf`,
        fileName: `${TAG}-a.pdf`,
        version: 1,
        milestoneId: open.id,
        uploadedById: uploader,
      },
    });
    await prisma.submission.create({
      data: {
        fileUrl: `${TAG}/b.pdf`,
        fileName: `${TAG}-b.pdf`,
        version: 1,
        milestoneId: done.id,
        uploadedById: uploader,
      },
    });

    const waiting = (await dashboard()).attention.awaitingReview!;
    const names = waiting.map(
      (s) => (s as unknown as { fileName: string }).fileName,
    );

    // «بانتظار المراجعة» مشتقّ من حالة المرحلة لا من علمٍ على التسليم — فلا
    // حقل مراجعة على `Submission`، واختراعه هنا كان سيكون تخميناً.
    expect(names).toContain(`${TAG}-a.pdf`);
    expect(names).not.toContain(`${TAG}-b.pdf`);
  });
});

//
// ═══ اللوحة: جدول الأعمال ═══
//

describe("لوحة الأستاذ — جدول الأعمال", () => {
  it("يخلط المراحل والمناقشات مرتَّبةً بالتاريخ، وستّةً على الأكثر", async () => {
    const { group } = await projectFor(f.professor.id, 2);

    // ثمانية مواعيد قادمة: أكثر من سقف الجدول عمداً.
    for (let i = 1; i <= 8; i++) await milestone(group.id, days(i), "pending", i);
    await prisma.defense.create({
      data: {
        groupId: group.id,
        date: days(2.5),
        room: `${TAG}-قاعة`,
        status: "scheduled",
      },
    });

    const d = await dashboard();
    const agenda = d.agenda;

    expect(agenda).toHaveLength(6);

    // مرتَّبٌ تصاعدياً بلا استثناء.
    const times = agenda.map((e) => new Date(e.date).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    // والنوعان معاً في قائمةٍ واحدة، والقاعة للمناقشة وحدها.
    const defense = agenda.find((e) => e.kind === "defense");
    expect(defense).toBeDefined();
    expect(defense!.room).toBe(`${TAG}-قاعة`);
    expect(agenda.find((e) => e.kind === "milestone")!.room).toBeNull();
  });

  it("والمناقشة الملغاة أو الماضية ليست قادمة", async () => {
    const past = await projectFor(f.professor.id, 1);
    const cancelled = await projectFor(f.professor.id, 1);

    await prisma.defense.create({
      data: {
        groupId: past.group.id,
        date: days(-5),
        room: `${TAG}-ماضية`,
        status: "scheduled",
      },
    });
    await prisma.defense.create({
      data: {
        groupId: cancelled.group.id,
        date: days(5),
        room: `${TAG}-ملغاة`,
        status: "cancelled",
      },
    });

    const d = await dashboard();
    const groupIds = d.agenda
      .filter((e) => e.kind === "defense")
      .map((e) => (e as unknown as { groupId: string }).groupId);

    expect(groupIds).not.toContain(past.group.id);
    expect(groupIds).not.toContain(cancelled.group.id);
  });
});

//
// ═══ اللوحة: الحدّ ═══
//

describe("لوحة الأستاذ تقف عند حدّ صاحبها", () => {
  /**
   * حارس المسار يمنع الطالب، لا يمنع أستاذاً من رؤية عمل أستاذ. والحدّ الوحيد
   * هنا هو `professorId` في كل استعلامٍ من الخمسة — خمسة مواضع، يكفي أن
   * يُنسى واحدٌ منها.
   */
  it("لا موضوعَ ولا مشروعَ ولا مرحلةَ من أستاذٍ آخر", async () => {
    const foreignTopic = await topicFor(f.professor.id, "pending");
    const foreign = await projectFor(f.professor.id, 2);
    await milestone(foreign.group.id, days(-1), "pending", 9);
    await prisma.defense.create({
      data: {
        groupId: foreign.group.id,
        date: days(4),
        room: `${TAG}-غريبة`,
        status: "scheduled",
      },
    });

    const d = await dashboard(other);

    expect(d.topics.map((t) => t.id)).not.toContain(foreignTopic.id);
    expect(d.projects.map((p) => p.id)).not.toContain(foreign.group.id);
    expect(d.stats.overdueMilestones).toBe(0);
    expect(d.stats.upcomingDefenses).toBe(0);
    expect(d.agenda).toEqual([]);
    expect(d.attention.awaitingReview).toEqual([]);
  });
});

//
// ═══ البحث عن الطلبة ═══
//

describe("البحث عن الطلبة", () => {
  const search = (q: Record<string, string>, token = mine) =>
    request(app)
      .get("/api/professor/students/search")
      .query(q)
      .set("Authorization", `Bearer ${token}`);

  const rows = (body: unknown) =>
    (Array.isArray(body) ? body : (body as { students?: unknown[] }).students ??
      []) as { id: string; registrationNumber: string }[];

  /**
   * حرفٌ واحد يُجاب بقائمةٍ فارغة و**٢٠٠**، لا بـ٤٠٠. وهذا اختيارٌ مقصود
   * شرحه المتحكّم: المنتقي يبحث مع كل ضغطة مفتاح، فأوّل حرفٍ يُكتب ليس خطأً
   * يُصاح به — هو ببساطة لا يقدّم شيئاً بعد. توثيقه هنا يمنع «تصحيحه» يوماً
   * إلى ٤٠٠ فتمتلئ الشاشة بأخطاء أثناء الكتابة العادية.
   */
  it("حرفٌ واحد ⇒ 200 بقائمةٍ فارغة، لا خطأً", async () => {
    const res = await search({ q: "خ" }).expect(200);
    expect(rows(res.body)).toEqual([]);
  });

  it("وبلا مصطلحٍ إطلاقاً ⇒ 200 فارغة كذلك", async () => {
    const res = await search({}).expect(200);
    expect(rows(res.body)).toEqual([]);
  });

  it("ورقم التسجيل يجد صاحبه", async () => {
    const [s] = f.nextStudents(1);
    const res = await search({ q: s!.reg }).expect(200);

    expect(rows(res.body).map((r) => r.id)).toContain(s!.id);
  });

  /**
   * الاسم يُقطَّع كلماتٍ، وكلٌّ منها يُطابَق على الاسمين معاً — فيجد «خالد
   * مرابط» و«مرابط خالد» الشخصَ نفسه. وهو وعدٌ مذكورٌ في تعليق الخدمة، ولم
   * يكن يُنفَّذ.
   */
  it("والاسم الكامل يجده بأي ترتيب", async () => {
    const [s] = f.nextStudents(1);
    const user = (await prisma.student.findUnique({
      where: { id: s!.id },
      select: { user: { select: { id: true } } },
    }))!;
    await prisma.user.update({
      where: { id: user.user.id },
      data: { firstName: `${TAG}خالد`, lastName: `${TAG}مرابط` },
    });

    const forward = await search({ q: `${TAG}خالد ${TAG}مرابط` }).expect(200);
    const backward = await search({ q: `${TAG}مرابط ${TAG}خالد` }).expect(200);

    expect(rows(forward.body).map((r) => r.id)).toContain(s!.id);
    expect(rows(backward.body).map((r) => r.id)).toContain(s!.id);
  });

  /**
   * الطالب المرتبط بمشروع غير قابلٍ للاقتراح، فلا يُعرض أصلاً. وعرضه ثم رفضه
   * عند الإرسال يجعل الأستاذ يبني فريقاً ثم يُقال له «لا».
   */
  it("وطالبٌ له مشروع لا يظهر في النتائج", async () => {
    const { students } = await projectFor(f.professor.id, 2);
    const placed = students[0]!;

    const res = await search({ q: placed.reg }).expect(200);
    expect(rows(res.body).map((r) => r.id)).not.toContain(placed.id);
  });

  it("ويُرشَّح بالتخصّص", async () => {
    const [s] = f.nextStudents(1);

    const hit = await search({
      q: s!.reg,
      specializationId: f.specialization.id,
    }).expect(200);
    expect(rows(hit.body).map((r) => r.id)).toContain(s!.id);

    const miss = await search({
      q: s!.reg,
      specializationId: NO_SUCH_ID,
    }).expect(200);
    expect(rows(miss.body)).toEqual([]);
  });

  it("ولا يُعيد أكثر من عشرة", async () => {
    const res = await search({ q: `${TAG}-REG` }).expect(200);
    expect(rows(res.body).length).toBeLessThanOrEqual(10);
  });

  it("ولا يُسرِّب من الطالب إلا ما يلزم لاختياره", async () => {
    const [s] = f.nextStudents(1);
    const res = await search({ q: s!.reg }).expect(200);
    const row = rows(res.body).find((r) => r.id === s!.id) as unknown as Record<
      string,
      unknown
    >;

    expect(row).toBeDefined();
    expect(Object.keys(row).sort()).toEqual([
      "id",
      "registrationNumber",
      "specialization",
      "user",
    ]);
    // البريد وكلمة السرّ لا شأن لهما باختيار عضوٍ في فريق.
    expect(JSON.stringify(row)).not.toContain("@");
    expect(JSON.stringify(row)).not.toContain("password");
  });
});

//
// ═══ اقتراح موضوعٍ مع فريقه ═══
//

describe("اقتراح موضوعٍ مع فريقه", () => {
  const propose = (body: Record<string, unknown>) =>
    asMine(request(app).post("/api/professor/topics/with-group")).send(body);

  const payload = (
    regs: string[],
    leader: string,
    over: Record<string, unknown> = {},
  ) => ({
    title: `${TAG} مقترح ${++n}`,
    description: `${TAG} وصف المقترح`,
    maxStudents: 3,
    specializationId: f.specialization.id,
    academicYearId: f.academicYear.id,
    memberRegistrationNumbers: regs,
    leaderRegistrationNumber: leader,
    ...over,
  });

  /**
   * المقترح **لا يُعتمد بنفسه**: يُنشأ «قيد الانتظار» ومعه طلبٌ يحجز الموضوع
   * تماماً كما يحجزه طلب الطلبة. فلا يصير للأستاذ بابٌ خلفيّ يتجاوز الإدارة.
   */
  it("يُنشئ موضوعاً معلَّقاً وطلباً يحجزه", async () => {
    const team = f.nextStudents(2);
    const res = await propose(
      payload(team.map((s) => s.reg), team[0]!.reg),
    ).expect(201);

    const topicId = (res.body.topic ?? res.body).id as string;
    const topic = (await prisma.graduationTopic.findUnique({
      where: { id: topicId },
    }))!;
    expect(topic.status).toBe("pending");
    expect(topic.professorId).toBe(f.professor.id);

    const req = (await prisma.groupRequest.findFirst({
      where: { topicId },
      include: { members: true },
    }))!;
    expect(req.status).toBe("pending");
    expect(req.activeTopicId).toBe(topicId); // الحجز
    expect(req.leaderStudentId).toBe(team[0]!.id);
    expect(req.members.map((m) => m.studentId).sort()).toEqual(
      team.map((s) => s.id).sort(),
    );
  });

  it("ويُشعِر الطلبة — فهم لم يطلبوا شيئاً", async () => {
    const team = f.nextStudents(2);
    await propose(payload(team.map((s) => s.reg), team[1]!.reg)).expect(201);

    for (const s of team) {
      const notes = await prisma.notification.count({
        where: { userId: s.userId },
      });
      expect(notes).toBeGreaterThan(0);
    }
  });

  it("ورقم تسجيلٍ غير موجود ⇒ 400 يسمّي الناقص", async () => {
    const [s] = f.nextStudents(1);
    const res = await propose(
      payload([s!.reg, `${TAG}-لا-وجود-له`], s!.reg),
    ).expect(400);

    expect(res.body.message).toContain(`${TAG}-لا-وجود-له`);
  });

  it("والمرسِل من خارج الفريق ⇒ 400", async () => {
    const team = f.nextStudents(2);
    const outsider = f.nextStudents(1)[0]!;

    const res = await propose(
      payload(team.map((s) => s.reg), outsider.reg),
    ).expect(400);
    expect(res.body.message).toContain("المرسِل");
  });

  it("وعددٌ يتجاوز سعة الموضوع ⇒ 400 يذكر السعة", async () => {
    const team = f.nextStudents(3);
    const res = await propose(
      payload(team.map((s) => s.reg), team[0]!.reg, { maxStudents: 2 }),
    ).expect(400);

    expect(res.body.message).toContain("2");
  });

  it("وطالبٌ له مشروع ⇒ 400 يسمّيه", async () => {
    const { students } = await projectFor(f.professor.id, 1);
    const placed = students[0]!;
    const free = f.nextStudents(1)[0]!;

    const res = await propose(
      payload([free.reg, placed.reg], free.reg),
    ).expect(400);
    expect(res.body.message).toContain(placed.reg);
  });

  it("وتخصّصٌ أو سنةٌ غير موجودة ⇒ 404", async () => {
    const [s] = f.nextStudents(1);

    await propose(
      payload([s!.reg], s!.reg, { specializationId: NO_SUCH_ID }),
    ).expect(404);
    await propose(
      payload([s!.reg], s!.reg, { academicYearId: NO_SUCH_ID }),
    ).expect(404);
  });

  /**
   * الفحوص كلّها تسبق المعاملة، والمعاملة تكتب الموضوع والطلب معاً. فرفضٌ
   * متأخّر لا يترك موضوعاً معلَّقاً بلا فريق — وهو ما كان سيحجب الموضوع عن
   * الطلبة إلى الأبد.
   */
  it("والرفض لا يترك موضوعاً بلا فريق", async () => {
    const before = await prisma.graduationTopic.count({
      where: { professorId: f.professor.id },
    });

    const [s] = f.nextStudents(1);
    await propose(
      payload([s!.reg, `${TAG}-ناقص`], s!.reg, { title: `${TAG} لن يُكتب` }),
    ).expect(400);

    expect(
      await prisma.graduationTopic.count({
        where: { professorId: f.professor.id },
      }),
    ).toBe(before);
    expect(
      await prisma.graduationTopic.findFirst({
        where: { title: `${TAG} ${TAG} لن يُكتب` },
      }),
    ).toBeNull();
  });

  it("وجسمٌ ناقص ⇒ 400 لا 500", async () => {
    await asMine(request(app).post("/api/professor/topics/with-group"))
      .send({ title: `${TAG} بلا شيء` })
      .expect(400);
  });
});

//
// ═══ تعديل المراحل وحذفها ═══
//

describe("تعديل المرحلة وحذفها", () => {
  async function ownedMilestone() {
    const { group } = await projectFor(f.professor.id, 1);
    return milestone(group.id, days(5), "pending", 1);
  }

  it("المالك يُعدّل العنوان والحالة والموعد", async () => {
    const m = await ownedMilestone();
    const deadline = days(9);

    const res = await asMine(request(app).put(`/api/professor/milestones/${m.id}`))
      .send({
        title: `${TAG} عنوان محدَّث`,
        status: "completed",
        deadline: deadline.toISOString(),
      })
      .expect(200);
    expect(res.body).toBeTruthy();

    const after = (await prisma.milestone.findUnique({ where: { id: m.id } }))!;
    expect(after.title).toBe(`${TAG} عنوان محدَّث`);
    expect(after.status).toBe("completed");
    expect(after.deadline.toISOString()).toBe(deadline.toISOString());
  });

  it("وحالةٌ غير معروفة ⇒ 400", async () => {
    const m = await ownedMilestone();
    await asMine(request(app).put(`/api/professor/milestones/${m.id}`))
      .send({ status: "منجزة-تقريباً" })
      .expect(400);
  });

  it("والمالك يحذفها", async () => {
    const m = await ownedMilestone();

    await asMine(
      request(app).delete(`/api/professor/milestones/${m.id}`),
    ).expect(200);
    expect(
      await prisma.milestone.findUnique({ where: { id: m.id } }),
    ).toBeNull();
  });

  it("وأستاذٌ آخر لا يُعدّلها ولا يحذفها، وتبقى كما هي", async () => {
    const m = await ownedMilestone();

    const edit = await asOther(
      request(app).put(`/api/professor/milestones/${m.id}`),
    ).send({ title: `${TAG} عنوان الدخيل` });
    expect([401, 403]).toContain(edit.status);

    const del = await asOther(
      request(app).delete(`/api/professor/milestones/${m.id}`),
    );
    expect([401, 403]).toContain(del.status);

    const after = (await prisma.milestone.findUnique({ where: { id: m.id } }))!;
    expect(after.title).toBe(m.title);
  });

  it("ومرحلةٌ غير موجودة ⇒ 404 في التعديل والحذف", async () => {
    await asMine(request(app).put(`/api/professor/milestones/${NO_SUCH_ID}`))
      .send({ title: `${TAG} لا شيء` })
      .expect(404);
    await asMine(
      request(app).delete(`/api/professor/milestones/${NO_SUCH_ID}`),
    ).expect(404);
  });

  /**
   * حذف مرحلةٍ عليها تسليمات يخرق مفتاحاً أجنبياً. والمطلوب أن يُقال ذلك
   * كخطأ عميل — لا أن يُجاب بـ«خطأ خادم» فيظنّ الأستاذ أن النظام معطوب.
   */
  it("ومرحلةٌ عليها تسليمات لا تُحذف بصمت ولا بـ500", async () => {
    const { group, students } = await projectFor(f.professor.id, 1);
    const m = await milestone(group.id, days(4), "in_progress", 1);
    await prisma.submission.create({
      data: {
        fileUrl: `${TAG}/keep.pdf`,
        fileName: `${TAG}-keep.pdf`,
        version: 1,
        milestoneId: m.id,
        uploadedById: students[0]!.userId,
      },
    });

    const res = await asMine(
      request(app).delete(`/api/professor/milestones/${m.id}`),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(
      await prisma.milestone.findUnique({ where: { id: m.id } }),
    ).not.toBeNull();
  });
});
