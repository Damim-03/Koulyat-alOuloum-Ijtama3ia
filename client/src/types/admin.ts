import type { Role } from "./enums";

// ── Shared ──
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface UserLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  username: string | null;
  role: Role;
  status: "active" | "suspended";
  isVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

// ── Stats ──
export interface OverviewStats {
  students: number;
  professors: number;
  topics: number;
  approvedTopics: number;
  projects: number;
  defenses: number;
  pendingApplications: number;
}

// ── Faculty / Department / Specialization / Year ──
export interface Faculty {
  id: string;
  name: string;
  code: string;
  _count?: { departments: number };
}

export interface Department {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  faculty?: Faculty;
  _count?: { specializations: number; professors: number };
}

export interface Specialization {
  id: string;
  name: string;
  level: "licence" | "master" | "doctorate";
  departmentId: string;
  department?: Department;
  _count?: { students: number; topics: number };
}

export interface AcademicYear {
  id: string;
  title: string;
  isActive: boolean;
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

export interface Professor {
  id: string;
  employeeNumber: string;
  universityEmail: string;
  userId: string;
  user?: UserLite;
  department?: Department;
  _count?: { topics: number };
}

// ── Topics / Applications / Projects / Defenses ──
export interface AdminTopic {
  references: TopicReference[];
  id: string;
  title: string;
  description: string;
  requirements?: string[];
  objectives?: string[];
  rejectionReason?: string | null;
  status: string;
  maxStudents: number;
  professor?: Professor;
  specialization?: Specialization;
  academicYear?: AcademicYear;
  _count?: { applications: number };
  createdAt: string;
}

export interface AdminApplication {
  id: string;
  status: string;
  priority: number;
  rejectionReason?: string | null;
  student?: Student;
  topic?: AdminTopic;
  createdAt: string;
}

export interface AdminMilestone {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  status: string;
  order: number;
}

export interface AdminProject {
  id: string;
  topic?: AdminTopic;
  members?: { id: string; student?: Student }[];
  milestones?: AdminMilestone[];
  defense?: AdminDefense | null;
  _count?: { milestones: number };
  createdAt: string;
}

export interface DefenseCommitteeMember {
  id: string;
  role: "president" | "supervisor" | "examiner";
  professor?: Professor;
}

export interface AdminDefense {
  id: string;
  date: string;
  room: string;
  grade: number | null;
  status?: "scheduled" | "completed" | "cancelled";
  notes?: string | null;
  committee?: DefenseCommitteeMember[];
  group?: AdminProject;
}