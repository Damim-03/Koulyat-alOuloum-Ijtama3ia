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

    professor?: {
      id: string;
      user?: {
        firstName?: string | null;
        lastName?: string | null;
      };
    };

    academicYear?: {
      id: string;
      title: string;
    };
  };
  members?: GroupRequestMember[];
  createdAt: string;
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
}

export interface MyProject {
  id: string;
  topic?: {
    id: string;
    title: string;
    description?: string;
    professor?: ProfessorRef;
  };
  members?: GroupRequestMember[];
  milestones?: StudentMilestone[];
  defense?: DefenseRef | null;
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
