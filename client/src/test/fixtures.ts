import type { MailTemplatesData } from "../features/admin/api/mail-templates.api";
import type { ProfessorOption, TopicTypeRow } from "../types/topic-extras";
import type { SheetPreview, TeamSizeImpact, TeamSizeState, TopicExportPreview, TopicQuotaState } from "../types/admin";
import type { TeamSizes } from "../lib/team-size";
/**
 * بيانات الخادم المزيّف — كلّيةٌ واحدة بقسمين، وثلاثة أساتذة، وأربعة طلبة،
 * ومواضيعُ بكلّ حالاتها، ومشروعٌ كاملٌ بمراحله ومناقشته، ورسائل.
 *
 * كلّها مترابطة كما في قاعدةٍ حقيقية: الطالب «أمين» قائدُ فريق الموضوع
 * الممتلئ، ومشرفُه «كريم»، ومناقشتُه بعد عشرة أيام في «قاعة 12». فصفحةٌ تفتح
 * التفاصيل تجد ما تعرضه، والرابط منها يقود إلى صفحةٍ تعرف المعرّف.
 *
 * والأشكال مكتوبةٌ بأنواع الواجهة (`satisfies`): حقلٌ يتغيّر اسمه في الأنواع
 * يُكسر هنا عند الترجمة، لا في اختبارٍ يمرّ بصمت.
 */
import type {
  AcademicYear,
  AdminDashboard,
  AdminDefense,
  AdminGroupRequest,
  AdminMilestone,
  AdminProject,
  AdminRequestTopic,
  AdminTopic,
  ArchiveYear,
  AuditActor,
  AuditCountry,
  AuditLogEntry,
  AuditSummary,
  ProposalWindow,
  SelectionWindow,
  Department,
  DefenseStats,
  Domain,
  Faculty,
  Filiere,
  Professor,
  Specialization,
  Student,
  TopicActionKey,
  TopicActions,
  TopicBlockCode,
  UniversityDomain,
  UserDetail,
  UserLite,
  YearReadiness,
  YearRecordResponse,
} from "../types/admin";
import type { AccountSession, MyAccount, SecurityAlert } from "../types/account";
import type { AuthUser } from "../types/auth";
import type { ProfessorDashboard, ProjectGroup, ProjectGroupListItem, Topic } from "../types/professor.types";
import type { GroupRequest, MyProject, StudentDashboard, StudentSelectionWindow } from "../types/student.types";
import type { PublicTopicDetail, PublicTopicFilters, PublicTopic } from "../types/public.types";
import type { AboutPage, DirectorMessage, HomeSlide, LoginContent, NewsItem } from "../types/site.types";
import type {
  ChatPage,
  Contact,
  Conversation,
  InboxItem,
  MessageUserLite,
  SentItem,
  ThreadMessage,
} from "../features/messages/api/messages.api";
import type { SupervisionDocument } from "../features/supervision/api/supervision.api";
import type { ActivationRequestItem, DeskStudent, DeskStudentRow, StudentProfile } from "../features/admin/api/activation.api";
import type { PasswordRequestItem } from "../features/admin/api/password-requests.api";

/**
 * معرّفاتٌ بصيغة الخادم (UUID) لما تتحقّق منه النماذج بـ`uuid()`: الكلّية
 * والقسم والتخصّص والسنة والمشروع. غيرها قصيرٌ ليُقرأ.
 */
export const ID = {
  fac1: "a1000000-0000-4000-8000-000000000001",
  dep1: "d1000000-0000-4000-8000-000000000001",
  dep2: "d2000000-0000-4000-8000-000000000002",
  spec1: "5e100000-0000-4000-8000-000000000001",
  spec2: "5e200000-0000-4000-8000-000000000002",
  y1: "e1000000-0000-4000-8000-000000002526",
  y0: "e0000000-0000-4000-8000-000000002425",
  g1: "b1000000-0000-4000-8000-000000000001",
  g2: "b2000000-0000-4000-8000-000000000002",
} as const;

const DAY = 86_400_000;
/** تاريخٌ بالأيام من الآن — المراحل والمناقشات «متأخرة» و«قادمة» حقّاً. */
export const days = (n: number) => new Date(Date.now() + n * DAY).toISOString();
const created = days(-120);

// ── البنية ──────────────────────────────────────────────────
export const faculty = {
  id: ID.fac1,
  name: "كلية العلوم الإنسانية والاجتماعية",
  code: "FSHS",
  coverUrl: null,
  iconUrl: null,
  _count: { departments: 2 },
} satisfies Faculty;

export const department = {
  id: ID.dep1,
  name: "قسم علم الاجتماع",
  code: "SOC",
  facultyId: faculty.id,
  coverUrl: null,
  faculty,
  _count: { specializations: 2, professors: 3, filieres: 1, domains: 1 },
} satisfies Department;

export const department2 = {
  id: ID.dep2,
  name: "قسم علم النفس",
  code: "PSY",
  facultyId: faculty.id,
  coverUrl: null,
  faculty,
  _count: { specializations: 0, professors: 0, filieres: 0, domains: 0 },
} satisfies Department;

export const domain = {
  id: "dom1",
  name: "العلوم الاجتماعية",
  code: "SS",
  departmentId: department.id,
  coverUrl: null,
  department,
  _count: { filieres: 1 },
} satisfies Domain;

export const filiere = {
  id: "fil1",
  name: "علم الاجتماع",
  code: "SOC-F",
  departmentId: department.id,
  domainId: domain.id,
  coverUrl: null,
  department,
  _count: { specializations: 2 },
} satisfies Filiere;

export const specialization = {
  id: ID.spec1,
  name: "علم اجتماع التنظيم والعمل",
  level: "master",
  coverUrl: null,
  filiereId: filiere.id,
  filiere,
  departmentId: department.id,
  department,
  _count: { students: 3, topics: 5 },
} satisfies Specialization;

export const specialization2 = {
  id: ID.spec2,
  name: "علم الاجتماع العام",
  level: "licence",
  coverUrl: null,
  filiereId: filiere.id,
  filiere,
  departmentId: department.id,
  department,
  _count: { students: 1, topics: 1 },
} satisfies Specialization;

export const year = { id: ID.y1, title: "2025/2026", isActive: true, archivedAt: null } satisfies AcademicYear;
export const pastYear = { id: ID.y0, title: "2024/2025", isActive: false, archivedAt: days(-200) } satisfies AcademicYear;

/** عدد الطلبة في كلّ موضوعٍ لسنة، لكلّ مستوى، كما يردّه الخادم. */
export const teamSizeState = (y: AcademicYear, teamSizes: TeamSizes | null = null): TeamSizeState => {
  const ruled = !!teamSizes && Object.keys(teamSizes).length > 0;
  return {
    year: { id: y.id, title: y.title, isActive: y.isActive, archivedAt: y.archivedAt ?? null, teamSizes },
    stats: { total: 7, topics: ruled ? 6 : 0, matching: ruled ? 4 : 0, differing: ruled ? 2 : 0 },
  };
};

/**
 * حدّ المواضيع لكلّ أستاذ في سنة، كما يردّه الخادم: ثلاثة أساتذة اقترحوا —
 * أربعةٌ ومواضيع اثنان وواحد — من خمسة.
 */
export const topicQuotaState = (y: AcademicYear, max: number | null = null): TopicQuotaState => {
  const people = [
    { id: "p1", name: "كريم منصوري", avatar: null, count: 4 },
    { id: "p2", name: "سعاد بن علي", avatar: null, count: 2 },
    { id: "p3", name: "يوسف عمراني", avatar: null, count: 1 },
  ];
  return {
    year: { id: y.id, title: y.title, isActive: y.isActive, archivedAt: y.archivedAt ?? null, maxTopicsPerProfessor: max },
    stats: {
      professors: 5,
      proposing: people.length,
      atLimit: max === null ? 0 : people.filter((p) => p.count === max).length,
      over: max === null ? 0 : people.filter((p) => p.count > max).length,
    },
    histogram: { "1": 1, "2": 1, "4": 1 },
    professors: people,
  };
};

/**
 * وأثرُ قواعدَ على مواضيع السنة قبل حفظها: موضوعٌ ليسانس وآخر ماستر يتغيّران،
 * وواحدٌ ماستر فيه طلبةٌ أكثر، وطلبٌ معلّقٌ أكبر — ومع كلّ مستوى تفصيله.
 */
export const teamSizeImpact = (rules: Record<string, string>): TeamSizeImpact => {
  const has = (l: string) => !!rules[l];
  const n = (l: string) => Number(String(rules[l] ?? "exact-2").split("-")[1]);
  const levels: TeamSizeImpact["levels"] = {
    licence: { total: 3, sizes: { "1": 1, "2": 1, "4": 1 }, ruled: has("licence"), matching: has("licence") ? 1 : 0, changes: has("licence") ? 1 : 0, over: 0, pendingOver: 0 },
    master: { total: 4, sizes: { "2": 1, "3": 2, "4": 1 }, ruled: has("master"), matching: has("master") ? 2 : 0, changes: has("master") ? 1 : 0, over: has("master") ? 1 : 0, pendingOver: has("master") ? 1 : 0 },
    doctorate: { total: 0, sizes: {}, ruled: has("doctorate"), matching: 0, changes: 0, over: 0, pendingOver: 0 },
  };
  const changes = [
    ...(has("licence") ? [{ id: "t-pend", title: "تحليل المشاعر في التغريدات", professor: "نادية بوعلام", avatar: { avatarUrl: null, gender: "female" }, specialization: "علوم البيانات", status: "pending", members: 0, level: "licence" as const, from: 4, to: n("licence") }] : []),
    ...(has("master") ? [{ id: "t-open", title: "منصة تعليمية تكيفية", professor: "كريم منصوري", avatar: { avatarUrl: null, gender: "male" }, specialization: "هندسة البرمجيات", status: "open", members: 0, level: "master" as const, from: 3, to: n("master") }] : []),
  ];
  const over = has("master") ? [{ id: "t-full", title: "نظام توصية للمكتبة", professor: "كريم منصوري", avatar: { avatarUrl: null, gender: "male" }, specialization: "هندسة البرمجيات", status: "full", level: "master" as const, from: 4, to: 3, members: 3 }] : [];
  return {
    total: 7,
    ruled: (has("licence") ? 3 : 0) + (has("master") ? 4 : 0),
    matching: levels.licence.matching + levels.master.matching,
    changesCount: changes.length,
    changes,
    overCount: over.length,
    over,
    pendingOver: levels.master.pendingOver,
    levels,
  };
};

