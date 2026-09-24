import crypto from "node:crypto";

import { prisma } from "../../core/prisma/client";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { RoleType } from "../../core/enums/role.enum";

//
// ═══════════════════════════════════════════════════════════════
//  «طلب الموافقة على الإشراف»
//
//  ورقةٌ رسمية تُثبت أنّ موضوعاً بعينه صار لمجموعةٍ بعينها. يوقّعها
//  المشرف بخطّ يده، ويتحقّق منها أيٌّ كان بمسح رمز الاستجابة أسفلها.
// ═══════════════════════════════════════════════════════════════
//

/** ما تحمله الوثيقة من بيانات — لقطةً لا مرآة. */
export interface SupervisionSnapshot {
  topicTitle: string;
  supervisorName: string;
  /** `licence` | `master` | `doctorate` — من تخصّص الموضوع. */
  level: string;
  academicYear: string;
  specialization: string;
  students: { fullName: string; registrationNumber: string }[];
  issuedAt: string;
}

const fullName = (u?: { firstName?: string | null; lastName?: string | null }) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();

/**
 * رمزُ التحقّق.
 *
 * ٢٥٦ بتاً من `randomBytes` — لا من `Math.random` ولا من الوقت ولا من
 * معرّفٍ متسلسل. ورابط الـQR عامٌّ بلا تسجيل دخول، فالرمز هو الحارس
 * الوحيد: رمزٌ يُخمَّن يعني وثيقةً تُزوَّر بتجريب الأرقام.
 */
const newToken = () => crypto.randomBytes(32).toString("base64url");

/**
 * بادئةُ الرموز الشريطية: ٢٩.
 *
 * المجالُ ٢٠–٢٩ محجوزٌ في EAN-13 للاستعمال الداخليّ، فلا يصطدم رمزُ ورقةٍ
 * جامعية برمز سلعةٍ في متجر، ولا يبدأ الرقم بصفرٍ يبتلعه محرِّرُ الجداول.
 */
const BARCODE_PREFIX = "29";

/**
 * رقمُ التحقّق في EAN-13: مجموعٌ موزونٌ ١ و٣ بالتناوب، ثمّ المتمّم للعشرة.
 *
 * وهو ما يجعل الرمز **يُمسح**: القارئ يحسبه ويقارن، فيرفض رقماً مخترَعاً
 * أو مقروءاً خطأً. فلا يصحّ أن تكون الأرقام الثلاثة عشر عشوائيةً كلّها.
 */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * رمزٌ شريطيٌّ جديد: بادئةٌ ثابتة، ثمّ عشرة أرقامٍ من مولّدٍ تعمويّ، ثمّ
 * رقمُ التحقّق. عشرة آلاف مليون احتمال، ومعها حدٌّ على معدّل الطلبات.
 *
 * و`randomInt` لا `Math.random`: هذا رمزٌ يُقرأ من ورقةٍ رسمية، ومولّدٌ
 * متوقَّعٌ يعني رمزاً يُستنتج.
 */
function newBarcode(): string {
  let body = "";
  for (let i = 0; i < 10; i++) body += String(crypto.randomInt(0, 10));
  const first12 = BARCODE_PREFIX + body;
  return first12 + String(ean13CheckDigit(first12));
}

/**
 * رقمُ الوثيقة المقروء: `SUP-2026-000123`.
 *
 * وهو **غيرُ رقم تسجيل الطالب** وغيرُ رمز التحقّق: هذا للعين والأرشيف،
 * وذاك للطالب، والثالث للتعمية. والتسلسل داخل السنة الميلادية للإصدار.
 */
