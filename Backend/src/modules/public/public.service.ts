import { prisma } from "../../core/prisma/client";
import { topicExtrasSelect } from "../../core/topic/topic-extras";
import { HttpException, NotFoundException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { Roles } from "../../core/enums/role.enum";
import { ListPublicTopicsDTO } from "./public.validation";
import { Prisma } from "../../generated/prisma";
import { tr } from "../../core/i18n";
import { REQUEST_CAP_REACHED, UNDER_REQUEST_CAP } from "../../core/topic/topic-status";

/** من يقرأ: الموضوع المحجوز يُغلق على الطلبة وحدهم، إلّا فريقه. */
export interface PublicViewer {
  userId: string;
  role: string;
}

/**
 * ملفّ الطالب للقارئ، إن كان طالباً — ومن لا ملفّ له (أستاذ، مسؤول) قارئٌ
 * لا متقدِّم، فلا يُغلق عليه شيء.
 */
const studentIdOf = async (viewer: PublicViewer) =>
  viewer.role === Roles.STUDENT
    ? ((
        await prisma.student.findUnique({
          where: { userId: viewer.userId },
          select: { id: true },
        })
      )?.id ?? null)
    : null;

/**
 * عضويّةُ القارئ في ما يحجز الموضوع — المجموعة أو الطلب الحيّ. والمرسِل
 * نفسه بين الأعضاء في الحالين. وبلا طالبٍ يُطابَق على معرّفٍ لا يوجد، فلا
 * يعود شيء.
 */
const mineOnly = (studentId: string | null) => ({
  where: { studentId: studentId ?? "" },
  select: { id: true },
  take: 1,
});

/**
 * Public-safe projection of a professor — what a university directory shows:
 * name, photo, academic rank, department and faculty.
 *
 * Never the account internals: no email (personal or university), no phone,
 * no employee number. These routes sit behind sign-in, but a student reading
 * a topic has no business with a professor's contact details or staff id;
 * the photo and rank are what let them recognise who they would work with.
 */
const publicProfessorSelect = {
  id: true,
  grade: true,
  user: {
    select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true, avatarUrl: true, gender: true },
  },
  department: {
    select: { name: true, faculty: { select: { name: true } } },
  },
};

//
// ═══════════════════════════════════════════════════════════════
//  BROWSE PUBLISHED TOPICS  (no auth — landing page)
// ═══════════════════════════════════════════════════════════════
//
// Only topics the admin has PUBLISHED are ever exposed publicly:
//   open  → "available" while it takes requests: fewer pending than its cap
//           (teams ask at the same time; the administration picks one)
//   full  → "reserved"  (shown, but locked — a group already formed)
//   open with its pending requests at the cap → "reserved" too, until the
//           administration decides
// pending / approved (accepted but not yet published) / rejected / archived
// are NEVER returned. "approved" is the initial-acceptance stage and stays
// hidden until the admin publishes it (approved → open).

const VISIBLE_STATUSES = ["open", "full"] as const;

/** الطلب الحيّ — pending أو accepted. */
const LIVE_REQUEST = { status: { in: ["pending", "accepted"] } as never };

/** منشور، ولا مجموعة ولا فريق مقبول، وطلباته المعلّقة دون سقفه ⇒ يقبل طلباً الآن. */
const PUBLIC_AVAILABLE: Prisma.GraduationTopicWhereInput = {
  status: "open",
  projectGroup: null,
  groupRequests: { none: { status: "accepted" } },
  ...UNDER_REQUEST_CAP,
};

/**
 * ظاهر للعموم لكنه لا يقبل طلباً: تشكّلت له مجموعة، أو قُبل عليه فريق، أو
 * اكتملت طلباته المعلّقة عند سقفه — وذاك حتى تبتّ الإدارة.
 *
 * كان تبويب «محجوز» يطلب `status = full` **و** «لا طلب حيّ» معاً، وهما لا
 * يجتمعان: كل موضوع اكتمل بطلب يحمل طلباً مقبولاً، فكان التبويب يُخفيه
 * ويُظهر المواضيع المُسنَدة إدارياً وحدها — وهي التي تصل `full` بلا طلب.
 */
const PUBLIC_RESERVED: Prisma.GraduationTopicWhereInput = {
  status: { in: [...VISIBLE_STATUSES] as never },
  OR: [
    { projectGroup: { isNot: null } },
    { groupRequests: { some: { status: "accepted" } } },
    REQUEST_CAP_REACHED,
  ],
};

