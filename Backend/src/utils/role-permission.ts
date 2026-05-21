import { PermissionType, RoleType, Permissions } from "../enums/role.enum";

/**
 * ============================================================
 * ROLE → PERMISSIONS MAPPING
 * Graduation Management System
 * ============================================================
 */

export const RolePermissions: Record<RoleType, PermissionType[]> = {
  /**
   * ============================================================
   * OWNER
   * Full system access
   * ============================================================
   */
  OWNER: Object.values(Permissions),

  /**
   * ============================================================
   * ADMIN
   * Academic & System Management
   * ============================================================
   */
  ADMIN: [
    //
    // Users
    //
    Permissions.MANAGE_USERS,
    Permissions.MANAGE_STUDENTS,
    Permissions.MANAGE_PROFESSORS,

    //
    // Academic Structure
    //
    Permissions.MANAGE_DEPARTMENTS,
    Permissions.MANAGE_SPECIALIZATIONS,
    Permissions.MANAGE_ACADEMIC_YEARS,

    //
    // Topics
    //
    Permissions.VIEW_TOPICS,
    Permissions.APPROVE_TOPICS,
    Permissions.REJECT_TOPICS,

    //
    // Applications
    //
    Permissions.VIEW_TOPIC_APPLICATIONS,

    //
    // Projects
    //
    Permissions.VIEW_PROJECT,

    //
    // Defenses
    //
    Permissions.ASSIGN_DEFENSES,
    Permissions.VIEW_DEFENSES,

    //
    // Rooms
    //
    Permissions.MANAGE_ROOMS,

    //
    // Reports
    //
    Permissions.VIEW_REPORTS,

    //
    // Notifications
    //
    Permissions.VIEW_NOTIFICATIONS,
    Permissions.MANAGE_NOTIFICATIONS,
  ],

  /**
   * ============================================================
   * PROFESSOR
   * Supervision & Topic Management
   * ============================================================
   */
  PROFESSOR: [
    //
    // Profile
    //
    Permissions.VIEW_OWN_PROFILE,
    Permissions.EDIT_OWN_PROFILE,

    //
    // Topics
    //
    Permissions.VIEW_TOPICS,
    Permissions.CREATE_TOPICS,
    Permissions.UPDATE_OWN_TOPICS,
    Permissions.DELETE_OWN_TOPICS,

    //
    // Applications
    //
    Permissions.VIEW_TOPIC_APPLICATIONS,
    Permissions.ACCEPT_APPLICATIONS,
    Permissions.REJECT_APPLICATIONS,

    //
    // Projects
    //
    Permissions.VIEW_SUPERVISED_PROJECTS,

    //
    // Milestones
    //
    Permissions.VIEW_MILESTONES,
    Permissions.CREATE_MILESTONES,
    Permissions.UPDATE_MILESTONES,

    //
    // Submissions
    //
    Permissions.COMMENT_ON_SUBMISSIONS,

    //
    // Defenses
    //
    Permissions.VIEW_DEFENSES,

    //
    // Meetings
    //
    Permissions.SCHEDULE_MEETINGS,

    //
    // Notifications
    //
    Permissions.VIEW_NOTIFICATIONS,
  ],

  /**
   * ============================================================
   * STUDENT
   * Graduation Project Workflow
   * ============================================================
   */
  STUDENT: [
    //
    // Profile
    //
    Permissions.VIEW_OWN_PROFILE,
    Permissions.EDIT_OWN_PROFILE,

    //
    // Topics
    //
    Permissions.VIEW_TOPICS,

    //
    // Applications
    //
    Permissions.APPLY_TO_TOPIC,
    Permissions.CANCEL_APPLICATION,
    Permissions.VIEW_OWN_APPLICATIONS,

    //
    // Project
    //
    Permissions.VIEW_PROJECT,

    //
    // Milestones
    //
    Permissions.VIEW_MILESTONES,

    //
    // Submissions
    //
    Permissions.UPLOAD_SUBMISSIONS,

    //
    // Defense
    //
    Permissions.VIEW_DEFENSE,

    //
    // Notifications
    //
    Permissions.VIEW_NOTIFICATIONS,
  ],
};