async function nextDocumentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SUP-${year}-`;

  const last = await prisma.supervisionDocument.findFirst({
    where: { documentNumber: { startsWith: prefix } },
    orderBy: { documentNumber: "desc" },
    select: { documentNumber: true },
  });

  const seq = last ? Number(last.documentNumber.slice(prefix.length)) + 1 : 1;
  return prefix + String(seq).padStart(6, "0");
}

/** الموضوع بكلّ ما تحتاجه الورقة، في استعلامٍ واحد. */
const topicForDocument = (id: string) =>
  prisma.graduationTopic.findUnique({
    where: { id },
    include: {
      professor: { include: { user: true } },
      specialization: true,
      academicYear: true,
      projectGroup: {
        include: {
          members: {
            orderBy: [{ isLeader: "desc" }, { createdAt: "asc" }],
            include: { student: { include: { user: true } } },
          },
        },
      },
    },
  });

type TopicForDocument = NonNullable<Awaited<ReturnType<typeof topicForDocument>>>;

/**
 * من يملك أن يُصدر ورقةً لهذا الموضوع أو يراها.
 *
 * الإدارة لكلّ موضوع. والأستاذ لمواضيعه هو. والطالب لمشروعه هو — عضواً في
 * مجموعته لا غير. ولا نظام صلاحياتٍ ثانياً: هي نفس الأدوار التي يحملها
 * `req.user`.
 */
function assertMayAccess(
  topic: TopicForDocument,
  actor: { userId: string; role: RoleType },
) {
  if (actor.role === "admin") return;

  if (actor.role === "professor") {
    if (topic.professor?.userId === actor.userId) return;
    throw new UnauthorizedException(
      "هذا الموضوع ليس من إشرافك",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  const isMember = (topic.projectGroup?.members ?? []).some(
    (m) => m.student?.userId === actor.userId,
  );
  if (isMember) return;

  throw new UnauthorizedException(
    "لست من أعضاء مشروع هذا الموضوع",
    ErrorCodeEnum.ACCESS_UNAUTHORIZED,
  );
}

/**
 * يبني اللقطة، ويرفض ما لا تصحّ عليه ورقة.
 *
 * ورقمُ التسجيل يُقرأ من `Student.registrationNumber` كما هو — لا يُولَّد
 * ولا يُشتقّ من معرّف. وإن غاب عن طالبٍ فالورقة لا تُصدَر: رقمٌ مخترَع في
 * وثيقةٍ رسمية أسوأ من وثيقةٍ لا تصدر.
 */
function buildSnapshot(topic: TopicForDocument): SupervisionSnapshot {
  const members = topic.projectGroup?.members ?? [];

  if (members.length === 0)
    throw new BadRequestException(
      "لا مجموعة مشروعٍ لهذا الموضوع بعد، فلا وثيقة",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const missing = members.filter(
    (m) => !(m.student?.registrationNumber ?? "").trim(),
  );
  if (missing.length > 0)
    throw new BadRequestException(
      `لا يمكن إصدار الوثيقة: ${missing.length} من الطلبة بلا رقم تسجيل. أكمل بياناتهم أوّلاً.`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const supervisorName = fullName(topic.professor?.user);
  if (!supervisorName)
    throw new BadRequestException(
      "اسم الأستاذ المشرف ناقص في النظام",
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  return {
    topicTitle: topic.title,
    supervisorName,
    level: topic.specialization?.level ?? "",
    academicYear: topic.academicYear?.title ?? "",
    specialization: topic.specialization?.name ?? "",
    students: members.map((m) => ({
      fullName: fullName(m.student?.user) || m.student!.registrationNumber,
      registrationNumber: m.student!.registrationNumber,
    })),
    issuedAt: new Date().toISOString(),
  };
}

type StoredDocument = { id: string; barcode: string | null };

/**
 * يمنح ورقةً قديمة رمزها الشريطيّ عند أوّل قراءة.
 *
 * العمودُ أُضيف بعد أن صدرت أوراق، وقيمتُه فيها `NULL`. والبديل — هجرةٌ
 * تملأ العمود — تحتاج حساب رقم التحقّق داخل SQL، وهو أصعب قراءةً وأسهل
 * خطأً من سطرٍ هنا. والتصادمُ يُعاد منه: القيد الفريد يحرس، لا النيّة.
 */
async function withBarcode<T extends StoredDocument>(document: T): Promise<T> {
  if (document.barcode) return document;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await prisma.supervisionDocument.update({
        where: { id: document.id },
        data: { barcode: newBarcode() },
      });
      return { ...document, barcode: updated.barcode };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002" || attempt === 4) throw e;
    }
  }

  return document;
}

//
// ─── ما تعرضه الشاشات قبل الإصدار ─────────────────────────────
//

/** معاينةٌ بلا إصدار: نفس البيانات، ومعها الوثيقة الفعّالة إن وُجدت. */
export const previewSupervisionDocumentService = async (
  topicId: string,
  actor: { userId: string; role: RoleType },
) => {
  const topic = await topicForDocument(topicId);
  if (!topic)
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  assertMayAccess(topic, actor);

  const active = await prisma.supervisionDocument.findFirst({
    where: { topicId, status: "active" },
    orderBy: { createdAt: "desc" },
  });

  return {
    snapshot: buildSnapshot(topic),
    active: active ? await withBarcode(active) : null,
  };
};

//
// ─── الإصدار ──────────────────────────────────────────────────
//

/**
 * يُصدر الورقة، أو يُعيد الفعّالة إن كانت موجودة.
 *
 * ولا يُنشئ ثانيةً ما دامت الأولى صالحة: ورقتان فعّالتان لموضوعٍ واحد
 * تعنيان توقيعين يتحقّقان معاً، ولا يُعرف أيّهما المُعتمَد.
 */
export const issueSupervisionDocumentService = async (
  topicId: string,
  actor: { userId: string; role: RoleType },
) => {
  const topic = await topicForDocument(topicId);
  if (!topic)
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  assertMayAccess(topic, actor);

  const existing = await prisma.supervisionDocument.findFirst({
    where: { topicId, status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { document: existing, created: false };

  const snapshot = buildSnapshot(topic);

  // التسلسل يُقرأ ثمّ يُكتب، فقد يسبق إليه طلبٌ آخر. وقيد `@unique` يمنع
  // التكرار، والمحاولة التالية تقرأ الرقم الجديد.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const document = await prisma.supervisionDocument.create({
        data: {
          documentNumber: await nextDocumentNumber(),
          verificationToken: newToken(),
          barcode: newBarcode(),
          topicId,
          snapshot: snapshot as unknown as object,
        },
      });
      return { document, created: true };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "P2002" || attempt === 4) throw e;
    }
  }

  throw new BadRequestException(
    "تعذّر إصدار رقم وثيقة",
    ErrorCodeEnum.VALIDATION_ERROR,
  );
};

//
// ─── القراءة ──────────────────────────────────────────────────
//

export const getSupervisionDocumentService = async (
  id: string,
  actor: { userId: string; role: RoleType },
) => {
  const document = await prisma.supervisionDocument.findUnique({
    where: { id },
  });
  if (!document)
    throw new NotFoundException(
      "Document not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  const topic = await topicForDocument(document.topicId);
  if (topic) assertMayAccess(topic, actor);

  return withBarcode(document);
};

/** قائمة الإدارة. */
export const listSupervisionDocumentsService = async (q: {
  page: number;
  limit: number;
  status?: "active" | "revoked";
  search?: string;
}) => {
  const where: Record<string, unknown> = {};
  if (q.status) where.status = q.status;
  // والرمزُ الشريطيّ من مداخل البحث: الإدارة تمسحه بقارئٍ فتصل إلى ورقته
  // مباشرةً بدل أن تقلّب القائمة عن رقمٍ لا تحفظه.
  if (q.search)
    where.OR = [
      { documentNumber: { contains: q.search } },
      { barcode: { contains: q.search } },
      { topic: { title: { contains: q.search } } },
    ];

  const [items, total] = await Promise.all([
    prisma.supervisionDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.supervisionDocument.count({ where }),
  ]);

  return { items, total, page: q.page, limit: q.limit };
};

//
// ─── الإلغاء ──────────────────────────────────────────────────
//

/** الإلغاء للإدارة وحدها، ولا يُحذف الصفّ: الورقة الموقَّعة قد تُمسَح غداً. */
export const revokeSupervisionDocumentService = async (id: string) => {
  const document = await prisma.supervisionDocument.findUnique({
    where: { id },
  });
  if (!document)
    throw new NotFoundException(
      "Document not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  if (document.status === "revoked") return document;

  return prisma.supervisionDocument.update({
    where: { id },
    data: { status: "revoked", revokedAt: new Date() },
  });
};

//
// ─── التحقّق العامّ ────────────────────────────────────────────
//

/**
 * ما يراه ماسحُ الـQR — بلا تسجيل دخول.
 *
 * ولا يُعاد منه إلّا ما يُثبت الصحّة: عنوانٌ ومشرفٌ وطلبةٌ وسنةٌ وشهادة.
 * لا بريد، ولا هاتف، ولا معرّفات داخلية، ولا رقم الموضوع ولا معرّف الصفّ
 * — فصفحةٌ عامّة لا تُسرّب ما لا يلزم إثباتَ الورقة.
 */
export const verifySupervisionDocumentService = async (code: string) => {
  // رمزٌ واحدٌ يصل من بابين: الطويل من رابطٍ مكتوب، والقصير من قارئٍ
  // شريطيّ أو من يدٍ تكتب ثلاثة عشر رقماً. وكلاهما فريدٌ في عموده، فلا
  // يلتبس أحدهما بالآخر.
  const document = await prisma.supervisionDocument.findFirst({
    where: { OR: [{ verificationToken: code }, { barcode: code }] },
    select: {
      documentNumber: true,
      barcode: true,
      status: true,
      createdAt: true,
      revokedAt: true,
      snapshot: true,
    },
  });

  if (!document) return { found: false as const };

  const snap = document.snapshot as unknown as SupervisionSnapshot;

  return {
    found: true as const,
    status: document.status,
    documentNumber: document.documentNumber,
    barcode: document.barcode,
    issuedAt: document.createdAt,
    revokedAt: document.revokedAt,
    topicTitle: snap.topicTitle,
    supervisorName: snap.supervisorName,
    level: snap.level,
    academicYear: snap.academicYear,
    students: snap.students,
  };
};