/**
 * ما يقوله الموضوع لهذا القارئ.
 *
 * `taken`: لا يقبل طلباً — مجموعة، أو فريق مقبول، أو سقفٌ مكتمل.
 * `mine`: لفريق القارئ عليه طلبٌ حيّ أو مجموعة — فيُفتح له، ولا يُعرض عليه
 * التقدّم ثانيةً (طلبُه قائم). و`myRequestPending` يفرّق بين «طلبكم بين
 * المتقدّمين ينتظر القرار» و«الموضوع لفريقكم».
 */
const readerView = (t: {
  status: string;
  maxRequests: number | null;
  pendingRequestCount: number;
  group: boolean;
  accepted: boolean;
  mineTaken: boolean;
  minePending: boolean;
}) => {
  const capFull = t.maxRequests !== null && t.pendingRequestCount >= t.maxRequests;
  const taken = t.group || t.accepted || capFull;
  const mine = t.mineTaken || t.minePending;
  return {
    isAvailable: t.status === "open" && !taken && !mine,
    // للقارئ نفسه، طلبُ فريقه يحجز الموضوع له.
    isReserved: taken || mine,
    isMine: mine,
    myRequestPending: t.minePending && !t.mineTaken,
    // عدّادُ السقف للعرض: «طلبان من ٣».
    requests: { pending: t.pendingRequestCount, max: t.maxRequests },
  };
};

const VISIBLE: Prisma.GraduationTopicWhereInput = {
  status: { in: [...VISIBLE_STATUSES] as never },
};

/** كلماتُ البحث — كلٌّ منها يُطابَق وحده، فلا يُشترط ترتيبها ولا تجاورها. */
const searchWords = (s?: string) =>
  (s ?? "").split(/\s+/).filter(Boolean).slice(0, 6);

const ORDER: Record<
  ListPublicTopicsDTO["sort"],
  Prisma.GraduationTopicOrderByWithRelationInput[]
> = {
  // والمعرّف آخراً: مواضيعُ أُنشئت في اللحظة نفسها تبقى في ترتيبٍ ثابت،
  // فلا يتكرّر موضوعٌ بين صفحتين ولا يسقط.
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  title: [{ title: "asc" }, { id: "asc" }],
};

export const listPublicTopicsService = async (
  q: ListPublicTopicsDTO,
  viewer: PublicViewer,
) => {
  const me = await studentIdOf(viewer);

  // تُجمع الشروط بـ AND صريح: التبويب «محجوز» يحتاج OR داخلياً، ولو تُرك
  // مسطّحاً لابتلع OR الخاص بالبحث.
  //
  // وما سوى الإتاحة يُجمع وحده أوّلاً: العدّادات الثلاثة (الكلّ، المتاح،
  // المحجوز) تُحسب عليه، فيرى الطالب كم في كلّ تبويبٍ **بفلاتره هو** قبل
  // أن ينتقل إليه.
  const base: Prisma.GraduationTopicWhereInput[] = [];

  if (q.specializationId) base.push({ specializationId: q.specializationId });
  // Filter by department through topic → specialization → filiere → department.
  if (q.departmentId)
    base.push({ specialization: { filiere: { departmentId: q.departmentId } } });
  if (q.academicYearId) base.push({ academicYearId: q.academicYearId });
  if (q.professorId) base.push({ professorId: q.professorId });
  if (q.maxStudents) base.push({ maxStudents: q.maxStudents });

  // البحث في العنوان والوصف واسم المشرف والتخصّص: «مرابط علم النفس» تجد
  // مواضيع الأستاذ مرابط في علم النفس، كلمةً كلمة.
  for (const w of searchWords(q.search))
    base.push({
      OR: [
        { title: { contains: w } },
        { description: { contains: w } },
        { professor: { user: { firstName: { contains: w } } } },
        { professor: { user: { lastName: { contains: w } } } },
        { specialization: { name: { contains: w } } },
      ],
    });

  const tab =
    q.availability === "available"
      ? PUBLIC_AVAILABLE
      : q.availability === "reserved"
        ? PUBLIC_RESERVED
        : VISIBLE;
  const where: Prisma.GraduationTopicWhereInput = { AND: [tab, ...base] };

  const [rows, all, available, reserved] = await Promise.all([
    prisma.graduationTopic.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        maxStudents: true,
        createdAt: true,
        publishedAt: true,
        specialization: { select: { id: true, name: true, level: true } },
        academicYear: { select: { id: true, title: true } },
        professor: { select: publicProfessorSelect },
        // The short description and the type, for the card (core/topic/topic-extras).
        summary: true,
        type: topicExtrasSelect.type,
        maxRequests: true,
        pendingRequestCount: true,
        // الإشغال يُقرأ من صفوفه لا من `status`. المعرّفات لا تُعاد إلى
        // العميل — تُستهلك أدناه ثم تُسقَط من الحمولة العامّة. ومعها عضويّةُ
        // القارئ وحده: هل لفريقه طلبٌ حيّ عليه؟
        projectGroup: { select: { id: true, members: mineOnly(me) } },
        groupRequests: {
          where: LIVE_REQUEST,
          select: { status: true, members: mineOnly(me) },
        },
      },
      orderBy: ORDER[q.sort],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.graduationTopic.count({ where: { AND: [VISIBLE, ...base] } }),
    prisma.graduationTopic.count({ where: { AND: [PUBLIC_AVAILABLE, ...base] } }),
    prisma.graduationTopic.count({ where: { AND: [PUBLIC_RESERVED, ...base] } }),
  ]);

  // زرّ «تقدَّم» يعتمد على الإشغال الحقيقي، لا على الحالة وحدها.
  const items = rows.map(({ projectGroup, groupRequests, maxRequests, pendingRequestCount, ...t }) => ({
    ...t,
    ...readerView({
      status: t.status,
      maxRequests,
      pendingRequestCount,
      group: !!projectGroup,
      accepted: groupRequests.some((r) => r.status === "accepted"),
      mineTaken:
        !!projectGroup?.members.length ||
        groupRequests.some((r) => r.status === "accepted" && r.members.length > 0),
      minePending: groupRequests.some((r) => r.status === "pending" && r.members.length > 0),
    }),
  }));

  const total =
    q.availability === "available"
      ? available
      : q.availability === "reserved"
        ? reserved
        : all;

  return {
    items,
    total,
    page: q.page,
    limit: q.limit,
    counts: { all, available, reserved },
  };
};

