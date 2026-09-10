/**
 * بيانات اختبار قابلة للتخلّص، ومشتركة بين كل الاختبارات.
 *
 * كل صفّ يحمل الوسم `__TEST__` في حقلٍ فريد، فيستطيع `teardown` العثور عليه
 * وحذفه، ويستطيع `residue` إثبات أنه لم يبقَ منه شيء. لا يُلمَس أي صفّ لا
 * يحمل الوسم — وإن كانت قاعدة الاختبار منفصلة أصلاً، فالانضباط نفسه هو ما
 * يجعل هذه الوحدة صالحة للاستعمال في أي مكان.
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/core/prisma/client";

export const TAG = "__TEST__";

/**
 * وسمٌ ثانٍ لنطاقات البريد الجامعي.
 *
 * `UniversityDomain.domain` يمرّ بتعبيرٍ نمطي لا يقبل الشرطة السفلية، فلا
 * يصلح `__TEST__` وسماً له. ولاحقةٌ لا يمكن أن تكون نطاقاً حقيقياً تؤدّي
 * الغرض نفسه: `teardown` يعرفها، ولا شيء خارج الاختبارات يحملها.
 */
export const TEST_DOMAIN_SUFFIX = "jest-fixture-test";

/** كلمة سرّ اختبارية معروفة — لا قيمة لها خارج قاعدة الاختبار. */
export const TEST_PASSWORD = "Test-Passw0rd!";

export type Fixture = Awaited<ReturnType<typeof seed>>;

