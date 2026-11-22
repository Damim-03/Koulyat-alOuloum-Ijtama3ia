/**
 * تدقيق ثوابت حالة الموضوع — قراءة فقط، لا يكتب شيئاً ولا ينشئ بيانات.
 *
 * الثابت الحاكم:
 *   `GraduationTopic.status` إسقاطٌ محسوب، لا مصدر حقيقة. مصدرا الحقيقة:
 *     - قرار الإدارة: pending / rejected / archived، وإلا فـ«معتمد» + هل نُشر؟
 *     - واقعة الإشغال: هل للموضوع ProjectGroup؟
 *
 *   project(topic) =
 *     status ∈ {pending, rejected, archived} → كما هو
 *     projectGroup ≠ null                    → "full"
 *     publishedAt  ≠ null                    → "open"
 *     غير ذلك                                → "approved"
 *
 * يُشغَّل: npm run audit:topics
 * يخرج بـ 0 إذا لم يُخرَق شيء، وبـ 1 إن وُجد خرق واحد على الأقل.
 */
import { prisma } from "../src/core/prisma/client";

type Finding = {
  invariant: string;
  what: string;
  count: number;
  /** أمثلة لتسهيل التتبّع — معرّفات لا أكثر. */
  samples: string[];
  /** خرق فعلي أم ملاحظة لا تُفشِل التدقيق. */
  severity: "violation" | "note";
};

const findings: Finding[] = [];

const record = async (
  invariant: string,
  what: string,
  severity: Finding["severity"],
  ids: () => Promise<{ id: string }[]>,
) => {
  const rows = await ids();
  findings.push({
    invariant,
    what,
    count: rows.length,
    samples: rows.slice(0, 5).map((r) => r.id),
    severity,
  });
};

