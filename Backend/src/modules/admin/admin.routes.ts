import { Router } from "express";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { adminOnly } from "../../core/utils/roleGuard";
import {
  // stats
  getOverviewStatsController,
  getDashboardController,
  // notifications
  listMyNotificationsController,
  unreadNotificationsCountController,
  markNotificationReadController,
  markAllNotificationsReadController,
  // users
  listUsersController,
  getUserController,
  createUserController,
  updateUserController,
  updateUserStatusController,
  updateUserVerificationController,
  resetUserPasswordController,
  deleteUserController,
  // students
  listStudentsController,
  getStudentController,
  createStudentController,
  updateStudentController,
  deleteStudentController,
  // professors
  listProfessorsController,
  getProfessorController,
  createProfessorController,
  updateProfessorController,
  deleteProfessorController,
  // faculties
  listFacultiesController,
  createFacultyController,
  updateFacultyController,
  deleteFacultyController,
  // departments
  listDepartmentsController,
  createDepartmentController,
  updateDepartmentController,
  deleteDepartmentController,
  // filieres
  listFilieresController,
  createFiliereController,
  updateFiliereController,
  deleteFiliereController,
  // specializations
  listSpecializationsController,
  createSpecializationController,
  updateSpecializationController,
  deleteSpecializationController,
  // academic years
  listAcademicYearsController,
  createAcademicYearController,
  updateAcademicYearController,
  activateAcademicYearController,
  deleteAcademicYearController,
  proposalWindowController,
  setProposalWindowController,
  clearProposalWindowController,
  selectionWindowController,
  setSelectionWindowController,
  clearSelectionWindowController,
  teamSizeController,
  teamSizePreviewController,
  setTeamSizeController,
  clearTeamSizeController,
  topicQuotaController,
  setTopicQuotaController,
  clearTopicQuotaController,
  // topics
  listTopicsController,
  topicTitlesListController,
  exportTopicsController,
  getTopicController,
  approveTopicController,
  rejectTopicController,
  archiveTopicController,
  publishTopicController,
  unpublishTopicController,
  deleteTopicController,
  unarchiveTopicController,
  listGroupRequestsController,
  listGroupRequestsByTopicController,
  getGroupRequestController,
  acceptGroupRequestController,
  rejectGroupRequestController,
  deleteGroupRequestController,
  // projects
  listProjectsController,
  getProjectController,
  changeSupervisorController,
  assignStudentController,
  listGroupMilestonesController,
  createGroupMilestoneController,
  updateGroupMilestoneController,
  deleteGroupMilestoneController,
  removeProjectMemberController,
  dissolveProjectController,
  setProjectLeaderController,
  // archive
  listArchiveYearsController,
  yearRecordController,
  yearReadinessController,
  closeYearController,
  reopenYearController,
  // defenses
  listDefensesController,
  defenseConflictsController,
  exportDefensesController,
  getDefenseController,
  createDefenseController,
  updateDefenseController,
  deleteDefenseController,
  uploadImageController,
  // domains
  listDomainsController,
  createDomainController,
  updateDomainController,
  deleteDomainController,
  createTopicController,
  createAssignedTopicController,
  listUniversityDomainsController,
  createAcademicStructureController,
  createUniversityDomainController,
  setDefaultUniversityDomainController,
  deleteUniversityDomainController,
  updateAssignedTopicController,
  removeGroupRequestMemberController,
  setGroupRequestLeaderController,
} from "./admin.controller";
import {
  cardImageUpload,
  xlsxFileUpload,
} from "../../core/middleware/upload.middleware";
import { mailTestLimiter, writeLimiter } from "../../core/middleware/rateLimit.middleware";
import { auditBefore, auditWrites } from "../../core/audit/audit";
import {
  auditSummaryController,
  listAuditActorsController,
  listAuditCountriesController,
  listAuditLogsController,
} from "./audit-log";
import {
  listTopicTypesController,
  createTopicTypeController,
  updateTopicTypeController,
  deleteTopicTypeController,
} from "./topic-types";
import { previewTopicsExportController } from "./topic-export.preview";
import {
  getSupervisionSheetController,
  resetSupervisionSheetController,
  saveSupervisionSheetController,
} from "../site/supervision-sheet";
import {
  getMailTemplatesController,
  previewMailTemplateController,
  saveMailTemplatesController,
  testMailTemplateController,
} from "../site/mail-templates";
import {
  deskLookupController,
  deskProfileController,
  deskSettingsController,
  deskStudentsController,
} from "./activation-desk";
import {
  activationPhotoController,
  approveActivationRequestController,
  listActivationRequestsController,
  rejectActivationRequestController,
} from "../activation/activation-request";
import {
  approvePasswordRequestController,
  listPasswordRequestsController,
  passwordRequestPhotoController,
  rejectPasswordRequestController,
} from "../password-request/password-request";
import {
  listHomeSlidesController,
  createHomeSlideController,
  createHomeSlidesBatchController,
  updateHomeSlideController,
  reorderHomeSlidesController,
  deleteHomeSlideController,
  listNewsController,
  createNewsController,
  updateNewsController,
  deleteNewsController,
  getDirectorMessageController,
  saveDirectorMessageController,
  getAboutPageController,
  saveAboutPageController,
  getLoginPageController,
  saveLoginPageController,
  getSiteTextsController,
  saveSiteTextsController,
} from "../site/site.controller";
import {
  studentImportController,
  studentImportPreviewController,
  studentImportTemplateController,
} from "./student-import/controller";
import { exportStudentsController } from "./admin.controller";
import {
  professorImportController,
  professorImportPreviewController,
  professorImportTemplateController,
} from "./professor-import/controller";
import {
  topicImportController,
  topicImportPreviewController,
  topicImportTemplateController,
} from "./topic-import/controller";
import {
  assignedTopicImportController,
  assignedTopicImportPreviewController,
  assignedTopicImportTemplateController,
} from "./assigned-topic-import/controller";