/** فترة اقتراح المواضيع لسنةٍ كما يردّها الخادم — وحالها من اللحظة، كما يحسبها. */
export const proposalWindow = (y: AcademicYear, open: string | null = null, close: string | null = null): ProposalWindow => ({
  year: { id: y.id, title: y.title, isActive: y.isActive, archivedAt: y.archivedAt ?? null, proposalsOpenAt: open, proposalsCloseAt: close },
  state: !open || !close ? "unset" : Date.now() < Date.parse(open) ? "upcoming" : Date.now() > Date.parse(close) ? "closed" : "open",
  stats: { topics: 7, professorsProposed: 3, professorsTotal: 5 },
});

const periodState = (open: string | null, close: string | null) =>
  !open || !close ? "unset" : Date.now() < Date.parse(open) ? "upcoming" : Date.now() > Date.parse(close) ? "closed" : "open";

/** مهلة اختيار المواضيع لسنةٍ كما يردّها الخادم للإدارة — ومعها فترة الاقتراح. */
export const selectionWindow = (
  y: AcademicYear,
  open: string | null = null,
  close: string | null = null,
  proposalsCloseAt: string | null = null,
): SelectionWindow => ({
  year: {
    id: y.id,
    title: y.title,
    isActive: y.isActive,
    archivedAt: y.archivedAt ?? null,
    proposalsOpenAt: proposalsCloseAt ? days(-30) : null,
    proposalsCloseAt,
    selectionOpenAt: open,
    selectionCloseAt: close,
  },
  state: periodState(open, close),
  stats: { topics: 12, studentsRequested: 18, studentsTotal: 40, pendingRequests: 4 },
});

/** ومهلة سنة الطالب كما يقرؤها هو (GET /student/selection-window). */
export const studentSelection = (open: string | null = null, close: string | null = null): StudentSelectionWindow => ({
  id: year.id,
  title: year.title,
  selectionOpenAt: open,
  selectionCloseAt: close,
  state: periodState(open, close),
});

// ── الأشخاص ─────────────────────────────────────────────────
const person = (
  id: string,
  firstName: string,
  lastName: string,
  role: UserLite["role"],
  extra: Partial<UserLite> = {},
): UserLite => ({
  id,
  firstName,
  lastName,
  firstNameLatin: null,
  lastNameLatin: null,
  email: `${id}@univ-msila.dz`,
  username: null,
  avatarUrl: null,
  gender: "male",
  phone: null,
  role,
  status: "active",
  isVerified: true,
  lastLoginAt: days(-1),
  createdAt: created,
  ...extra,
});

export const adminUser = person("ua1", "سمير", "بن علي", "admin", { email: "admin@univ-msila.dz" });
export const profUsers = [
  person("up1", "كريم", "منصوري", "professor", { firstNameLatin: "Karim", lastNameLatin: "MANSOURI" }),
  person("up2", "نادية", "بوزيد", "professor", { gender: "female" }),
  person("up3", "رشيد", "عبادة", "professor"),
];
export const studentUsers = [
  person("us1", "أمين", "حداد", "student", { firstNameLatin: "Amine", lastNameLatin: "HADDAD" }),
  person("us2", "سارة", "مرابط", "student", { gender: "female" }),
  person("us3", "ياسين", "عمراني", "student"),
  person("us4", "ليلى", "قاسمي", "student", { gender: "female", status: "suspended" }),
];

export const professors = profUsers.map(
  (user, i) =>
    ({
      id: `p${i + 1}`,
      employeeNumber: `EMP-00${i + 1}`,
      universityEmail: `${user.id}.prof@univ-msila.dz`,
      userId: user.id,
      user,
      department,
      grade: [["أستاذ محاضر أ"], ["أستاذ التعليم العالي"], ["أستاذ مساعد ب"]][i],
      tags: i === 0 ? ["رئيس فرقة بحث"] : [],
      _count: { topics: i === 0 ? 5 : 1 },
    }) satisfies Professor,
);
export const [prof1, prof2, prof3] = professors as [Professor, Professor, Professor];

export const students = studentUsers.map(
  (user, i) =>
    ({
      id: `st${i + 1}`,
      registrationNumber: `20203901234${i + 5}`,
      userId: user.id,
      user,
      specialization: i === 3 ? specialization2 : specialization,
      academicYear: year,
    }) satisfies Student,
);
export const [student1, student2, student3, student4] = students as [Student, Student, Student, Student];

const ref = (s: Student) => ({
  id: s.id,
  registrationNumber: s.registrationNumber,
  user: { id: s.user!.id, firstName: s.user!.firstName, lastName: s.user!.lastName, avatarUrl: null, gender: s.user!.gender },
  specialization: { id: specialization.id, name: specialization.name },
});

// ── المواضيع ────────────────────────────────────────────────
const actions = (over: Partial<TopicActions> = {}): TopicActions => ({
  canApprove: false,
  canReject: false,
  canPublish: false,
  canUnpublish: false,
  canArchive: false,
  canUnarchive: false,
  canDelete: false,
  canAssignGroup: false,
  blockedReasons: {},
  blockedCodes: {},
  ...over,
});

/**
 * ما يجوز للموضوع — بقواعد `topicActions` في الخادم (core/topic/topic-status)
 * نفسها: فريقٌ ينتظر يمنع الرفض والنشر والأرشفة والحذف، والمجموعة تمنع الحذف.
 */
const rules = (s: string, occ: { waiting: boolean; reserved: boolean; hasGroup: boolean }): TopicActions => {
  const { waiting, reserved, hasGroup } = occ;
  const out = actions({
    canApprove: s === "pending" || s === "rejected",
    canReject: ["pending", "approved", "open"].includes(s) && !waiting,
    canPublish: s === "approved" && !waiting && !reserved,
    canUnpublish: s === "open",
    canArchive: ["approved", "open", "full"].includes(s) && !waiting,
    canUnarchive: s === "archived",
    canDelete: !hasGroup && !waiting && !reserved,
    canAssignGroup: !waiting,
  });
  const block = (key: TopicActionKey, code: TopicBlockCode, reason: string) => {
    out.blockedCodes[key] = { code, ...(code === "teamWaiting" ? { params: { count: 2, teams: 1 } } : {}) };
    out.blockedReasons[key] = reason;
  };
  if (!out.canDelete) block("delete", hasGroup ? "hasGroup" : reserved ? "reserved" : "teamWaiting", "لا يُحذف");
  if (!out.canArchive && waiting) block("archive", "teamWaiting", "فريقٌ ينتظر");
  if (!out.canReject && waiting) block("reject", "teamWaiting", "فريقٌ ينتظر");
  return out;
};

const topic = (id: string, title: string, status: string, over: Partial<AdminTopic> = {}): AdminTopic => ({
  id,
  title,
  description: `وصف الموضوع «${title}»: إشكاليته ومنهجه وحدود الدراسة الميدانية.`,
  requirements: ["إتقان SPSS", "العمل الميداني"],
  objectives: ["تشخيص الظاهرة", "اقتراح حلول عملية"],
  references: [{ id: `${id}-r1`, title: "دليل البحث الاجتماعي", url: "https://example.org/guide" }],
  rejectionReason: null,
  status,
  maxStudents: 3,
  maxRequests: 3,
  professorId: prof1.id,
  professor: prof1,
  specialization,
  academicYear: year,
  _count: { groupRequests: 0 },
  occupancy: {
    hasGroup: false,
    groupMemberCount: 0,
    hasPendingRequest: false,
    pendingRequestMemberCount: 0,
    hasAcceptedRequest: false,
  },
  createdAt: created,
  ...over,
  actions: rules(status, {
    waiting: !!over.occupancy?.hasPendingRequest,
    reserved: !!over.occupancy?.hasAcceptedRequest,
    hasGroup: !!over.occupancy?.hasGroup,
  }),
});

export const topics = [
  topic("t-open", "أثر الرقمنة على الثقافة التنظيمية", "open", {
    _count: { groupRequests: 2 },
    occupancy: {
      hasGroup: false,
      groupMemberCount: 0,
      hasPendingRequest: true,
      pendingRequestMemberCount: 2,
      hasAcceptedRequest: false,
    },
  }),
  topic("t-pending", "العنف المدرسي في المرحلة المتوسطة", "pending"),
  topic("t-approved", "الاتصال داخل المؤسسة الاستشفائية", "approved", {
    professorId: prof2.id,
    professor: prof2,
  }),
  topic("t-full", "الهجرة غير الشرعية لدى الشباب", "full", {
    _count: { groupRequests: 1 },
    occupancy: {
      hasGroup: true,
      groupMemberCount: 2,
      hasPendingRequest: false,
      pendingRequestMemberCount: 0,
      hasAcceptedRequest: true,
    },
  }),
  topic("t-rejected", "التسرّب المدرسي", "rejected", {
    rejectionReason: "الموضوع مكرّر من السنة الماضية",
  }),
  topic("t-archived", "الأسرة الجزائرية والتحوّلات القيمية", "archived", {
    academicYear: pastYear,
  }),
];
export const [topicOpen, topicPending, topicApproved, topicFull, topicRejected, topicArchived] = topics as [
  AdminTopic,
  AdminTopic,
  AdminTopic,
  AdminTopic,
  AdminTopic,
  AdminTopic,
];

/**
 * تفصيل الموضوع كما يبنيه `getTopicByIdService`: فريقه بطلبته (المرسِل
 * أوّلاً)، والطلبات المعلّقة عليه بأقدمها، والمرفوضة سابقاً (`pastRequests`).
 */
