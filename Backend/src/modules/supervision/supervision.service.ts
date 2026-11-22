import crypto from "node:crypto";

import { prisma } from "../../core/prisma/client";
import {
  BadRequestException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { RoleType } from "../../core/enums/role.enum";
import { tr } from "../../core/i18n";
import { currentSupervisionSheet, type SupervisionSheet } from "../site/supervision-sheet";

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
  /**
   * The sheet's words and logos (modules/site/supervision-sheet): the current
   * ones until the document is first printed, then those it was printed with
   * — so it is verified as the professor signed it, whatever is edited after.
   * Absent from the documents issued before: they were printed with the original.
   */
  template?: SupervisionSheet;
}

/** بالعربية، وباللاتينية لمن لا اسم عربيّ له. */
const fullName = (u?: {
  firstName?: string | null;
  lastName?: string | null;
  firstNameLatin?: string | null;
  lastNameLatin?: string | null;
}) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
  [u?.firstNameLatin, u?.lastNameLatin].filter(Boolean).join(" ").trim();

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
      tr("supervision.notYourTopic"),
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  const isMember = (topic.projectGroup?.members ?? []).some(
    (m) => m.student?.userId === actor.userId,
  );
  if (isMember) return;

  throw new UnauthorizedException(
    tr("supervision.notMember"),
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
      tr("supervision.noGroup"),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const missing = members.filter((m) => !m.student.registrationNumber.trim());
  if (missing.length > 0)
    throw new BadRequestException(
      tr("supervision.missingRegistrations", { count: missing.length }),
      ErrorCodeEnum.VALIDATION_ERROR,
    );

  const supervisorName = fullName(topic.professor?.user);
  if (!supervisorName)
    throw new BadRequestException(
      tr("supervision.supervisorNameMissing"),
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

  // Five tries; the loop either returns or throws, so nothing follows it.
  for (let attempt = 1; ; attempt++) {
    try {
      const updated = await prisma.supervisionDocument.update({
        where: { id: document.id },
        data: { barcode: newBarcode() },
      });
      return { ...document, barcode: updated.barcode };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002" || attempt === 5) throw e;
    }
  }
}

//
// ─── قبل الطباعة وبعدها ───────────────────────────────────────
//

type Actor = { userId: string; role: RoleType };
type DocumentRow = NonNullable<Awaited<ReturnType<typeof prisma.supervisionDocument.findUnique>>>;

/**
 * JSON with its keys in one order at every depth: the same snapshot gives the
 * same text whatever order the database kept its keys in.
 */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** What a screen showed of a document, in a word: its first print checks it. */
export const versionOf = (snapshot: unknown) =>
  crypto.createHash("sha256").update(stable(snapshot)).digest("base64url").slice(0, 16);

const isLive = (d: { status?: string; printedAt?: Date | null }) => d.status === "active" && !d.printedAt;

/**
 * قبل أوّل طباعة، تتبع الورقة موضوعها ونصّ الورقة الجاري.
 *
 * عنوانٌ صُحّح، أو طالبٌ أُضيف، أو عبارةٌ من الورقة أُعيدت صياغتها: تظهر في
 * الورقة برقمها ورمزها نفسيهما — فلم يخرج منها شيءٌ على الورق بعد، ولا يلزم
 * رقمٌ جديد ولا إلغاء. واللقطة تُحدَّث حين تُقرأ، ولا تُكتب إلّا إن تغيّر شيء.
 * والمطبوعة والملغاة تُترك كما هي.
 *
 * وموضوعٌ لم يعد يصنع ورقة — زالت مجموعته، أو نقص رقم تسجيل — يترك الورقة
 * على آخر ما كانت: القارئ يجدها، ولا يُرمى بخطأ.
 */
async function current<T extends DocumentRow>(document: T, topic?: TopicForDocument | null): Promise<T> {
  if (!isLive(document)) return document;
  const t = topic === undefined ? await topicForDocument(document.topicId) : topic;
  if (!t) return document;

  const stored = (document.snapshot ?? {}) as unknown as Partial<SupervisionSnapshot>;
  let built: SupervisionSnapshot;
  try {
    built = buildSnapshot(t);
  } catch {
    return document;
  }
  const fresh: SupervisionSnapshot = {
    ...built,
    issuedAt: stored.issuedAt ?? built.issuedAt,
    template: await currentSupervisionSheet(),
  };
  if (stable(fresh) === stable(stored)) return document;

  // Unless it was printed meanwhile: what was printed stays.
  const { count } = await prisma.supervisionDocument.updateMany({
    where: { id: document.id, status: "active", printedAt: null },
    data: { snapshot: fresh as unknown as object },
  });
  if (!count) return (await prisma.supervisionDocument.findUnique({ where: { id: document.id } })) as T;
  return { ...document, snapshot: fresh as unknown as T["snapshot"] };
}

/**
 * The document as a screen reads it: with its `version` (what its first print
 * checks), and without the account of who printed it. And an employee of the
 * administration who printed it is named to the administration alone: the
 * students and the professor read «the administration».
 */
export function presentDocument(d: DocumentRow, actor: { role: RoleType }) {
  const { printedById, ...rest } = d;
  void printedById;
  return {
    ...rest,
    printedByName: d.printedByRole === "admin" && actor.role !== "admin" ? null : d.printedByName,
    version: versionOf(d.snapshot),
  };
}

const ADMIN = { role: "admin" as RoleType };

/** The name a print is kept under: as written that day. */
async function nameOf(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true, email: true },
  });
  return fullName(u ?? undefined) || u?.email || null;
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
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  assertMayAccess(topic, actor);

  const active = await prisma.supervisionDocument.findFirst({
    where: { topicId, status: "active" },
    orderBy: { createdAt: "desc" },
  });

  return {
    // The draft with the sheet's words as they are now — as it would be issued.
    snapshot: { ...buildSnapshot(topic), template: await currentSupervisionSheet() },
    // The active one as it is now: up to date until it is printed.
    active: active ? presentDocument(await current(await withBarcode(active), topic), actor) : null,
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
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  assertMayAccess(topic, actor);

  const existing = await prisma.supervisionDocument.findFirst({
    where: { topicId, status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { document: presentDocument(await current(existing, topic), actor), created: false };

  // The topic's data and the sheet's words as they are now; they follow both until the first print.
  const snapshot = { ...buildSnapshot(topic), template: await currentSupervisionSheet() };

  // التسلسل يُقرأ ثمّ يُكتب، فقد يسبق إليه طلبٌ آخر. وقيد `@unique` يمنع
  // التكرار، والمحاولة التالية تقرأ الرقم الجديد. وبعد خمس محاولاتٍ تُقال
  // رسالتها هي — لا «قيمةٌ مكرّرة في documentNumber»، وهو حقلٌ لم يكتبه أحد.
  for (let attempt = 1; ; attempt++) {
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
      return { document: presentDocument(document, actor), created: true };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      if (attempt === 5)
        throw new BadRequestException(
          tr("supervision.numberFailed"),
          ErrorCodeEnum.VALIDATION_ERROR,
        );
    }
  }
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
      tr("notFound.document"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // A document whose topic is gone has no professor or group left to entitle
  // anyone: the administration alone may still open it. (It used to skip the
  // check altogether — open to every signed-in account that knew the id.)
  const topic = await topicForDocument(document.topicId);
  if (topic) assertMayAccess(topic, actor);
  else if (actor.role !== "admin")
    throw new NotFoundException(
      tr("notFound.document"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  return presentDocument(await current(await withBarcode(document), topic), actor);
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

  return { items: items.map((d) => presentDocument(d, ADMIN)), total, page: q.page, limit: q.limit };
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
      tr("notFound.document"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  if (document.status === "revoked") return presentDocument(document, ADMIN);

  return presentDocument(
    await prisma.supervisionDocument.update({
      where: { id },
      data: { status: "revoked", revokedAt: new Date() },
    }),
    ADMIN,
  );
};

//
// ─── الطباعة ──────────────────────────────────────────────────
//

/**
 * فُتحت نافذة طباعة الورقة — من زرّها، أو بـCtrl+P وهي معروضة.
 *
 * ولا يعرف أحدٌ أخرجت ورقةٌ من الطابعة أم لا: فتحُ النافذة يُعدّ طباعة، وهو
 * الجانب الأسلم — ورقةٌ قد تكون على الورق ورقةٌ لا تتغيّر بعدها.
 *
 * والطباعة الأولى تُثبّت الورقة كما عرضتها الشاشة (`version`): فإن تغيّرت
 * منذ قرأتها — أعادت الإدارة صياغة عبارة، أو انضمّ طالب — لا يُثبَّت شيء،
 * ويُردّ ٤٠٩ لتُعرض الورقة كما صارت قبل أن تُطبع. ويُحفظ معها من طبعها
 * ومتى. وما بعدها من طبعاتٍ يُعدّ، ولا يُغيّر شيئاً.
 */
export const printSupervisionDocumentService = async (id: string, actor: Actor, version?: string) => {
  const document = await prisma.supervisionDocument.findUnique({ where: { id } });
  if (!document)
    throw new NotFoundException(tr("notFound.document"), ErrorCodeEnum.RESOURCE_NOT_FOUND);

  const topic = await topicForDocument(document.topicId);
  if (topic) assertMayAccess(topic, actor);
  else if (actor.role !== "admin")
    throw new NotFoundException(tr("notFound.document"), ErrorCodeEnum.RESOURCE_NOT_FOUND);

  if (document.status !== "active")
    throw new BadRequestException(tr("supervision.printRevoked"), ErrorCodeEnum.VALIDATION_ERROR);

  const now = new Date();
  if (!document.printedAt) {
    const live = await current(await withBarcode(document), topic);
    if (!live.printedAt) {
      if (version && versionOf(live.snapshot) !== version)
        throw new HttpException(tr("supervision.changedBeforePrint"), HTTPSTATUS.CONFLICT, ErrorCodeEnum.DOCUMENT_CHANGED);
      const { count } = await prisma.supervisionDocument.updateMany({
        where: { id, status: "active", printedAt: null },
        data: {
          printedAt: now,
          printedById: actor.userId,
          printedByRole: actor.role,
          printedByName: await nameOf(actor.userId),
          printCount: { increment: 1 },
          lastPrintedAt: now,
        },
      });
      if (count) {
        const printed = await prisma.supervisionDocument.findUnique({ where: { id } });
        return presentDocument(printed!, actor);
      }
    }
  }

  // Printed already — a moment ago by someone else, perhaps: one print more, nothing else.
  return presentDocument(
    await prisma.supervisionDocument.update({
      where: { id },
      data: { printCount: { increment: 1 }, lastPrintedAt: now },
    }),
    actor,
  );
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
  const found = await prisma.supervisionDocument.findFirst({
    where: { OR: [{ verificationToken: code }, { barcode: code }] },
  });

  if (!found) return { found: false as const };
  // Not printed yet: as it is now, as any other screen shows it.
  const document = await current(found);

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
