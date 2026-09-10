import type { TopicStatus, MilestoneStatus } from "./enums";

// ════════════════════════════════════════════════════════════
//  Professor feature — shared types
//  Shapes mirror what the backend professor.service returns.
//  Enums (TopicStatus, MilestoneStatus) come
//  from ./enums — do NOT redefine them here.
// ════════════════════════════════════════════════════════════

// ── Nested user shape (as included by the backend) ──
export interface UserRef {
  id?: string;
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
  // Both are what UserAvatar needs to draw a photo, or the right default
  // silhouette when there is none.
  avatarUrl?: string | null;
  gender?: string | null;
}

// ── Reference link that helps students (title + url) ──
export interface TopicReference {
  title: string;
  url: string;
}

// ── Lookups (from /common/* — for form dropdowns) ──
export interface SpecializationLite {
  id: string;
  name: string;
  level: "licence" | "master" | "doctorate";
  departmentId?: string;
  department?: { id: string; name: string };
  // /common/specializations flattens the chain onto every row, which is why
  // the topic dialog can offer faculty → department → filiere without a
  // filieres endpoint of its own.
  filiereId?: string;
  filiere?: { id: string; name: string };
}

export interface FacultyLite {
  id: string;
  name: string;
  code?: string;
}

export interface DepartmentLite {
  id: string;
  name: string;
  code?: string;
  facultyId: string;
}

export interface AcademicYearLite {
  id: string;
  title: string;
  isActive: boolean;
}

// ── Student (nested in group requests / members) ──
export interface StudentRef {
  id: string;
  registrationNumber: string;
  user?: UserRef;
  specialization?: { id: string; name: string } | null;
}

// ── Group request (a team asking for a topic) ──
// The professor sees these for information only: the administration decides.
// Note the shape is narrower than what he gets for a team he supervises —
// an applicant's contact details are not part of the answer.
export interface TopicGroupRequest {
  id: string;
  status: "pending" | "accepted" | "rejected" | string;
  priority: number;
  rejectionReason?: string | null;
  leader?: StudentRef | null;
  members?: { id: string; student?: StudentRef | null }[];
  createdAt: string;
}

// ── Topic ──
export interface Topic {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  objectives: string[];
  references?: TopicReference[];
  status: TopicStatus;
  rejectionReason?: string | null;
  maxStudents: number;

  professorId?: string;
  specializationId?: string;
  academicYearId?: string;
  specialization?: SpecializationLite;
  academicYear?: AcademicYearLite;

  // Present on the detail response only; the list omits them.
  groupRequests?: TopicGroupRequest[];
  projectGroup?: {
    id: string;
    members?: { id: string; isLeader: boolean; student?: StudentRef | null }[];
    _count?: { milestones: number };
    createdAt?: string;
  } | null;

  _count?: { groupRequests: number };

  createdAt: string;
  updatedAt?: string;
}

// ── Submission (nested under milestones) ──
export interface Submission {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  version: number;
  uploadedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
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

// ── Dashboard ──
// One request assembles the professor's first screen; the shapes below are
// what GET /professor/dashboard returns.

export interface DashTopicLite {
  id: string;
  title: string;
  status: TopicStatus | string;
  rejectionReason?: string | null;
  maxStudents: number;
  createdAt: string;
  updatedAt: string;
  specialization?: SpecializationLite | null;
  _count: { groupRequests: number };
}

export interface DashMilestoneLite {
  id: string;
  title: string;
  deadline: string;
  status: MilestoneStatus | string;
  order: number;
  groupId: string;
  group: { topic: { id: string; title: string } };
}

export interface DashSubmissionLite {
  id: string;
  fileName: string;
  createdAt: string;
  version: number;
  milestone: {
    id: string;
    title: string;
    status: MilestoneStatus | string;
    groupId: string;
    group: { topic: { id: string; title: string } };
  };
  uploadedBy: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    gender?: string | null;
  };
}

export interface DashAgendaItem {
  kind: "milestone" | "defense";
  id: string;
  title: string;
  date: string;
  groupId: string;
  topicTitle: string;
  room: string | null;
}

export interface DashProject {
  id: string;
  topic: { id: string; title: string; status: string; maxStudents: number };
  members: ProjectMember[];
  defense: { id: string; date: string; room: string; status: string } | null;
  milestones: { total: number; completed: number; overdue: number };
  nextDeadline: { id: string; title: string; deadline: string } | null;
}

export interface ProfessorDashboard {
  topics: DashTopicLite[];
  stats: {
    myTopics: number;
    supervisedProjects: number;
    supervisedStudents: number;
    overdueMilestones: number;
    upcomingDefenses: number;
  };
  topicBreakdown: Record<string, number>;
  attention: {
    rejectedTopics: DashTopicLite[];
    pendingTopics: DashTopicLite[];
    approvedNotPublished: DashTopicLite[];
    openWithoutRequests: DashTopicLite[];
    overdueMilestones: DashMilestoneLite[];
    dueThisWeek: DashMilestoneLite[];
    awaitingReview: DashSubmissionLite[];
  };
  agenda: DashAgendaItem[];
  projects: DashProject[];
}

// ── Student lookup (proposing a team) ──
// What GET /professor/students/search answers with: only the fields the
// picker puts on screen.
export interface StudentSearchHit {
  id: string;
  registrationNumber: string;
  user: {
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    gender?: string | null;
  } | null;
  specialization: { id: string; name: string } | null;
}