export const adminTopicDetail = (id: string) => {
  const base = topics.find((t) => t.id === id) ?? topics[0]!;
  const member = (s: Student, i: number, isLeader: boolean) => ({ id: `pg-m${i}`, isLeader, student: s });
  const requestOf = (rid: string, leader: Student, team: Student[], extra: object = {}) => ({
    id: rid,
    createdAt: days(-3),
    updatedAt: days(-2),
    leader: { id: leader.id, registrationNumber: leader.registrationNumber },
    members: team.map((s, i) => ({ id: `${rid}-m${i}`, student: { id: s.id, registrationNumber: s.registrationNumber, user: s.user } })),
    ...extra,
  });
  return {
    ...base,
    projectGroup: base.id === "t-full" ? { id: ID.g1, topicId: base.id, createdAt: days(-60), members: [member(student1, 1, true), member(student4, 2, false)] } : null,
    groupRequests: base.id === "t-open" ? [requestOf("gr1", student2, [student2, student3], { status: "pending", priority: 1 })] : [],
    pastRequests: base.id === "t-open" ? [requestOf("gr3", student3, [student3], { rejectionReason: "الفريق تجاوز العدد المسموح" })] : [],
  };
};

// ── طلبات المجموعات ──────────────────────────────────────────
const leaderOf = (s: Student) => ({
  id: s.id,
  registrationNumber: s.registrationNumber,
  user: { firstName: s.user!.firstName, lastName: s.user!.lastName },
});

export const groupRequests: AdminGroupRequest[] = [
  {
    id: "gr1",
    status: "pending",
    priority: 1,
    createdAt: days(-3),
    rejectionReason: null,
    actions: { canAccept: true, canReject: true, blockedReasons: {}, blockedCodes: {} },
    topic: { id: topicOpen.id, title: topicOpen.title, status: "open" },
    leader: leaderOf(student2),
    members: [
      { id: "grm1", student: leaderOf(student2) },
      { id: "grm2", student: leaderOf(student3) },
    ],
  },
  {
    id: "gr2",
    status: "accepted",
    priority: 1,
    createdAt: days(-60),
    actions: {
      canAccept: false,
      canReject: false,
      blockedReasons: { accept: "قُبل من قبل", reject: "قُبل من قبل" },
      blockedCodes: {},
    },
    topic: { id: topicFull.id, title: topicFull.title, status: "full" },
    leader: leaderOf(student1),
    members: [
      { id: "grm3", student: leaderOf(student1) },
      { id: "grm4", student: leaderOf(student4) },
    ],
  },
  {
    id: "gr3",
    status: "rejected",
    priority: 2,
    createdAt: days(-20),
    rejectionReason: "الفريق تجاوز العدد المسموح",
    actions: { canAccept: false, canReject: false, blockedReasons: {}, blockedCodes: {} },
    topic: { id: topicOpen.id, title: topicOpen.title, status: "open" },
    leader: leaderOf(student3),
    members: [{ id: "grm5", student: leaderOf(student3) }],
  },
];

export const requestTopics: AdminRequestTopic[] = [
  {
    id: topicOpen.id,
    title: topicOpen.title,
    status: "open",
    maxStudents: 3,
    maxRequests: 3,
    pendingRequestCount: 1,
    professor: { id: prof1.id, user: { firstName: "كريم", lastName: "منصوري" } },
    specialization: { id: specialization.id, name: specialization.name },
    projectGroup: null,
    counts: { pending: 1, accepted: 0, rejected: 1, all: 2 },
    requests: [groupRequests[0]!, groupRequests[2]!],
  },
  {
    id: topicFull.id,
    title: topicFull.title,
    status: "full",
    maxStudents: 3,
    maxRequests: null,
    pendingRequestCount: 0,
    professor: { id: prof1.id, user: { firstName: "كريم", lastName: "منصوري" } },
    specialization: { id: specialization.id, name: specialization.name },
    projectGroup: { id: ID.g1 },
    counts: { pending: 0, accepted: 1, rejected: 0, all: 1 },
    requests: [groupRequests[1]!],
  },
];

// ── المشروع ومراحله ──────────────────────────────────────────
const submission = (id: string, by: UserLite, version: number) => ({
  id,
  fileName: `الفصل-${version}.pdf`,
  fileUrl: `/uploads/submissions/${id}.pdf`,
  fileSize: 245_760,
  mimeType: "application/pdf",
  version,
  createdAt: days(-25 + version),
  uploadedBy: { id: by.id, firstName: by.firstName, lastName: by.lastName, avatarUrl: null, gender: by.gender },
});

export const milestones: AdminMilestone[] = [
  {
    id: "ms1",
    title: "الفصل النظري",
    description: "الإطار المفاهيمي والدراسات السابقة",
    deadline: days(-30),
    status: "completed",
    order: 1,
    _count: { submissions: 2 },
    submissions: [submission("sub1", studentUsers[0]!, 1), submission("sub2", studentUsers[0]!, 2)],
  },
  {
    id: "ms2",
    title: "الاستمارة",
    description: null,
    deadline: days(5),
    status: "in_progress",
    order: 2,
    _count: { submissions: 1 },
    submissions: [submission("sub3", studentUsers[3]!, 1)],
  },
  { id: "ms3", title: "الدراسة الميدانية", deadline: days(-2), status: "overdue", order: 3, _count: { submissions: 0 }, submissions: [] },
  { id: "ms4", title: "المذكرة النهائية", deadline: days(40), status: "pending", order: 4, _count: { submissions: 0 }, submissions: [] },
];

const committee = [
  { id: "c1", role: "president" as const, professorId: prof2.id, professor: prof2 },
  { id: "c2", role: "supervisor" as const, professorId: prof1.id, professor: prof1 },
  { id: "c3", role: "examiner" as const, professorId: prof3.id, professor: prof3 },
];

export const defense = {
  id: "df1",
  groupId: ID.g1,
  date: days(10),
  durationMinutes: 60,
  endsAt: new Date(Date.now() + 10 * DAY + 3_600_000).toISOString(),
  room: "قاعة 12",
  grade: null,
  status: "scheduled",
  notes: "إحضار ثلاث نسخ ورقية",
  committee,
  clashes: { room: [], professors: [] },
} satisfies AdminDefense;

export const project = {
  id: ID.g1,
  topic: topicFull,
  members: [
    { id: "pm1", isLeader: true, createdAt: days(-60), student: student1 },
    { id: "pm2", isLeader: false, createdAt: days(-60), student: student4 },
  ],
  milestones,
  defense: { ...defense, _count: { committee: 3 } },
  _count: { milestones: 4 },
  progress: {
    total: 4,
    completed: 1,
    inProgress: 1,
    overdue: 1,
    submissions: 3,
    nextDeadline: { title: "الاستمارة", deadline: days(5) },
    lastActivityAt: days(-1),
  },
  insights: { submissions: 3, lastSubmissionAt: days(-1), origin: { kind: "request", requestId: "gr2", since: days(-60) } },
  actions: { canDissolve: false, dissolveBlockers: { submissions: 3, defense: true } },
  createdAt: days(-60),
  updatedAt: days(-1),
} satisfies AdminProject;

/** مشروعٌ ثانٍ بلا مناقشةٍ بعد — ما تقترحه شاشة البرمجة. */
export const project2 = {
  id: ID.g2,
  topic: { ...topicFull, id: "t-g2", title: "التنمّر الإلكتروني بين المراهقين", professorId: prof2.id, professor: prof2 },
  members: [{ id: "pm3", isLeader: true, createdAt: days(-30), student: student3 }],
  milestones: [],
  defense: null,
  _count: { milestones: 0 },
  progress: { total: 0, completed: 0, inProgress: 0, overdue: 0, submissions: 0, nextDeadline: null, lastActivityAt: null },
  actions: { canDissolve: true, dissolveBlockers: { submissions: 0, defense: false } },
  createdAt: days(-30),
} satisfies AdminProject;

export const defenseDetail = {
  ...defense,
  createdAt: days(-15),
  updatedAt: days(-2),
  group: { ...project, milestones: undefined },
  progress: { total: 4, completed: 1, late: 1, submissions: 3 },
  roomDay: [
    { id: "df0", date: days(10), endsAt: days(10), status: "scheduled", title: "موضوعٌ قبله", current: false },
    { id: defense.id, date: defense.date, endsAt: defense.endsAt, status: "scheduled", title: topicFull.title, current: true },
  ],
};

export const defenseStats = {
  total: 1,
  upcoming: 1,
  today: 0,
  week: 0,
  completed: 0,
  cancelled: 0,
  stale: 0,
  noCommittee: 0,
  averageGrade: null,
  rooms: 1,
  readyToSchedule: 0,
} satisfies DefenseStats;

// ── لوحة الإدارة ─────────────────────────────────────────────
const name = (u: UserLite) => ({ firstName: u.firstName, lastName: u.lastName });

