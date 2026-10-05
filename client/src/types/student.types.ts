import type { TopicStatus, MilestoneStatus } from "./enums";

export type GroupRequestStatus = "pending" | "accepted" | "rejected";

// ─── shared lite shapes ────────────────────────────────────────
export interface UserRef {
  id?: string;
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
}

// ─── student lookup (live teammate search) ─────────────────────
export interface LookupStudent {
  id: string;
  registrationNumber: string;
  user?: UserRef;
  specialization?: { name?: string | null } | null; // اختياري
  /** الخادم يقول إنّه الطالب نفسه — بالمعرّف لا بالنصّ. */
  isSelf?: boolean;
  /**
   * في مجموعةٍ أخرى: `project` له مشروعٌ قائم، و`request` في طلبٍ حيٍّ
   * لفريقٍ آخر. وطلباتُ المرسِل نفسه لا تُعدّ.
   */
  otherGroup?: "project" | "request" | null;
}

export interface ProfessorRef {
  id: string;
  user?: UserRef;
}

export interface SpecializationLite {
  id: string;
  name: string;
  level?: "licence" | "master" | "doctorate";
}

export interface AcademicYearLite {
  id: string;
  title: string;
  isActive: boolean;
}

export interface StudentRef {
  id: string;
  registrationNumber: string;
  user?: UserRef;
}

// ─── topics (browse published) ─────────────────────────────────
export interface BrowseTopic {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  objectives: string[];
  status: TopicStatus;
  maxStudents: number;
  specialization?: SpecializationLite;
  academicYear?: AcademicYearLite;
  professor?: ProfessorRef;
  _count?: { groupRequests: number };
  createdAt: string;
}

// ─── group requests (team → admin) ─────────────────────────────
export interface GroupRequestMember {
  id: string;
  student?: StudentRef;
  /** Present on project members (ProjectMember.isLeader). */
  isLeader?: boolean;
}

