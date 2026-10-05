/**
 * لوحة الطالب — GET /api/student/dashboard.
 *
 * قراءةٌ واحدة تجمع ما يفتح الطالبُ المنصّةَ ليعرفه، وكلّها اشتقاق: أين
 * يقف من المسار، وما المتأخّر، وما يستحقّ هذا الأسبوع، وكم موضوعاً ما يزال
 * متاحاً له. والاشتقاق بلا اختبارٍ حسابٌ لا يُراجعه أحد.
 *
 * وثلاثة أسئلة تحكم هذا الملفّ:
 *
 *   **هل المرحلة صحيحة؟** بلا طلب ← اختيار، بطلبٍ معلّق ← انتظار، بمشروع ←
 *     إنجاز، بمناقشةٍ مبرمجة أو تمّت ← ما يقابلها.
 *
 *   **هل يرى العضوُ طلبَ فريقه؟** الطلب يرسله المسؤول وحده، والعضو كان
 *     يُقال له «لم ترسل أي طلب» وفريقه ينتظر قرار الإدارة.
 *
 *   **هل تقف اللوحة عند حدّ صاحبها؟** طلبُ غيره ومشروعُ غيره لا يظهران.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import {
  seed,
  teardown,
  residue,
  makeTopic,
  TEST_PASSWORD,
  TAG,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;

const DAY = 86_400_000;
const days = (n: number) => new Date(Date.now() + n * DAY);

let n = 0;

type Student = { id: string; userId: string; reg: string };

const login = async (reg: string) =>
  (
    await request(app)
      .post("/api/auth/student/login")
      .send({ registrationNumber: reg, password: TEST_PASSWORD })
      .expect(200)
  ).body.accessToken as string;

type Dashboard = {
  student: { registrationNumber: string };
  stage: string;
  availableTopics: number;
  requests: {
    id: string;
    status: string;
    isLeader: boolean;
    membersCount: number;
  }[];
  project: null | {
    id: string;
    milestones: { id: string; submissions: number }[];
    progress: { total: number; completed: number; overdue: number; percent: number };
    nextMilestone: { id: string } | null;
    defense: { status: string; grade: number | null } | null;
    supervisionDocument: { documentNumber: string } | null;
  };
  attention: {
    overdueMilestones: { id: string }[];
    dueThisWeek: { id: string }[];
    rejectedRequests: { id: string }[];
  };
};

/** يدخل بالطالب ويقرأ لوحته. */
async function dashboard(s: Student) {
  const token = await login(s.reg);
  return (
    await request(app)
      .get("/api/student/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
  ).body as Dashboard;
}

/** طلبُ فريقٍ بحالته — الحيُّ منه يحجز الموضوع كما يفعل المسار الحقيقيّ. */
async function requestFor(
  leader: Student,
  mates: Student[],
  status: "pending" | "accepted" | "rejected" = "pending",
  rejectionReason: string | null = null,
) {
  const topic = await makeTopic(f, `طلب ${++n}`, "open");
  return prisma.groupRequest.create({
    data: {
      topicId: topic.id,
      activeTopicId: status === "rejected" ? null : topic.id,
      leaderStudentId: leader.id,
      status,
      rejectionReason,
      members: {
        create: [leader, ...mates].map((s) => ({ studentId: s.id })),
      },
    },
  });
}

/** مشروعٌ قائمٌ لهؤلاء الطلبة، أوّلهم المسؤول. */
async function projectFor(students: Student[]) {
  const topic = await makeTopic(f, `مشروع ${++n}`, "full");
  const group = await prisma.projectGroup.create({
    data: { topicId: topic.id },
  });
  await prisma.projectMember.createMany({
    data: students.map((s, i) => ({
      groupId: group.id,
      studentId: s.id,
      isLeader: i === 0,
    })),
  });
  return { topic, group };
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

beforeAll(async () => {
  await teardown();
  f = await seed(20);
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ المرحلة ═══
//

describe("لوحة الطالب — المرحلة", () => {
  it("طالبٌ بلا شيء: يختار موضوعاً، ولا مشروع ولا طلبات", async () => {
    const [s] = f.nextStudents(1);
    const d = await dashboard(s);

    expect(d.stage).toBe("choose_topic");
    expect(d.project).toBeNull();
    expect(d.requests).toEqual([]);
    expect(d.student.registrationNumber).toBe(s.reg);
    expect(d.attention).toEqual({
      overdueMilestones: [],
      dueThisWeek: [],
      rejectedRequests: [],
    });
  });

  it("بطلبٍ معلّق: ينتظر القرار — والعضوُ يراه كما يراه المسؤول", async () => {
    const [leader, mate] = f.nextStudents(2);
    const req = await requestFor(leader, [mate]);

    const mine = await dashboard(leader);
    expect(mine.stage).toBe("awaiting_decision");
    expect(mine.requests).toEqual([
      expect.objectContaining({ id: req.id, isLeader: true, membersCount: 2 }),
    ]);

    const theirs = await dashboard(mate);
    expect(theirs.stage).toBe("awaiting_decision");
    expect(theirs.requests).toEqual([
      expect.objectContaining({ id: req.id, isLeader: false }),
    ]);
  });

  it("بمشروعٍ بلا مناقشة: ينجز المراحل", async () => {
    const [s] = f.nextStudents(1);
    await projectFor([s]);

    const d = await dashboard(s);
    expect(d.stage).toBe("in_progress");
    expect(d.project).not.toBeNull();
    expect(d.project!.defense).toBeNull();
  });

  it("بمناقشةٍ مبرمجة ثمّ تمّت: تتبعها المرحلة، والعلامة تصل", async () => {
    const [s] = f.nextStudents(1);
    const { group } = await projectFor([s]);
    const defense = await prisma.defense.create({
      data: { groupId: group.id, date: days(10), room: "A1" },
    });

    expect((await dashboard(s)).stage).toBe("defense_scheduled");

    await prisma.defense.update({
      where: { id: defense.id },
      data: { status: "completed", grade: 16.5 },
    });
    const d = await dashboard(s);
    expect(d.stage).toBe("defended");
    expect(d.project!.defense).toEqual(
      expect.objectContaining({ status: "completed", grade: 16.5 }),
    );
  });
});

//
// ═══ المراحل: المتأخّر، وهذا الأسبوع، والتالي ═══
//

describe("لوحة الطالب — المراحل", () => {
  it("المتأخّر متأخّر، والمنجز ليس متأخّراً وإن فات موعده", async () => {
    const [s] = f.nextStudents(1);
    const { group } = await projectFor([s]);

    const late = await milestone(group.id, days(-3), "in_progress", 1);
    const doneLate = await milestone(group.id, days(-10), "completed", 2);
    const thisWeek = await milestone(group.id, days(3), "pending", 3);
    const later = await milestone(group.id, days(20), "pending", 4);
    const soonest = await milestone(group.id, days(1), "pending", 5);

    const d = await dashboard(s);
    const p = d.project!;

    expect(p.progress).toEqual({
      total: 5,
      completed: 1,
      overdue: 1,
      percent: 20,
    });
    expect(d.attention.overdueMilestones.map((m) => m.id)).toEqual([late.id]);
    expect(d.attention.dueThisWeek.map((m) => m.id).sort()).toEqual(
      [thisWeek.id, soonest.id].sort(),
    );
    // الأقرب موعداً، لا الأسبق ترتيباً — والمتأخّرُ ليس «التالي».
    expect(p.nextMilestone?.id).toBe(soonest.id);

    const ids = d.attention.dueThisWeek.map((m) => m.id);
    expect(ids).not.toContain(later.id);
    expect(ids).not.toContain(doneLate.id);
  });

  it("المرحلة المعلَّمة متأخّرةً تُعدّ متأخّرة ولو لم يفت موعدها", async () => {
    const [s] = f.nextStudents(1);
    const { group } = await projectFor([s]);
    const flagged = await milestone(group.id, days(5), "overdue");

    const d = await dashboard(s);
    expect(d.attention.overdueMilestones.map((m) => m.id)).toEqual([
      flagged.id,
    ]);
    expect(d.attention.dueThisWeek).toEqual([]);
    expect(d.project!.nextMilestone).toBeNull();
  });

  it("تعدّ الملفّات المسلَّمة لكلّ مرحلة", async () => {
    const [s] = f.nextStudents(1);
    const { group } = await projectFor([s]);
    const m = await milestone(group.id, days(4));
    await prisma.submission.createMany({
      data: [1, 2].map((version) => ({
        milestoneId: m.id,
        uploadedById: s.userId,
        fileUrl: `/uploads/${TAG}-${version}.pdf`,
        fileName: `${TAG}-${version}.pdf`,
        version,
      })),
    });

    const d = await dashboard(s);
    expect(d.project!.milestones).toEqual([
      expect.objectContaining({ id: m.id, submissions: 2 }),
    ]);
  });
});

//
// ═══ الطلبات المرفوضة ═══
//

describe("لوحة الطالب — الرفض", () => {
  it("يُنبَّه إلى الرفض ما دام بلا طلبٍ حيّ، ويسكت حين يُرسل غيره", async () => {
    const [s] = f.nextStudents(1);
    const rejected = await requestFor(s, [], "rejected", "عضوٌ ناقص");

    const before = await dashboard(s);
    expect(before.stage).toBe("choose_topic");
    expect(before.attention.rejectedRequests.map((r) => r.id)).toEqual([
      rejected.id,
    ]);

    await requestFor(s, []);
    const after = await dashboard(s);
    expect(after.stage).toBe("awaiting_decision");
    expect(after.attention.rejectedRequests).toEqual([]);
    // والأثرُ باقٍ في القائمة، وإنّما خرج من «يحتاج انتباهك».
    expect(after.requests.map((r) => r.id)).toContain(rejected.id);
  });
});

//
// ═══ المواضيع المتاحة ═══
//

describe("لوحة الطالب — المواضيع المتاحة", () => {
  it("يعدّ المتاح في تخصّصه وحده، لا المحجوز ولا المنتظِر ولا تخصّصاً آخر", async () => {
    const [s] = f.nextStudents(1);
    const base = (await dashboard(s)).availableTopics;

    await makeTopic(f, "متاح منشور", "open");
    await makeTopic(f, "متاح معتمد", "approved");
    await makeTopic(f, "بانتظار الإدارة", "pending");
    await projectFor(f.nextStudents(1)); // مأخوذ بمجموعة
    await requestFor(f.nextStudents(1)[0], []); // محجوز بطلبٍ حيّ

    const other = await prisma.specialization.create({
      data: { name: `${TAG} spec other`, level: "master", filiereId: f.filiere.id },
    });
    await prisma.graduationTopic.create({
      data: {
        title: `${TAG} تخصّص آخر`,
        description: `${TAG} description`,
        maxStudents: 3,
        status: "open",
        publishedAt: new Date(),
        professorId: f.professor.id,
        specializationId: other.id,
        academicYearId: f.academicYear.id,
      },
    });

    expect((await dashboard(s)).availableTopics).toBe(base + 2);
  });
});

//
// ═══ الحدود ═══
//

describe("لوحة الطالب — الحدود", () => {
  it("لا يرى طلبَ غيره ولا مشروعه", async () => {
    const [owner, stranger] = f.nextStudents(2);
    await requestFor(owner, []);
    await projectFor([owner]);

    const d = await dashboard(stranger);
    expect(d.requests).toEqual([]);
    expect(d.project).toBeNull();
    expect(d.stage).toBe("choose_topic");
  });

  it("وليست لغير الطلبة", async () => {
    const res = await request(app)
      .post("/api/auth/professor/login")
      .send({
        universityEmail: f.professor.universityEmail,
        password: TEST_PASSWORD,
      })
      .expect(200);

    await request(app)
      .get("/api/student/dashboard")
      .set("Authorization", `Bearer ${res.body.accessToken}`)
      .expect(403);
  });
});