export const adminDashboard = {
  stats: {
    students: 4,
    professors: 3,
    openTopics: 1,
    fullTopics: 1,
    pendingTopics: 1,
    pendingGroupRequests: 1,
    pendingRequests: 1,
    upcomingDefenses: 1,
  },
  trends: {
    students: { current: 4, previous: 2, delta: 2 },
    topics: { current: 6, previous: 6, delta: 0 },
    requests: { current: 1, previous: 3, delta: -2 },
  },
  academicYear: { id: year.id, title: year.title, isActive: true },
  pendingProposals: [
    {
      id: topicPending.id,
      title: topicPending.title,
      maxStudents: 3,
      createdAt: days(-4),
      professor: { user: name(profUsers[0]!) },
      specialization: { id: specialization.id, name: specialization.name },
    },
  ],
  recentRequests: [
    {
      id: "gr1",
      status: "pending",
      priority: 1,
      createdAt: days(-3),
      topic: { id: topicOpen.id, title: topicOpen.title },
      leader: { registrationNumber: student2.registrationNumber, user: name(studentUsers[1]!) },
      members: [{ student: { registrationNumber: student3.registrationNumber, user: name(studentUsers[2]!) } }],
    },
  ],
  upcomingDefenses: [{ id: defense.id, date: defense.date, room: defense.room, group: { topic: { id: topicFull.id, title: topicFull.title } } }],
  attention: {
    staleProposals: [{ id: topicPending.id, title: topicPending.title, createdAt: days(-20), professor: { user: name(profUsers[0]!) } }],
    openWithoutRequests: [
      { id: topicApproved.id, title: topicApproved.title, updatedAt: days(-9), specialization: { id: specialization.id, name: specialization.name } },
    ],
  },
  topicBreakdown: [
    { status: "open", count: 1 },
    { status: "pending", count: 1 },
    { status: "approved", count: 1 },
    { status: "full", count: 1 },
    { status: "rejected", count: 1 },
    { status: "archived", count: 1 },
  ],
  studentsPerSpecialization: [
    { id: specialization.id, name: specialization.name, count: 3 },
    { id: specialization2.id, name: specialization2.name, count: 1 },
  ],
  monthlyGrowth: [
    { month: "2026-08", students: 1, topics: 2, projects: 0 },
    { month: "2026-09", students: 2, topics: 3, projects: 1 },
    { month: "2026-10", students: 1, topics: 1, projects: 0 },
  ],
  systemHealth: { totalAccounts: 8, activeUsers: 7, suspendedUsers: 1 },
} satisfies AdminDashboard;

// ── تفاصيل المستخدم ─────────────────────────────────────────
export const userDetail = (u: UserLite): UserDetail => {
  const st = students.find((s) => s.userId === u.id);
  const pr = professors.find((p) => p.userId === u.id);
  return {
    ...u,
    student: st
      ? {
          id: st.id,
          registrationNumber: st.registrationNumber,
          academicYear: { id: year.id, title: year.title },
          specialization: {
            id: specialization.id,
            name: specialization.name,
            filiere: { id: filiere.id, name: filiere.name, department: { id: department.id, name: department.name, faculty } },
          },
        }
      : null,
    professor: pr
      ? {
          id: pr.id,
          employeeNumber: pr.employeeNumber,
          universityEmail: pr.universityEmail,
          department: { id: department.id, name: department.name, faculty },
        }
      : null,
  };
};
export const allUsers = [adminUser, ...profUsers, ...studentUsers];

// ── الأرشيف ─────────────────────────────────────────────────
export const archiveYears: ArchiveYear[] = [
  {
    id: year.id,
    title: year.title,
    isActive: true,
    archivedAt: null,
    archivedByName: null,
    counts: { students: 4, topics: 6, projects: 1, defended: 0, averageGrade: null },
  },
  {
    id: pastYear.id,
    title: pastYear.title,
    isActive: false,
    archivedAt: pastYear.archivedAt,
    archivedByName: "سمير بن علي",
    counts: { students: 30, topics: 25, projects: 12, defended: 12, averageGrade: 14.5 },
  },
];

const spec = { id: specialization.id, name: specialization.name, level: "master" };
export const yearRecord = (id: string): YearRecordResponse => ({
  source: id === pastYear.id ? "archive" : "live",
  archivedAt: id === pastYear.id ? pastYear.archivedAt : null,
  archivedByName: id === pastYear.id ? "سمير بن علي" : null,
  note: id === pastYear.id ? "أُغلقت بعد آخر مناقشة" : null,
  isActive: id !== pastYear.id,
  record: {
    year: { id, title: id === pastYear.id ? pastYear.title : year.title },
    generatedAt: days(0),
    summary: {
      students: 4,
      studentsWithProject: 2,
      topics: 6,
      topicsByStatus: { open: 1, pending: 1, approved: 1, full: 1, rejected: 1, archived: 1 },
      projects: 1,
      defenses: { total: 1, completed: 1, scheduled: 0, cancelled: 0 },
      graded: 1,
      averageGrade: 15.5,
      bestGrade: 15.5,
      passRate: 100,
      mentions: { excellent: 0, veryGood: 1, good: 0, fair: 0, fail: 0 },
      requests: { pending: 1, accepted: 1, rejected: 1 },
      supervisors: 1,
    },
    bySpecialization: [{ ...spec, students: 3, topics: 5, projects: 1, defended: 1, averageGrade: 15.5 }],
    supervisors: [{ id: prof1.id, name: "كريم منصوري", latinName: "Karim Mansouri", topics: 5, projects: 1, defended: 1, averageGrade: 15.5 }],
    students: students.map((s, i) => ({
      id: s.id,
      registrationNumber: s.registrationNumber,
      name: `${s.user!.firstName} ${s.user!.lastName}`,
      latinName: null,
      gender: s.user!.gender ?? null,
      avatarUrl: null,
      accountStatus: s.user!.status,
      specialization: spec,
      project: i === 0 || i === 3 ? { id: ID.g1, title: topicFull.title, leader: i === 0 } : null,
      defense: i === 0 || i === 3 ? { status: "completed", grade: 15.5, mention: "veryGood" } : null,
    })),
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      maxStudents: t.maxStudents,
      createdAt: t.createdAt,
      specialization: spec,
      supervisor: { id: prof1.id, name: "كريم منصوري" },
      department: department.name,
      requests: t._count?.groupRequests ?? 0,
      projectId: t.id === topicFull.id ? ID.g1 : null,
      members: t.id === topicFull.id ? 2 : 0,
    })),
    projects: [
      {
        id: ID.g1,
        topicId: topicFull.id,
        title: topicFull.title,
        createdAt: days(-60),
        specialization: spec,
        supervisor: { id: prof1.id, name: "كريم منصوري", gender: "male", avatarUrl: null },
        members: [student1, student4].map((s, i) => ({
          id: s.id,
          name: `${s.user!.firstName} ${s.user!.lastName}`,
          registrationNumber: s.registrationNumber,
          leader: i === 0,
          gender: s.user!.gender ?? null,
          avatarUrl: null,
        })),
        milestones: { total: 4, completed: 4, late: 0, submissions: 6 },
        defense: {
          id: defense.id,
          date: days(-10),
          durationMinutes: 60,
          room: defense.room,
          status: "completed",
          grade: 15.5,
          mention: "veryGood",
          notes: null,
          committee: committee.map((c) => ({ role: c.role, id: c.professorId, name: `${c.professor.user!.firstName} ${c.professor.user!.lastName}` })),
        },
      },
    ],
    defenses: [
      {
        id: defense.id,
        date: days(-10),
        durationMinutes: 60,
        room: defense.room,
        status: "completed",
        grade: 15.5,
        mention: "veryGood",
        notes: null,
        committee: committee.map((c) => ({ role: c.role, id: c.professorId, name: `${c.professor.user!.firstName} ${c.professor.user!.lastName}` })),
        projectId: ID.g1,
        title: topicFull.title,
        students: ["أمين حداد", "ليلى قاسمي"],
        supervisor: "كريم منصوري",
      },
    ],
  },
});

export const readiness = (id: string): YearReadiness => ({
  year: { id, title: year.title, archivedAt: null },
  ready: false,
  items: [
    { key: "pendingTopics", count: 1, level: "warn" },
    { key: "pendingRequests", count: 1, level: "warn" },
    { key: "scheduledDefenses", count: 1, level: "info", extra: { upcoming: 1 } },
    { key: "projects", count: 1, level: "ok" },
  ],
});

export const auditLogs: AuditLogEntry[] = [
  {
    id: "al1",
    actorId: adminUser.id,
    actorRole: "admin",
    actorLabel: "سمير بن علي",
    action: "auth.login",
    targetType: null,
    targetId: null,
    targetLabel: null,
    details: { secondFactor: "totp", session: "s-123" },
    success: true,
    ip: "10.0.0.5",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130",
    createdAt: days(0),
  },
  {
    id: "al2",
    actorId: adminUser.id,
    actorRole: "admin",
    actorLabel: "سمير بن علي",
    action: "PATCH /students/:id",
    targetType: "students",
    targetId: student1.id,
    targetLabel: "أسامة بلقاسم · 202039012345",
    details: {
      body: { phone: "0550112233", status: "suspended" },
      changes: [
        { field: "phone", from: null, to: "0550112233" },
        { field: "status", from: "active", to: "suspended" },
        { field: "specialization", from: "علم الاجتماع", to: "علم النفس" },
        { field: "isVerified", from: false, to: true },
        { field: "avatarUrl", from: null, to: "/uploads/cards/a.jpg" },
      ],
    },
    success: true,
    ip: "10.0.0.5",
    userAgent: null,
    createdAt: days(-1),
  },
  {
    id: "al3",
    actorId: null,
    actorRole: null,
    actorLabel: "202039012349",
    action: "auth.loginFailed",
    targetType: null,
    targetId: null,
    targetLabel: null,
    details: { as: "student", reason: "unknownAccount" },
    success: false,
    ip: "41.100.1.1",
    country: "DZ",
    region: "Tlemcen",
    city: "Remchi",
    isp: "Telecom Algeria",
    userAgent: null,
    createdAt: days(-2),
  },
  {
    id: "al4",
    actorId: profUsers[0]!.id,
    actorRole: "professor",
    actorLabel: "يوسف حمادي",
    action: "DELETE /professor/topics/:id",
    targetType: "topics",
    targetId: "t-gone",
    targetLabel: "التنشئة الاجتماعية في الأسرة الجزائرية",
    details: { deleted: { title: "التنشئة الاجتماعية في الأسرة الجزائرية", status: "pending", maxStudents: 2 } },
    success: true,
    ip: "10.0.0.9",
    userAgent: null,
    createdAt: days(-2.1),
  },
  {
    id: "al5",
    actorId: adminUser.id,
    actorRole: "admin",
    actorLabel: "سمير بن علي",
    action: "POST /students/import",
    targetType: "students",
    targetId: null,
    targetLabel: null,
    details: { file: { name: "students.xlsx", size: 20480 }, result: { ok: true, created: 42 } },
    success: true,
    ip: "10.0.0.5",
    userAgent: null,
    createdAt: days(-3),
  },
  {
    id: "al6",
    actorId: adminUser.id,
    actorRole: "admin",
    actorLabel: "سمير بن علي",
    action: "PATCH /group-requests/:id/leader/:studentId",
    targetType: "group-requests",
    targetId: "gr-1",
    targetLabel: "موضوع · أسامة بلقاسم",
    details: { refs: { student: "مريم سعدي · 202039012346" }, changes: [] },
    success: true,
    ip: "10.0.0.5",
    userAgent: null,
    createdAt: days(-3.1),
  },
  {
    id: "al7",
    actorId: adminUser.id,
    actorRole: "admin",
    actorLabel: "سمير بن علي",
    action: "PATCH /something-new/:id",
    targetType: "something-new",
    targetId: "x1",
    targetLabel: null,
    details: null,
    success: true,
    ip: null,
    userAgent: null,
    createdAt: days(-4),
  },
  {
    id: "al8",
    actorId: studentUsers[0]!.id,
    actorRole: "student",
    actorLabel: "أمين حداد · 202039012345",
    action: "auth.logout",
    targetType: null,
    targetId: null,
    targetLabel: null,
    details: { session: "s-9", startedAt: new Date(Date.parse(days(-5)) - (2 * 60 + 15) * 60_000).toISOString() },
    success: true,
    ip: "::1",
    userAgent: null,
    createdAt: days(-5),
  },
];