export async function seed(studentCount = 6) {
  const hash = await bcrypt.hash(TEST_PASSWORD, 4); // 4 جولات: الاختبارات لا تُحمى

  const faculty = await prisma.faculty.create({
    data: { name: `${TAG} faculty`, code: `${TAG}-FAC` },
  });
  const department = await prisma.department.create({
    data: { name: `${TAG} dept`, code: `${TAG}-DEP`, facultyId: faculty.id },
  });
  const filiere = await prisma.filiere.create({
    data: {
      name: `${TAG} filiere`,
      code: `${TAG}-FIL`,
      departmentId: department.id,
    },
  });
  const specialization = await prisma.specialization.create({
    data: { name: `${TAG} spec`, level: "master", filiereId: filiere.id },
  });
  const academicYear = await prisma.academicYear.create({
    data: { title: `${TAG} 2099/2100` },
  });

  const admin = await prisma.user.create({
    data: {
      firstName: TAG,
      lastName: "Admin",
      email: `${TAG}.admin@test.local`,
      password: hash,
      role: "admin",
    },
  });

  /*
   * مالكٌ إلى جانب المدير.
   *
   * ثلاثة مسارات حذف محميّة بـ`ownerOnly()` — حذف حساب، وحذف طالب، وحذف
   * أستاذ. وهذا امتيازٌ **فوق** المدير، فلا يُختبَر بحساب مدير وحده: يلزم من
   * يملكه ومن لا يملكه، وإلا بقي الفرق بين الدورين دعوى بلا شاهد.
   */
  const owner = await prisma.user.create({
    data: {
      firstName: TAG,
      lastName: "Owner",
      email: `${TAG}.owner@test.local`,
      password: hash,
      role: "owner",
    },
  });

  const profUser = await prisma.user.create({
    data: {
      firstName: TAG,
      lastName: "Prof",
      email: `${TAG}.prof@test.local`,
      password: hash,
      role: "professor",
    },
  });
  const professor = await prisma.professor.create({
    data: {
      employeeNumber: `${TAG}-EMP`,
      universityEmail: `${TAG}.emp@test.local`,
      userId: profUser.id,
      departmentId: department.id,
    },
  });

  /*
   * أستاذ ثانٍ.
   *
   * حُرّاس الملكية في وحدة الأستاذ («لا تملك هذا الموضوع») لا يمكن اختبارها
   * بأستاذ واحد إطلاقاً: يلزم صاحبٌ ودخيل. وبدون الثاني تبقى تلك الحُرّاس
   * أسطراً لم تُنفَّذ قطّ — وهو ما كانت التغطية تقوله بـ«٠٪ فروع».
   */
  const prof2User = await prisma.user.create({
    data: {
      firstName: TAG,
      lastName: "Prof2",
      email: `${TAG}.prof2@test.local`,
      password: hash,
      role: "professor",
    },
  });
  const professor2 = await prisma.professor.create({
    data: {
      employeeNumber: `${TAG}-EMP2`,
      universityEmail: `${TAG}.emp2@test.local`,
      userId: prof2User.id,
      departmentId: department.id,
    },
  });

  /*
   * الطلبة يُنشَؤون دفعتين لا صفّاً صفّاً.
   *
   * الحلقة السابقة كانت تُرسل رحلتين لكل طالب — ٣٢٠ رحلة لستّين ومئة — فتقارب
   * مهلة `beforeAll` في التشغيل العادي وتتجاوزها تحت التغطية. وحين تنقضي
   * المهلة يقطع Jest الخطّاف بينما الإنشاء جارٍ، ثم يمسح `afterAll` المستخدمين
   * من تحته، فيسقط ما بقي بـ«مفتاح أجنبي مخروق» — عطلٌ مربك سببه البطء لا
   * المنطق.
   *
   * والمعرّفات تُولَّد هنا لأن `createMany` لا تُعيد الصفوف المُنشأة.
   */
  const rows = Array.from({ length: studentCount }, (_, i) => ({
    userId: randomUUID(),
    studentId: randomUUID(),
    email: `${TAG}.s${i + 1}@test.local`,
    reg: `${TAG}-REG-${i + 1}`,
    index: i + 1,
  }));

  await prisma.user.createMany({
    data: rows.map((r) => ({
      id: r.userId,
      firstName: TAG,
      lastName: `Student${r.index}`,
      email: r.email,
      password: hash,
      role: "student" as const,
    })),
  });

  await prisma.student.createMany({
    data: rows.map((r) => ({
      id: r.studentId,
      registrationNumber: r.reg,
      userId: r.userId,
      specializationId: specialization.id,
      academicYearId: academicYear.id,
    })),
  });

  const students = rows.map((r) => ({
    id: r.studentId,
    userId: r.userId,
    reg: r.reg,
    email: r.email,
  }));

  // موزّع: كل اختبار يأخذ طلبة لم يُستعملوا قطّ، فلا تتسرّب حالة بينها.
  let cursor = 0;

  return {
    faculty,
    department,
    filiere,
    specialization,
    academicYear,
    admin,
    owner,
    profUser,
    professor,
    prof2User,
    professor2,
    students,
    nextStudents(n: number) {
      if (cursor + n > students.length)
        throw new Error(
          `نفد طلبة الاختبار: طُلب ${n} ولم يبقَ إلا ${students.length - cursor}.`,
        );
      return students.slice(cursor, (cursor += n));
    },
  };
}

