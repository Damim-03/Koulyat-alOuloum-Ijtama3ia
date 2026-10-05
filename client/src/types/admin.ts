import type { Gender, Role } from "./enums";

// ── Shared ──
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Filiere {
  id: string;
  name: string;
  code?: string;
  departmentId: string;
  domainId?: string | null;
  /** Optional cover image shown behind this entry's card. */
  coverUrl?: string | null;
  department?: Department;
  _count?: { specializations?: number };
}

export interface Domain {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  /** Optional cover image shown behind this entry's card. */
  coverUrl?: string | null;
  department?: Department;
  _count?: { filieres?: number };
}

export interface TopicReference {
  id: string;
  title: string;
  url: string;
}

export interface UserLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  /** الاسم باللاتينية كما في الوثائق الفرنسية — اختياريّ. */
  firstNameLatin?: string | null;
  lastNameLatin?: string | null;
  email: string | null;
  username: string | null;
  avatarUrl?: string | null;
  gender?: Gender | null;
  phone?: string | null;
  role: Role;
  status: "active" | "suspended";
  isVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserDetail extends UserLite {
  student?: {
    id: string;
    registrationNumber: string;
    academicYear?: { id: string; title: string } | null;
    specialization?: {
      id: string;
      name: string;
      filiere?: {
        id: string;
        name: string;
        department?: {
          id: string;
          name: string;
          faculty?: { id: string; name: string } | null;
        } | null;
      } | null;
    } | null;
  } | null;
  professor?: {
    id: string;
    employeeNumber: string;
    universityEmail: string;
    department?: {
      id: string;
      name: string;
      faculty?: { id: string; name: string } | null;
    } | null;
  } | null;
}

// ── Stats ──
export interface OverviewStats {
  students: number;
  professors: number;
  topics: number;
  approvedTopics: number;
  projects: number;
  defenses: number;
}

// ── Faculty / Department / Specialization / Year ──
export interface Faculty {
  id: string;
  name: string;
  code: string;
  /** Optional cover image shown behind this entry's card. */
  coverUrl?: string | null;
  /** شعارُ الكلّية — علامةٌ مربّعة تحلّ محلّ أيقونة المبنى الافتراضية. */
  iconUrl?: string | null;
  _count?: { departments: number };
}

export interface Department {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  /** Optional cover image shown behind this entry's card. */
  coverUrl?: string | null;
  faculty?: Faculty;
  filieres?: Filiere[]; // ← included for the professors table ("الشعبة")
  /** `specializations` is summed across the department's filieres server-side. */
  _count?: {
    specializations: number;
    professors: number;
    filieres?: number;
    domains?: number;
  };
}

export interface Filiere {
  id: string;
  name: string;
  code?: string;
  departmentId: string;
  department?: Department;
}

export interface Specialization {
  id: string;
  name: string;
  level: "licence" | "master" | "doctorate";
  /** Optional cover image shown behind this entry's card. */
  coverUrl?: string | null;
  filiereId?: string;
  filiere?: Filiere;
  // kept for back-compat with places that still get a flat department
  departmentId?: string;
  department?: Department;
  _count?: { students: number; topics: number };
}

// ── The list of memoir titles, as the department prints it ──
export type TitlesListMode = "before" | "after";
type TitlesPerson = {
  firstName: string | null;
  lastName: string | null;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
};
export interface TitlesListRow {
  id: string;
  title: string;
  status: string;
  maxStudents: number;
  supervisor: TitlesPerson & { id: string; grade: unknown; email: string | null };
  /** Leader first; empty before assignment. */
  students: (TitlesPerson & { registrationNumber: string; isLeader: boolean })[];
}
export interface TitlesListGroup {
  specialization: { id: string; name: string; level: string };
  filiere: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  faculty: { id: string; name: string } | null;
  rows: TitlesListRow[];
}
export interface TopicTitlesList {
  mode: TitlesListMode;
  year: { id: string; title: string } | null;
  groups: TitlesListGroup[];
}
export interface TitlesListParams {
  mode: TitlesListMode;
  academicYearId?: string;
  professorId?: string;
  facultyId?: string;
  departmentId?: string;
  filiereId?: string;
  specializationId?: string;
}

export interface AcademicYear {
  id: string;
  title: string;
  isActive: boolean;
  /** Set once the year is closed into the archive. */
  archivedAt?: string | null;
}

