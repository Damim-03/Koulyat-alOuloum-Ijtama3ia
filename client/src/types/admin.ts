import type { Role } from "./enums";

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
  department?: Department;
  _count?: { specializations?: number };
}

export interface Domain {
  id: string;
  name: string;
  code: string;
  departmentId: string;
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
  email: string | null;
  username: string | null;
  avatarUrl?: string | null;
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
  filieres?: Filiere[]; // ← included for the professors table ("الشعبة")
  _count?: { specializations: number; professors: number };
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
  filiereId?: string;
  filiere?: Filiere;
  // kept for back-compat with places that still get a flat department
  departmentId?: string;
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

// A professor's supervised topic, as returned by GET /admin/professors/:id.
export interface ProfessorTopicLite {
  id: string;
  title: string;
  status: string;
  maxStudents: number;
  createdAt: string;
  specialization?: { id: string; name: string } | null;
  _count?: { applications: number };
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

export interface AdminGroupRequestMember {
  id: string;
  student?: {
    id: string;
    registrationNumber: string;
    user?: { firstName: string | null; lastName: string | null } | null;
  };
}

export interface AdminGroupRequest {
  id: string;
  status: "pending" | "accepted" | "rejected";
  priority: number;
  rejectionReason?: string | null;
  createdAt: string;
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
  pendingApplications: number;
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