export const auditActors: AuditActor[] = [
  { id: adminUser.id, label: "سمير بن علي · admin@univ.dz", role: "admin", count: 40, lastAt: days(-0.01) },
  { id: profUsers[0]!.id, label: "يوسف حمادي · y.hamadi@univ.dz", role: "professor", count: 7, lastAt: days(-2.1) },
];

export const auditCountries: AuditCountry[] = [
  { country: "DZ", count: 120 },
  { country: "FR", count: 3 },
];

export const auditSummary: AuditSummary = { total: 128, changes: 17, failed: 3, people: 9 };

export const universityDomains: UniversityDomain[] = [
  { id: "ud1", domain: "univ-msila.dz", isDefault: true, createdAt: created, updatedAt: created },
  { id: "ud2", domain: "univ-alger.dz", isDefault: false, createdAt: created, updatedAt: created },
];

// ── واجهة الموقع ────────────────────────────────────────────
export const slides: HomeSlide[] = [
  { id: "sl1", imageUrl: "/uploads/cards/a.jpg", caption: "حفل التخرّج", isActive: true, sortOrder: 0, createdAt: created, updatedAt: created },
  { id: "sl2", imageUrl: "/uploads/cards/b.jpg", caption: null, isActive: false, sortOrder: 1, createdAt: created, updatedAt: created },
];

export const news: NewsItem[] = [
  {
    id: "n1",
    text: "فتح باب اقتراح المواضيع",
    textFr: "Ouverture des propositions",
    textEn: null,
    date: days(-2),
    linkUrl: "/topics",
    isActive: true,
    createdAt: created,
    updatedAt: created,
  },
  { id: "n2", text: "رزنامة المناقشات", textFr: null, textEn: null, date: days(-9), linkUrl: null, isActive: false, createdAt: created, updatedAt: created },
];

const directorBlock = (lang: string) => ({
  sectionTitle: `كلمة رئيس القسم ${lang}`,
  title: "مرحباً بكم",
  paragraphs: ["فقرة أولى.", "فقرة ثانية."],
  quote: "العلم نور",
  fullName: "د. عبد القادر",
  role: "رئيس القسم",
  initials: "ع ق",
});
export const director: DirectorMessage = { isVisible: true, photoUrl: null, ar: directorBlock("ar"), fr: directorBlock("fr"), en: directorBlock("en") };

const aboutBlock = {
  title: "عن المنصة",
  subtitle: "مذكّرتي",
  introTitle: "من نحن",
  intro: ["منصة لتسيير مذكرات التخرّج."],
  galleryTitle: "صور",
  featuresTitle: "المزايا",
  features: [{ title: "متابعة", desc: "متابعة المراحل" }],
  stats: [{ value: "+2000", label: "طالب" }],
};
export const about: AboutPage = { ar: aboutBlock, fr: aboutBlock, en: aboutBlock };

const loginBlock = { university: "جامعة المسيلة", platform: "مذكّرتي", welcome: "مرحباً", highlight: "رحلة التخرّج", body: "ادخل بحسابك.", note: "" };
export const loginContent: LoginContent = { ar: loginBlock, fr: loginBlock, en: loginBlock };

// ── الأستاذ ─────────────────────────────────────────────────
const asProfTopic = (t: AdminTopic): Topic => ({
  id: t.id,
  title: t.title,
  description: t.description,
  requirements: t.requirements ?? [],
  objectives: t.objectives ?? [],
  references: t.references.map((r) => ({ title: r.title, url: r.url })),
  status: t.status as Topic["status"],
  rejectionReason: t.rejectionReason,
  maxStudents: t.maxStudents,
  professorId: prof1.id,
  specializationId: specialization.id,
  academicYearId: year.id,
  specialization: { id: specialization.id, name: specialization.name, level: "master", filiereId: filiere.id, filiere: { id: filiere.id, name: filiere.name } },
  academicYear: { id: year.id, title: year.title, isActive: true },
  _count: t._count,
  createdAt: t.createdAt,
  updatedAt: days(-1),
});

export const profTopics: Topic[] = topics.filter((t) => t.id !== topicApproved.id).map(asProfTopic);

export const profTopicDetail = (id: string): Topic => {
  const base = profTopics.find((t) => t.id === id) ?? profTopics[0]!;
  return {
    ...base,
    groupRequests:
      id === topicOpen.id
        ? [
            {
              id: "gr1",
              status: "pending",
              priority: 1,
              leader: ref(student2),
              members: [
                { id: "grm1", student: ref(student2) },
                { id: "grm2", student: ref(student3) },
              ],
              createdAt: days(-3),
            },
            { id: "gr3", status: "rejected", priority: 2, rejectionReason: "الفريق تجاوز العدد", leader: ref(student3), members: [], createdAt: days(-20) },
          ]
        : [],
    projectGroup:
      id === topicFull.id
        ? {
            id: ID.g1,
            members: [
              { id: "pm1", isLeader: true, student: ref(student1) },
              { id: "pm2", isLeader: false, student: ref(student4) },
            ],
            _count: { milestones: 4 },
            createdAt: days(-60),
          }
        : null,
  };
};

const profMilestones = milestones.map((m) => ({
  id: m.id,
  title: m.title,
  description: m.description,
  deadline: m.deadline,
  status: m.status as "pending",
  order: m.order,
  groupId: ID.g1,
  submissions: m.submissions?.map((s) => ({ ...s, uploadedBy: { id: s.uploadedBy!.id, firstName: s.uploadedBy!.firstName, lastName: s.uploadedBy!.lastName } })),
  createdAt: days(-60),
}));

export const profGroup: ProjectGroup = {
  id: ID.g1,
  topicId: topicFull.id,
  topic: { id: topicFull.id, title: topicFull.title, status: "full", maxStudents: 3 },
  members: [
    { id: "pm1", isLeader: true, student: ref(student1) },
    { id: "pm2", isLeader: false, student: ref(student4) },
  ],
  milestones: profMilestones,
  defense: { id: defense.id, date: defense.date, room: defense.room, grade: null, status: "scheduled" },
  _count: { milestones: 4 },
  createdAt: days(-60),
};

export const profGroups: ProjectGroupListItem[] = [
  {
    id: ID.g1,
    topicId: topicFull.id,
    topic: {
      id: topicFull.id,
      title: topicFull.title,
      status: "full",
      maxStudents: 3,
      specialization: { id: specialization.id, name: specialization.name },
      academicYear: { id: year.id, title: year.title },
    },
    members: profGroup.members,
    milestones: milestones.map((m) => ({ id: m.id, title: m.title, deadline: m.deadline, status: m.status, order: m.order, _count: m._count })),
    defense: { id: defense.id, date: defense.date, room: defense.room, status: "scheduled", grade: null },
    _count: { milestones: 4 },
    createdAt: days(-60),
  },
];

const dashTopic = (t: AdminTopic) => ({
  id: t.id,
  title: t.title,
  status: t.status,
  rejectionReason: t.rejectionReason,
  maxStudents: t.maxStudents,
  createdAt: t.createdAt,
  updatedAt: days(-1),
  specialization: { id: specialization.id, name: specialization.name, level: "master" as const },
  _count: { groupRequests: t._count?.groupRequests ?? 0 },
});
const dashMilestone = (m: AdminMilestone) => ({
  id: m.id,
  title: m.title,
  deadline: m.deadline,
  status: m.status,
  order: m.order,
  groupId: ID.g1,
  group: { topic: { id: topicFull.id, title: topicFull.title } },
});
const dashSubmission = {
  id: "sub3",
  fileName: "الاستمارة.docx",
  createdAt: days(-1),
  version: 1,
  milestone: { id: "ms2", title: "الاستمارة", status: "in_progress", groupId: ID.g1, group: { topic: { id: topicFull.id, title: topicFull.title } } },
  uploadedBy: { id: studentUsers[3]!.id, firstName: "ليلى", lastName: "قاسمي", avatarUrl: null, gender: "female" },
};