// ── The archive of academic years ──
export interface ArchiveYear {
  id: string;
  title: string;
  isActive: boolean;
  archivedAt: string | null;
  archivedByName: string | null;
  counts: {
    students: number;
    topics: number;
    projects: number;
    defended: number;
    averageGrade: number | null;
  };
}

export type Mention = "excellent" | "veryGood" | "good" | "fair" | "fail";
type SpecRef = { id: string; name: string; level: string };

export interface YearSummary {
  students: number;
  studentsWithProject: number;
  topics: number;
  topicsByStatus: Record<string, number>;
  projects: number;
  defenses: { total: number; completed: number; scheduled: number; cancelled: number };
  graded: number;
  averageGrade: number | null;
  bestGrade: number | null;
  passRate: number | null;
  mentions: Record<Mention, number>;
  requests: Record<string, number>;
  supervisors: number;
}

export interface YearDefense {
  id: string;
  date: string;
  durationMinutes: number;
  room: string;
  status: "scheduled" | "completed" | "cancelled";
  grade: number | null;
  mention: Mention | null;
  notes: string | null;
  committee: { role: string; id: string; name: string; latinName?: string | null }[];
}

export interface YearRecord {
  year: { id: string; title: string };
  generatedAt: string;
  summary: YearSummary;
  bySpecialization: (SpecRef & { students: number; topics: number; projects: number; defended: number; averageGrade: number | null })[];
  supervisors: { id: string; name: string; latinName?: string | null; topics: number; projects: number; defended: number; averageGrade: number | null }[];
  students: {
    id: string;
    registrationNumber: string;
    name: string;
    latinName: string | null;
    gender: "male" | "female" | null;
    avatarUrl: string | null;
    accountStatus: string;
    specialization: SpecRef;
    project: { id: string; title: string; leader: boolean } | null;
    defense: { status: string; grade: number | null; mention: Mention | null } | null;
  }[];
  topics: {
    id: string;
    title: string;
    status: string;
    maxStudents: number;
    createdAt: string;
    specialization: SpecRef;
    supervisor: { id: string; name: string; latinName?: string | null };
    department: string | null;
    requests: number;
    projectId: string | null;
    members: number;
  }[];
  projects: {
    id: string;
    topicId: string;
    title: string;
    createdAt: string;
    specialization: SpecRef;
    supervisor: { id: string; name: string; latinName?: string | null; gender: "male" | "female" | null; avatarUrl: string | null };
    members: { id: string; name: string; latinName?: string | null; registrationNumber: string; leader: boolean; gender: "male" | "female" | null; avatarUrl: string | null }[];
    milestones: { total: number; completed: number; late: number; submissions: number };
    defense: YearDefense | null;
  }[];
  defenses: (YearDefense & {
    projectId: string;
    title: string;
    students: string[];
    studentsLatin?: (string | null)[];
    supervisor: string;
    supervisorLatin?: string | null;
  })[];
}

export interface YearRecordResponse {
  source: "archive" | "live";
  archivedAt: string | null;
  archivedByName: string | null;
  note: string | null;
  isActive: boolean;
  record: YearRecord;
}

export interface YearReadiness {
  year: { id: string; title: string; archivedAt: string | null };
  ready: boolean;
  items: { key: string; count: number; level: "ok" | "info" | "warn"; extra?: { upcoming?: number } }[];
}

// ── Students / Professors ──
export interface Student {
  id: string;
  registrationNumber: string;
  userId: string;
  user?: UserLite;
  specialization?: Specialization;
  academicYear?: AcademicYear;
}