export interface GroupRequest {
  id: string;
  topicId: string;
  leaderStudentId: string;
  priority: number;
  status: GroupRequestStatus;
  rejectionReason?: string | null;
  topic?: {
    id: string;
    title: string;
    status?: TopicStatus;
    maxStudents?: number;

    professor?: {
      id: string;
      user?: DashPerson | null;
    } | null;

    academicYear?: {
      id: string;
      title: string;
    } | null;

    specialization?: { id: string; name: string } | null;
  };
  members?: GroupRequestMember[];
  /** False when a teammate sent it with this student in the team. */
  isLeader?: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ─── my project (after acceptance) ─────────────────────────────
export interface Submission {
  id: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
}

export interface StudentMilestone {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  status: MilestoneStatus;
  order: number;
  submissions?: Submission[];
}

export interface DefenseRef {
  id: string;
  date: string;
  room: string;
  status?: "scheduled" | "completed" | "cancelled";
  grade?: number | null;
  committee?: {
    role: "president" | "supervisor" | "examiner";
    professor: { id: string; user: DashPerson | null } | null;
  }[];
}

export interface MyProject {
  id: string;
  topic?: {
    id: string;
    title: string;
    description?: string;
    professor?: ProfessorRef;
    academicYear?: { id: string; title: string } | null;
    specialization?: { id: string; name: string } | null;
  };
  members?: GroupRequestMember[];
  milestones?: StudentMilestone[];
  defense?: DefenseRef | null;
}

// ─── dashboard (GET /student/dashboard) ────────────────────────
/** A person as the dashboard shows one: a name and an avatar. */
export interface DashPerson {
  firstName: string | null;
  lastName: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
}

/** Where the student stands — derived on the server from the rows. */
export type StudentStage =
  | "choose_topic"
  | "awaiting_decision"
  | "in_progress"
  | "defense_scheduled"
  | "defended";

export interface StudentDashRequest {
  id: string;
  priority: number;
  status: GroupRequestStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  /** False when a teammate sent it with this student in the team. */
  isLeader: boolean;
  membersCount: number;
  leader: { user: DashPerson | null } | null;
  topic: {
    id: string;
    title: string;
    professor: { user: DashPerson | null } | null;
  };
}

export interface StudentDashMilestone {
  id: string;
  title: string;
  deadline: string;
  status: MilestoneStatus;
  order: number;
  submissions: number;
}

export interface StudentDashProject {
  id: string;
  topic: {
    id: string;
    title: string;
    professor: { user: DashPerson | null } | null;
  };
  members: {
    id: string;
    isLeader: boolean;
    student: { id: string; registrationNumber: string; user: DashPerson | null };
  }[];
  milestones: StudentDashMilestone[];
  progress: { total: number; completed: number; overdue: number; percent: number };
  nextMilestone: StudentDashMilestone | null;
  defense: {
    id: string;
    date: string;
    room: string;
    status: "scheduled" | "completed" | "cancelled";
    grade: number | null;
    committee: {
      role: "president" | "supervisor" | "examiner";
      professor: { user: DashPerson | null } | null;
    }[];
  } | null;
  supervisionDocument: {
    id: string;
    documentNumber: string;
    createdAt: string;
  } | null;
}

export interface StudentDashMilestoneLite {
  id: string;
  title: string;
  deadline: string;
}

export interface StudentDashboard {
  student: {
    registrationNumber: string;
    specialization: SpecializationLite | null;
    academicYear: { id: string; title: string } | null;
  };
  stage: StudentStage;
  /** Topics still open to a request in the student's specialization. */
  availableTopics: number;
  requests: StudentDashRequest[];
  project: StudentDashProject | null;
  attention: {
    overdueMilestones: StudentDashMilestoneLite[];
    dueThisWeek: StudentDashMilestoneLite[];
    rejectedRequests: StudentDashRequest[];
  };
}

export interface MMember {
  id?: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  user?: { firstName?: string | null; lastName?: string | null } | null;
  registrationNumber?: string | null;
  isLeader?: boolean | null;
}
export interface MMilestone {
  id?: string;
  title?: string | null;
  description?: string | null;
  dueDate?: string | null; // الموعد النهائي
  status?: string | null; // completed | in_progress | pending | overdue
}
export interface MyProjectView {
  id?: string;
  title?: string | null;
  status?: string | null; // pill
  type?: string | null; // "مشروع تخرّج"
  academicYear?: { title?: string | null } | null;
  professor?: {
    user?: { firstName?: string | null; lastName?: string | null } | null;
    office?: string | null;
  } | null;
  members?: MMember[] | null;
  milestones?: MMilestone[] | null;
  defense?: {
    date?: string | null;
    scheduledAt?: string | null;
    room?: string | null;
    location?: string | null;
  } | null;
  progress?: number | null; // نسبة مئوية صريحة إن وُجدت
}

export interface TopicView {
  title?: string | null;
  description?: string | null; // تفاصيل المشروع
  objectives?: string | null; // الأهداف
  requirements?: string[] | null; // المتطلبات (chips)
  status?: string | null; // open / published / full / in_progress
  // A topic can be `open` and still taken: the first team's request reserves
  // it before the project group exists. The endpoint answers with both.
  isAvailable?: boolean;
  isReserved?: boolean;
  maxStudents?: number | null; // عدد الطلاب
  type?: string | null; // نوع المشروع (تطبيقي/بحثي)
  code?: string | null; // رقم الموضوع
  coverImage?: string | null; // صورة الموضوع
  createdAt?: string | null; // تاريخ النشر
  professor?: {
    // ⚠️ الاسم يُبنى من user.firstName + user.lastName (مطابق لـ browse-topics).
    user?: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null;
    office?: string | null; // ⚠️ لو الحقل officeNumber بدّله هنا
  } | null;
  specialization?: { name?: string | null } | null;
  academicYear?: { title?: string | null } | null;
}
