/**
 * تجهيز قاعدة الاختبار لتشغيل Playwright، أو تنظيفها بعده.
 *
 *   npx tsx scripts/e2e-fixture.ts seed
 *   npx tsx scripts/e2e-fixture.ts teardown
 *
 * ولا يُكتب هنا بذرٌ جديد: تُستدعى `seed`/`teardown` نفساهما اللتان تستعملهما
 * ٧٩١ اختباراً في الخلفية. فما يراه المتصفّح هو ما تراه تلك الاختبارات، وإن
 * تغيّر التجهيز يوماً تغيّر عند الطرفين معاً — لا نسختان تتباعدان بصمت.
 *
 * والحارس الذي يرفض أي قاعدة لا ينتهي اسمها بـ`_test` يُحمَّل أوّل سطر، قبل
 * أن يُستورد عميل Prisma. وهو نفس الحارس، لا نسخةٌ منه.
 */
import "../tests/load-env";

import {
  seed,
  teardown,
  TEST_PASSWORD,
  TAG,
} from "../tests/helpers/fixture";
import { prisma } from "../src/core/prisma/client";

/** مواضيع منشورة يراها الطالب فعلاً في المتصفّح. */
async function publishedTopics(f: Awaited<ReturnType<typeof seed>>) {
  const now = new Date();
  const titles = [
    "نظام إدارة المكتبات",
    "كشف التزييف العميق",
    "تحليل شبكات التواصل",
  ];

  for (const [i, title] of titles.entries()) {
    await prisma.graduationTopic.create({
      data: {
        title: `${TAG} ${title}`,
        description: `${TAG} وصفٌ كافٍ لعرضه في البطاقة وفي صفحة التفصيل.`,
        maxStudents: 3,
        status: "open",
        publishedAt: now,
        professorId: i === 0 ? f.professor.id : f.professor2.id,
        specializationId: f.specialization.id,
        academicYearId: f.academicYear.id,
      },
    });
  }

  // وموضوعٌ معلَّق: تراه الإدارة في «بانتظار القرار» ولا يراه الطالب.
  await prisma.graduationTopic.create({
    data: {
      title: `${TAG} مقترحٌ بانتظار القرار`,
      description: `${TAG} وصف`,
      maxStudents: 2,
      status: "pending",
      professorId: f.professor.id,
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    },
  });
}

async function main() {
  const command = process.argv[2];

  if (command === "seed") {
    await teardown(); // تشغيلٌ سابقٌ انقطع لا يُفسد هذا
    const f = await seed(12);

    // سنةٌ نشطة: شاشاتٌ عدّة تقرأها، وبدونها تبدو اللوحة معطوبة بلا سبب.
    await prisma.academicYear.updateMany({ data: { isActive: false } });
    await prisma.academicYear.update({
      where: { id: f.academicYear.id },
      data: { isActive: true },
    });

    await publishedTopics(f);

    // ما يحتاجه المتصفّح للدخول — يُقرأ من الملفّ في `global-setup`.
    const out = {
      password: TEST_PASSWORD,
      admin: { email: f.admin.email },
      admin2: { email: f.admin2.email },
      professor: { universityEmail: f.professor.universityEmail },
      student: { registrationNumber: f.students[0]!.reg },
      studentNoProject: { registrationNumber: f.students[1]!.reg },
      specializationId: f.specialization.id,
      academicYearId: f.academicYear.id,
    };
    process.stdout.write(JSON.stringify(out));
  } else if (command === "teardown") {
    await teardown();
  } else {
    throw new Error('استعمال: e2e-fixture.ts seed | teardown');
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