const adminRoutes = Router();

// كل مسارات الإدارة تشترط المصادقة ودور المدير.
//
// وكان الحذف وحده مشروطاً بدور `owner` فوق هذا؛ فلمّا أُلغي ذلك الدور صار
// الحذف كسائر عمليات الإدارة — لا حارس إضافيّ له هنا، لأن حارساً مطابقاً
// للحارس العامّ يُوهم بمستوىً ثانٍ لا وجود له.
adminRoutes.use(authMiddleware);
adminRoutes.use(adminOnly());
// Every change made here is written to the audit log (core/audit), with the
// item it was made to read before the change and after it.
adminRoutes.use(auditWrites);
adminRoutes.param("id", auditBefore);

//
// ─── AUDIT LOG (read-only) ────────────────────────────────────
//
adminRoutes.get("/audit-logs", listAuditLogsController);
// What the log's filters offer: who appears in it, from which countries, and the last day.
adminRoutes.get("/audit-logs/actors", listAuditActorsController);
adminRoutes.get("/audit-logs/summary", auditSummaryController);
adminRoutes.get("/audit-logs/countries", listAuditCountriesController);

//
// ─── ACTIVATION (./activation-desk) ───────────────────────────
//
adminRoutes.get("/activation/settings", deskSettingsController);
adminRoutes.get("/activation/student", deskLookupController);
adminRoutes.get("/activation/students", deskStudentsController);
adminRoutes.get("/activation/students/:id", deskProfileController);
// The requests to review (../activation/activation-request): photos and a password.
adminRoutes.get("/activation/requests", listActivationRequestsController);
adminRoutes.get("/activation/requests/:id/card", activationPhotoController("card"));
adminRoutes.get("/activation/requests/:id/selfie", activationPhotoController("selfie"));
adminRoutes.post("/activation/requests/:id/approve", approveActivationRequestController);
adminRoutes.post("/activation/requests/:id/reject", rejectActivationRequestController);
// «نسيت كلمة المرور» لطالبٍ بلا بريد (../password-request): البطاقة، ثمّ كلمة مرورٍ يكتبها المسؤول — أو الرفض.
adminRoutes.get("/password-requests", listPasswordRequestsController);
adminRoutes.get("/password-requests/:id/card", passwordRequestPhotoController);
adminRoutes.post("/password-requests/:id/approve", approvePasswordRequestController);
adminRoutes.post("/password-requests/:id/reject", rejectPasswordRequestController);