// ─── الاستيراد من Excel (الطلبة والأساتذة) ───
/** مفتاح عمودٍ في ملفّ الاستيراد — تأتي الأعمدة مع التقرير من الخادم. */
export type ImportColumnKey = string;
export type ImportColumnKind = "req" | "opt" | "auto";
export interface ImportColumn {
  key: ImportColumnKey;
  header: string;
  kind: ImportColumnKind;
  group: "personal" | "academic" | "professional";
  /** حرفه في الملف المرفوع، أو null إن غاب عنه. */
  letter: string | null;
}
export type ImportIssueLevel = "error" | "warning" | "info";
export interface ImportIssue {
  level: ImportIssueLevel;
  message: string;
}
/** ok: سليمة · error/warning: فيها ما يُقال · empty: اختيارية فارغة · auto: تملؤها المنصّة. */
export type ImportCellState = "ok" | "error" | "warning" | "empty" | "auto";
export interface ImportCell {
  /** كما في الملف. كلمة المرور نجومٌ بطولها. */
  value: string;
  /** ما سيُحفظ أو يُشتقّ — إن خالف المكتوب، أو ملأته المنصّة. */
  saved?: string;
  state: ImportCellState;
  issues?: ImportIssue[];
}
export interface StudentImportRow {
  /** رقم الصفّ في Excel — ما يُبحث عنه عند التصحيح. */
  row: number;
  /** مخفيٌّ في Excel. */
  hidden?: boolean;
  cells: Record<ImportColumnKey, ImportCell>;
  /** ما يخصّ الصفّ كلّه لا خانةً منه. */
  issues?: ImportIssue[];
  errors: number;
  warnings: number;
}
export interface StudentImportReport {
  fileErrors: string[];
  fileWarnings: string[];
  file?: {
    sheetName: string;
    headerRow: number;
    otherSheets: string[];
    ignored: { header: string; letter: string }[];
  };
  columns: ImportColumn[];
  rows: StudentImportRow[];
  summary: { total: number; valid: number; invalid: number; warned: number };
}
export interface StudentImportPreview {
  report: StudentImportReport;
  /** الملف نفسه مُعلَّماً بأخطائه وتنبيهاته (base64) — حين يكون فيه ما يُعلَّم. */
  annotatedFile?: string;
}
/** تقرير أيّ استيراد — الطلبة والأساتذة بالشكل نفسه. */
export type ImportReport = StudentImportReport;
export type ImportRow = StudentImportRow;
export type ImportPreviewResult = StudentImportPreview;

/** نتيجة استيرادٍ نجح: الحسابات بمعرّفاتها، وكلمة المرور المولَّدة وحدها. */
export interface ImportResult {
  created: number;
  accounts: ({ firstName: string; lastName: string; password: string | null } & Record<string, string | null>)[];
  accountsFile: string;
}

export interface ProfessorImportResult extends ImportResult {
  accounts: {
    employeeNumber: string;
    universityEmail: string;
    firstName: string;
    lastName: string;
    password: string | null;
  }[];
}

export interface StudentImportResult {
  created: number;
  accounts: {
    registrationNumber: string;
    firstName: string;
    lastName: string;
    /** المولَّدة وحدها؛ null لما كُتب في الملف. */
    password: string | null;
  }[];
  /** ملفّ الحسابات (base64) — يُنزَّل مرّةً، ولا يُحفظ في المنصّة. */
  accountsFile: string;
}

// A professor's supervised topic, as returned by GET /admin/professors/:id.
export interface ProfessorTopicLite {
  id: string;
  title: string;
  status: string;
  maxStudents: number;
  createdAt: string;
  specialization?: { id: string; name: string } | null;
  _count?: { groupRequests: number };
}

export interface Professor {
  id: string;
  employeeNumber: string;
  universityEmail: string;
  userId: string;
  user?: UserLite;
  department?: Department;
  grade?: string[]; // الرتبة — free tags entered by the admin
  tags?: string[]; // الصفة — free tags entered by the admin
  topics?: ProfessorTopicLite[]; // present in the detail payload
  _count?: { topics: number };
}

// ── Topics / Projects / Defenses ──

/**
 * سبب منع إجراء، كما يرسله الخادم.
 *
 * `code` هو ما تترجمه الواجهة عبر `topicBlocked.<code>`؛ و`reason` نصّ عربيّ
 * جاهز يُعرض حين لا ترجمة للرمز. الاثنان يأتيان معاً دائماً.
 */
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
 * حكم الخادم على ما يجوز لهذا الموضوع.
 *
 * كانت الواجهة تستنتج هذا من `status` وحده — `deletable = status !== "full"` —
 * بينما الحارس الحقيقي في الخادم يسأل عن المجموعة والطلبات. فتُعرض عمليات
 * مستحيلة وتُخفى عمليات جائزة. لا تشتقّ هذه القيم من `status`: اقرأها.
 */
export interface TopicActions {
  canApprove: boolean;
  canReject: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canArchive: boolean;
  canUnarchive: boolean;
  canDelete: boolean;
  canAssignGroup: boolean;
  blockedReasons: Partial<Record<TopicActionKey, string>>;
  blockedCodes: Partial<
    Record<
      TopicActionKey,
      { code: TopicBlockCode; params?: Record<string, string | number> }
    >
  >;
}

/** الإشغال الفعليّ، مقروءاً من الصفوف لا من `status`. */
export interface TopicOccupancy {
  hasGroup: boolean;
  groupMemberCount: number;
  hasPendingRequest: boolean;
  pendingRequestMemberCount: number;
  hasAcceptedRequest: boolean;
}

