/**
 * نقطة الكتابة الوحيدة لـ `GraduationTopic.status`.
 *
 * كان الحقل يحمل شيئين لهما صاحبان مختلفان:
 *   (أ) قرار إداري — تكتبه الإدارة: pending → approved → open، أو rejected /
 *       archived.
 *   (ب) واقعة إشغال — لا يقرّرها أحد: هل تشكّلت للموضوع مجموعة؟ و`full` واحدة
 *       من هذه الوقائع لا من القرارات.
 *
 * ولأنهما في حقل واحد كان `full` يُكتب فوق `open` فيمحو القرار، فلا يعرف أي
 * باب خروج إلى أين يعود — فيخمّن. والبابان خمّنا مختلفاً: رفض الطلب يُعيد
 * الموضوع `open` وفسخ المجموعة يُعيده `approved`.
 *
 * الحلّ هنا: `status` إسقاطٌ محسوب لا مصدر حقيقة. مصدرا الحقيقة:
 *   - القرار: مُستخلَص من `status` نفسه (`decisionOf`) + `publishedAt`.
 *   - الإشغال: مقروء من الصفوف (`readOccupancy`).
 *
 *   project(decision, publishedAt, hasGroup) =
 *     decision ≠ approved  → decision
 *     hasGroup             → "full"
 *     publishedAt ≠ null   → "open"
 *     غير ذلك              → "approved"
 *
 * لا تكتب `status` حرفياً في أي خدمة. استعمل `computeTopicStatus` بعد كل
 * تغيّر في الإشغال، و`setTopicDecision` عند تغيير القرار نفسه.
 */
import { Prisma, TopicStatus } from "../../generated/prisma";
import { prisma } from "../prisma/client";

/** إمّا العميل المفرد أو عميل معاملة — كما في `notification.service`. */
type Db = Prisma.TransactionClient | typeof prisma;

/** القيم الأربع التي هي قرار إداري حقيقي. */
export type TopicDecision = Extract<
  TopicStatus,
  "pending" | "approved" | "rejected" | "archived"
>;

/**
 * تُرجِع القرار الكامن خلف الحالة المخزَّنة.
 *
 * `approved` و`open` و`full` كلها تعني قراراً واحداً: «اعتمدت الإدارة هذا
 * الموضوع». الفرق بينها ليس قراراً بل نشرٌ (`publishedAt`) وإشغال (مجموعة)،
 * وكلاهما يُقرأ من مكانه لا من هذا الحقل.
 */
export const decisionOf = (status: TopicStatus): TopicDecision =>
  status === "pending" || status === "rejected" || status === "archived"
    ? status
    : "approved";

/** الإسقاط. دالّة صرفة — لا أحد يخترع الحالة، الكلّ يشتقّها. */
export const projectTopicStatus = (input: {
  decision: TopicDecision;
  publishedAt: Date | null;
  hasGroup: boolean;
}): TopicStatus => {
  if (input.decision !== "approved") return input.decision;
  if (input.hasGroup) return "full";
  if (input.publishedAt) return "open";
  return "approved";
};

//
// ─── الإشغال ─────────────────────────────────────────────────────
//

/**
 * حالة إشغال الموضوع، مقروءة من الصفوف لا من `status`.
 *
 * «حيّ» تعني `pending` أو `accepted`: كلاهما يحمل `activeTopicId` ويحجز
 * الموضوع فعلياً عبر الفهرس الفريد. التمييز بينهما مهمّ لأن `pending` ينتظر
 * قراراً بينما `accepted` صار مشروعاً قائماً.
 */
export type TopicOccupancy = {
  /** تشكّلت مجموعة مشروع — الموضوع مأخوذ فعلاً. */
  hasGroup: boolean;
  groupId: string | null;
  /** عدد أعضاء المجموعة إن وُجدت. */
  groupMemberCount: number;
  /** طلب فريق ينتظر قرار الإدارة. */
  pendingRequestId: string | null;
  pendingRequestMemberCount: number;
  /** الطلب الذي أنشأ المجموعة القائمة، إن وُجد. */
  acceptedRequestId: string | null;
  /** أي طلب حيّ (pending أو accepted) — هو ما يحجز الموضوع. */
  hasLiveRequest: boolean;
};

