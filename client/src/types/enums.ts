// Mirrors the backend Prisma enums.

export const Role = {
  OWNER: "owner",
  ADMIN: "admin",
  PROFESSOR: "professor",
  STUDENT: "student",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Gender = {
  MALE: "male",
  FEMALE: "female",
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

// The three login entry points exposed by /auth.
export type LoginRole = "student" | "professor" | "admin";

export const TopicStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  OPEN: "open",
  FULL: "full",
  ARCHIVED: "archived",
} as const;
export type TopicStatus = (typeof TopicStatus)[keyof typeof TopicStatus];

export const MilestoneStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  OVERDUE: "overdue",
} as const;
export type MilestoneStatus =
  (typeof MilestoneStatus)[keyof typeof MilestoneStatus];

export const UserStatus = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];