export interface AdminTopic {
  professorId?: string;
  references: TopicReference[];
  id: string;
  title: string;
  description: string;
  requirements?: string[];
  objectives?: string[];
  rejectionReason?: string | null;
  status: string;
  maxStudents: number;
  /** سقفُ المحاولات على الموضوع — `null` بلا سقف. */
  maxRequests?: number | null;
  professor?: Professor;
  specialization?: Specialization;
  academicYear?: AcademicYear;
  _count?: { groupRequests: number };
  /** يأتيان من القائمة وصفحة التفصيل معاً. */
  actions?: TopicActions;
  occupancy?: TopicOccupancy;
  createdAt: string;
}

/** ملفٌّ سلّمه الفريق في مرحلة، ومن سلّمه. */
export interface AdminSubmission {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
  version: number;
  createdAt: string;
  uploadedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl?: string | null;
    gender?: string | null;
  } | null;
}

export interface AdminMilestone {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  status: string;
  order: number;
  _count?: { submissions: number };
  /** آخر الملفات (حتى عشرة)؛ و`_count` هو العدد الحقيقي. */
  submissions?: AdminSubmission[];
}

/** تقدّم المشروع كما يحسبه الخادم للقائمة — «متأخرة» بعلامتها أو بتاريخها. */
export interface AdminProjectProgress {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  submissions: number;
  nextDeadline: { title: string; deadline: string } | null;
  lastActivityAt: string | null;
}

export interface AdminProjectStats {
  total: number;
  defenseScheduled: number;
  defenseDone: number;
  noDefense: number;
  withOverdue: number;
  noPlan: number;
}

export interface AdminProject {
  id: string;
  topic?: AdminTopic;
  members?: { id: string; isLeader?: boolean; createdAt?: string; student?: Student }[];
  milestones?: AdminMilestone[];
  defense?: (AdminDefense & { _count?: { committee: number } }) | null;
  _count?: { milestones: number };
  progress?: AdminProjectProgress;
  /** تفاصيل المشروع وحدها. */
  insights?: {
    submissions: number;
    lastSubmissionAt: string | null;
    origin: { kind: "request" | "assignment"; requestId: string | null; since: string };
  };
  /** حكم الخادم على الفسخ، قبل النقر لا بعده. */
  actions?: {
    canDissolve: boolean;
    dissolveBlockers: { submissions: number; defense: boolean };
  };
  createdAt: string;
  updatedAt?: string;
}

export interface DefenseCommitteeMember {
  id: string;
  role: "president" | "supervisor" | "examiner";
  professor?: Professor;
}

export interface DefenseClash {
  id: string;
  title: string;
  date: string;
  room: string;
  professorId?: string;
  name?: string;
}

export interface DefenseClashes {
  room: DefenseClash[];
  professors: DefenseClash[];
}

export interface AdminDefense {
  id: string;
  groupId?: string;
  date: string;
  /** How long the session lasts (60 by default). */
  durationMinutes?: number;
  /** date + duration, computed by the server. */
  endsAt?: string;
  room: string;
  grade: number | null;
  status?: "scheduled" | "completed" | "cancelled";
  notes?: string | null;
  committee?: (DefenseCommitteeMember & { professorId?: string })[];
  group?: AdminProject;
  /** Scheduled defences overlapping this one by room or by juror. */
  clashes?: DefenseClashes;
}

/** The whole schedule's figures — not the page's, not the filter's. */
export interface DefenseStats {
  total: number;
  upcoming: number;
  today: number;
  week: number;
  completed: number;
  cancelled: number;
  stale: number;
  noCommittee: number;
  averageGrade: number | null;
  rooms: number;
  readyToSchedule: number;
}

export interface AdminGroupRequestMember {
  id: string;
  student?: {
    id: string;
    registrationNumber: string;
    user?: { firstName: string | null; lastName: string | null } | null;
  };
}

/** عدّاد كل حالة تحت الفلاتر الجارية — يحسبه الخادم في نفس الرحلة. */
export interface AdminGroupRequestCounts {
  pending: number;
  accepted: number;
  rejected: number;
  all: number;
}

/** ما يجوز الآن على طلب المجموعة — يحسبه الخادم ولا تُخمّنه الشاشة. */
export interface AdminGroupRequestActions {
  canAccept: boolean;
  canReject: boolean;
  /** سبب المنع بالعربية، جاهزٌ للعرض كتلميح على الزرّ المطفأ. */
  blockedReasons: Partial<Record<"accept" | "reject", string>>;
  blockedCodes: Partial<
    Record<"accept" | "reject", { code: string; params?: Record<string, string | number> }>
  >;
}

