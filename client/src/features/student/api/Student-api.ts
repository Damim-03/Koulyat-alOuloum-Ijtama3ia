import { client } from "../../../lib/api/client";
import type {
  BrowseTopic,
  StudentApplication,
  StudentProject,
  StudentMilestone,
  ProjectFile,
  Meeting,
  OfficeHours,
  DefenseSession,
} from "../../../types/student.types";

/**
 * ============================================================
 *  STUDENT API
 * ------------------------------------------------------------
 *  Backend module not built yet. Each function returns MOCK
 *  data for now. To wire the real backend later, uncomment the
 *  `client` call and delete the `return mock...` line.
 *  Base path expected: /api/student
 * ============================================================
 */

//const BASE = "/student";

// small helper to simulate network latency for mock calls
const delay = <T>(data: T, ms = 350): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ─── BROWSE TOPICS ─────────────────────────────────────────────
export const studentApi = {
  // GET /student/topics  → open topics with seats + professor + specialization
  async getTopics(): Promise<BrowseTopic[]> {
    // TODO(backend): const { data } = await client.get(`${BASE}/topics`); return data;
    return delay(mockTopics);
  },

  // POST /student/applications { topicId, priority }
  async apply(payload: { topicId: string; priority: number }): Promise<void> {
    // TODO(backend): await client.post(`${BASE}/applications`, payload);
    void payload;
    return delay(undefined);
  },

  // DELETE /student/applications/:id
  async cancelApplication(id: string): Promise<void> {
    // TODO(backend): await client.delete(`${BASE}/applications/${id}`);
    void id;
    return delay(undefined);
  },

  // GET /student/applications → current student's applications
  async getApplications(): Promise<StudentApplication[]> {
    // TODO(backend): const { data } = await client.get(`${BASE}/applications`); return data;
    return delay(mockApplications);
  },

  // ─── MY PROJECT ──────────────────────────────────────────────
  // GET /student/project → group + topic + supervisor + members + progress
  async getProject(): Promise<StudentProject | null> {
    // TODO(backend): const { data } = await client.get(`${BASE}/project`); return data;
    return delay(mockProject);
  },

  // GET /student/project/milestones
  async getMilestones(): Promise<StudentMilestone[]> {
    // TODO(backend): const { data } = await client.get(`${BASE}/project/milestones`); return data;
    return delay(mockMilestones);
  },

  // ─── FILES ───────────────────────────────────────────────────
  // GET /student/project/files
  async getFiles(): Promise<ProjectFile[]> {
    // TODO(backend): const { data } = await client.get(`${BASE}/project/files`); return data;
    return delay(mockFiles);
  },

  // POST /student/project/files (multipart) — upload submission
  async uploadFile(file: File): Promise<void> {
    // TODO(backend):
    // const fd = new FormData(); fd.append("file", file);
    // await client.post(`${BASE}/project/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    void file;
    return delay(undefined);
  },

  // ─── MEETINGS ────────────────────────────────────────────────
  // GET /student/project/meetings
  async getMeetings(): Promise<{ meetings: Meeting[]; officeHours: OfficeHours[] }> {
    // TODO(backend): const { data } = await client.get(`${BASE}/project/meetings`); return data;
    return delay({ meetings: mockMeetings, officeHours: mockOfficeHours });
  },

  // POST /student/project/meetings — request a meeting
  async requestMeeting(payload: {
    subject: string;
    date: string;
    duration: string;
    mode: "in_person" | "online";
    note?: string;
  }): Promise<void> {
    // TODO(backend): await client.post(`${BASE}/project/meetings`, payload);
    void payload;
    return delay(undefined);
  },

  // ─── DEFENSE ─────────────────────────────────────────────────
  // GET /student/project/defense
  async getDefense(): Promise<DefenseSession | null> {
    // TODO(backend): const { data } = await client.get(`${BASE}/project/defense`); return data;
    return delay(mockDefense);
  },
};

// keep `client` import referenced so it's not flagged unused before wiring
void client;

/* ============================================================
 *  MOCK DATA  (delete once backend is wired)
 * ============================================================ */

const mockTopics: BrowseTopic[] = [
  {
    id: "t1",
    title: "تحليل سلوك المستخدم في منصات التعلم الإلكتروني",
    description:
      "دراسة تحليلية لتفاعل الطلاب مع منصات التعلم عن بُعد واستخراج أنماط الاستخدام.",
    status: "open",
    maxStudents: 4,
    takenSeats: 4,
    professor: { id: "p1", title: "أ.د عمر عبدالله", user: { firstName: "عمر", lastName: "عبدالله" } },
    specialization: { id: "s1", name: "نظم المعلومات", level: "master" },
    hasApplied: false,
  },
  {
    id: "t2",
    title: "منصة لامركزية لإدارة الشهادات الأكاديمية باستخدام البلوكشين",
    description:
      "تصميم منصة موثوقة لإصدار والتحقق من الشهادات الجامعية عبر تقنية سلسلة الكتل.",
    status: "open",
    maxStudents: 5,
    takenSeats: 2,
    professor: { id: "p2", title: "د. سارة خالد", user: { firstName: "سارة", lastName: "خالد" } },
    specialization: { id: "s2", name: "أمن المعلومات", level: "master" },
    hasApplied: false,
  },
  {
    id: "t3",
    title: "تطوير نظام ذكي لتحليل البيانات الطبية باستخدام التعلّم العميق",
    description:
      "بناء نموذج تعلّم عميق لتحليل السجلات الطبية ودعم اتخاذ القرار التشخيصي.",
    status: "open",
    maxStudents: 5,
    takenSeats: 1,
    professor: { id: "p3", title: "د. أحمد محمد", user: { firstName: "أحمد", lastName: "محمد" } },
    specialization: { id: "s3", name: "ذكاء اصطناعي", level: "master" },
    hasApplied: false,
  },
  {
    id: "t4",
    title: "تحسين خوارزميات التشفير لأجهزة إنترنت الأشياء",
    description:
      "بحث وتطوير طرق تشفير خفيفة الوزن مناسبة للأجهزة محدودة الموارد في بيئة إنترنت الأشياء.",
    status: "open",
    maxStudents: 3,
    takenSeats: 1,
    professor: { id: "p4", title: "د. خالد السعيد", user: { firstName: "خالد", lastName: "السعيد" } },
    specialization: { id: "s2", name: "أمن المعلومات", level: "master" },
    hasApplied: true,
  },
];

