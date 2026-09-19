/**
 * جرس الإدارة — أن يصله شيء.
 *
 * الجانب القارئ منه مُختبَرٌ سلفاً: صفحاتٌ وعدّادُ غير مقروء و«اقرأ الكلّ».
 * لكن التغطية كشفت أن `notifyAdmins` — وهي الدالّة المكتوبة لهذا الغرض
 * بالذات، ويقول تعليقها حرفياً «أستاذٌ اقترح موضوعاً ⇒ أبلِغ كل المديرين» —
 * **لا يستدعيها أحدٌ في المستودع كلّه**. وفحصُ وجهات الإشعارات العشرة أكّد
 * الأثر: كلّها إلى طلبةٍ وأساتذة، ولا واحدة إلى مدير.
 *
 * أي أن الجرس كان يعمل ويبقى فارغاً أبداً. وهذا الملفّ هو الشاهد على وصله.
 *
 * وثلاثة أسئلة تحكمه:
 *
 *   **هل يصل؟** ثلاثة أفعالٍ تنتظر قرار الإدارة: موضوعٌ مقترَح، وموضوعٌ
 *     مقترَحٌ بفريقه، وطلبُ مجموعة.
 *
 *   **هل يصل الجميع؟** المدير **والمالك** معاً — والمالك دورٌ فوق المدير،
 *     فإسقاطه يعني أن أعلى صلاحيةٍ في النظام أقلّها علماً.
 *
 *   **وهل يبقى الفعل ناجحاً إن سقط الإشعار؟** الموضوع يكون قد كُتب وثبت،
 *     فردُّ ٥٠٠ بعده يدفع صاحبه إلى إعادة المحاولة فيُنشئه مرّتين.
 */
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/core/prisma/client";
import * as notifications from "../../src/modules/notification/notification.service";
import {
  seed,
  teardown,
  residue,
  TEST_PASSWORD,
  TAG,
  type Fixture,
} from "../helpers/fixture";

let f: Fixture;
let professorToken = "";

let n = 0;

/**
 * لقطةُ معرّفات إشعارات هؤلاء الآن — تُؤخذ قبل الفعل.
 *
 * والفرق يُقاس بالمعرّفات لا بالوقت. جرّبتُ نافذةً زمنية أوّلاً فالتقطت
 * إشعارات الاختبارات السابقة: كلّها تقع في الثانية نفسها. والمعرّف لا يكذب،
 * ولا يعتمد على دقّة ساعةٍ ولا على ترتيب تشغيل.
 */
const snapshot = async (...userIds: string[]) =>
  new Set(
    (
      await prisma.notification.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      })
    ).map((r) => r.id),
  );

/** ما وصل جرس هذا المستخدم بعد اللقطة. */
const arrived = async (userId: string, before: Set<string>) =>
  (
    await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
  ).filter((r) => !before.has(r.id));

/** كل من يُحتمل أن يصله شيء في هذا الملفّ. */
const everyone = () => [
  f.admin.id,
  f.admin2.id,
  f.profUser.id,
  f.prof2User.id,
  ...f.students.map((s) => s.userId),
];

beforeAll(async () => {
  await teardown();
  f = await seed(20);

  const login = async (path: string, body: Record<string, string>) =>
    (await request(app).post(path).send(body).expect(200)).body
      .accessToken as string;

  professorToken = await login("/api/auth/professor/login", {
    universityEmail: f.professor.universityEmail,
    password: TEST_PASSWORD,
  });
});

