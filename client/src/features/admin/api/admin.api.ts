import { client } from "../../../lib/api/client";
import type {
  TitlesListParams,
  TopicTitlesList,
  OverviewStats,
  Paginated,
  StudentImportPreview,
  StudentImportResult,
  ProfessorImportResult,
  UserLite,
  Student,
  Professor,
  Faculty,
  Department,
  Specialization,
  AcademicYear,
  ArchiveYear,
  YearRecordResponse,
  YearReadiness,
  AdminTopic,
  AdminProject,
  AdminDefense,
  DefenseClashes,
  DefenseStats,
  AdminGroupRequest,
  AdminDashboard,
  UserDetail,
  Filiere,
  Domain,
  UniversityDomain,
  AcademicStructurePayload,
  AcademicStructureResult,
} from "../../../types/admin";
import type {
  AboutPage,
  LoginContent,
  DirectorMessage,
  HomeSlide,
  HomeSlideInput,
  NewsInput,
  NewsItem,
  SlidePlacement,
} from "../../../types/site.types";

const BASE = "/admin";

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: unknown;
}

export const adminApi = {
  // A topic with no group: the students reach it through a group request.
  createTopic: (data: unknown) =>
    client
      .post<{ topic: AdminTopic }>(`${BASE}/topics`, data)
      .then((r) => r.data.topic),

  createAssignedTopic: (data: unknown) =>
    client
      .post<{ topic: AdminTopic }>(`${BASE}/topics/assigned`, data)
      .then((r) => r.data.topic),

  updateAssignedTopic: (id: string, data: unknown) =>
    client
      .patch<{ topic: AdminTopic }>(`${BASE}/topics/${id}/assignment`, data)
      .then((r) => r.data.topic),

  // ── Stats ──
  getStats: () =>
    client
      .get<{ stats: OverviewStats }>(`${BASE}/stats/overview`)
      .then((r) => r.data.stats),

  // ── Dashboard ──
  getDashboard: () =>
    client.get<AdminDashboard>(`${BASE}/dashboard`).then((r) => r.data),

  // ── Users ──
  listUsers: (params?: ListParams) =>
    client
      .get<Paginated<UserLite>>(`${BASE}/users`, { params })
      .then((r) => r.data),
  getUser: (id: string) =>
    client
      .get<{ user: UserDetail }>(`${BASE}/users/${id}`)
      .then((r) => r.data.user),
  createUser: (data: unknown) =>
    client
      .post<{ user: UserLite }>(`${BASE}/users`, data)
      .then((r) => r.data.user),
  updateUser: (id: string, data: unknown) =>
    client
      .patch<{ user: UserLite }>(`${BASE}/users/${id}`, data)
      .then((r) => r.data.user),
  setUserStatus: (id: string, status: "active" | "suspended") =>
    client.patch(`${BASE}/users/${id}/status`, { status }).then((r) => r.data),
  setUserVerification: (id: string, isVerified: boolean) =>
    client
      .patch(`${BASE}/users/${id}/verification`, { isVerified })
      .then((r) => r.data),
  resetUserPassword: (id: string, password: string) =>
    client
      .post(`${BASE}/users/${id}/reset-password`, { password })
      .then((r) => r.data),
  deleteUser: (id: string) =>
    client.delete(`${BASE}/users/${id}`).then((r) => r.data),

  // ── Students ──
  listStudents: (params?: ListParams) =>
    client
      .get<Paginated<Student>>(`${BASE}/students`, { params })
      .then((r) => r.data),
  getStudent: (id: string) =>
    client
      .get<{ student: Student }>(`${BASE}/students/${id}`)
      .then((r) => r.data.student),
  createStudent: (data: unknown) =>
    client
      .post<{ student: Student }>(`${BASE}/students`, data)
      .then((r) => r.data.student),
  updateStudent: (id: string, data: unknown) =>
    client
      .patch<{ student: Student }>(`${BASE}/students/${id}`, data)
      .then((r) => r.data.student),
  deleteStudent: (id: string) =>
    client.delete(`${BASE}/students/${id}`).then((r) => r.data),

  // ── Professors ──

  // ── استيراد الطلبة من Excel ──
  /** قوائم الطلبة بفلاتر الصفحة — ملفّ Excel (ورقةٌ لكلّ تخصص أو ورقةٌ واحدة). */
  exportStudents: (params: Record<string, string | undefined>) =>
    client
      .get<Blob>(`${BASE}/students/export`, { params, responseType: "blob" })
      .then((r) => r.data),
  studentImportTemplate: () =>
    client
      .get<Blob>(`${BASE}/students/import/template`, { responseType: "blob" })
      .then((r) => r.data),
  previewStudentImport: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file); // "file" لمطابقة xlsxFileUpload
    const r = await client.post<StudentImportPreview>(
      `${BASE}/students/import/preview`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return r.data;
  },
  importStudents: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await client.post<StudentImportResult>(`${BASE}/students/import`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
      // دفعةٌ كبيرة تُجزَّأ كلماتُ مرورها وتُكتب في معاملةٍ واحدة — دقيقةٌ لا ثوانٍ.
      timeout: 5 * 60 * 1000,
    });
    return r.data;
  },
  professorImportTemplate: () =>
    client
      .get<Blob>(`${BASE}/professors/import/template`, { responseType: "blob" })
      .then((r) => r.data),
  previewProfessorImport: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file); // "file" لمطابقة xlsxFileUpload
    const r = await client.post<StudentImportPreview>(`${BASE}/professors/import/preview`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data;
  },
  importProfessors: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await client.post<ProfessorImportResult>(`${BASE}/professors/import`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 5 * 60 * 1000,
    });
    return r.data;
  },

  uploadImage: async (file: File) => {
    const fd = new FormData();
    fd.append("image", file); // "image" لمطابقة cardUpload.single("image")
    const r = await client.post<{ url: string }>(`${BASE}/uploads/image`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data.url;
  },

  listProfessors: (params?: ListParams) =>
    client
      .get<Paginated<Professor>>(`${BASE}/professors`, { params })
      .then((r) => r.data),
  getProfessor: (id: string) =>
    client
      .get<{ professor: Professor }>(`${BASE}/professors/${id}`)
      .then((r) => r.data.professor),
  createProfessor: (data: unknown) =>
    client
      .post<{ professor: Professor }>(`${BASE}/professors`, data)
      .then((r) => r.data.professor),
  updateProfessor: (id: string, data: unknown) =>
    client
      .patch<{ professor: Professor }>(`${BASE}/professors/${id}`, data)
      .then((r) => r.data.professor),
  deleteProfessor: (id: string) =>
    client.delete(`${BASE}/professors/${id}`).then((r) => r.data),

  // ── Faculties ──
  listFaculties: () =>
    client
      .get<{ faculties: Faculty[] }>(`${BASE}/faculties`)
      .then((r) => r.data.faculties),
  createFaculty: (data: unknown) =>
    client
      .post<{ faculty: Faculty }>(`${BASE}/faculties`, data)
      .then((r) => r.data.faculty),
  updateFaculty: (id: string, data: unknown) =>
    client
      .patch<{ faculty: Faculty }>(`${BASE}/faculties/${id}`, data)
      .then((r) => r.data.faculty),
  deleteFaculty: (id: string) =>
    client.delete(`${BASE}/faculties/${id}`).then((r) => r.data),

  // ── Departments ──
  listDepartments: () =>
    client
      .get<{ departments: Department[] }>(`${BASE}/departments`)
      .then((r) => r.data.departments),
  createDepartment: (data: unknown) =>
    client
      .post<{ department: Department }>(`${BASE}/departments`, data)
      .then((r) => r.data.department),
  updateDepartment: (id: string, data: unknown) =>
    client
      .patch<{ department: Department }>(`${BASE}/departments/${id}`, data)
      .then((r) => r.data.department),
  deleteDepartment: (id: string) =>
    client.delete(`${BASE}/departments/${id}`).then((r) => r.data),

  // ── Specializations ──
  listSpecializations: () =>
    client
      .get<{ specializations: Specialization[] }>(`${BASE}/specializations`)
      .then((r) => r.data.specializations),
  createSpecialization: (data: unknown) =>
    client
      .post<{ specialization: Specialization }>(`${BASE}/specializations`, data)
      .then((r) => r.data.specialization),
  updateSpecialization: (id: string, data: unknown) =>
    client
      .patch<{
        specialization: Specialization;
      }>(`${BASE}/specializations/${id}`, data)
      .then((r) => r.data.specialization),
  deleteSpecialization: (id: string) =>
    client.delete(`${BASE}/specializations/${id}`).then((r) => r.data),

  // ── Domains (الميادين) ──
  listDomains: (departmentId?: string) =>
    client
      .get<{ domains: Domain[] }>(`${BASE}/domains`, {
        params: departmentId ? { departmentId } : undefined,
      })
      .then((r) => r.data.domains),
  createDomain: (data: unknown) =>
    client
      .post<{ domain: Domain }>(`${BASE}/domains`, data)
      .then((r) => r.data.domain),
  updateDomain: (id: string, data: unknown) =>
    client
      .patch<{ domain: Domain }>(`${BASE}/domains/${id}`, data)
      .then((r) => r.data.domain),
  deleteDomain: (id: string) =>
    client.delete(`${BASE}/domains/${id}`).then((r) => r.data),

  // ── Filieres ──

  listFilieresByDomain: (domainId?: string) =>
    client
      .get<{ filieres: Filiere[] }>(`${BASE}/filieres`, {
        params: domainId ? { domainId } : undefined,
      })
      .then((r) => r.data.filieres),
  createFiliere: (data: unknown) =>
    client
      .post<{ filiere: Filiere }>(`${BASE}/filieres`, data)
      .then((r) => r.data.filiere),
  updateFiliere: (id: string, data: unknown) =>
    client
      .patch<{ filiere: Filiere }>(`${BASE}/filieres/${id}`, data)
      .then((r) => r.data.filiere),
  deleteFiliere: (id: string) =>
    client.delete(`${BASE}/filieres/${id}`).then((r) => r.data),

  listFilieres: (departmentId?: string) =>
    client
      .get<{ filieres: Filiere[] }>(`${BASE}/filieres`, {
        // ← /admin/filieres
        params: departmentId ? { departmentId } : undefined,
      })
      .then((r) => r.data.filieres),

  // ── Academic Years ──
  listAcademicYears: () =>
    client
      .get<{ academicYears: AcademicYear[] }>(`${BASE}/academic-years`)
      .then((r) => r.data.academicYears),
  createAcademicYear: (data: unknown) =>
    client
      .post<{ academicYear: AcademicYear }>(`${BASE}/academic-years`, data)
      .then((r) => r.data.academicYear),
  updateAcademicYear: (id: string, data: unknown) =>
    client
      .patch<{
        academicYear: AcademicYear;
      }>(`${BASE}/academic-years/${id}`, data)
      .then((r) => r.data.academicYear),
  activateAcademicYear: (id: string) =>
    client
      .patch<{
        academicYear: AcademicYear;
      }>(`${BASE}/academic-years/${id}/activate`)
      .then((r) => r.data.academicYear),
  deleteAcademicYear: (id: string) =>
    client.delete(`${BASE}/academic-years/${id}`).then((r) => r.data),

  // ── The archive ──
  listArchiveYears: () =>
    client
      .get<{ items: ArchiveYear[] }>(`${BASE}/archive/years`)
      .then((r) => r.data.items),
  getYearRecord: (id: string) =>
    client
      .get<YearRecordResponse>(`${BASE}/archive/years/${id}`)
      .then((r) => r.data),
  getYearReadiness: (id: string) =>
    client
      .get<YearReadiness>(`${BASE}/archive/years/${id}/readiness`)
      .then((r) => r.data),
  closeYear: (
    id: string,
    data: { confirmTitle: string; note?: string; nextYearId?: string; nextYearTitle?: string },
  ) =>
    client
      .post<{ archived: true; activeYearId: string | null }>(`${BASE}/archive/years/${id}/close`, data)
      .then((r) => r.data),
  reopenYear: (id: string, data: { activate?: boolean }) =>
    client
      .post<{ reopened: true; active: boolean }>(`${BASE}/archive/years/${id}/reopen`, data)
      .then((r) => r.data),

  // ── Topics ──
  /** The memoir titles of a scope, grouped by specialization — before or after assignment. */
  topicTitlesList: (params: TitlesListParams) =>
    client.get<TopicTitlesList>(`${BASE}/topics/titles-list`, { params }).then((r) => r.data),
  listTopics: (params?: ListParams) =>
    client
      .get<Paginated<AdminTopic>>(`${BASE}/topics`, { params })
      .then((r) => r.data),
  getTopic: (id: string) =>
    client
      .get<{ topic: AdminTopic }>(`${BASE}/topics/${id}`)
      .then((r) => r.data.topic),
  approveTopic: (id: string) =>
    client.patch(`${BASE}/topics/${id}/approve`).then((r) => r.data),
  rejectTopic: (id: string, reason?: string) =>
    client.patch(`${BASE}/topics/${id}/reject`, { reason }).then((r) => r.data),
  archiveTopic: (id: string) =>
    client.patch(`${BASE}/topics/${id}/archive`).then((r) => r.data),
  publishTopic: (id: string) =>
    client.patch(`${BASE}/topics/${id}/publish`).then((r) => r.data),
  unpublishTopic: (id: string) =>
    client.patch(`${BASE}/topics/${id}/unpublish`).then((r) => r.data),
  deleteTopic: (id: string) =>
    client.delete(`${BASE}/topics/${id}`).then((r) => r.data),
  unarchiveTopic: (id: string) =>
    client.patch(`${BASE}/topics/${id}/unarchive`).then((r) => r.data),

  // ── Milestones (administration side) ──
  listMilestones: (groupId: string, params?: ListParams) =>
    client
      .get<{ milestones: unknown[] }>(`${BASE}/projects/${groupId}/milestones`, {
        params,
      })
      .then((r) => r.data.milestones),

  createMilestone: (groupId: string, data: unknown) =>
    client
      .post<{ milestone: unknown }>(
        `${BASE}/projects/${groupId}/milestones`,
        data,
      )
      .then((r) => r.data.milestone),

  updateMilestone: (id: string, data: unknown) =>
    client
      .patch<{ milestone: unknown }>(`${BASE}/milestones/${id}`, data)
      .then((r) => r.data.milestone),

  deleteMilestone: (id: string) =>
    client.delete(`${BASE}/milestones/${id}`).then((r) => r.data),


  // ── Group Requests ──

  removeGroupRequestMember: (requestId: string, studentId: string) =>
    client
      .delete(`${BASE}/group-requests/${requestId}/members/${studentId}`)
      .then((r) => r.data),
  setGroupRequestLeader: (requestId: string, studentId: string) =>
    client
      .patch(`${BASE}/group-requests/${requestId}/leader/${studentId}`)
      .then((r) => r.data),

  listGroupRequests: (params?: ListParams) =>
    client
      .get<Paginated<AdminGroupRequest>>(`${BASE}/group-requests`, { params })
      .then((r) => r.data),
  getGroupRequest: (id: string) =>
    client
      .get<{ groupRequest: AdminGroupRequest }>(`${BASE}/group-requests/${id}`)
      .then((r) => r.data.groupRequest),
  acceptGroupRequest: (id: string) =>
    client.patch(`${BASE}/group-requests/${id}/accept`).then((r) => r.data),
  rejectGroupRequest: (id: string, reason?: string) =>
    client
      .patch(`${BASE}/group-requests/${id}/reject`, { reason })
      .then((r) => r.data),
  /** حذفُ سطرٍ منتهٍ من السجلّ — للمرفوض وحده، والحارسُ في الخادم. */
  deleteGroupRequest: (id: string) =>
    client.delete(`${BASE}/group-requests/${id}`).then((r) => r.data),

  // ── Projects ──
  listProjects: (params?: ListParams) =>
    client
      .get<Paginated<AdminProject>>(`${BASE}/projects`, { params })
      .then((r) => r.data),
  getProject: (id: string) =>
    client
      .get<{ project: AdminProject }>(`${BASE}/projects/${id}`)
      .then((r) => r.data.project),
  changeSupervisor: (id: string, professorId: string) =>
    client
      .patch(`${BASE}/projects/${id}/supervisor`, { professorId })
      .then((r) => r.data),
  assignStudent: (id: string, studentId: string) =>
    client
      .post(`${BASE}/projects/${id}/assign`, { studentId })
      .then((r) => r.data),
  removeProjectMember: (groupId: string, studentId: string) =>
    client
      .delete(`${BASE}/projects/${groupId}/members/${studentId}`)
      .then((r) => r.data),
  setProjectLeader: (groupId: string, studentId: string) =>
    client
      .patch(`${BASE}/projects/${groupId}/leader/${studentId}`)
      .then((r) => r.data),
  // فسخ المشروع كلّه. الخادم يرفض إن كان عليه تسليمات أو مناقشة، ويردّ
  // برسالة تقول ما الذي يمنع — فتُعرض كما هي بدل نصّ عام.
  dissolveProject: (groupId: string, reason?: string) =>
    client
      .delete(`${BASE}/projects/${groupId}`, {
        data: reason ? { reason } : {},
      })
      .then((r) => r.data),

  // ── Academic structure wizard (whole tree in one transaction) ──
  createAcademicStructure: (payload: AcademicStructurePayload) =>
    client
      .post<AcademicStructureResult>(`${BASE}/academic-structure`, payload)
      .then((r) => r.data),

  // ── University email domains ──
  listUniversityDomains: () =>
    client
      .get<{ domains: UniversityDomain[] }>(`${BASE}/university-domains`)
      .then((r) => r.data.domains),
  createUniversityDomain: (domain: string) =>
    client
      .post<{ domain: UniversityDomain }>(`${BASE}/university-domains`, {
        domain,
      })
      .then((r) => r.data.domain),
  setDefaultUniversityDomain: (id: string) =>
    client
      .patch(`${BASE}/university-domains/${id}/default`)
      .then((r) => r.data),
  deleteUniversityDomain: (id: string) =>
    client.delete(`${BASE}/university-domains/${id}`).then((r) => r.data),

  // ── Defenses ──
  defenseConflicts: (params: {
    date: string;
    durationMinutes?: number;
    room?: string;
    professorIds?: string;
    excludeId?: string;
  }) =>
    client
      .get<DefenseClashes>(`${BASE}/defenses/conflicts`, { params })
      .then((r) => r.data),
  getDefense: (id: string) =>
    // The details payload is far wider than the list row; its page reads it loosely.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.get<{ defense: any }>(`${BASE}/defenses/${id}`).then((r) => r.data.defense),
  listDefenses: (params?: ListParams) =>
    client
      .get<Paginated<AdminDefense> & { stats: DefenseStats }>(`${BASE}/defenses`, { params })
      .then((r) => r.data),
  createDefense: (data: unknown) =>
    client
      .post<{ defense: AdminDefense }>(`${BASE}/defenses`, data)
      .then((r) => r.data.defense),
  updateDefense: (id: string, data: unknown) =>
    client
      .patch<{ defense: AdminDefense }>(`${BASE}/defenses/${id}`, data)
      .then((r) => r.data.defense),
  deleteDefense: (id: string) =>
    client.delete(`${BASE}/defenses/${id}`).then((r) => r.data),

  // ── Home slides (صور الصفحة الرئيسية) ──
  listHomeSlides: (placement: SlidePlacement = "home") =>
    client
      .get<{ slides: HomeSlide[] }>(`${BASE}/home-slides`, { params: { placement } })
      .then((r) => r.data.slides),
  createHomeSlides: (data: {
    slides: { imageUrl: string; caption?: string | null }[];
    isActive?: boolean;
    placement: SlidePlacement;
  }) =>
    client
      .post<{ slides: HomeSlide[] }>(`${BASE}/home-slides/batch`, data)
      .then((r) => r.data.slides),
  updateHomeSlide: (id: string, data: Partial<HomeSlideInput>) =>
    client
      .patch<{ slide: HomeSlide }>(`${BASE}/home-slides/${id}`, data)
      .then((r) => r.data.slide),
  reorderHomeSlides: (ids: string[], placement: SlidePlacement) =>
    client
      .patch<{ slides: HomeSlide[] }>(`${BASE}/home-slides/order`, { ids, placement })
      .then((r) => r.data.slides),
  deleteHomeSlide: (id: string) =>
    client.delete(`${BASE}/home-slides/${id}`).then((r) => r.data),

  // ── آخر الأخبار ──
  listNews: () =>
    client.get<{ news: NewsItem[] }>(`${BASE}/news`).then((r) => r.data.news),
  createNews: (data: NewsInput) =>
    client.post<{ item: NewsItem }>(`${BASE}/news`, data).then((r) => r.data.item),
  updateNews: (id: string, data: Partial<NewsInput>) =>
    client.patch<{ item: NewsItem }>(`${BASE}/news/${id}`, data).then((r) => r.data.item),
  deleteNews: (id: string) =>
    client.delete(`${BASE}/news/${id}`).then((r) => r.data),

  // ── كلمة رئيس القسم ──
  getDirectorMessage: () =>
    client
      .get<{ director: DirectorMessage | null }>(`${BASE}/director-message`)
      .then((r) => r.data.director),
  saveDirectorMessage: (data: DirectorMessage) =>
    client
      .put<{ director: DirectorMessage }>(`${BASE}/director-message`, data)
      .then((r) => r.data.director),

  // ── صفحة «عن المنصة» ──
  getAboutPage: () =>
    client
      .get<{ content: AboutPage | null }>(`${BASE}/about-page`)
      .then((r) => r.data.content),
  saveAboutPage: (data: AboutPage) =>
    client
      .put<{ content: AboutPage }>(`${BASE}/about-page`, data)
      .then((r) => r.data.content),

  // ── لوحة الترحيب في صفحة الدخول ──
  getLoginPage: () =>
    client
      .get<{ content: LoginContent | null }>(`${BASE}/login-page`)
      .then((r) => r.data.content),
  saveLoginPage: (data: LoginContent) =>
    client
      .put<{ content: LoginContent }>(`${BASE}/login-page`, data)
      .then((r) => r.data.content),
};