export const readOccupancy = async (
  db: Db,
  topicId: string,
): Promise<TopicOccupancy> => {
  const [group, pending, accepted] = await Promise.all([
    db.projectGroup.findUnique({
      where: { topicId },
      select: { id: true, _count: { select: { members: true } } },
    }),
    db.groupRequest.findFirst({
      where: { topicId, status: "pending" },
      select: { id: true, _count: { select: { members: true } } },
    }),
    db.groupRequest.findFirst({
      where: { topicId, status: "accepted" },
      select: { id: true },
    }),
  ]);

  return {
    hasGroup: !!group,
    groupId: group?.id ?? null,
    groupMemberCount: group?._count.members ?? 0,
    pendingRequestId: pending?.id ?? null,
    pendingRequestMemberCount: pending?._count.members ?? 0,
    acceptedRequestId: accepted?.id ?? null,
    hasLiveRequest: !!pending || !!accepted,
  };
};

//
// ─── الكتابة ─────────────────────────────────────────────────────
//

/**
 * يُعيد حساب `status` من القرار المخزَّن والإشغال الحاليّ، ويكتبه إن تغيّر.
 *
 * تُنادى بعد **كل** تغيّر في الإشغال: إنشاء مجموعة أو فسخها، قبول طلب أو
 * رفضه. لا تغيّر القرار أبداً — لذلك تُنادى بأمان داخل أي معاملة.
 */
export const computeTopicStatus = async (
  db: Db,
  topicId: string,
): Promise<TopicStatus> => {
  const topic = await db.graduationTopic.findUnique({
    where: { id: topicId },
    select: { status: true, publishedAt: true },
  });
  if (!topic) return "pending"; // حُذف الموضوع في نفس المعاملة — لا شيء ليُكتب.

  const { hasGroup } = await readOccupancy(db, topicId);
  const next = projectTopicStatus({
    decision: decisionOf(topic.status),
    publishedAt: topic.publishedAt,
    hasGroup,
  });

  if (next !== topic.status) {
    await db.graduationTopic.update({
      where: { id: topicId },
      data: { status: next },
    });
  }
  return next;
};

/**
 * يغيّر القرار الإداري، ثم يكتب الإسقاط الناتج عنه.
 *
 * `publishedAt` لا يُمسّ هنا: الأرشفة والرفض لا يُلغيان النشر، وإنما يخفيان
 * الموضوع. ولهذا يعود بالضبط إلى ما كان عليه عند إلغاء الأرشفة، بدل التخمين
 * الذي كان يُعيد كل موضوع مؤرشف «معتمداً» فيُفقِد النشر.
 */
export const setTopicDecision = async (
  db: Db,
  topicId: string,
  decision: TopicDecision,
  opts: { rejectionReason?: string | null } = {},
): Promise<TopicStatus> => {
  const topic = await db.graduationTopic.findUnique({
    where: { id: topicId },
    select: { publishedAt: true },
  });
  if (!topic) return "pending";

  const { hasGroup } = await readOccupancy(db, topicId);
  const next = projectTopicStatus({
    decision,
    publishedAt: topic.publishedAt,
    hasGroup,
  });

  await db.graduationTopic.update({
    where: { id: topicId },
    data: {
      status: next,
      // يُحفظ السبب عند الرفض، ويُمسح فيما عداه.
      rejectionReason:
        decision === "rejected" ? (opts.rejectionReason ?? null) : null,
    },
  });
  return next;
};

/**
 * يضبط النشر ثم يُعيد الحساب.
 *
 * `publishedAt` هو البتّ الوحيد الذي لا يستطيع `status` حمله وحده، وهو ما
 * يجعل الرجوع من `full` دقيقاً بدل أن يكون تخميناً.
 */