//
// ─── STATS ────────────────────────────────────────────────────
//
adminRoutes.get("/stats/overview", getOverviewStatsController);
adminRoutes.get("/dashboard", getDashboardController);

//
// ─── NOTIFICATIONS (admin's own bell) ─────────────────────────
//
// Literal paths first so they don't get captured by "/:id/read".
adminRoutes.get("/notifications", listMyNotificationsController);
adminRoutes.get(
  "/notifications/unread-count",
  unreadNotificationsCountController,
);
adminRoutes.patch(
  "/notifications/read-all",
  markAllNotificationsReadController,
);
adminRoutes.patch("/notifications/:id/read", markNotificationReadController);

//
// ─── USERS ────────────────────────────────────────────────────
//
adminRoutes.get("/users", listUsersController);
adminRoutes.get("/users/:id", getUserController);
adminRoutes.post("/users", createUserController);
adminRoutes.patch("/users/:id", updateUserController);
adminRoutes.patch("/users/:id/status", updateUserStatusController);
adminRoutes.patch(
  "/users/:id/verification",
  updateUserVerificationController,
);
adminRoutes.post("/users/:id/reset-password", resetUserPasswordController);
adminRoutes.delete("/users/:id", deleteUserController);

//
// ─── STUDENTS ─────────────────────────────────────────────────
//
adminRoutes.get("/students", listStudentsController);
// التصدير والاستيراد قبل `/students/:id`: وإلّا قُرئت «export» و«import»
// معرّفَ طالب.
adminRoutes.get("/students/export", exportStudentsController);
adminRoutes.get("/students/import/template", studentImportTemplateController);
adminRoutes.post(
  "/students/import/preview",
  writeLimiter,
  xlsxFileUpload,
  studentImportPreviewController,
);
adminRoutes.post(
  "/students/import",
  writeLimiter,
  xlsxFileUpload,
  studentImportController,
);
adminRoutes.get("/students/:id", getStudentController);
adminRoutes.post("/students", createStudentController);
adminRoutes.patch("/students/:id", updateStudentController);
adminRoutes.delete("/students/:id", deleteStudentController);

//
// ─── PROFESSORS ───────────────────────────────────────────────
//

adminRoutes.post(
  "/uploads/image",
  writeLimiter,
  cardImageUpload,
  uploadImageController,
);

adminRoutes.get("/professors", listProfessorsController);
// الاستيراد قبل `/professors/:id`: وإلّا قُرئت «import» معرّفَ أستاذ.
adminRoutes.get("/professors/import/template", professorImportTemplateController);
adminRoutes.post(
  "/professors/import/preview",
  writeLimiter,
  xlsxFileUpload,
  professorImportPreviewController,
);
adminRoutes.post(
  "/professors/import",
  writeLimiter,
  xlsxFileUpload,
  professorImportController,
);
adminRoutes.get("/professors/:id", getProfessorController);
adminRoutes.post("/professors", createProfessorController);
adminRoutes.patch("/professors/:id", updateProfessorController);
adminRoutes.delete("/professors/:id", deleteProfessorController);

//
// ─── FACULTIES ────────────────────────────────────────────────
//
//
// ─── ACADEMIC STRUCTURE ─────────────────────────────────
//
adminRoutes.post("/academic-structure", createAcademicStructureController);

//
// ─── UNIVERSITY DOMAINS ─────────────────────────────────
//
adminRoutes.get("/university-domains", listUniversityDomainsController);
adminRoutes.post("/university-domains", createUniversityDomainController);
adminRoutes.patch(
  "/university-domains/:id/default",
  setDefaultUniversityDomainController,
);
adminRoutes.delete("/university-domains/:id", deleteUniversityDomainController);

adminRoutes.get("/faculties", listFacultiesController);
adminRoutes.post("/faculties", createFacultyController);
adminRoutes.patch("/faculties/:id", updateFacultyController);
adminRoutes.delete("/faculties/:id", deleteFacultyController);