afterAll(async () => {
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ الوصول ═══
//

describe("ما يصل جرس الإدارة", () => {
  it("موضوعٌ يقترحه أستاذ ⇒ يصل المدير والمالك معاً", async () => {
    const before = await snapshot(...everyone());
    const title = `${TAG} مقترح الجرس ${++n}`;

    await request(app)
      .post("/api/professor/topics")
      .set("Authorization", `Bearer ${professorToken}`)
      .send({
        title,
        description: `${TAG} وصف`,
        maxStudents: 2,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      })
      .expect(201);

    for (const who of [f.admin, f.admin2]) {
      const bell = await arrived(who.id, before);
      expect(bell).toHaveLength(1);
      expect(bell[0]!.title).toContain("بانتظار القرار");
      expect(bell[0]!.message).toContain(title);
      expect(bell[0]!.link).toBe("/admin/topics");
      expect(bell[0]!.isRead).toBe(false);
    }
  });

  it("وموضوعٌ بفريقه ⇒ يصل كذلك، ويذكر عدد الطلبة", async () => {
    const before = await snapshot(...everyone());
    const team = f.nextStudents(2);
    const title = `${TAG} مقترح بفريق ${++n}`;

    await request(app)
      .post("/api/professor/topics/with-group")
      .set("Authorization", `Bearer ${professorToken}`)
      .send({
        title,
        description: `${TAG} وصف`,
        maxStudents: 3,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
        memberRegistrationNumbers: team.map((s) => s.reg),
        leaderRegistrationNumber: team[0]!.reg,
      })
      .expect(201);

    const bell = await arrived(f.admin.id, before);
    expect(bell).toHaveLength(1);
    expect(bell[0]!.message).toContain(title);
    expect(bell[0]!.message).toContain("2");

    // والطلبة يُشعَرون هم أيضاً — الوصلُ الجديد لم يُلغِ القديم.
    for (const s of team)
      expect(await arrived(s.userId, before)).not.toHaveLength(0);
  });

  it("وطلبُ مجموعة من الطلبة ⇒ يصل ويشير إلى شاشة الطلبات", async () => {
    const before = await snapshot(...everyone());
    const topic = await prisma.graduationTopic.create({
      data: {
        title: `${TAG} موضوع الطلب ${++n}`,
        description: `${TAG} وصف`,
        maxStudents: 3,
        status: "open",
        publishedAt: new Date(),
        professorId: f.professor.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });

    const team = f.nextStudents(1);
    const leaderToken = (
      await request(app)
        .post("/api/auth/student/login")
        .send({
          registrationNumber: team[0]!.reg,
          password: TEST_PASSWORD,
        })
        .expect(200)
    ).body.accessToken as string;

    await request(app)
      .post("/api/student/group-requests")
      .set("Authorization", `Bearer ${leaderToken}`)
      .send({
        topicId: topic.id,
        memberStudentIds: [team[0]!.id],
        priority: 1,
      })
      .expect(201);

    const bell = await arrived(f.admin.id, before);
    expect(bell).toHaveLength(1);
    expect(bell[0]!.title).toContain("طلبُ مجموعة");
    expect(bell[0]!.message).toContain(topic.title);
    expect(bell[0]!.link).toBe("/admin/group-requests");
  });

  /**
   * الجرس القارئ مُختبَرٌ على حدة، لكن الوصلة بين الطرفين لم تكن قائمة أصلاً:
   * لا شيء يُكتب فلا شيء يُقرأ. وهذا التأكيد يُغلق الدائرة — من الفعل إلى
   * الصفّ إلى ما يراه المدير على المسار.
   */
  it("وما وصل يظهر في المسار الذي تقرأه الشاشة", async () => {
    const adminToken = (
      await request(app)
        .post("/api/auth/admin/login")
        .send({ email: f.admin.email!, password: TEST_PASSWORD })
        .expect(200)
    ).body.accessToken as string;

    const before = (
      await request(app)
        .get("/api/admin/notifications/unread-count")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200)
    ).body.unread as number;

    const title = `${TAG} مقترح الدائرة ${++n}`;
    await request(app)
      .post("/api/professor/topics")
      .set("Authorization", `Bearer ${professorToken}`)
      .send({
        title,
        description: `${TAG} وصف`,
        maxStudents: 2,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      })
      .expect(201);

    const after = (
      await request(app)
        .get("/api/admin/notifications/unread-count")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200)
    ).body.unread as number;
    expect(after).toBe(before + 1);

    const list = await request(app)
      .get("/api/admin/notifications")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(JSON.stringify(list.body.items)).toContain(title);
  });
});

//
// ═══ مَن يُبلَّغ ومَن لا ═══
//

describe("مَن يُبلَّغ", () => {
  it("الطلبة والأساتذة لا يُبلَّغون بما يخصّ الإدارة", async () => {
    const before = await snapshot(...everyone());

    await request(app)
      .post("/api/professor/topics")
      .set("Authorization", `Bearer ${professorToken}`)
      .send({
        title: `${TAG} لا يُبلَّغ به غير الإدارة ${++n}`,
        description: `${TAG} وصف`,
        maxStudents: 2,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      })
      .expect(201);

    // صاحب المقترح نفسه لا يُشعَر بمقترحه.
    expect(await arrived(f.profUser.id, before)).toHaveLength(0);
    expect(await arrived(f.prof2User.id, before)).toHaveLength(0);
    expect(await arrived(f.students[0]!.userId, before)).toHaveLength(0);
  });

  /**
   * `notifyRoles` تُرشِّح بـ`status: "active"`. ومديرٌ موقوف لا يعمل، فإرسال
   * إشعارٍ إليه يُراكم صفوفاً لا يقرأها أحد — والأسوأ أنه يُوهم الإدارة بأن
   * أحداً أُبلِغ.
   */
  it("والمدير الموقوف لا يُبلَّغ", async () => {
    await prisma.user.update({
      where: { id: f.admin2.id },
      data: { status: "suspended" },
    });

    try {
      const before = await snapshot(...everyone());
      await request(app)
        .post("/api/professor/topics")
        .set("Authorization", `Bearer ${professorToken}`)
        .send({
          title: `${TAG} أثناء الإيقاف ${++n}`,
          description: `${TAG} وصف`,
          maxStudents: 2,
          specializationId: f.specialization.id,
          academicYearId: f.academicYear.id,
        })
        .expect(201);

      expect(await arrived(f.admin2.id, before)).toHaveLength(0);
      // والمدير النشط يبقى مُبلَّغاً: الترشيح لا يُسكت الجرس كلّه.
      expect(await arrived(f.admin.id, before)).toHaveLength(1);
    } finally {
      await prisma.user.update({
        where: { id: f.admin2.id },
        data: { status: "active" },
      });
    }
  });
});

//
// ═══ الإشعار لا يُفشِل ما تسبّب فيه ═══
//

describe("سقوط الإشعار لا يُسقط الفعل", () => {
  /**
   * أهمّ تأكيدٍ في الملفّ.
   *
   * الموضوع يُكتب أوّلاً ثم يُبلَّغ. فلو رمى التبليغ وسُمح للرمية بالصعود
   * لعاد فعلٌ **ناجح** بـ٥٠٠، ولأعاد الأستاذ المحاولة، ولصار في القاعدة
   * موضوعان. والإشعار الضائع أهون من ذلك بما لا يُقاس.
   */
  it("موضوعٌ يُنشأ حتى لو تعذّر إشعار الإدارة", async () => {
    const spy = jest
      .spyOn(notifications, "notifyAdmins")
      .mockRejectedValue(new Error("القاعدة تعثّرت"));
    const quiet = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      const title = `${TAG} رغم سقوط الجرس ${++n}`;
      const res = await request(app)
        .post("/api/professor/topics")
        .set("Authorization", `Bearer ${professorToken}`)
        .send({
          title,
          description: `${TAG} وصف`,
          maxStudents: 2,
          specializationId: f.specialization.id,
          academicYearId: f.academicYear.id,
        });

      expect(res.status).toBe(201);
      expect(
        await prisma.graduationTopic.findFirst({ where: { title } }),
      ).not.toBeNull();

      // ولا يُبتلع السقوط صامتاً: سطرٌ في السجلّ يدلّ عليه.
      expect(
        quiet.mock.calls.some((c) => String(c[0]).includes("notifyAdmins")),
      ).toBe(true);
    } finally {
      spy.mockRestore();
      quiet.mockRestore();
    }
  });
});