export const setTopicPublished = async (
  db: Db,
  topicId: string,
  published: boolean,
): Promise<TopicStatus> => {
  await db.graduationTopic.update({
    where: { id: topicId },
    data: { publishedAt: published ? new Date() : null },
  });
  return computeTopicStatus(db, topicId);
};

//
// ─── الإتاحة ─────────────────────────────────────────────────────
//

/**
 * الشرط الوحيد لـ«متاح للطلبة».
 *
 * كان هذا الشرط مكتوباً أربع مرّات — في تصفّح الطالب، وفي إنشاء الطلب، وفي
 * القائمة العامّة، وفي صفحة الموضوع العامّة — وكلٌّ يشتقّه بطريقته. تُستورد
 * هذه القطعة الآن بدل إعادة كتابته، فتتغيّر القاعدة في مكان واحد.
 *
 * `full` مستبعَد ضمناً: الشرط يقتصر على `approved` و`open`، وأي موضوع له
 * مجموعة يكون `full` بعد المرحلة 1.
 */
export const AVAILABLE_TO_STUDENTS = {
  status: { in: ["approved", "open"] as TopicStatus[] },
  // لا مجموعة تشكّلت، ولا فريق يحجزه بطلب حيّ.
  projectGroup: null,
  groupRequests: {
    none: { status: { in: ["pending", "accepted"] as const } },
  },
} satisfies Prisma.GraduationTopicWhereInput;

//
// ─── ما الذي يجوز للإدارة، ولماذا لا ─────────────────────────────
//

export type TopicActionKey =
  | "approve"
  | "reject"
  | "publish"
  | "unpublish"
  | "archive"
  | "unarchive"
  | "delete"
  | "assignGroup";

/**
 * سبب المنع: رمزٌ ثابت ومعاملاته، ونصٌّ عربيّ جاهز.
 *
 * الرمز هو ما تترجمه الواجهة — فالإدارة قد تعمل بالفرنسية أو الإنجليزية،
 * وزرٌّ مطفأ بتلميح عربيّ في واجهة فرنسية يُفشل الغرض من التلميح. والنصّ
 * العربيّ يبقى معه ليكون الاحتياط حين لا ترجمة للرمز بعد، ولأنه ما يرسله
 * الخادم أصلاً في رسائل الرفض.
 */
export type TopicBlock = {
  code: TopicBlockCode;
  params?: Record<string, string | number>;
};

export type TopicBlockCode =
  | "notUndecided"
  | "teamWaiting"
  | "notRejectable"
  | "notApproved"
  | "reserved"
  | "notOpen"
  | "notArchivable"
  | "notArchived"
  | "hasGroup";

/** ما يجوز الآن، بصيغة يقرأها الخادم حارساً وتقرأها الواجهة عرضاً. */
export type TopicActions = {
  canApprove: boolean;
  canReject: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canArchive: boolean;
  canUnarchive: boolean;
  canDelete: boolean;
  canAssignGroup: boolean;
  /** سبب المنع لكل إجراء ممنوع — بالعربية، جاهزاً للعرض كما هو. */
  blockedReasons: Partial<Record<TopicActionKey, string>>;
  /** ونفس السبب برمزٍ تترجمه الواجهة. */
  blockedCodes: Partial<Record<TopicActionKey, TopicBlock>>;
};