//
// ─── DEPARTMENTS ──────────────────────────────────────────────
//
adminRoutes.get("/departments", listDepartmentsController);
adminRoutes.post("/departments", createDepartmentController);
adminRoutes.patch("/departments/:id", updateDepartmentController);
adminRoutes.delete("/departments/:id", deleteDepartmentController);
// أنواع مواضيع القسم (محاورها): رمزٌ ولونٌ لكلٍّ منها في قائمة المواضيع.
adminRoutes.get("/topic-types", listTopicTypesController);
adminRoutes.post("/topic-types", createTopicTypeController);
adminRoutes.patch("/topic-types/:id", updateTopicTypeController);
adminRoutes.delete("/topic-types/:id", deleteTopicTypeController);

//
// ─── DOMAINS ──────────────────────────────────────────────────
//
adminRoutes.get("/domains", listDomainsController);
adminRoutes.post("/domains", createDomainController);
adminRoutes.patch("/domains/:id", updateDomainController);
adminRoutes.delete("/domains/:id", deleteDomainController);

//
// ─── FILIERES ─────────────────────────────────────────────────
//
adminRoutes.get("/filieres", listFilieresController);
adminRoutes.post("/filieres", createFiliereController);
adminRoutes.patch("/filieres/:id", updateFiliereController);
adminRoutes.delete("/filieres/:id", deleteFiliereController);

//
// ─── SPECIALIZATIONS ──────────────────────────────────────────
//
adminRoutes.get("/specializations", listSpecializationsController);
adminRoutes.post("/specializations", createSpecializationController);
adminRoutes.patch("/specializations/:id", updateSpecializationController);
adminRoutes.delete("/specializations/:id", deleteSpecializationController);

//
// ─── ACADEMIC YEARS ───────────────────────────────────────────
//
adminRoutes.get("/academic-years", listAcademicYearsController);
adminRoutes.post("/academic-years", createAcademicYearController);
adminRoutes.patch("/academic-years/:id", updateAcademicYearController);
adminRoutes.patch(
  "/academic-years/:id/activate",
  activateAcademicYearController,
);
adminRoutes.delete("/academic-years/:id", deleteAcademicYearController);
// فترة اقتراح المواضيع: لكلّ سنةٍ فترةٌ واحدة لكلّ الأساتذة.
adminRoutes.get("/academic-years/:id/proposal-window", proposalWindowController);
adminRoutes.put("/academic-years/:id/proposal-window", setProposalWindowController);
adminRoutes.delete("/academic-years/:id/proposal-window", clearProposalWindowController);
// ومهلة اختيار المواضيع: لكلّ سنةٍ مهلةٌ واحدة لكلّ طلبتها.
adminRoutes.get("/academic-years/:id/selection-window", selectionWindowController);
adminRoutes.put("/academic-years/:id/selection-window", setSelectionWindowController);
adminRoutes.delete("/academic-years/:id/selection-window", clearSelectionWindowController);
// The number of students in every topic of the year — and what it would do to them, before it is saved.
adminRoutes.get("/academic-years/:id/team-size", teamSizeController);
adminRoutes.get("/academic-years/:id/team-size/preview", teamSizePreviewController);
adminRoutes.put("/academic-years/:id/team-size", setTeamSizeController);
adminRoutes.delete("/academic-years/:id/team-size", clearTeamSizeController);
// The most topics a professor sends for the year — and how the professors stand to it.
adminRoutes.get("/academic-years/:id/topic-quota", topicQuotaController);
adminRoutes.put("/academic-years/:id/topic-quota", setTopicQuotaController);
adminRoutes.delete("/academic-years/:id/topic-quota", clearTopicQuotaController);

//
// ─── THE ARCHIVE ──────────────────────────────────────────────
//
adminRoutes.get("/archive/years", listArchiveYearsController);
adminRoutes.get("/archive/years/:id", yearRecordController);
adminRoutes.get("/archive/years/:id/readiness", yearReadinessController);
adminRoutes.post("/archive/years/:id/close", writeLimiter, closeYearController);
adminRoutes.post("/archive/years/:id/reopen", writeLimiter, reopenYearController);

