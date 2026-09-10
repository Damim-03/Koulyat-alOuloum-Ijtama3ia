/**
 * يُعطي كل مجموعة قائمة بلا قائد قائداً — إصلاح بيانات، لا هجرة.
 *
 * قبول طلب الفريق كان ينسخ الأعضاء بلا `isLeader`، فكل مجموعة تشكّلت من طلب
 * خرجت بلا قائد. أُصلح المصدر في المرحلة 5، لكن المجموعات القائمة تبقى على
 * حالها ما لم تُصلَح صراحةً، وهذا ما يفعله هذا السكربت.
 *
 * الخلَف يُختار بالترتيب:
 *   1. المرسِل المسجَّل في الطلب الذي أنشأ المجموعة — إن كان ما يزال عضواً.
 *   2. وإلّا أقدم الأعضاء انضماماً.
 *
 * ولا يمسّ مجموعة لها قائد بالفعل. وإن وُجدت مجموعة بأكثر من قائد — وهي حالة
 * لا ينتجها أي مسار اليوم — يُبقي أقدمهم ويُنزل الباقين.
 *
 * يُشغَّل: npm run backfill:leaders        (وبـ --apply ليكتب فعلاً)
 * بلا --apply يعرض ما سيفعله ولا يكتب شيئاً.
 */
import { prisma } from "../src/core/prisma/client";

const APPLY = process.argv.includes("--apply");

(async () => {
  const groups = await prisma.projectGroup.findMany({
    include: {
      topic: { select: { title: true } },
      members: {
        orderBy: { createdAt: "asc" },
        select: {
          studentId: true,
          isLeader: true,
          student: {
            select: {
              registrationNumber: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  const plans: {
    groupId: string;
    topic: string;
    action: string;
    studentId: string;
    label: string;
    demote: string[];
  }[] = [];

  for (const g of groups) {
    if (g.members.length === 0) {
      console.log(
        `تخطّي ${g.id} («${g.topic.title}») — مجموعة بلا أعضاء إطلاقاً؛ تحتاج قراراً بشرياً.`,
      );
      continue;
    }

    const leaders = g.members.filter((m) => m.isLeader);
    if (leaders.length === 1) continue; // سليمة

    let chosen: (typeof g.members)[number] | undefined;
    let how: string;

    if (leaders.length > 1) {
      chosen = leaders[0]; // أقدمهم — الترتيب تصاعدي بـ createdAt
      how = `أكثر من قائد (${leaders.length}) ⇒ يُبقى أقدمهم`;
    } else {
      const sourceRequest = await prisma.groupRequest.findFirst({
        where: { topicId: g.topicId },
        orderBy: { createdAt: "asc" },
        select: { leaderStudentId: true },
      });
      chosen =
        g.members.find((m) => m.studentId === sourceRequest?.leaderStudentId) ??
        g.members[0];
      how =
        chosen.studentId === sourceRequest?.leaderStudentId
          ? "المرسِل المسجَّل في الطلب"
          : "أقدم الأعضاء (لا طلب مصدر، أو المرسِل لم يعد عضواً)";
    }

    const u = chosen.student.user;
    plans.push({
      groupId: g.id,
      topic: g.topic.title,
      action: how,
      studentId: chosen.studentId,
      label: `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim() ||
        chosen.student.registrationNumber,
      demote: leaders
        .filter((m) => m.studentId !== chosen!.studentId)
        .map((m) => m.studentId),
    });
  }

  if (plans.length === 0) {
    console.log("لا مجموعة تحتاج إصلاحاً — كل مجموعة قائمة لها قائد واحد.");
    await prisma.$disconnect();
    return;
  }

  console.log(`${plans.length} مجموعة تحتاج قائداً:\n`);
  for (const p of plans) {
    console.log(`  «${p.topic}»`);
    console.log(`    القائد: ${p.label}  (${p.action})`);
    if (p.demote.length) console.log(`    يُنزَّل: ${p.demote.length}`);
  }

  if (!APPLY) {
    console.log("\nعرض فقط. أضِف --apply للكتابة.");
    await prisma.$disconnect();
    return;
  }

  for (const p of plans) {
    await prisma.$transaction(async (tx) => {
      await tx.projectMember.updateMany({
        where: { groupId: p.groupId },
        data: { isLeader: false },
      });
      await tx.projectMember.update({
        where: {
          groupId_studentId: { groupId: p.groupId, studentId: p.studentId },
        },
        data: { isLeader: true },
      });
    });
  }

  const leftover = await prisma.projectGroup.count({
    where: { members: { some: {} }, AND: { members: { none: { isLeader: true } } } },
  });
  console.log(
    `\nطُبِّق على ${plans.length} مجموعة. مجموعات بأعضاء وبلا قائد الآن: ${leftover}.`,
  );

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("فشل الإصلاح:", e);
  await prisma.$disconnect();
  process.exit(1);
});