export async function makeTopic(
  f: Fixture,
  title: string,
  status: string,
  maxStudents = 3,
) {
  return prisma.graduationTopic.create({
    data: {
      title: `${TAG} ${title}`,
      description: `${TAG} description`,
      maxStudents,
      status: status as never,
      // موضوع يبدأ `open` هو موضوع نُشر، و`publishedAt` هو ما يشهد بذلك.
      publishedAt: status === "open" ? new Date() : null,
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
}

/**
 * حذف من الأعمق إلى الأسطح، حتى لا يبقى مفتاح أجنبي معلّقاً.
 *
 * والمواضيع تُجمع بشرطين لا بواحد: العنوان الموسوم، **أو** الانتماء إلى
 * أستاذ موسوم. العنوان وحده لا يكفي لأن الاختبارات تُعدّل العناوين — وقد
 * حدث فعلاً: اختبارٌ يجرّب حارس الملكية أعاد تسمية موضوع إلى «عنوان
 * الدخيل»، فخرج من نطاق الوسم، فتعذّر حذف الأستاذ المرتبط به وسقط كل
 * تشغيل بعده بخطأ مفتاح أجنبي لا علاقة له بما يُختبَر.
 */
export async function teardown() {
  const professorIds = (
    await prisma.professor.findMany({
      where: { employeeNumber: { startsWith: TAG } },
      select: { id: true },
    })
  ).map((x) => x.id);

  const topicIds = (
    await prisma.graduationTopic.findMany({
      where: {
        OR: [
          { title: { startsWith: TAG } },
          { professorId: { in: professorIds } },
        ],
      },
      select: { id: true },
    })
  ).map((t) => t.id);
  const groupIds = (
    await prisma.projectGroup.findMany({
      where: { topicId: { in: topicIds } },
      select: { id: true },
    })
  ).map((g) => g.id);

  await prisma.submission.deleteMany({
    where: { milestone: { groupId: { in: groupIds } } },
  });
  await prisma.milestone.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.defenseCommitteeMember.deleteMany({
    where: { defense: { groupId: { in: groupIds } } },
  });
  await prisma.defense.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.projectMember.deleteMany({
    where: { groupId: { in: groupIds } },
  });
  await prisma.projectGroup.deleteMany({ where: { id: { in: groupIds } } });
  await prisma.groupRequestMember.deleteMany({
    where: { request: { topicId: { in: topicIds } } },
  });
  await prisma.groupRequest.deleteMany({ where: { topicId: { in: topicIds } } });
  await prisma.topicApplication.deleteMany({
    where: { topicId: { in: topicIds } },
  });
  await prisma.graduationTopic.deleteMany({ where: { id: { in: topicIds } } });

  await prisma.notification.deleteMany({
    where: { user: { email: { startsWith: TAG } } },
  });
  await prisma.student.deleteMany({
    where: { registrationNumber: { startsWith: TAG } },
  });
  await prisma.professor.deleteMany({
    where: { employeeNumber: { startsWith: TAG } },
  });
  /*
   * الجلسات المُبطَلة تُجمع بالمستخدم لا بالوسم: مفتاحها `sid` عشوائي، ولا
   * مفتاح أجنبي يربطها بالمستخدم — فحذفُه لا يجرّها معه، وتبقى صفوفاً
   * يتيمة لا يعرف أحدٌ لمن كانت.
   */
  const taggedUserIds = (
    await prisma.user.findMany({
      where: { email: { startsWith: TAG } },
      select: { id: true },
    })
  ).map((u) => u.id);
  await prisma.revokedSession.deleteMany({
    where: { userId: { in: taggedUserIds } },
  });

  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.specialization.deleteMany({
    where: { name: { startsWith: TAG } },
  });
  await prisma.filiere.deleteMany({ where: { code: { startsWith: TAG } } });
  // الميدان بعد الشعبة وقبل القسم: الشعبة تشير إليه، وهو يشير إلى القسم.
  await prisma.domain.deleteMany({ where: { code: { startsWith: TAG } } });
  await prisma.department.deleteMany({ where: { code: { startsWith: TAG } } });
  await prisma.faculty.deleteMany({ where: { code: { startsWith: TAG } } });
  await prisma.academicYear.deleteMany({
    where: { title: { startsWith: TAG } },
  });
  await prisma.universityDomain.deleteMany({
    where: { domain: { endsWith: TEST_DOMAIN_SUFFIX } },
  });
}

/** عدد الصفوف التي ما تزال تحمل الوسم — يجب أن يكون صفراً بعد كل تشغيل. */
export async function residue(): Promise<number> {
  const counts = await Promise.all([
    prisma.graduationTopic.count({ where: { title: { startsWith: TAG } } }),
    prisma.user.count({ where: { email: { startsWith: TAG } } }),
    prisma.faculty.count({ where: { code: { startsWith: TAG } } }),
    prisma.academicYear.count({ where: { title: { startsWith: TAG } } }),
    prisma.domain.count({ where: { code: { startsWith: TAG } } }),
    prisma.universityDomain.count({
      where: { domain: { endsWith: TEST_DOMAIN_SUFFIX } },
    }),
  ]);
  return counts.reduce((a, b) => a + b, 0);
}