export const professorDashboard: ProfessorDashboard = {
  profile: {
    employeeNumber: prof1.employeeNumber,
    universityEmail: prof1.universityEmail,
    grade: ["أستاذ محاضر أ"],
    tags: ["رئيس فرقة بحث"],
    department: { id: department.id, name: department.name, faculty: { id: faculty.id, name: faculty.name } },
  },
  committee: [
    {
      role: "supervisor",
      id: defense.id,
      date: defense.date,
      room: defense.room,
      status: "scheduled",
      grade: null,
      groupId: ID.g1,
      topic: { id: topicFull.id, title: topicFull.title },
      supervisor: { firstName: "كريم", lastName: "منصوري", avatarUrl: null, gender: "male" },
      ownProject: true,
      membersCount: 2,
    },
    {
      role: "examiner",
      id: "df9",
      date: days(12),
      room: "قاعة 3",
      status: "scheduled",
      grade: null,
      groupId: "g9",
      topic: { id: "t9", title: "موضوع زميل" },
      supervisor: { firstName: "نادية", lastName: "بوزيد", avatarUrl: null, gender: "female" },
      ownProject: false,
      membersCount: 3,
    },
  ],
  recentSubmissions: [dashSubmission],
  topics: topics.map(dashTopic),
  stats: { myTopics: 6, supervisedProjects: 1, supervisedStudents: 2, overdueMilestones: 1, upcomingDefenses: 1 },
  topicBreakdown: { open: 1, pending: 1, approved: 1, full: 1, rejected: 1, archived: 1 },
  attention: {
    rejectedTopics: [dashTopic(topicRejected)],
    pendingTopics: [dashTopic(topicPending)],
    approvedNotPublished: [dashTopic(topicApproved)],
    openWithoutRequests: [dashTopic(topicOpen)],
    overdueMilestones: [dashMilestone(milestones[2]!)],
    dueThisWeek: [dashMilestone(milestones[1]!)],
    awaitingReview: [dashSubmission],
  },
  agenda: [
    { kind: "milestone", id: "ms2", title: "الاستمارة", date: days(5), groupId: ID.g1, topicTitle: topicFull.title, room: null },
    { kind: "defense", id: defense.id, title: topicFull.title, date: defense.date, groupId: ID.g1, topicTitle: topicFull.title, room: defense.room },
  ],
  projects: [
    {
      id: ID.g1,
      topic: { id: topicFull.id, title: topicFull.title, status: "full", maxStudents: 3 },
      members: profGroup.members!,
      defense: { id: defense.id, date: defense.date, room: defense.room, status: "scheduled" },
      milestones: { total: 4, completed: 1, overdue: 1 },
      nextDeadline: { id: "ms2", title: "الاستمارة", deadline: days(5) },
    },
  ],
};

// ── الطالب ──────────────────────────────────────────────────
const dashPerson = (u: UserLite) => ({ firstName: u.firstName, lastName: u.lastName, avatarUrl: null, gender: u.gender });
const profRef = { id: prof1.id, user: { id: profUsers[0]!.id, firstName: "كريم", lastName: "منصوري", email: profUsers[0]!.email } };

export const studentRequests: GroupRequest[] = [
  {
    id: "gr2",
    topicId: topicFull.id,
    leaderStudentId: student1.id,
    priority: 1,
    status: "accepted",
    topic: {
      id: topicFull.id,
      title: topicFull.title,
      status: "full",
      maxStudents: 3,
      professor: { id: prof1.id, user: dashPerson(profUsers[0]!) },
      academicYear: { id: year.id, title: year.title },
      specialization: { id: specialization.id, name: specialization.name },
    },
    members: [
      { id: "grm3", student: ref(student1) },
      { id: "grm4", student: ref(student4) },
    ],
    isLeader: true,
    createdAt: days(-60),
    updatedAt: days(-55),
  },
  {
    id: "gr4",
    topicId: topicOpen.id,
    leaderStudentId: student1.id,
    priority: 2,
    status: "rejected",
    rejectionReason: "اختير فريقٌ آخر",
    topic: {
      id: topicOpen.id,
      title: topicOpen.title,
      status: "open",
      maxStudents: 3,
      professor: { id: prof1.id, user: dashPerson(profUsers[0]!) },
      academicYear: { id: year.id, title: year.title },
      specialization: { id: specialization.id, name: specialization.name },
    },
    members: [{ id: "grm6", student: ref(student1) }],
    isLeader: true,
    createdAt: days(-70),
  },
  {
    id: "gr5",
    topicId: topicApproved.id,
    leaderStudentId: student2.id,
    priority: 3,
    status: "pending",
    topic: { id: topicApproved.id, title: topicApproved.title, status: "open", maxStudents: 2 },
    members: [
      { id: "grm7", student: ref(student2) },
      { id: "grm8", student: ref(student1) },
    ],
    isLeader: false,
    createdAt: days(-4),
  },
];

export const myProject: MyProject = {
  id: ID.g1,
  topic: {
    id: topicFull.id,
    title: topicFull.title,
    description: topicFull.description,
    professor: profRef,
    academicYear: { id: year.id, title: year.title },
    specialization: { id: specialization.id, name: specialization.name },
  },
  members: [
    { id: "pm1", isLeader: true, student: ref(student1) },
    { id: "pm2", isLeader: false, student: ref(student4) },
  ],
  milestones: milestones.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    deadline: m.deadline,
    status: m.status as "pending",
    order: m.order,
    submissions: m.submissions?.map((s) => ({ id: s.id, fileName: s.fileName, fileUrl: s.fileUrl, createdAt: s.createdAt })),
  })),
  defense: {
    id: defense.id,
    date: defense.date,
    room: defense.room,
    status: "scheduled",
    grade: null,
    committee: committee.map((c) => ({ role: c.role, professor: { id: c.professorId, user: dashPerson(c.professor.user!) } })),
  },
};

const dashMs = milestones.map((m) => ({
  id: m.id,
  title: m.title,
  deadline: m.deadline,
  status: m.status as "pending",
  order: m.order,
  submissions: m._count?.submissions ?? 0,
}));

export const studentDashboard: StudentDashboard = {
  student: {
    registrationNumber: student1.registrationNumber,
    specialization: { id: specialization.id, name: specialization.name, level: "master" },
    academicYear: { id: year.id, title: year.title },
  },
  stage: "defense_scheduled",
  availableTopics: 1,
  requests: studentRequests.map((r) => ({
    id: r.id,
    priority: r.priority,
    status: r.status,
    rejectionReason: r.rejectionReason ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt ?? r.createdAt,
    isLeader: r.isLeader ?? true,
    membersCount: r.members?.length ?? 1,
    leader: { user: dashPerson(studentUsers[0]!) },
    topic: { id: r.topic!.id, title: r.topic!.title, professor: { user: dashPerson(profUsers[0]!) } },
  })),
  project: {
    id: ID.g1,
    topic: { id: topicFull.id, title: topicFull.title, professor: { user: dashPerson(profUsers[0]!) } },
    members: [student1, student4].map((s, i) => ({
      id: `pm${i + 1}`,
      isLeader: i === 0,
      student: { id: s.id, registrationNumber: s.registrationNumber, user: dashPerson(s.user!) },
    })),
    milestones: dashMs,
    progress: { total: 4, completed: 1, overdue: 1, percent: 25 },
    nextMilestone: dashMs[1]!,
    defense: {
      id: defense.id,
      date: defense.date,
      room: defense.room,
      status: "scheduled",
      grade: null,
      committee: committee.map((c) => ({ role: c.role, professor: { user: dashPerson(c.professor.user!) } })),
    },
    supervisionDocument: { id: "doc1", documentNumber: "SUP-2026-0001", createdAt: days(-50) },
  },
  attention: {
    overdueMilestones: [{ id: "ms3", title: "الدراسة الميدانية", deadline: days(-2) }],
    dueThisWeek: [{ id: "ms2", title: "الاستمارة", deadline: days(5) }],
    rejectedRequests: [],
  },
};

// ── العامّ ──────────────────────────────────────────────────
const publicProf = { id: prof1.id, grade: ["أستاذ محاضر أ"], user: { firstName: "كريم", lastName: "منصوري", avatarUrl: null, gender: "male" }, department: { name: department.name, faculty: { name: faculty.name } } };
export const publicTopics: PublicTopic[] = [
  {
    id: topicOpen.id,
    title: topicOpen.title,
    description: topicOpen.description,
    status: "open",
    maxStudents: 3,
    createdAt: created,
    isAvailable: true,
    isReserved: false,
    isMine: false,
    myRequestPending: true,
    requests: { pending: 1, max: 3 },
    specialization: { id: specialization.id, name: specialization.name, level: "master" },
    academicYear: { id: year.id, title: year.title },
    professor: publicProf,
    publishedAt: days(-30),
  },
  {
    id: topicFull.id,
    title: topicFull.title,
    description: topicFull.description,
    status: "full",
    maxStudents: 3,
    createdAt: created,
    isAvailable: false,
    isReserved: true,
    isMine: true,
    requests: { pending: 0, max: null },
    specialization: { id: specialization.id, name: specialization.name, level: "master" },
    academicYear: { id: year.id, title: year.title },
    professor: publicProf,
    publishedAt: days(-90),
  },
];
export const publicTopicDetail = (id: string): PublicTopicDetail => ({
  ...(publicTopics.find((t) => t.id === id) ?? publicTopics[0]!),
  requirements: ["إتقان SPSS"],
  objectives: ["تشخيص الظاهرة"],
});
export const publicFilters: PublicTopicFilters = {
  professors: [{ id: prof1.id, user: publicProf.user, count: 2 }],
  academicYears: [{ id: year.id, title: year.title, isActive: true, count: 2 }],
  sizes: [{ value: 3, count: 2 }],
  mine: null,
};

// ── الرسائل ─────────────────────────────────────────────────
export const messageUser = (u: UserLite): MessageUserLite => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
  firstNameLatin: u.firstNameLatin,
  lastNameLatin: u.lastNameLatin,
  avatarUrl: null,
  gender: u.gender,
  role: u.role,
  email: u.email,
});

export const inbox = (me: UserLite): InboxItem[] => [
  {
    id: "rc1",
    userId: me.id,
    readAt: null,
    message: {
      id: "m1",
      senderId: profUsers[0]!.id,
      subject: "موعد الإشراف",
      body: "نلتقي يوم الأحد في المكتب.",
      broadcast: null,
      threadId: null,
      replyToId: null,
      createdAt: days(-0.2),
      sender: messageUser(profUsers[0]!),
    },
  },
  {
    id: "rc2",
    userId: me.id,
    readAt: days(-3),
    message: {
      id: "m2",
      senderId: adminUser.id,
      subject: "إعلان",
      body: "فُتح باب اقتراح المواضيع.",
      broadcast: "all",
      threadId: null,
      replyToId: null,
      createdAt: days(-4),
      sender: messageUser(adminUser),
    },
  },
];

