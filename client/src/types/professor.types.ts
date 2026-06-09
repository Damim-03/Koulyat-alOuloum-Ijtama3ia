import type {
  TopicStatus,
  ApplicationStatus,
  MilestoneStatus,
} from "./enums";

export interface Specialization {
  id: string;
  name: string;
  level: "licence" | "master" | "doctorate";
}

export interface AcademicYear {
  id: string;
  title: string;
  isActive: boolean;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  status: TopicStatus;
  maxStudents: number;
  professorId: string;
  specializationId: string;
  academicYearId: string;
  specialization?: Specialization;
  academicYear?: AcademicYear;
  applications?: Application[];
  _count?: { applications: number };
  createdAt: string;
  updatedAt: string;
}

export interface StudentLite {
  id: string;
  registrationNumber: string;
  user?: { firstName?: string; lastName?: string; email?: string };
}

export interface Application {
  id: string;
  studentId: string;
  topicId: string;
  status: ApplicationStatus;
  priority: number;
  student?: StudentLite;
  topic?: Topic;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectGroup {
  id: string;
  topicId: string;
  topic?: Topic;
  members?: unknown[];
  milestones?: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  status: MilestoneStatus;
  order: number;
  groupId: string;
  createdAt: string;
  updatedAt: string;
}