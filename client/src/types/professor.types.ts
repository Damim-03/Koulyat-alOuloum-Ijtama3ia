import type {
  TopicStatus,
  ApplicationStatus,
  MilestoneStatus,
} from "./enums";

// ════════════════════════════════════════════════════════════
//  Professor feature — shared types
//  Shapes mirror what the backend professor.service returns.
//  Enums (TopicStatus, ApplicationStatus, MilestoneStatus) come
//  from ./enums — do NOT redefine them here.
// ════════════════════════════════════════════════════════════

// ── Nested user shape (as included by the backend) ──
export interface UserRef {
  id?: string;
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
}

// ── Lookups (from /common/* — for form dropdowns) ──
export interface SpecializationLite {
  id: string;
  name: string;
  level: "licence" | "master" | "doctorate";
  departmentId?: string;
  department?: { id: string; name: string };
}

export interface AcademicYearLite {
  id: string;
  title: string;
  isActive: boolean;
}

// ── Student (nested in applications / members) ──
export interface StudentRef {
  id: string;
  registrationNumber: string;
  user?: UserRef;
}

// ── Topic ──
export interface Topic {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  objectives: string[];
  status: TopicStatus;
  rejectionReason?: string | null;
  maxStudents: number;

  professorId?: string;
  specializationId?: string;
  academicYearId?: string;
  specialization?: SpecializationLite;
  academicYear?: AcademicYearLite;

  // present on getTopicById
  applications?: Application[];

  _count?: { applications: number };

  createdAt: string;
  updatedAt?: string;
}

// ── Application ──
export interface Application {
  id: string;
  status: ApplicationStatus;
  priority: number;
  rejectionReason?: string | null;
  studentId?: string;
  topicId?: string;
  student?: StudentRef;
  topic?: Pick<Topic, "id" | "title" | "maxStudents" | "status">;
  createdAt: string;
}

// ── Submission (nested under milestones) ──
export interface Submission {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  version: number;
  uploadedBy?: { id: string; firstName: string | null; lastName: string | null };
  createdAt: string;
}

// ── Milestone ──
export interface Milestone {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  status: MilestoneStatus;
  order: number;
  groupId: string;
  submissions?: Submission[];
  createdAt?: string;
}

// ── Project member ──
export interface ProjectMember {
  id: string;
  student?: StudentRef;
}

// ── Defense (as included on a group) ──
export interface DefenseRef {
  id: string;
  date: string;
  room: string;
  grade: number | null;
  status?: "scheduled" | "completed" | "cancelled";
}

// ── Project group ──
export interface ProjectGroup {
  id: string;
  topicId?: string;
  topic?: Pick<Topic, "id" | "title" | "status" | "maxStudents">;
  members?: ProjectMember[];
  milestones?: Milestone[];
  defense?: DefenseRef | null;
  _count?: { milestones: number };
  createdAt: string;
}