export interface AdminGroupRequest {
  id: string;
  status: "pending" | "accepted" | "rejected";
  priority: number;
  rejectionReason?: string | null;
  createdAt: string;
  actions?: AdminGroupRequestActions;
  topic?: { id: string; title: string; status?: string } | null;
  leader?: {
    id: string;
    registrationNumber: string;
    user?: { firstName: string | null; lastName: string | null } | null;
  } | null;
  members?: AdminGroupRequestMember[];
}

// Types for the GET /admin/dashboard payload (mirrors getDashboardService).

export type TopicStatus =
  | "pending"
  | "approved"
  | "open"
  | "full"
  | "rejected"
  | "archived";

export interface DashboardStats {
  students: number;
  professors: number;
  openTopics: number;
  fullTopics: number;
  pendingTopics: number;
  pendingGroupRequests: number;
  pendingRequests: number;
  upcomingDefenses: number;
}

export interface TrendValue {
  current: number;
  previous: number;
  delta: number;
}

export interface DashboardTrends {
  students: TrendValue;
  topics: TrendValue;
  requests: TrendValue;
}

export interface AcademicYearLite {
  id: string;
  title: string;
  isActive: boolean;
}

interface UserName {
  firstName: string | null;
  lastName: string | null;
}

export interface PendingProposal {
  id: string;
  title: string;
  maxStudents: number;
  createdAt: string;
  professor: { user: UserName };
  specialization: { id: string; name: string };
}

export interface RecentRequest {
  id: string;
  status: "pending" | "accepted" | "rejected";
  priority: number;
  createdAt: string;
  topic: { id: string; title: string };
  leader: { registrationNumber: string; user: UserName };
  members: { student: { registrationNumber: string; user: UserName } }[];
}

export interface UpcomingDefense {
  id: string;
  date: string;
  room: string;
  group: { topic: { id: string; title: string } };
}

export interface StaleProposal {
  id: string;
  title: string;
  createdAt: string;
  professor: { user: UserName };
}

export interface OpenWithoutRequests {
  id: string;
  title: string;
  updatedAt: string;
  specialization: { id: string; name: string };
}

export interface DashboardAttention {
  staleProposals: StaleProposal[];
  openWithoutRequests: OpenWithoutRequests[];
}

export interface TopicBreakdownItem {
  status: TopicStatus;
  count: number;
}

export interface StudentsPerSpecializationItem {
  id: string;
  name: string;
  count: number;
}

export interface MonthlyGrowthItem {
  month: string; // "YYYY-MM"
  students: number;
  topics: number;
  projects: number;
}

export interface SystemHealth {
  totalAccounts: number;
  activeUsers: number;
  suspendedUsers: number;
}

export interface AdminDashboard {
  stats: DashboardStats;
  trends: DashboardTrends;
  academicYear: AcademicYearLite | null;
  pendingProposals: PendingProposal[];
  recentRequests: RecentRequest[];
  upcomingDefenses: UpcomingDefense[];
  attention: DashboardAttention;
  topicBreakdown: TopicBreakdownItem[];
  studentsPerSpecialization: StudentsPerSpecializationItem[];
  monthlyGrowth: MonthlyGrowthItem[];
  systemHealth: SystemHealth;
}

/** An email domain the platform accepts for professor accounts. */
export interface UniversityDomain {
  id: string;
  domain: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

//
// ─── ACADEMIC STRUCTURE WIZARD ────────────────────────────────
//

/** Points at a row created in this same payload, or an existing one. */
export interface StructureRef {
  kind: "new" | "existing";
  /** Temp key when kind is "new", real id when "existing". */
  value: string;
}

export interface StructureSpecialization {
  name: string;
  level: "licence" | "master" | "doctorate";
}

export interface AcademicStructurePayload {
  faculty:
    | { kind: "new"; name: string; code: string }
    | { kind: "existing"; id: string };
  departments: { key: string; name: string; code: string }[];
  domains: {
    key: string;
    name: string;
    code: string;
    department: StructureRef;
  }[];
  filieres: {
    key: string;
    name: string;
    code: string;
    department: StructureRef;
    domain?: StructureRef | null;
    specializations: StructureSpecialization[];
  }[];
}

export interface AcademicStructureResult {
  faculty: Faculty;
  created: {
    departments: number;
    domains: number;
    filieres: number;
    specializations: number;
  };
}