/**
 * خيارات الفلاتر، من المنشور وحده.
 *
 * قائمةُ «المشرف» لا تعرض أستاذاً بلا موضوعٍ ظاهر، ولا «السنة» سنةً خالية،
 * ولا «الحجم» حجماً لا موضوع به: خيارٌ يُختار فلا يُرجع شيئاً فخٌّ لا فلتر.
 * وبجانب كلٍّ عددُه، فيُعرف قبل الاختيار ما وراءه.
 *
 * و`mine` للطالب وحده: تخصّصه وسنته، لزرّ «تخصّصي» — والحساب في الواجهة
 * لا يحملهما.
 */
export const getPublicTopicFiltersService = async (userId: string) => {
  const [professors, academicYears, sizes, me] = await Promise.all([
    prisma.professor.findMany({
      where: { topics: { some: VISIBLE } },
      select: {
        id: true,
        user: {
          select: { firstName: true, lastName: true, firstNameLatin: true, lastNameLatin: true, avatarUrl: true, gender: true },
        },
        _count: { select: { topics: { where: VISIBLE } } },
      },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    }),
    prisma.academicYear.findMany({
      where: { topics: { some: VISIBLE } },
      select: {
        id: true,
        title: true,
        isActive: true,
        _count: { select: { topics: { where: VISIBLE } } },
      },
      orderBy: { title: "desc" },
    }),
    prisma.graduationTopic.groupBy({
      by: ["maxStudents"],
      where: VISIBLE,
      _count: { _all: true },
      orderBy: { maxStudents: "asc" },
    }),
    prisma.student.findUnique({
      where: { userId },
      select: {
        academicYearId: true,
        specialization: {
          select: { id: true, name: true, filiere: { select: { departmentId: true } } },
        },
      },
    }),
  ]);

  return {
    professors: professors.map((p) => ({
      id: p.id,
      user: p.user,
      count: p._count.topics,
    })),
    academicYears: academicYears.map((y) => ({
      id: y.id,
      title: y.title,
      isActive: y.isActive,
      count: y._count.topics,
    })),
    sizes: sizes.map((s) => ({ value: s.maxStudents, count: s._count._all })),
    mine: me
      ? {
          specializationId: me.specialization.id,
          specializationName: me.specialization.name,
          departmentId: me.specialization.filiere.departmentId,
          academicYearId: me.academicYearId,
        }
      : null,
  };
};