const mockApplications: StudentApplication[] = [
  {
    id: "a1",
    topicId: "t4",
    status: "pending",
    priority: 1,
    topic: { id: "t4", title: "تحسين خوارزميات التشفير لأجهزة إنترنت الأشياء" },
    createdAt: new Date().toISOString(),
  },
];

const mockProject: StudentProject = {
  id: "g1",
  topic: {
    id: "tx",
    title: "نظام إدارة وتحليل البيانات الطبية الذكي",
    description:
      "مشروع تخرّج يهدف إلى توظيف تقنيات الذكاء الاصطناعي لتحليل سجلات المرضى وتقديم توصيات استباقية للطاقم الطبي، مما يسهم في تقليل الأخطاء الطبية وتسريع عملية التشخيص.",
  },
  supervisor: {
    id: "p3",
    title: "أستاذ مشارك · قسم علوم الحاسب",
    user: { firstName: "أحمد", lastName: "عبدالرحمن" },
  },
  members: [
    { id: "m1", registrationNumber: "20200001", user: { firstName: "عمر", lastName: "محمود" }, role: "قائد المشروع" },
    { id: "m2", registrationNumber: "20200002", user: { firstName: "سارة", lastName: "خالد" }, role: "عضو" },
    { id: "m3", registrationNumber: "20200003", user: { firstName: "يوسف", lastName: "بلال" }, role: "عضو" },
  ],
  progress: 65,
  stats: { monthsTotal: 18, monthsElapsed: 12, meetings: 4, defenseStatus: "ممتازة" },
};

const mockMilestones: StudentMilestone[] = [
  { id: "ms1", title: "خطة البحث", description: "تعريف وصياغة خطة المشروع الأولية وتحديد المنهجية.", deadline: "2023-10-10", status: "completed", order: 1 },
  { id: "ms2", title: "الفصل 1-1", description: "إنجاز الإطار النظري ومراجعة الأدبيات والمنهجية المتبعة.", deadline: "2023-12-10", status: "completed", order: 2 },
  { id: "ms3", title: "الدراسة الميدانية", description: "جمع البيانات من عينة الدراسة وتحليل النتائج الأولية.", deadline: "2024-03-26", status: "in_progress", order: 3 },
  { id: "ms4", title: "السيرة الأولى", description: "", deadline: "2024-05-10", status: "pending", order: 4 },
  { id: "ms5", title: "التسليم النهائي", description: "", deadline: "2024-06-10", status: "pending", order: 5 },
  { id: "ms6", title: "المناقشة", description: "", deadline: "2024-06-25", status: "pending", order: 6 },
];

const mockFiles: ProjectFile[] = [
  {
    id: "f1",
    name: "مسودة_المقدمة_النهائية.pdf",
    type: "pdf",
    sizeMB: 2.4,
    version: 3,
    status: "submitted",
    updatedAt: "2023-10-12",
    comments: [
      {
        id: "c1",
        authorName: "د. سارة محمود (المشرفة)",
        authorRole: "المشرفة",
        body: "يرجى إضافة المزيد من المصادر الحديثة (بعد 2020) في القسم الثاني لدعم فرضيتك بشكل أقوى.",
        createdAt: "04:30",
      },
    ],
  },
  {
    id: "f2",
    name: "مراجعة_الأدبيات_v2.docx",
    type: "docx",
    sizeMB: 1.1,
    version: 2,
    status: "draft",
    updatedAt: "10:30",
    comments: [],
  },
];

const mockMeetings: Meeting[] = [
  {
    id: "mt1",
    title: "مراجعة الفصل الأول: منهجية البحث",
    date: "2024-06-24",
    startTime: "13:30",
    endTime: "14:30",
    location: "مكتب 402، مبنى الهندسة",
    mode: "online",
    status: "upcoming",
    note: "أ. أحمد محمود (المشرف)",
  },
];

const mockOfficeHours: OfficeHours[] = [
  { day: "الاثنين", from: "10:00", to: "12:00" },
  { day: "الأربعاء", from: "13:00", to: "14:00" },
  { day: "الخميس", from: "11:00", to: "13:00" },
];

const mockDefense: DefenseSession = {
  id: "d1",
  type: "جلسة المناقشة الحضورية",
  date: "2024-05-15",
  startTime: "10:00",
  endTime: "11:30",
  location: "قاعة المؤتمرات الرئيسية (مبنى أ)، الطابق الثاني",
  committee: [
    { id: "cm1", name: "أ.د أحمد محمود", role: "رئيس اللجنة" },
    { id: "cm2", name: "د. سارة عبدالرحمن", role: "مشرف" },
    { id: "cm3", name: "د. خالد العتيبي", role: "ممتحن" },
  ],
  checklist: [
    { id: "ck1", label: "تسليم النسخة النهائية من التقرير", done: true },
    { id: "ck2", label: "مراجعة النسخة من المشرف", done: true },
    { id: "ck3", label: "رفع التقرير النهائي (PDF)", done: false },
    { id: "ck4", label: "تسليم النسخ المطبوعة للمكتبة", done: false },
  ],
};