//
// ─── TOPICS ───────────────────────────────────────────────────
//
adminRoutes.get("/topics", listTopicsController);
// Before `/topics/:id`, or "titles-list" and "export" would be read as ids.
adminRoutes.get("/topics/titles-list", topicTitlesListController);
adminRoutes.get("/topics/export", exportTopicsController);
// The file before it is downloaded: its first rows, as it will draw them.
adminRoutes.get("/topics/export/preview", previewTopicsExportController);
adminRoutes.post("/topics", createTopicController);
// الاستيراد قبل `/topics/:id`: وإلّا قُرئت «import» معرّفَ موضوع.
adminRoutes.get("/topics/import/template", topicImportTemplateController);
adminRoutes.post(
  "/topics/import/preview",
  writeLimiter,
  xlsxFileUpload,
  topicImportPreviewController,
);
adminRoutes.post(
  "/topics/import",
  writeLimiter,
  xlsxFileUpload,
  topicImportController,
);
adminRoutes.post("/topics/assigned", createAssignedTopicController);
// المواضيع المُسنَدة من Excel — استيرادٌ مستقلّ بنموذجه، قبل `/topics/:id`.
adminRoutes.get("/topics/assigned/import/template", assignedTopicImportTemplateController);
adminRoutes.post(
  "/topics/assigned/import/preview",
  writeLimiter,
  xlsxFileUpload,
  assignedTopicImportPreviewController,
);
adminRoutes.post(
  "/topics/assigned/import",
  writeLimiter,
  xlsxFileUpload,
  assignedTopicImportController,
);
adminRoutes.patch("/topics/:id/assignment", updateAssignedTopicController);
adminRoutes.patch("/topics/:id/unarchive", unarchiveTopicController);
adminRoutes.delete("/topics/:id", deleteTopicController);
adminRoutes.get("/topics/:id", getTopicController);
adminRoutes.patch("/topics/:id/approve", approveTopicController);
adminRoutes.patch("/topics/:id/reject", rejectTopicController);
adminRoutes.patch("/topics/:id/archive", archiveTopicController);
adminRoutes.patch("/topics/:id/publish", publishTopicController);
adminRoutes.patch("/topics/:id/unpublish", unpublishTopicController);

//
// ─── APPLICATIONS ─────────────────────────────────────────────
//

// group requests (team submissions — admin decides)
adminRoutes.get("/group-requests", listGroupRequestsController);
// The same requests under their topics. Before `/:id`, which would take it.
adminRoutes.get("/group-requests/by-topic", listGroupRequestsByTopicController);
adminRoutes.get("/group-requests/:id", getGroupRequestController);
adminRoutes.patch("/group-requests/:id/accept", acceptGroupRequestController);
adminRoutes.patch("/group-requests/:id/reject", rejectGroupRequestController);
// الحذفُ للمنتهي وحده — الحارسُ في الخدمة، لا في المسار.
adminRoutes.delete("/group-requests/:id", deleteGroupRequestController);

adminRoutes.delete(
  "/group-requests/:id/members/:studentId",
  removeGroupRequestMemberController,
);
adminRoutes.patch(
  "/group-requests/:id/leader/:studentId",
  setGroupRequestLeaderController,
);

//
// ─── PROJECTS ─────────────────────────────────────────────────
//
adminRoutes.get("/projects", listProjectsController);
adminRoutes.get("/projects/:id", getProjectController);
adminRoutes.patch("/projects/:id/supervisor", changeSupervisorController);
adminRoutes.post("/projects/:id/assign", assignStudentController);
adminRoutes.get("/projects/:groupId/milestones", listGroupMilestonesController);
adminRoutes.post(
  "/projects/:groupId/milestones",
  createGroupMilestoneController,
);
adminRoutes.patch("/milestones/:id", updateGroupMilestoneController);
adminRoutes.delete("/milestones/:id", deleteGroupMilestoneController);
adminRoutes.delete(
  "/projects/:id/members/:studentId",
  removeProjectMemberController,
);
// تعيين قائد المشروع — يعمل في أي مرحلة، بما فيها بعد الاكتمال.
adminRoutes.patch(
  "/projects/:id/leader/:studentId",
  setProjectLeaderController,
);
// فسخ المشروع: الباب الوحيد للتراجع عن اكتمال وقع بالخطأ.
adminRoutes.delete("/projects/:id", dissolveProjectController);