// Public single-topic detail. Mirrors the list visibility rules: a topic that
// is not published returns 404 (we don't reveal pending/rejected topics).
//
// والمحجوزُ يُغلق على الطالب من غير فريقه: 403 برمز `TOPIC_RESERVED`، لا
// تفاصيل. كانت القائمة تمنع النقر وحدها، فيصله بالرابط المباشر من نسخه أو
// حفظه. والأستاذ والمسؤول يقرآنه كما هو: لا طلبَ لهما عليه.
export const getPublicTopicService = async (id: string, viewer: PublicViewer) => {
  const me = await studentIdOf(viewer);

  // والطالبُ الذي له مذكرة لا يفتح إلّا موضوعها: طالبٌ واحد لمذكرةٍ واحدة، فلا
  // طلبَ له على غيره — وتفاصيلُ غيره تُغلق عليه كما يُغلق المحجوز، والقائمة
  // تقفل بطاقاتها (الواجهة)؛ وهنا لمن جاء بالرابط المباشر.
  if (me) {
    const placed = await prisma.projectMember.findFirst({
      where: { studentId: me },
      select: { group: { select: { topicId: true, topic: { select: { title: true } } } } },
    });
    if (placed && placed.group.topicId !== id)
      throw new HttpException(
        tr("public.topicPlaced", { title: placed.group.topic.title }),
        HTTPSTATUS.FORBIDDEN,
        ErrorCodeEnum.TOPIC_PLACED,
      );
  }

  const topic = await prisma.graduationTopic.findFirst({
    where: { id, status: { in: [...VISIBLE_STATUSES] as never } },
    // The lists hide a reserved topic; a saved or shared link still reaches
    // it, so the answer has to say it is taken rather than let the page
    // claim it is free and the request fail later.
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      maxStudents: true,
      requirements: true,
      objectives: true,
      // references: true,  // ← فعّله بعد إضافة عمود references + migration
      createdAt: true,
      publishedAt: true,
      maxRequests: true,
      pendingRequestCount: true,
      specialization: { select: { id: true, name: true, level: true } },
      academicYear: { select: { id: true, title: true } },
      professor: { select: publicProfessorSelect },
      // The co-supervisor, the short description and the type (core/topic/topic-extras).
      ...topicExtrasSelect,
    },
  });
  if (!topic)
    throw new NotFoundException(
      tr("notFound.topic"),
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );

  // المُسنَد إدارياً يصل `full` بلا طلب، فالمجموعة وحدها تكفي لاعتباره محجوزاً.
  const [liveRequests, group] = await Promise.all([
    prisma.groupRequest.findMany({
      where: { topicId: id, ...LIVE_REQUEST },
      select: { status: true, members: mineOnly(me) },
    }),
    prisma.projectGroup.findUnique({
      where: { topicId: id },
      select: { id: true, members: mineOnly(me) },
    }),
  ]);
  const { maxRequests, pendingRequestCount, ...rest } = topic;
  const view = readerView({
    status: topic.status,
    maxRequests,
    pendingRequestCount,
    group: !!group,
    accepted: liveRequests.some((r) => r.status === "accepted"),
    mineTaken:
      !!group?.members.length ||
      liveRequests.some((r) => r.status === "accepted" && r.members.length > 0),
    minePending: liveRequests.some((r) => r.status === "pending" && r.members.length > 0),
  });

  // مأخوذٌ لغير فريق القارئ: لا تُعرض تفاصيله على طالبٍ لا طلب له عليه.
  if (view.isReserved && !view.isMine && viewer.role === Roles.STUDENT)
    throw new HttpException(
      tr("public.topicReserved"),
      HTTPSTATUS.FORBIDDEN,
      ErrorCodeEnum.TOPIC_RESERVED,
    );

  return { ...rest, ...view };
};

// Specializations list for the filter dropdown (public, minimal fields).
// Optionally scoped to one department, so the UI can show only that
// department's specializations when a department is selected.
export const listPublicSpecializationsService = async (
  departmentId?: string,
) => {
  const rows = await prisma.specialization.findMany({
    where: departmentId ? { filiere: { departmentId } } : undefined,
    select: {
      id: true,
      name: true,
      filiere: { select: { departmentId: true } },
    },
    orderBy: { name: "asc" },
  });
  // احتفظ بنفس شكل المخرجات السابق للواجهة: { id, name, departmentId }
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    departmentId: s.filiere.departmentId,
  }));
};

// Departments list for the filter dropdown (public, minimal fields).
export const listPublicDepartmentsService = async () => {
  return prisma.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
};