(async () => {
  // ─── I1 — status = "full" ⟺ للموضوع مجموعة ───────────────────
  await record(
    "I1",
    'status = "full" بينما لا توجد ProjectGroup',
    "violation",
    () =>
      prisma.graduationTopic.findMany({
        where: { status: "full", projectGroup: null },
        select: { id: true },
      }),
  );

  await record(
    "I1",
    'للموضوع ProjectGroup بينما status ≠ "full"',
    "violation",
    () =>
      prisma.graduationTopic.findMany({
        where: { status: { not: "full" }, projectGroup: { isNot: null } },
        select: { id: true },
      }),
  );

  // ─── I2 — المجموعة وطلبها المصدر يحييان ويموتان معاً ──────────
  await record(
    "I2",
    "طلب accepted بينما موضوعه بلا مجموعة (طلب معلّق يحجز الموضوع إلى الأبد)",
    "violation",
    () =>
      prisma.groupRequest.findMany({
        where: { status: "accepted", topic: { projectGroup: null } },
        select: { id: true },
      }),
  );

  await record(
    "I2",
    "ProjectGroup بلا طلب accepted — المسار المُسنَد إدارياً، مقبول بذاته",
    "note",
    () =>
      prisma.projectGroup.findMany({
        where: { topic: { groupRequests: { none: { status: "accepted" } } } },
        select: { id: true },
      }),
  );

  // ─── I3 — عدّاد السقف يطابق الطلبات المعلّقة، وطلبٌ مقبولٌ واحد ───
  await record(
    "I3",
    "pendingRequestCount لا يطابق عدد الطلبات المعلّقة على الموضوع",
    "violation",
    async () => {
      const topics = await prisma.graduationTopic.findMany({
        select: { id: true, pendingRequestCount: true, _count: { select: { groupRequests: { where: { status: "pending" } } } } },
      });
      return topics
        .filter((t) => t.pendingRequestCount !== t._count.groupRequests)
        .map((t) => ({ id: t.id }));
    },
  );

  await record(
    "I3",
    "موضوعٌ عليه أكثرُ من طلبٍ مقبول",
    "violation",
    async () => {
      const rows = await prisma.groupRequest.groupBy({
        by: ["topicId"],
        where: { status: "accepted" },
        _count: { _all: true },
      });
      return rows.filter((r) => r._count._all > 1).map((r) => ({ id: r.topicId }));
    },
  );

  await record(
    "I3",
    "موضوعٌ طلباتُه المعلّقة فوق سقفه",
    "violation",
    async () => {
      const topics = await prisma.graduationTopic.findMany({
        where: { maxRequests: { not: null } },
        select: { id: true, maxRequests: true, pendingRequestCount: true },
      });
      return topics
        .filter((t) => t.pendingRequestCount > (t.maxRequests ?? Infinity))
        .map((t) => ({ id: t.id }));
    },
  );

  // ─── I4 — قابلية الإتاحة تُحسب من الإشغال لا من status وحده ───
  await record(
    "I4",
    "موضوع approved/open بلا مجموعة لكنه محجوب عن الطلبة بسبب طلب accepted ميّت",
    "violation",
    () =>
      prisma.graduationTopic.findMany({
        where: {
          status: { in: ["approved", "open"] },
          projectGroup: null,
          groupRequests: { some: { status: "accepted" } },
        },
        select: { id: true },
      }),
  );

  // عدّة طلباتٍ معلّقة على موضوعٍ واحد مشروعةٌ الآن — حتى سقفه. والخرقُ أن
  // يبقى طلبٌ معلّقٌ بجانب طلبٍ مقبول: القبولُ يُلغي البقيّة.
  await record(
    "I4",
    "طلبٌ معلّقٌ على موضوعٍ قُبل عليه فريق (القبولُ لم يُلغِ البقيّة)",
    "violation",
    () =>
      prisma.groupRequest.findMany({
        where: { status: "pending", topic: { groupRequests: { some: { status: "accepted" } } } },
        select: { id: true },
      }),
  );

  // ─── I5 — كل مجموعة قائمة لها قائد واحد بالضبط ───────────────
  await record(
    "I5",
    "ProjectGroup بلا أي عضو مُعلَّم isLeader",
    "violation",
    () =>
      prisma.projectGroup.findMany({
        where: { members: { none: { isLeader: true } } },
        select: { id: true },
      }),
  );

  await record(
    "I5",
    "ProjectGroup بأكثر من قائد",
    "violation",
    async () => {
      const groups = await prisma.projectGroup.findMany({
        select: { id: true, _count: { select: { members: true } }, members: { where: { isLeader: true }, select: { id: true } } },
      });
      return groups.filter((g) => g.members.length > 1).map((g) => ({ id: g.id }));
    },
  );

  await record("I5", "ProjectGroup بلا أعضاء إطلاقاً", "violation", () =>
    prisma.projectGroup.findMany({
      where: { members: { none: {} } },
      select: { id: true },
    }),
  );

  // ─── التقرير ─────────────────────────────────────────────────
  const byStatus = await prisma.graduationTopic.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  console.log("═".repeat(72));
  console.log("  تدقيق ثوابت GraduationTopic.status — قراءة فقط");
  console.log("═".repeat(72));
  console.log(
    "\nتوزيع المواضيع:",
    byStatus.map((s) => `${s.status}=${s._count._all}`).join("  ") || "(لا مواضيع)",
  );
  console.log(
    "المجموعات:",
    await prisma.projectGroup.count(),
    " الطلبات:",
    await prisma.groupRequest.count(),
  );

  console.log("");
  let violations = 0;
  for (const f of findings) {
    const clean = f.count === 0;
    const mark =
      clean ? "  ✓  " : f.severity === "violation" ? " ✗✗  " : "  •  ";
    if (!clean && f.severity === "violation") violations += f.count;
    console.log(`${mark}[${f.invariant}] ${f.what}`);
    if (!clean) {
      console.log(`        العدد: ${f.count}${f.samples.length ? `  أمثلة: ${f.samples.join(", ")}` : ""}`);
    }
  }

  console.log("\n" + "─".repeat(72));
  console.log(
    violations === 0
      ? "سليم — لا خرق للثوابت في البيانات الحالية."
      : `${violations} صفّاً يخرق الثوابت. راجع الأسطر المعلَّمة ✗✗ أعلاه.`,
  );

  await prisma.$disconnect();
  process.exit(violations === 0 ? 0 : 1);
})().catch(async (e) => {
  console.error("فشل التدقيق:", e);
  await prisma.$disconnect();
  process.exit(2);
});