export const sent = (me: UserLite): SentItem[] => [
  {
    id: "m3",
    senderId: me.id,
    subject: "استفسار",
    body: "هل يمكن تأجيل التسليم؟",
    broadcast: null,
    threadId: null,
    replyToId: null,
    createdAt: days(-1),
    recipients: [{ id: "rc3", userId: profUsers[0]!.id, readAt: days(-0.5), user: messageUser(profUsers[0]!) }],
    _count: { recipients: 1 },
    readCount: 1,
  },
  {
    id: "m4",
    senderId: me.id,
    subject: "رزنامة المناقشات",
    body: "تبدأ المناقشات الأسبوع القادم.",
    broadcast: "students",
    threadId: null,
    replyToId: null,
    createdAt: days(-2),
    recipients: studentUsers.map((u, i) => ({ id: `rc-b${i}`, userId: u.id, readAt: i < 2 ? days(-1) : null, user: messageUser(u) })),
    _count: { recipients: 4 },
    readCount: 2,
  },
];

export const thread = (me: UserLite, id: string): { message: ThreadMessage; thread: ThreadMessage[]; rootId: string; subject: string } => {
  const root: ThreadMessage = {
    id,
    senderId: profUsers[0]!.id,
    subject: "موعد الإشراف",
    body: "نلتقي يوم الأحد في المكتب.",
    broadcast: null,
    threadId: null,
    replyToId: null,
    createdAt: days(-0.2),
    sender: messageUser(profUsers[0]!),
    mine: false,
    // «m1» لم يُقرأ بعد في صندوق الوارد: فتحُه يقرؤه.
    readAt: id === "m1" ? null : days(-0.1),
    recipientsCount: 1,
    recipients: [],
  };
  const reply: ThreadMessage = {
    ...root,
    id: `${id}-r`,
    senderId: me.id,
    body: "حاضر، شكراً.",
    threadId: id,
    replyToId: id,
    createdAt: days(-0.1),
    sender: messageUser(me),
    mine: true,
    readCount: 0,
    recipients: [{ readAt: null, user: messageUser(profUsers[0]!) }],
  };
  return { message: root, thread: [root, reply], rootId: id, subject: "موعد الإشراف" };
};

export const contacts = (me: UserLite): Contact[] =>
  allUsers
    .filter((u) => u.id !== me.id)
    .map((u, i) => ({
      ...messageUser(u),
      relation: u.role === "admin" ? "admin" : u.role === "professor" ? (i === 1 ? "supervisor" : "professor") : i === 4 ? "teammate" : "student",
      detail: u.role === "student" ? specialization.name : department.name,
      handle: null,
      recent: i < 3,
    }));

const chatUser = (u: UserLite) => ({ ...messageUser(u), detail: department.name, handle: null, active: true, online: u.id === profUsers[0]!.id, lastLoginAt: days(-0.5) });

export const conversations = (me: UserLite): Conversation[] =>
  [profUsers[0]!, adminUser, studentUsers[1]!]
    .filter((u) => u.id !== me.id)
    .map((u, i) => ({
      user: chatUser(u),
      unread: i === 0 ? 2 : 0,
      last: { id: `cm${i}`, subject: null, preview: i === 0 ? "نلتقي يوم الأحد" : "شكراً", broadcast: null, createdAt: days(-i - 0.1), mine: i === 1, read: i !== 0 },
    }));

export const chat = (me: UserLite, userId: string): ChatPage => {
  const other = allUsers.find((u) => u.id === userId) ?? profUsers[0]!;
  return {
    user: chatUser(other),
    canWrite: true,
    hasMore: false,
    items: [
      { id: "cm1", senderId: other.id, subject: null, body: "السلام عليكم", broadcast: null, threadId: null, replyToId: null, createdAt: days(-1), mine: false, readAt: null, recipientsCount: 1 },
      { id: "cm2", senderId: me.id, subject: null, body: "وعليكم السلام", broadcast: null, threadId: null, replyToId: null, createdAt: days(-0.5), mine: true, readAt: null, recipientsCount: 1 },
    ],
  };
};

// ── وثيقة الإشراف ───────────────────────────────────────────
export const supervisionSnapshot = {
  topicTitle: topicFull.title,
  supervisorName: "كريم منصوري",
  level: "ماستر",
  academicYear: year.title,
  specialization: specialization.name,
  students: [
    { fullName: "أمين حداد", registrationNumber: student1.registrationNumber },
    { fullName: "ليلى قاسمي", registrationNumber: student4.registrationNumber },
  ],
  issuedAt: days(-50),
};
export const supervisionDoc: SupervisionDocument = {
  id: "doc1",
  documentNumber: "SUP-2026-0001",
  verificationToken: "tok-verify-1",
  barcode: "6131234567890",
  topicId: topicFull.id,
  status: "active",
  snapshot: supervisionSnapshot,
  createdAt: days(-50),
  revokedAt: null,
  printedAt: null,
  printedByRole: null,
  printedByName: null,
  printCount: 0,
  lastPrintedAt: null,
  version: "v-doc1",
};

// ── الحساب ──────────────────────────────────────────────────
/** `updatedAt` يتغيّر بالكتابة وحدها، كما يغيّره Prisma (`@updatedAt`). */
export const myAccount = (u: AuthUser, updatedAt = days(-1)): MyAccount => {
  const base = allUsers.find((x) => x.id === u.id) ?? adminUser;
  const st = students.find((s) => s.userId === base.id);
  const pr = professors.find((p) => p.userId === base.id);
  return {
    id: base.id,
    firstName: base.firstName,
    lastName: base.lastName,
    firstNameLatin: base.firstNameLatin ?? null,
    lastNameLatin: base.lastNameLatin ?? null,
    email: base.email,
    username: base.role === "admin" ? "samir" : null,
    phone: "0550000000",
    avatarUrl: null,
    gender: base.gender ?? null,
    role: base.role,
    status: "active",
    isVerified: true,
    lastLoginAt: days(-1),
    createdAt: created,
    updatedAt,
    student: st
      ? {
          id: st.id,
          registrationNumber: st.registrationNumber,
          academicYear: { title: year.title, isActive: true },
          specialization: { name: specialization.name, level: "master", filiere: { name: filiere.name, department: { name: department.name, faculty: { name: faculty.name } } } },
        }
      : null,
    professor: pr
      ? { id: pr.id, employeeNumber: pr.employeeNumber, universityEmail: pr.universityEmail, grade: pr.grade, department: { name: department.name, faculty: { name: faculty.name } } }
      : null,
    // كما في `CAN` في account.service على الخادم.
    can: {
      admin: { edit: ["firstName", "lastName", "firstNameLatin", "lastNameLatin", "username", "phone", "gender"], photo: true, email: true },
      professor: { edit: ["firstName", "lastName", "firstNameLatin", "lastNameLatin", "gender", "phone"], photo: true, email: true },
      student: { edit: ["firstName", "lastName"], photo: false, email: true },
    }[base.role],
    // Its own address not proven yet: a professor's links go to the university one meanwhile.
    recoveryEmail: pr ? pr.universityEmail : null,
    mustChangePassword: !!u.mustChangePassword,
    twoFactor: {
      available: base.role === "admin",
      required: base.role === "admin",
      enabled: base.role === "admin" && u.twoFactorEnabled !== false,
      enabledAt: base.role === "admin" ? days(-30) : null,
      recoveryCodesLeft: base.role === "admin" ? 8 : 0,
    },
  };
};

export const sessions: AccountSession[] = [
  { id: "se1", device: { type: "desktop", os: "Windows", browser: "Chrome" }, ip: "10.0.0.5", createdAt: days(-3), lastActiveAt: days(0), current: true, online: true },
  { id: "se2", device: { type: "mobile", os: "Android", browser: "Chrome" }, ip: "41.100.1.1", createdAt: days(-10), lastActiveAt: days(-2), current: false, online: false },
];

export const securityAlerts: SecurityAlert[] = [
  { id: "sa1", title: "دخولٌ من جهازٍ جديد", message: "Android · Chrome", i18n: null, link: "/account", createdAt: days(-2) },
];

/** المستخدم المسجّل لكلّ دور، كما يحفظه المتجر بعد الدخول. */
export const authUsers: Record<"admin" | "professor" | "student", AuthUser> = {
  admin: { id: adminUser.id, role: "admin", email: adminUser.email!, firstName: "سمير", lastName: "بن علي", gender: "male", mustChangePassword: false, twoFactorEnabled: true, twoFactorSetupRequired: false },
  professor: { id: profUsers[0]!.id, role: "professor", universityEmail: prof1.universityEmail, firstName: "كريم", lastName: "منصوري", firstNameLatin: "Karim", lastNameLatin: "MANSOURI", gender: "male", mustChangePassword: false },
  student: { id: studentUsers[0]!.id, role: "student", registrationNumber: student1.registrationNumber, firstName: "أمين", lastName: "حداد", gender: "male", mustChangePassword: false },
};

/** The student standing at the activation desk (Backend modules/admin/activation-desk). */
export const deskStudent: DeskStudent = {
  id: "desk-student-1",
  registrationNumber: "777000111",
  firstName: "ليلى",
  lastName: "بوزيد",
  firstNameLatin: "Leila",
  lastNameLatin: "BOUZID",
  specialization: { name: "علم الاجتماع التربوي", level: "master" },
  academicYear: "2026/2027",
  status: "active",
  activated: false,
  lastLoginAt: null,
};

/** A request with photos waiting for review (Backend modules/activation). */
export const activationRequest: ActivationRequestItem = {
  id: "request-student-1",
  registrationNumber: "777000222",
  firstName: "سارة",
  lastName: "مزيان",
  firstNameLatin: "Sara",
  lastNameLatin: "MEZIANE",
  specialization: { name: "علم الاجتماع التربوي", level: "master" },
  academicYear: "2026/2027",
  status: "active",
  sentAt: "2026-11-01T08:30:00.000Z",
  qrNumber: "777000222",
  qrMatches: true,
  // The card alone, as every request is sent now.
  photos: { card: true, selfie: false },
};

