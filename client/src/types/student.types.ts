import type {
  TopicStatus,
  ApplicationStatus,
  MilestoneStatus,
} from "./enums";

// ─── shared lite shapes ────────────────────────────────────────
export interface ProfessorLite {
  id: string;
  user?: { firstName?: string; lastName?: string; email?: string };
  specialization?: string;
  title?: string; // academic title, e.g. "أستاذ محاضر"
}

export interface SpecializationLite {
  id: string;
  name: string;
  level: "licence" | "master" | "doctorate";
}

export interface StudentMember {
  id: string;
  registrationNumber: string;
  user?: { firstName?: string; lastName?: string };
  role?: string; // e.g. "قائد المشروع" / "عضو"
}

// ─── topics (browse) ───────────────────────────────────────────
export interface BrowseTopic {
  id: string;
  title: string;
  description: string;
  status: TopicStatus;
  maxStudents: number;
  takenSeats: number; // accepted applications count
  professor?: ProfessorLite;
  specialization?: SpecializationLite;
  hasApplied?: boolean; // did current student already apply
}

// ─── applications ──────────────────────────────────────────────
export interface StudentApplication {
  id: string;
  topicId: string;
  status: ApplicationStatus;
  priority: number;
  topic?: { id: string; title: string; professor?: ProfessorLite };
  createdAt: string;
}

// ─── project (my project) ──────────────────────────────────────
export interface StudentProject {
  id: string; // group id
  topic: {
    id: string;
    title: string;
    description: string;
  };
  supervisor?: ProfessorLite;
  members: StudentMember[];
  progress: number; // 0..100
  stats: {
    monthsTotal: number;
    monthsElapsed: number;
    meetings: number;
    defenseStatus: string; // e.g. "ممتازة" / "قيد التقييم"
  };
}

// ─── milestones (timeline) ─────────────────────────────────────
export interface StudentMilestone {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  status: MilestoneStatus;
  order: number;
}

// ─── files / submissions ───────────────────────────────────────
export interface SubmissionComment {
  id: string;
  authorName: string;
  authorRole?: string;
  body: string;
  createdAt: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  type: "pdf" | "docx" | "other";
  sizeMB: number;
  version: number;
  status: "draft" | "submitted" | "approved";
  updatedAt: string;
  comments?: SubmissionComment[];
}

// ─── meetings ──────────────────────────────────────────────────
export interface Meeting {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  mode: "in_person" | "online";
  status?: "upcoming" | "done" | "cancelled";
  note?: string;
}

export interface OfficeHours {
  day: string;
  from: string;
  to: string;
}

// ─── defense ───────────────────────────────────────────────────
export interface CommitteeMember {
  id: string;
  name: string;
  role: string; // "رئيس اللجنة" / "مشرف" / "ممتحن"
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface DefenseSession {
  id: string;
  type: string; // "جلسة المناقشة الحضورية"
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  committee: CommitteeMember[];
  checklist: ChecklistItem[];
}
