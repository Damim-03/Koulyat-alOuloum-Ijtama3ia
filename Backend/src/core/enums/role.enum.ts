/**
 * ============================================================
 * ROLES & PERMISSIONS
 * Graduation Management System
 * core/enums/role.enum.ts
 * ============================================================
 */

//
// ================= ROLES =================
//

export const Roles = {
  OWNER: "owner",
  ADMIN: "admin",
  PROFESSOR: "professor",
  STUDENT: "student",
} as const;

export type RoleType = (typeof Roles)[keyof typeof Roles];

//
// ================= PERMISSIONS =================
//

export const Permissions = {
  // ===== AUTH =====
  LOGIN: "LOGIN",

  // ===== PROFILE =====
  VIEW_OWN_PROFILE: "VIEW_OWN_PROFILE",
  EDIT_OWN_PROFILE: "EDIT_OWN_PROFILE",

  // ===== MILESTONES =====
  VIEW_MILESTONES: "VIEW_MILESTONES",
  CREATE_MILESTONES: "CREATE_MILESTONES",
  UPDATE_MILESTONES: "UPDATE_MILESTONES",
  DELETE_MILESTONES: "DELETE_MILESTONES",

  // ===== TOPICS =====
  VIEW_TOPICS: "VIEW_TOPICS",
  CREATE_TOPICS: "CREATE_TOPICS",
  UPDATE_OWN_TOPICS: "UPDATE_OWN_TOPICS",
  DELETE_OWN_TOPICS: "DELETE_OWN_TOPICS",
  APPROVE_TOPICS: "APPROVE_TOPICS",
  REJECT_TOPICS: "REJECT_TOPICS",

  // ===== APPLICATIONS =====
  APPLY_TO_TOPIC: "APPLY_TO_TOPIC",
  CANCEL_APPLICATION: "CANCEL_APPLICATION",
  VIEW_OWN_APPLICATIONS: "VIEW_OWN_APPLICATIONS",
  VIEW_TOPIC_APPLICATIONS: "VIEW_TOPIC_APPLICATIONS",
  VIEW_GROUPS: "VIEW_GROUPS",
  ACCEPT_APPLICATIONS: "ACCEPT_APPLICATIONS",
  REJECT_APPLICATIONS: "REJECT_APPLICATIONS",

  // ===== PROJECTS =====
  VIEW_PROJECT: "VIEW_PROJECT",
  VIEW_SUPERVISED_PROJECTS: "VIEW_SUPERVISED_PROJECTS",

  // ===== SUBMISSIONS =====
  UPLOAD_SUBMISSIONS: "UPLOAD_SUBMISSIONS",
  COMMENT_ON_SUBMISSIONS: "COMMENT_ON_SUBMISSIONS",

  // ===== DEFENSES =====
  VIEW_DEFENSE: "VIEW_DEFENSE",
  ASSIGN_DEFENSES: "ASSIGN_DEFENSES",
  VIEW_DEFENSES: "VIEW_DEFENSES",

  // ===== MEETINGS =====
  SCHEDULE_MEETINGS: "SCHEDULE_MEETINGS",

  // ===== USERS =====
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_STUDENTS: "MANAGE_STUDENTS",
  MANAGE_PROFESSORS: "MANAGE_PROFESSORS",

  // ===== ACADEMIC STRUCTURE =====
  MANAGE_DEPARTMENTS: "MANAGE_DEPARTMENTS",
  MANAGE_SPECIALIZATIONS: "MANAGE_SPECIALIZATIONS",
  MANAGE_ACADEMIC_YEARS: "MANAGE_ACADEMIC_YEARS",

  // ===== ROOMS =====
  MANAGE_ROOMS: "MANAGE_ROOMS",

  // ===== REPORTS =====
  VIEW_REPORTS: "VIEW_REPORTS",

  // ===== NOTIFICATIONS =====
  VIEW_NOTIFICATIONS: "VIEW_NOTIFICATIONS",
  MANAGE_NOTIFICATIONS: "MANAGE_NOTIFICATIONS",

  // ===== SYSTEM =====
  MANAGE_ADMINS: "MANAGE_ADMINS",
  VIEW_AUDIT_LOGS: "VIEW_AUDIT_LOGS",
  MANAGE_SYSTEM_SETTINGS: "MANAGE_SYSTEM_SETTINGS",
  SYSTEM_OVERVIEW: "SYSTEM_OVERVIEW",
} as const;

export type PermissionType = (typeof Permissions)[keyof typeof Permissions];

//
// ================= ROLE → PERMISSIONS =================
//

