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
import { tr } from "../i18n";

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
 * «حيّ» تعني `pending` أو `accepted`. وقد يكون للموضوع عدّة طلباتٍ معلّقة
 * معاً — حتى سقفه — والإدارة تختار منها واحداً؛ أمّا المقبول فواحدٌ أبداً.
 */
export type TopicOccupancy = {
  /** تشكّلت مجموعة مشروع — الموضوع مأخوذ فعلاً. */
  hasGroup: boolean;
  groupId: string | null;
  /** عدد أعضاء المجموعة إن وُجدت. */
  groupMemberCount: number;
  /** أوّلُ طلبٍ ينتظر قرار الإدارة، إن وُجد. */
  pendingRequestId: string | null;
  /** طلابُ ذلك الطلب — لنصّ «فريقٌ من ٣ طلاب ينتظر». */
  pendingRequestMemberCount: number;
  /** كم فريقاً ينتظر القرار الآن. */
  pendingRequestCount: number;
  /** الطلب الذي أنشأ المجموعة القائمة، إن وُجد. */
  acceptedRequestId: string | null;
  /** أي طلب حيّ (pending أو accepted) — هو ما يحجز الموضوع. */
  hasLiveRequest: boolean;
};

export const readOccupancy = async (
  db: Db,
  topicId: string,
): Promise<TopicOccupancy> => {
  const [group, pending, pendingCount, accepted] = await Promise.all([
    db.projectGroup.findUnique({
      where: { topicId },
      select: { id: true, _count: { select: { members: true } } },
    }),
    db.groupRequest.findFirst({
      where: { topicId, status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { id: true, _count: { select: { members: true } } },
    }),
    db.groupRequest.count({ where: { topicId, status: "pending" } }),
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
    pendingRequestCount: pendingCount,
    acceptedRequestId: accepted?.id ?? null,
    hasLiveRequest: !!pending || !!accepted,
  };
};

//
// ─── الكتابة ─────────────────────────────────────────────────────
//

/**
 * يُعيد حساب `status` من القرار المخزَّن والإشغال الحاليّ، ويكتبه إن تغيّر —
 * ومعه `pendingRequestCount`، عدّادُ السقف.
 *
 * تُنادى بعد **كل** تغيّر في الإشغال أو في الطلبات: إنشاء مجموعة أو فسخها،
 * إرسال طلب أو إلغاؤه، قبوله أو رفضه. لا تغيّر القرار أبداً — لذلك تُنادى
 * بأمان داخل أي معاملة.
 */
export const computeTopicStatus = async (
  db: Db,
  topicId: string,
): Promise<TopicStatus> => {
  const topic = await db.graduationTopic.findUnique({
    where: { id: topicId },
    select: { status: true, publishedAt: true, pendingRequestCount: true },
  });
  if (!topic) return "pending"; // حُذف الموضوع في نفس المعاملة — لا شيء ليُكتب.

  const { hasGroup, pendingRequestCount } = await readOccupancy(db, topicId);
  const next = projectTopicStatus({
    decision: decisionOf(topic.status),
    publishedAt: topic.publishedAt,
    hasGroup,
  });

  if (next !== topic.status || pendingRequestCount !== topic.pendingRequestCount) {
    await db.graduationTopic.update({
      where: { id: topicId },
      data: { status: next, pendingRequestCount },
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
 * ما يزال يقبل طلباً: الطلباتُ المعلّقة دون السقف، أو لا سقف له.
 *
 * والمقارنةُ بين عمودين في قاعدة البيانات نفسها (`fields.maxRequests`)،
 * فتُسأل في الاستعلام الذي يُرقّم ويَعدّ — لا بعد جلب الصفوف.
 */
export const UNDER_REQUEST_CAP = {
  OR: [
    { maxRequests: null },
    { pendingRequestCount: { lt: prisma.graduationTopic.fields.maxRequests } },
  ],
} satisfies Prisma.GraduationTopicWhereInput;

/** وعكسُه: اكتملت طلباتُه المعلّقة، فلا يقبل جديداً حتى تبتّ الإدارة. */
export const REQUEST_CAP_REACHED = {
  maxRequests: { not: null },
  pendingRequestCount: { gte: prisma.graduationTopic.fields.maxRequests },
} satisfies Prisma.GraduationTopicWhereInput;

/**
 * الشرط الوحيد لـ«متاح للطلبة».
 *
 * كان هذا الشرط مكتوباً أربع مرّات — في تصفّح الطالب، وفي إنشاء الطلب، وفي
 * القائمة العامّة، وفي صفحة الموضوع العامّة — وكلٌّ يشتقّه بطريقته. تُستورد
 * هذه القطعة الآن بدل إعادة كتابته، فتتغيّر القاعدة في مكان واحد.
 *
 * المنشور (`open`) تتقدّم إليه الفرق **معاً** حتى سقفه، والإدارة تختار.
 * وغيرُ المنشور (`approved`) يبقى على حجز الطلب الواحد: هو حال اقتراح الأستاذ
 * لطلبةٍ بأعيانهم، وطلبُه عليه لا يُزاحَم.
 *
 * `full` مستبعَد ضمناً: أي موضوع له مجموعة يكون `full`.
 */
export const AVAILABLE_TO_STUDENTS = {
  projectGroup: null,
  OR: [
    {
      status: "open",
      groupRequests: { none: { status: "accepted" } },
      ...UNDER_REQUEST_CAP,
    },
    {
      status: "approved",
      groupRequests: { none: { status: { in: ["pending", "accepted"] } } },
    },
  ],
} satisfies Prisma.GraduationTopicWhereInput;

/**
 * ما يُحسب على سقف الموضوع — وهو ما يُعرض أيضاً: الطلبات المعلّقة.
 *
 * العرضُ والحارسُ يقرآن هذا الشرط نفسه. ولو افترقا لقالت الشاشة «٢ / ٢»
 * والخادمُ يقبل طلباً ثالثاً، أو العكس — وكلاهما يُفقد الثقة بالعدّاد.
 * والمرفوضُ والمُلغى خارجه: يُفرِجان عن خانتيهما.
 */
export const COUNTED_ON_CAP = {
  status: "pending",
} satisfies Prisma.GroupRequestWhereInput;

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
  > & { pendingRequestCount?: number },
): TopicActions => {
  const s = topic.status;
  const waiting = !!occ.pendingRequestId;
  const reserved = !!occ.acceptedRequestId;

  // فريقٌ بعدد طلابه، أو عدّة فرق بعددها.
  const waitingParams = {
    count: occ.pendingRequestMemberCount,
    teams: occ.pendingRequestCount ?? (waiting ? 1 : 0),
  };
  const waitingTeam = (
    key: "gate.rejectWaiting" | "gate.publishWaiting" | "gate.archiveWaiting" | "gate.assignWaiting",
  ) => tr(key, waitingParams);

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
    params: waitingParams,
  };

  const canApprove = gate(
    "approve",
    s === "pending" || s === "rejected",
    tr("gate.approve"),
    { code: "notUndecided" },
  );

  const canReject = gate(
    "reject",
    (s === "pending" || s === "approved" || s === "open") && !waiting,
    waiting
      ? waitingTeam("gate.rejectWaiting")
      : tr("gate.reject"),
    waiting ? waitingBlock : { code: "notRejectable" },
  );

  const canPublish = gate(
    "publish",
    s === "approved" && !waiting && !reserved,
    waiting
      ? waitingTeam("gate.publishWaiting")
      : reserved
        ? tr("gate.publishReserved")
        : tr("gate.publishNotApproved"),
    waiting ? waitingBlock : { code: reserved ? "reserved" : "notApproved" },
  );

  const canUnpublish = gate(
    "unpublish",
    s === "open",
    tr("gate.unpublish"),
    { code: "notOpen" },
  );

  const canArchive = gate(
    "archive",
    (s === "approved" || s === "open" || s === "full") && !waiting,
    waiting
      ? waitingTeam("gate.archiveWaiting")
      : tr("gate.archive"),
    waiting ? waitingBlock : { code: "notArchivable" },
  );

  const canUnarchive = gate(
    "unarchive",
    s === "archived",
    tr("gate.unarchive"),
    { code: "notArchived" },
  );

  // الحذف لا يسأل عن الحالة إطلاقاً — يسأل عمّا سيُفقد.
  const canDelete = gate(
    "delete",
    !occ.hasGroup && !waiting && !reserved,
    occ.hasGroup
      ? tr("gate.deleteHasGroup")
      : reserved
        ? tr("gate.deleteReserved")
        : tr("gate.deleteWaiting", waitingParams),
    occ.hasGroup
      ? { code: "hasGroup" }
      : reserved
        ? { code: "reserved" }
        : waitingBlock,
  );

  const canAssignGroup = gate(
    "assignGroup",
    !waiting,
    waitingTeam("gate.assignWaiting"),
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
  pendingRequestCount: number;
  hasAcceptedRequest: boolean;
};

/** يبني الإشغال من صفوفٍ محمَّلة سلفاً، بلا استعلام إضافي لكل صفّ. */
export const occupancyFromRelations = (row: {
  projectGroup?: { _count?: { members: number } } | null;
  groupRequests?: { id: string; status: string; _count?: { members: number } }[];
}): TopicOccupancy & TopicOccupancySummary => {
  const pending = row.groupRequests?.find((r) => r.status === "pending");
  const pendingCount = row.groupRequests?.filter((r) => r.status === "pending").length ?? 0;
  const accepted = row.groupRequests?.find((r) => r.status === "accepted");
  const hasGroup = !!row.projectGroup;
  return {
    hasGroup,
    groupId: null,
    groupMemberCount: row.projectGroup?._count?.members ?? 0,
    pendingRequestId: pending?.id ?? null,
    pendingRequestMemberCount: pending?._count?.members ?? 0,
    pendingRequestCount: pendingCount,
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
  | "memberPlaced"
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
  /**
   * أوّلُ عضوٍ في الطلب له مشروعٌ على موضوعٍ آخر، إن وُجد.
   *
   * الطالبُ الواحد لا يكون إلّا في مشروعٍ واحد. وكان القبولُ لا يسأل عن
   * الأعضاء أصلاً: فريقٌ طلب موضوعين بأولويتين، فقُبل الأوّل، ثمّ الثاني —
   * فصار أعضاؤه في مشروعين.
   */
  placed?: { name: string; topic: string } | null;
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

  const { status, memberCount, topic, placed } = input;
  const accepted = status === "accepted";

  // الترتيب هو ترتيب الخادم نفسه، فيقع السبب المعروض على أوّل ما يمنع فعلاً.
  const canAccept = accepted
    ? gate("accept", false, tr("gate.requestAccepted"), {
        code: "alreadyAccepted",
      })
    : !ELIGIBLE_FOR_ACCEPT.includes(topic.status)
      ? gate(
          "accept",
          false,
          tr("gate.topicGone"),
          { code: "topicUnavailable", params: { status: topic.status } },
        )
      : topic.hasGroup
        ? gate(
            "accept",
            false,
            tr("gate.topicTaken"),
            { code: "topicTaken" },
          )
        : placed
          ? gate(
              "accept",
              false,
              tr("gate.memberPlaced", placed),
              { code: "memberPlaced", params: placed },
            )
          : gate(
              "accept",
              memberCount <= topic.maxStudents,
              tr("gate.tooManyMembers", { members: memberCount, max: topic.maxStudents }),
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
    tr("gate.rejectHasProject"),
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