/**
 * جدول القواعد الوحيد: من هنا يحرس الخادم، ومن هنا تعرض الواجهة.
 *
 * كانت الواجهة تُقلّد قواعد الخادم بدل أن تسأله: `deletable = status !== "full"`
 * بينما الحارس الحقيقي «هل له مجموعة؟» — فيُعرض على موضوع مؤرشف زرّ حذف لا
 * ينجح أبداً. وحين يفشل، تبتلع الواجهة رسالة الخادم وتعرض «فشل الحذف»، فلا
 * يعرف المستخدم أن البديل هو الأرشفة.
 *
 * الحلّ ليس تصحيح شرط الواجهة — فسيتباعد الاثنان ثانيةً عند أول تعديل — بل
 * ألّا يكون للواجهة شرط أصلاً: الخادم يحسب هنا مرّة، ويرسل ما يجوز ولماذا لا،
 * ويحرس بنفس الحساب. فإن تغيّرت القاعدة تغيّرت في الموضعين معاً لأنهما موضع
 * واحد.
 */
export const topicActions = (
  topic: { status: TopicStatus },
  occ: Pick<
    TopicOccupancy,
    "hasGroup" | "pendingRequestId" | "pendingRequestMemberCount" | "acceptedRequestId"
  >,
): TopicActions => {
  const s = topic.status;
  const waiting = !!occ.pendingRequestId;
  const reserved = !!occ.acceptedRequestId;

  const waitingTeam = (action: string) =>
    `لا يمكن ${action}: هناك فريق (${occ.pendingRequestMemberCount} طلبة) بانتظار القرار على هذا الموضوع. ابتّ في طلبه من صفحة «طلبات المجموعات» أوّلاً.`;

  const reasons: Partial<Record<TopicActionKey, string>> = {};
  const codes: Partial<Record<TopicActionKey, TopicBlock>> = {};
  const gate = (
    key: TopicActionKey,
    ok: boolean,
    why: string,
    block: TopicBlock,
  ) => {
    if (!ok) {
      reasons[key] = why;
      codes[key] = block;
    }
    return ok;
  };
  const waitingBlock: TopicBlock = {
    code: "teamWaiting",
    params: { count: occ.pendingRequestMemberCount },
  };

  const canApprove = gate(
    "approve",
    s === "pending" || s === "rejected",
    "لا يُعتمد إلا موضوع قيد الانتظار أو مرفوض.",
    { code: "notUndecided" },
  );

  const canReject = gate(
    "reject",
    (s === "pending" || s === "approved" || s === "open") && !waiting,
    waiting
      ? waitingTeam("رفض الموضوع")
      : "لا يُرفض إلا موضوع قيد الانتظار أو معتمَد أو منشور. الموضوع الذي تشكّلت له مجموعة يُؤرشَف بدل رفضه.",
    waiting ? waitingBlock : { code: "notRejectable" },
  );

  const canPublish = gate(
    "publish",
    s === "approved" && !waiting && !reserved,
    waiting
      ? waitingTeam("نشر الموضوع")
      : reserved
        ? "لا يمكن نشر الموضوع: عليه طلب فريق مقبول ما يزال يحجزه. افسخ مشروعه من صفحة «المشاريع» أوّلاً ليعود قابلاً للتداول."
        : "يجب قبول الموضوع أوّلاً قبل نشره",
    waiting ? waitingBlock : { code: reserved ? "reserved" : "notApproved" },
  );

  const canUnpublish = gate(
    "unpublish",
    s === "open",
    "لا يمكن إلغاء النشر إلا لموضوع منشور ولم تُشكّل له مجموعة",
    { code: "notOpen" },
  );

  const canArchive = gate(
    "archive",
    (s === "approved" || s === "open" || s === "full") && !waiting,
    waiting
      ? waitingTeam("أرشفة الموضوع")
      : "لا يُؤرشَف إلا موضوع معتمَد أو منشور أو مكتمل. الموضوع قيد الانتظار أو المرفوض يُبَتّ فيه لا يُؤرشَف.",
    waiting ? waitingBlock : { code: "notArchivable" },
  );

  const canUnarchive = gate(
    "unarchive",
    s === "archived",
    "لا يمكن إلغاء الأرشفة إلا لموضوع مؤرشف",
    { code: "notArchived" },
  );

  // الحذف لا يسأل عن الحالة إطلاقاً — يسأل عمّا سيُفقد.
  const canDelete = gate(
    "delete",
    !occ.hasGroup && !waiting && !reserved,
    occ.hasGroup
      ? "لا يمكن حذف موضوع تشكّلت له مجموعة مشروع؛ أرشفه بدلاً من ذلك."
      : reserved
        ? "لا يمكن حذف موضوع عليه طلب فريق مقبول. افسخ مشروعه أوّلاً."
        : `لا يمكن حذف الموضوع: هناك فريق (${occ.pendingRequestMemberCount} طلبة) ينتظر قراره، وحذفه يمحو طلبهم بلا خبر. ابتّ في الطلب أوّلاً — رفضُه يُحرّر الموضوع.`,
    occ.hasGroup
      ? { code: "hasGroup" }
      : reserved
        ? { code: "reserved" }
        : waitingBlock,
  );

  const canAssignGroup = gate(
    "assignGroup",
    !waiting,
    waitingTeam("إسناد مجموعة إلى الموضوع"),
    waitingBlock,
  );

  return {
    canApprove,
    canReject,
    canPublish,
    canUnpublish,
    canArchive,
    canUnarchive,
    canDelete,
    canAssignGroup,
    blockedReasons: reasons,
    blockedCodes: codes,
  };
};