export const RolePermissions: Record<RoleType, PermissionType[]> = {
  //
  // ================= OWNER =================
  //
  [Roles.OWNER]: [
    // System
    Permissions.MANAGE_ADMINS,
    Permissions.VIEW_AUDIT_LOGS,
    Permissions.MANAGE_SYSTEM_SETTINGS,
    Permissions.SYSTEM_OVERVIEW,

    // Full access
    Permissions.LOGIN,
    Permissions.VIEW_OWN_PROFILE,
    Permissions.EDIT_OWN_PROFILE,

    Permissions.VIEW_TOPICS,
    Permissions.CREATE_TOPICS,
    Permissions.UPDATE_OWN_TOPICS,
    Permissions.DELETE_OWN_TOPICS,
    Permissions.APPROVE_TOPICS,
    Permissions.REJECT_TOPICS,

    Permissions.APPLY_TO_TOPIC,
    Permissions.CANCEL_APPLICATION,
    Permissions.VIEW_OWN_APPLICATIONS,
    Permissions.VIEW_TOPIC_APPLICATIONS,
    Permissions.VIEW_GROUPS,
    Permissions.ACCEPT_APPLICATIONS,
    Permissions.REJECT_APPLICATIONS,

    Permissions.VIEW_PROJECT,
    Permissions.VIEW_SUPERVISED_PROJECTS,

    Permissions.VIEW_MILESTONES,
    Permissions.CREATE_MILESTONES,
    Permissions.UPDATE_MILESTONES,
    Permissions.DELETE_MILESTONES,

    Permissions.UPLOAD_SUBMISSIONS,
    Permissions.COMMENT_ON_SUBMISSIONS,

    Permissions.VIEW_DEFENSE,
    Permissions.ASSIGN_DEFENSES,
    Permissions.VIEW_DEFENSES,

    Permissions.SCHEDULE_MEETINGS,

    Permissions.MANAGE_USERS,
    Permissions.MANAGE_STUDENTS,
    Permissions.MANAGE_PROFESSORS,

    Permissions.MANAGE_DEPARTMENTS,
    Permissions.MANAGE_SPECIALIZATIONS,
    Permissions.MANAGE_ACADEMIC_YEARS,

    Permissions.MANAGE_ROOMS,
    Permissions.VIEW_REPORTS,

    Permissions.VIEW_NOTIFICATIONS,
    Permissions.MANAGE_NOTIFICATIONS,
  ],

  //
  // ================= ADMIN =================
  //
  [Roles.ADMIN]: [
    Permissions.LOGIN,
    Permissions.VIEW_OWN_PROFILE,
    Permissions.EDIT_OWN_PROFILE,

    // Topics
    Permissions.VIEW_TOPICS,
    Permissions.APPROVE_TOPICS,
    Permissions.REJECT_TOPICS,

    // Applications
    Permissions.VIEW_TOPIC_APPLICATIONS,

    // Projects
    Permissions.VIEW_PROJECT,

    // Milestones — administration maintains the schedule alongside the
    // supervising professor, so both can shape a project's timeline.
    Permissions.VIEW_MILESTONES,
    Permissions.CREATE_MILESTONES,
    Permissions.UPDATE_MILESTONES,
    Permissions.DELETE_MILESTONES,

    // Defenses
    Permissions.ASSIGN_DEFENSES,
    Permissions.VIEW_DEFENSES,

    // Users
    Permissions.MANAGE_USERS,
    Permissions.MANAGE_STUDENTS,
    Permissions.MANAGE_PROFESSORS,

    // Academic structure
    Permissions.MANAGE_DEPARTMENTS,
    Permissions.MANAGE_SPECIALIZATIONS,
    Permissions.MANAGE_ACADEMIC_YEARS,

    // Rooms
    Permissions.MANAGE_ROOMS,

    // Reports
    Permissions.VIEW_REPORTS,

    // Notifications
    Permissions.VIEW_NOTIFICATIONS,
    Permissions.MANAGE_NOTIFICATIONS,
  ],

  //
  // ================= PROFESSOR =================
  //
  [Roles.PROFESSOR]: [
    Permissions.LOGIN,
    Permissions.VIEW_OWN_PROFILE,
    Permissions.EDIT_OWN_PROFILE,

    // Topics
    Permissions.VIEW_TOPICS,
    Permissions.CREATE_TOPICS,
    Permissions.UPDATE_OWN_TOPICS,
    Permissions.DELETE_OWN_TOPICS,

    // Applications
    Permissions.VIEW_TOPIC_APPLICATIONS,
    Permissions.ACCEPT_APPLICATIONS,
    Permissions.REJECT_APPLICATIONS,

    // Projects / Groups
    Permissions.VIEW_SUPERVISED_PROJECTS,
    Permissions.VIEW_GROUPS,

    // Milestones
    Permissions.VIEW_MILESTONES,
    Permissions.CREATE_MILESTONES,
    Permissions.UPDATE_MILESTONES,
    Permissions.DELETE_MILESTONES,

    // Submissions
    Permissions.COMMENT_ON_SUBMISSIONS,

    // Defenses
    Permissions.VIEW_DEFENSES,

    // Meetings
    Permissions.SCHEDULE_MEETINGS,

    // Notifications
    Permissions.VIEW_NOTIFICATIONS,
  ],

  //
  // ================= STUDENT =================
  //
  [Roles.STUDENT]: [
    Permissions.LOGIN,
    Permissions.VIEW_OWN_PROFILE,
    Permissions.EDIT_OWN_PROFILE,

    // Topics
    Permissions.VIEW_TOPICS,

    // Applications
    Permissions.APPLY_TO_TOPIC,
    Permissions.CANCEL_APPLICATION,
    Permissions.VIEW_OWN_APPLICATIONS,

    // Project
    Permissions.VIEW_PROJECT,

    // Milestones
    Permissions.VIEW_MILESTONES,

    // Submissions
    Permissions.UPLOAD_SUBMISSIONS,

    // Defense
    Permissions.VIEW_DEFENSE,

    // Notifications
    Permissions.VIEW_NOTIFICATIONS,
  ],
};