/** A forgotten password waiting for the administration (Backend modules/password-request). */
export const passwordRequest: PasswordRequestItem = {
  id: "password-student-1",
  registrationNumber: "202039012345",
  firstName: "أمين",
  lastName: "حداد",
  firstNameLatin: "Amine",
  lastNameLatin: "HADDAD",
  specialization: { name: "علم الاجتماع التربوي", level: "master" },
  domain: "العلوم الاجتماعية والإنسانية",
  filiere: "علم الاجتماع",
  avatarUrl: null,
  academicYear: "2026/2027",
  status: "active",
  verified: false,
  lastLoginAt: null,
  sentAt: "2026-11-20T08:30:00.000Z",
  qrNumber: "202039012345",
  qrMatches: true,
  photo: true,
};

/** The desk's list: the student at the desk, and two others in other states. */
export const deskStudents: DeskStudentRow[] = [
  {
    id: deskStudent.id,
    registrationNumber: deskStudent.registrationNumber,
    firstName: deskStudent.firstName,
    lastName: deskStudent.lastName,
    firstNameLatin: deskStudent.firstNameLatin,
    lastNameLatin: deskStudent.lastNameLatin,
    gender: "female",
    avatarUrl: null,
    specialization: deskStudent.specialization,
    academicYear: deskStudent.academicYear,
    status: "active",
    activated: false,
    verified: false,
    lastLoginAt: null,
    pendingRequest: null,
  },
  {
    id: "desk-student-2",
    registrationNumber: "777000333",
    firstName: "يوسف",
    lastName: "حمادي",
    firstNameLatin: "Youcef",
    lastNameLatin: "HAMMADI",
    gender: "male",
    avatarUrl: null,
    specialization: deskStudent.specialization,
    academicYear: deskStudent.academicYear,
    status: "active",
    activated: true,
    verified: true,
    lastLoginAt: "2026-10-30T09:00:00.000Z",
    pendingRequest: null,
  },
];

/** Everything about the student at the desk (Backend activation-desk `deskProfileService`). */
export const studentProfile: StudentProfile = {
  id: deskStudent.id,
  registrationNumber: deskStudent.registrationNumber,
  personal: {
    userId: "desk-user-1",
    firstName: "ليلى",
    lastName: "بوزيد",
    firstNameLatin: "Leila",
    lastNameLatin: "BOUZID",
    email: "leila.bouzid@etu.univ-eloued.dz",
    username: null,
    phone: "0661 22 33 44",
    gender: "female",
    avatarUrl: null,
  },
  academic: {
    faculty: "كلية العلوم الاجتماعية والإنسانية",
    department: "قسم علم الاجتماع",
    filiere: "علم الاجتماع",
    specialization: { name: "علم الاجتماع التربوي", level: "master" },
    academicYear: "2026/2027",
    currentYear: true,
  },
  account: {
    status: "active",
    activated: false,
    verified: false,
    createdAt: "2026-09-27T08:00:00.000Z",
    lastLoginAt: null,
    devices: 0,
    request: null,
  },
  requests: [
    {
      id: "gr-desk-1",
      role: "leader",
      status: "pending",
      priority: 1,
      createdAt: "2026-10-12T10:00:00.000Z",
      rejectionReason: null,
      topic: {
        id: "topic-desk-1",
        title: "أثر المنصّات الرقمية في التحصيل الدراسي",
        status: "open",
        supervisor: { firstName: "كريم", lastName: "منصوري", firstNameLatin: "Karim", lastNameLatin: "MANSOURI" },
      },
      team: [{ registrationNumber: "777000333", firstName: "يوسف", lastName: "حمادي", firstNameLatin: "Youcef", lastNameLatin: "HAMMADI" }],
    },
  ],
  project: null,
  activity: [
    {
      id: "audit-desk-1",
      action: "auth.loginFailed",
      success: false,
      createdAt: "2026-10-31T21:00:00.000Z",
      ip: "192.168.1.20",
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130",
    },
  ],
};

// ── أنواع المواضيع والمشرف المساعد ──
export const topicTypes = [
  { id: "tt1", name: "الذكاء الاصطناعي", code: "AI", color: "#dbeafe", departmentId: department.id, sortOrder: 0, department: { id: department.id, name: department.name }, topicsCount: 2 },
  { id: "tt2", name: "إنترنت الأشياء", code: "IoT", color: "#dcfce7", departmentId: department.id, sortOrder: 1, department: { id: department.id, name: department.name }, topicsCount: 0 },
] satisfies TopicTypeRow[];

/** The professors a co-supervisor is picked from (`/common/professors`). */
export const professorOptions: ProfessorOption[] = professors.map((p) => ({
  id: p.id,
  firstName: p.user.firstName ?? null,
  lastName: p.user.lastName ?? null,
  firstNameLatin: p.user.firstNameLatin ?? null,
  lastNameLatin: p.user.lastNameLatin ?? null,
  department: { id: department.id, name: department.name },
  isMe: false,
}));

/** The Excel file's preview, as `/admin/topics/export/preview` answers: a sheet per level — a licence one, then the master's, a supervisor over two topics. */
export const topicExportPreview = (lang: string): TopicExportPreview => ({
  sheets: [
    {
      ...masterSheet(lang),
      name: lang === "en" ? "Topics - Bachelor's" : "المواضيع - ليسانس",
      rows: [{ band: false, cells: [{ v: 1, center: true }, { v: "نادية بوزيد", wrap: true }, { v: topicApproved.title, wrap: true }, { v: "لا يوجد", muted: true, center: true }] }],
      total: 1,
    },
    masterSheet(lang),
  ],
});
const masterSheet = (lang: string): SheetPreview => ({
  name: lang === "en" ? "Topics - Master's" : lang === "fr" ? "Sujets - Master" : "المواضيع - ماستر",
  rtl: lang === "ar",
  title: [lang === "en" ? "List of topics" : "قائمة المواضيع", "2 مواضيع"],
  columns: [
    { header: "#", accent: false, width: 8 },
    { header: lang === "en" ? "Supervisor" : "الأستاذ المشرف", accent: false, width: 24 },
    { header: lang === "en" ? "Topic title" : "عنوان الموضوع", accent: false, width: 46 },
    { header: lang === "en" ? "Type of topic" : "نوع الموضوع", accent: false, width: 22 },
  ],
  rows: [
    { band: false, cells: [{ v: "AI01", center: true, ink: "#2f4f7a" }, { v: "كريم منصوري", wrap: true, rowSpan: 2 }, { v: topicOpen.title, wrap: true }, { v: "AI", fill: "#dae3f3", ink: "#1f2d2a" }] },
    { band: false, cells: [{ v: "AI02", center: true, ink: "#2f4f7a" }, { v: "كريم منصوري", covered: true }, { v: topicFull.title, wrap: true }, { v: "لا يوجد", muted: true, center: true }] },
  ],
  total: 2,
  freeze: 3,
  colors: { brand: "#26423d", gold: "#c1965a", goldSoft: "#e9d3ae", zebra: "#f6f2e9", ink: "#1f2d2a", muted: "#9a9384", line: "#e4dccb" },
});

// ─── رسائل البريد (واجهة الموقع ← رسائل البريد) ───

const MAIL_GROUPS: MailTemplatesData["groups"] = {
  common: ["mail.brand", "mail.footer", "mail.linkFallback", "mail.ignore", "mail.notYou"],
  reset: ["mail.reset.subject", "mail.reset.title", "mail.reset.intro", "mail.reset.action", "mail.reset.expires"],
  verify: ["mail.verify.subject", "mail.verify.title", "mail.verify.intro", "mail.verify.action", "mail.verify.expires"],
  passwordChanged: ["mail.passwordChanged.subject", "mail.passwordChanged.title", "mail.passwordChanged.intro", "mail.passwordChanged.byAdmin"],
  newDevice: [
    "mail.newDevice.subject",
    "mail.newDevice.title",
    "mail.newDevice.intro",
    "mail.newDevice.device",
    "mail.newDevice.ip",
    "mail.newDevice.when",
    "mail.newDevice.action",
    "mail.newDevice.notYou",
  ],
};
const MAIL_VARS: Record<string, string[]> = {
  "mail.reset.intro": ["account"],
  "mail.reset.expires": ["minutes"],
  "mail.verify.intro": ["account"],
  "mail.verify.expires": ["hours"],
  "mail.passwordChanged.intro": ["account", "when"],
  "mail.passwordChanged.byAdmin": ["account", "when"],
  "mail.newDevice.intro": ["account"],
  "mail.newDevice.device": ["device"],
  "mail.newDevice.ip": ["ip"],
  "mail.newDevice.when": ["when"],
};
const MAIL_KEYS = Object.values(MAIL_GROUPS).flat();
/** The platform's words, short: the key's last part, and its values. */
const mailDefaults = (lang: string) =>
  Object.fromEntries(
    MAIL_KEYS.map((k) => [k, `${lang}:${k.split(".").pop()}${(MAIL_VARS[k] ?? []).map((v) => ` {{${v}}}`).join("")}`]),
  );

export const mailTemplates: MailTemplatesData = {
  templates: null,
  defaults: { ar: mailDefaults("ar"), en: mailDefaults("en"), fr: mailDefaults("fr") },
  look: { header: "#26423d", accent: "#c1965a", universityLogo: null, facultyLogo: null },
  groups: MAIL_GROUPS,
  fields: Object.fromEntries(
    MAIL_KEYS.map((k) => [k, { vars: MAIL_VARS[k] ?? [], oneLine: /\.(subject|title|action|device|ip|when)$|^mail\.brand$/.test(k), max: 700 }]),
  ),
  mailEnabled: true,
  testTo: "admin@univ-eloued.dz",
};