/**
 * الشكل المختصر للإشغال كما يُرسَل إلى الواجهة — بلا معرّفات داخلية.
 */
export type TopicOccupancySummary = {
  hasGroup: boolean;
  groupMemberCount: number;
  hasPendingRequest: boolean;
  pendingRequestMemberCount: number;
  hasAcceptedRequest: boolean;
};

/** يبني الإشغال من صفوفٍ محمَّلة سلفاً، بلا استعلام إضافي لكل صفّ. */
export const occupancyFromRelations = (row: {
  projectGroup?: { _count?: { members: number } } | null;
  groupRequests?: { id: string; status: string; _count?: { members: number } }[];
}): TopicOccupancy & TopicOccupancySummary => {
  const pending = row.groupRequests?.find((r) => r.status === "pending");
  const accepted = row.groupRequests?.find((r) => r.status === "accepted");
  const hasGroup = !!row.projectGroup;
  return {
    hasGroup,
    groupId: null,
    groupMemberCount: row.projectGroup?._count?.members ?? 0,
    pendingRequestId: pending?.id ?? null,
    pendingRequestMemberCount: pending?._count?.members ?? 0,
    acceptedRequestId: accepted?.id ?? null,
    hasLiveRequest: !!pending || !!accepted,
    hasPendingRequest: !!pending,
    hasAcceptedRequest: !!accepted,
  };
};

/** ما تحتاجه `occupancyFromRelations` من كل صفّ موضوع. */
export const OCCUPANCY_INCLUDE = {
  projectGroup: { select: { _count: { select: { members: true } } } },
  groupRequests: {
    where: { status: { in: ["pending", "accepted"] as const } },
    select: { id: true, status: true, _count: { select: { members: true } } },
  },
} satisfies Prisma.GraduationTopicInclude;

//
// ─── طلبات المجموعات ──────────────────────────────────────────
//

export type RequestActionKey = "accept" | "reject";

export type RequestBlockCode =
  | "alreadyAccepted"
  | "topicUnavailable"
  | "topicTaken"
  | "tooManyMembers"
  | "hasProject";

export type RequestBlock = {
  code: RequestBlockCode;
  params?: Record<string, string | number>;
};

export type RequestActions = {
  canAccept: boolean;
  canReject: boolean;
  blockedReasons: Partial<Record<RequestActionKey, string>>;
  blockedCodes: Partial<Record<RequestActionKey, RequestBlock>>;
};