//
// ─── DEFENSES ─────────────────────────────────────────────────
//
adminRoutes.get("/defenses", listDefensesController);
// قبل «/defenses/:id»: هل يتعارض موعدٌ مقترح مع قاعةٍ أو عضو لجنة؟ وتصدير الجدول.
adminRoutes.get("/defenses/conflicts", defenseConflictsController);
adminRoutes.get("/defenses/export", exportDefensesController);
adminRoutes.get("/defenses/:id", getDefenseController);
adminRoutes.post("/defenses", createDefenseController);
adminRoutes.patch("/defenses/:id", updateDefenseController);
adminRoutes.delete("/defenses/:id", deleteDefenseController);

//
// ─── HOME SLIDES (صور الصفحة الرئيسية) ─────────────────────────
//
// مساراتٌ كاملة لا موجّهٌ فرعيّ: البثّ الحيّ يقرأ المورد من أوّل مقطعٍ بعد
// `/admin`، وموجّهٌ مركَّب عند `/home-slides` كان سيُقرئه المعرّفَ بدل اسمه.
adminRoutes.get("/home-slides", listHomeSlidesController);
adminRoutes.post("/home-slides", createHomeSlideController);
// عدّة صورٍ دفعةً واحدة — ما تختاره الإدارة في نافذة الإضافة.
adminRoutes.post("/home-slides/batch", createHomeSlidesBatchController);
// قبل `/home-slides/:id`، وإلّا قُرئت «order» معرّفَ صورة.
adminRoutes.patch("/home-slides/order", reorderHomeSlidesController);
adminRoutes.patch("/home-slides/:id", updateHomeSlideController);
adminRoutes.delete("/home-slides/:id", deleteHomeSlideController);

//
// ─── آخر الأخبار وكلمة رئيس القسم (واجهة الموقع) ──────────────
//
adminRoutes.get("/news", listNewsController);
adminRoutes.post("/news", createNewsController);
adminRoutes.patch("/news/:id", updateNewsController);
adminRoutes.delete("/news/:id", deleteNewsController);

adminRoutes.get("/director-message", getDirectorMessageController);
adminRoutes.put("/director-message", saveDirectorMessageController);

// صفحة «عن المنصة» — نصوصها؛ وصور معرضها من `/home-slides?placement=about`،
// وخلفية رأسها من `placement=aboutHero`.
adminRoutes.get("/about-page", getAboutPageController);
adminRoutes.put("/about-page", saveAboutPageController);

// لوحة الترحيب في صفحة الدخول — نصوصها؛ وخلفيتها من `/home-slides?placement=login`.
adminRoutes.get("/login-page", getLoginPageController);
adminRoutes.put("/login-page", saveLoginPageController);

// ورقة «طلب الموافقة على الإشراف» — نصوصها وشعاراها؛ وكلّ وثيقةٍ تصدر تحمل
// ما كانت عليه يومها (modules/site/supervision-sheet).
adminRoutes.get("/supervision-sheet", getSupervisionSheetController);
adminRoutes.put("/supervision-sheet", saveSupervisionSheetController);
adminRoutes.delete("/supervision-sheet", resetSupervisionSheetController);

// نصوص الموقع — عباراتٌ تحلّ محلّ نصوص الواجهة بمفاتيحها، لكلّ لغة:
// الصفحة الرئيسية والقوائم والتذييل والقوائم الجانبية.
adminRoutes.get("/site-texts", getSiteTextsController);
adminRoutes.put("/site-texts", saveSiteTextsController);

// رسائل البريد — نصوصها بكلّ لغة، ولونا الرأس والزرّ، والختم (modules/site/mail-templates):
// المعاينة تُرسم ممّا يُكتب ولا تُحفظ، والتجربة تذهب إلى بريد المسؤول المؤكَّد وحده.
adminRoutes.get("/mail-templates", getMailTemplatesController);
adminRoutes.put("/mail-templates", saveMailTemplatesController);
adminRoutes.post("/mail-templates/preview", previewMailTemplateController);
adminRoutes.post("/mail-templates/test", mailTestLimiter, testMailTemplateController);

export default adminRoutes;
