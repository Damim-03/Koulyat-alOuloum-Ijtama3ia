// Mirrors the backend Prisma enums.

export const Role = {
  OWNER: "owner",
  ADMIN: "admin",
  PROFESSOR: "professor",
  STUDENT: "student",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

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

export const ApplicationStatus = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
} as const;
export type ApplicationStatus =
  (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

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