/**
 * جدول قواعد طلب المجموعة — نظير `topicActions`، وللسبب نفسه.
 *
 * شاشة «طلبات المجموعات» كانت تُقرّر من حالة الطلب وحدها:
 *
 *     status === "pending" || status === "rejected"  ⇒ اعرض «قبول»
 *     status === "pending" || status === "accepted"  ⇒ اعرض «رفض»
 *
 * بينما الخادم يحرس بأربعة شروط، ثلاثةٌ منها **لا تصل الواجهة أصلاً**: هل
 * للموضوع مجموعة، وما حالته، وكم يسع. فكان زرُّ «رفض» يُعرض على كل طلبٍ
 * مقبول — وقبولُ الطلب يُنشئ المجموعة، فالرفض بعده مرفوضٌ دائماً. زرٌّ
 * لإجراءٍ مستحيل، وهو عين العَرَض الثاني الذي عالجناه في المواضيع.
 *
 * ولا يُصلحه تصحيح شرط الواجهة: الشرطان سيتباعدان ثانيةً عند أوّل تعديل.
 * يُصلحه ألّا يكون للواجهة شرطٌ أصلاً.
 */
export const requestActions = (input: {
  status: string;
  memberCount: number;
  topic: { status: TopicStatus; maxStudents: number; hasGroup: boolean };
}): RequestActions => {
  const reasons: Partial<Record<RequestActionKey, string>> = {};
  const codes: Partial<Record<RequestActionKey, RequestBlock>> = {};
  const gate = (
    key: RequestActionKey,
    ok: boolean,
    why: string,
    block: RequestBlock,
  ) => {
    if (!ok) {
      reasons[key] = why;
      codes[key] = block;
    }
    return ok;
  };

  const { status, memberCount, topic } = input;
  const accepted = status === "accepted";

  // الترتيب هو ترتيب الخادم نفسه، فيقع السبب المعروض على أوّل ما يمنع فعلاً.
  const canAccept = accepted
    ? gate("accept", false, "هذا الطلب مقبولٌ بالفعل.", {
        code: "alreadyAccepted",
      })
    : !ELIGIBLE_FOR_ACCEPT.includes(topic.status)
      ? gate(
          "accept",
          false,
          "هذا الموضوع لم يعد متاحاً (تمّت معالجته بالفعل).",
          { code: "topicUnavailable", params: { status: topic.status } },
        )
      : topic.hasGroup
        ? gate(
            "accept",
            false,
            "تمّت الموافقة على مجموعة لهذا الموضوع بالفعل — سبقهم فريقٌ آخر.",
            { code: "topicTaken" },
          )
        : gate(
            "accept",
            memberCount <= topic.maxStudents,
            `عدد الأعضاء (${memberCount}) يتجاوز الحدّ الأقصى للموضوع (${topic.maxStudents}).`,
            {
              code: "tooManyMembers",
              params: { members: memberCount, max: topic.maxStudents },
            },
          );

  /*
   * الشرط على المجموعة لا على حالة الطلب: طلبٌ مقبولٌ فُسخت مجموعته يبقى
   * رفضه ممكناً — فهو الإصلاح لا الهدم.
   */
  const canReject = gate(
    "reject",
    !(accepted && topic.hasGroup),
    "لا يمكن رفض طلب تشكّل له مشروع بالفعل. إن أردت التراجع عن الاكتمال فافسخ المشروع من صفحة «المشاريع» — عندها يتحرّر الموضوع ويعود قابلاً للتداول.",
    { code: "hasProject" },
  );

  return { canAccept, canReject, blockedReasons: reasons, blockedCodes: codes };
};

/**
 * حالات الموضوع التي يجوز قبول طلبٍ عليها.
 *
 * و`pending` منها عمداً: الأستاذ قد يقترح موضوعاً مع فريقه، فيحمل الطلب
 * اعتماد الموضوع معه. والطالب لا يبلغ هذه الحالة — طلبه يُردّ على موضوعٍ غير
 * معتمَد أو منشور.
 */
const ELIGIBLE_FOR_ACCEPT: TopicStatus[] = [
  "pending",
  "approved",
  "open",
  "full",
];
