/**
 * خادمٌ مزيّف للواجهة كلّها — محوِّل axios يجيب كلّ مسارٍ في طبقة الـAPI.
 *
 * لا محاكاة لدوالّ الـAPI ولا للخطّافات: الطلب يخرج من الشيفرة الحقيقية كما
 * يخرج في المتصفّح، ويصل هنا بطريقته ومساره وجسمه، فيُسجَّل ويُجاب ببيانات
 * `fixtures`. فالاختبار يرى ما يراه المستخدم، ويسأل بعدها: أيّ طلبٍ أُرسل؟
 *
 *   fake.calls          — كلّ طلبٍ بطريقته ومساره ومعاملاته وجسمه.
 *   fake.on(...)        — جوابٌ آخر لمسارٍ في اختبارٍ واحد.
 *   fake.fail(...)      — رفضٌ برمز ورسالة كما يرسلها الخادم.
 *   fake.empty = true   — القوائم كلّها فارغة: الشاشات في أوّل يومٍ لها.
 *   fake.unknown        — طلباتٌ لا مسار لها هنا؛ يجب أن تبقى فارغة.
 */
import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { client } from "../lib/api/client";
import { useAuthStore } from "../store/auth.store";
import * as F from "./fixtures";
import type { UserLite } from "../types/admin";
import type { AuthUser } from "../types/auth";
import { DEFAULT_SUPERVISION_TEMPLATE } from "../features/supervision/lib/sheet-template";

export type Method = "get" | "post" | "put" | "patch" | "delete";
export type Req = {
  method: Method;
  path: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
};
/** جوابٌ ثابت، أو دالّةٌ تبنيه من الطلب (فيُعرف نوع `req` داخلها). */
type Reply = ((req: Req) => unknown) | object | string | number | boolean | null;
type Route = { method: Method; pattern: RegExp; keys: string[]; reply: Reply };

const compile = (method: Method, path: string, reply: Reply): Route => {
  const keys: string[] = [];
  const source = path.replace(/:(\w+)/g, (_, k: string) => {
    keys.push(k);
    return "([^/]+)";
  });
  return { method, pattern: new RegExp(`^${source}/?$`), keys, reply };
};

/** من سجّل دخوله الآن — لـ/auth/me والحساب وصندوق الرسائل. */
const me = (): UserLite => {
  const id = useAuthStore.getState().user?.id;
  return F.allUsers.find((u) => u.id === id) ?? F.adminUser;
};

const state = { empty: false, accountWrites: 0, session: null as AuthUser | null };
/**
 * من دخل، كما يعرفه الخادم — لا كما يحفظه المتصفّح. تغيّره الكتابات (كلمة
 * المرور، التحقّق بخطوتين، الاسم) فيقرأ `/auth/me` بعدها ما صار، فتُرى
 * الشاشات التي تكتب في المتجر قبل جواب الخادم على حقيقتها.
 */
const session = (): AuthUser => state.session ?? useAuthStore.getState().user ?? F.authUsers.admin;
/** الحساب كما يقرؤه الخادم الآن — `updatedAt` يتقدّم مع كلّ كتابةٍ فيه. */
const account = (over: object = {}) => ({
  ...F.myAccount(session(), new Date(Date.parse("2026-10-01T10:00:00Z") + state.accountWrites * 1000).toISOString()),
  // Mail works here; an address is confirmed unless a test says otherwise.
  mailEnabled: true,
  emailVerified: false,
  ...over,
});
/** كتابةٌ في صفّ المستخدم: تُحسب، وتُغيّر ما يعرفه الخادم عنه، ثمّ يُجاب. */
const write = <T>(reply: (r: Req) => T, change: (r: Req) => Partial<AuthUser> = () => ({})) => (r: Req) => {
  state.accountWrites++;
  state.session = { ...session(), ...change(r) };
  return reply(r);
};
const signedIn = (who: keyof typeof F.authUsers) => () => {
  state.session = F.authUsers[who];
  return { message: "ok", user: F.authUsers[who], accessToken: `tok-${who}` };
};
const L = <T>(list: T[]): T[] => (state.empty ? [] : list);
const page = <T>(list: T[], req: Req) => ({
  items: L(list),
  total: L(list).length,
  page: Number(req.query.page ?? 1),
  limit: Number(req.query.limit ?? 20),
});
const byId = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id) ?? list[0]!;
/** بحثٌ نصّيّ كما يفعله الخادم تقريباً: في كلّ ما يُعرض من الصفّ. */
const hit = (item: unknown, q: unknown) => !q || JSON.stringify(item).includes(String(q));
/**
 * A name typed as the server takes it: each word somewhere in the first or last
 * name, in any order — or the whole term in the registration number.
 */
const nameOrNumber = (s: (typeof F.students)[number], q: unknown) => {
  const term = String(q ?? "").trim();
  if (!term) return true;
  const names = `${s.user!.firstName ?? ""} ${s.user!.lastName ?? ""}`;
  return s.registrationNumber.includes(term) || term.split(/\s+/).every((w) => names.includes(w));
};
/** الطلبة بفلاتر الصفحة والمنتقيات: بحثٌ سريع، ورقمٌ بعينه، وتخصّص، ومن لا مشروع له. */
const studentsFor = (q: Record<string, unknown>) =>
  F.students.filter(
    (s) =>
      nameOrNumber(s, q.quickSearch) &&
      (!q.specializationId || s.specialization?.id === q.specializationId) &&
      hit(s, q.search) &&
      (!q.registrationNumber || s.registrationNumber === q.registrationNumber) &&
      (q.unassigned !== "true" || !F.project.members.some((m) => m.student.id === s.id)),
  );
const ok = { message: "ok" };
const echo = (key: string, base: object) => (req: Req) => ({ [key]: { ...base, ...(req.body as object) } });
const blob = () => new Blob(["xlsx"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

const importReport = {
  report: {
    fileErrors: [],
    fileWarnings: [],
    file: { sheetName: "الطلبة", headerRow: 1, otherSheets: [], ignored: [] },
    columns: [
      { key: "registrationNumber", header: "رقم التسجيل", kind: "req", group: "academic", letter: "A" },
      { key: "lastName", header: "اللقب", kind: "req", group: "personal", letter: "B" },
      { key: "password", header: "كلمة المرور", kind: "auto", group: "personal", letter: null },
    ],
    rows: [
      {
        row: 2,
        cells: {
          registrationNumber: { value: "202039012399", state: "ok" },
          lastName: { value: "بلقاسم", state: "ok" },
          password: { value: "", saved: "••••••", state: "auto" },
        },
        errors: 0,
        warnings: 0,
      },
      {
        row: 3,
        cells: {
          registrationNumber: { value: "12", state: "error", issues: [{ level: "error", message: "رقم التسجيل قصير" }] },
          lastName: { value: "", state: "warning", issues: [{ level: "warning", message: "اللقب فارغ" }] },
          password: { value: "", state: "auto" },
        },
        errors: 1,
        warnings: 1,
      },
    ],
    summary: { total: 2, valid: 1, invalid: 1, warned: 1 },
  },
};

const ROUTES: Route[] = (
  [
    // ── الدخول ──
    ["post", "/auth/student/login", signedIn("student")],
    ["post", "/auth/professor/login", signedIn("professor")],
    ["post", "/auth/admin/login", signedIn("admin")],
    ["post", "/auth/admin/login/2fa", signedIn("admin")],
    // تحقّق الدخول بدرجة الصورة: تحدٍّ بصورته، والرمز الصحيح «23456» يعطي تصريحاً.
    [
      "get",
      "/auth/challenge",
      () => ({
        parameters: { algorithm: "PBKDF2/SHA-256", nonce: "n", salt: "s", cost: 1, keyPrefix: "00" },
        signature: "sig",
        codeChallenge: { image: "data:image/svg+xml;base64,PHN2Zy8+", length: 5 },
      }),
    ],
    [
      "post",
      "/auth/challenge/verify",
      (r) =>
        (r.body as { code?: string }).code === "23456"
          ? { verified: true, payload: "PASS-1" }
          : { verified: false, reason: "الرمز لا يطابق الصورة — أعد التحقّق برمزٍ جديد." },
    ],
    ["get", "/auth/me", () => ({ user: session() })],
    ["post", "/auth/logout", ok],
    ["post", "/auth/logout-all", ok],
    // Links sent by email: this server sends mail, and every link is good.
    ["get", "/auth/password/available", { available: true }],
    ["post", "/auth/password/forgot", { message: "إن كان لهذا الحساب بريدٌ مؤكَّد، فقد أرسلنا إليه رابطاً." }],
    ["post", "/auth/password/reset/check", { valid: true }],
    ["post", "/auth/password/reset", { message: "تغيّرت كلمة مرورك. سجّل الدخول بها الآن." }],
    ["post", "/auth/email/verify", { message: "تأكّد بريدك." }],
    // «نسيت كلمة المرور» عبر الإدارة: الرقم لطالبٍ له بريدٌ مؤكَّد — إلّا ما أراده الاختبار.
    ["post", "/auth/password/student", { found: true, via: "email" }],
    ["post", "/auth/password/request", { token: "T".repeat(43), status: "pending", sentAt: "2026-11-20T09:00:00.000Z" }],
    ["post", "/auth/password/request/status", { status: "pending", sentAt: "2026-11-20T09:00:00.000Z" }],
    ["post", "/auth/password/request/close", { status: "none" }],

    // ── الحساب ──
    ["get", "/account", () => ({ account: account() })],
    ["post", "/account/email/verify-request", { message: "أرسلنا رابط التأكيد إلى بريدك." }],
    ["patch", "/account", write((r: Req) => ({ account: account(r.body as object) }), (r) => r.body as Partial<AuthUser>)],
    ["post", "/account/avatar", write(() => ({ account: account({ avatarUrl: "/uploads/avatars/me.jpg" }) }), () => ({ avatarUrl: "/uploads/avatars/me.jpg" }))],
    // The address saved, not proven yet — and the link that proves it sent, as the server does.
    [
      "post",
      "/account/email",
      write(
        (r: Req) => ({ account: account({ email: (r.body as { email: string }).email, emailVerified: false }), verification: "sent" }),
        (r) => ({ email: (r.body as { email: string }).email }),
      ),
    ],
    // The password chosen: with activation on, its first stage done too (the server reads both from the one column).
    ["post", "/account/password", write(() => ({ accessToken: "tok-new" }), () => ({ mustChangePassword: false, activationRequired: false }))],
    // التفعيل بالصور: لا طلب بعد؛ والإرسال يجعله قيد المراجعة.
    ["get", "/account/activation-request", { status: "none" }],
    ["post", "/account/activation-request", { status: "pending", sentAt: "2026-11-01T09:00:00.000Z" }],
    ["get", "/account/sessions", () => ({ sessions: L(F.sessions) })],
    ["delete", "/account/sessions/:id", ok],
    ["post", "/account/2fa/setup", { secret: "JBSWY3DPEHPK3PXP", otpauthUrl: "otpauth://totp/Mudhakkarati:admin?secret=JBSWY3DPEHPK3PXP", account: "admin@univ-msila.dz" }],
    ["post", "/account/2fa/enable", write(() => ({ recoveryCodes: ["aaaa-bbbb", "cccc-dddd", "eeee-ffff", "gggg-hhhh"] }), () => ({ twoFactorEnabled: true, twoFactorSetupRequired: false }))],
    ["post", "/account/2fa/disable", write(() => ok, () => ({ twoFactorEnabled: false, twoFactorSetupRequired: true }))],
    ["post", "/account/2fa/recovery-codes", write(() => ({ recoveryCodes: ["iiii-jjjj", "kkkk-llll"] }))],
    ["get", "/account/security-alerts", () => ({ alerts: L(F.securityAlerts) })],
    ["post", "/account/security-alerts/ack-all", ok],
    ["post", "/account/security-alerts/:id/ack", ok],

    // ── واجهة الموقع (للزائر) ──
    ["get", "/site/home-slides", () => ({ slides: L(F.slides) })],
    ["get", "/site/about-page", () => ({ content: state.empty ? null : F.about })],
    ["get", "/site/login-page", () => ({ content: state.empty ? null : F.loginContent })],
    ["get", "/site/news", () => ({ news: L(F.news) })],
    ["get", "/site/texts", { texts: { ar: {}, fr: {}, en: {}, hidden: [] } }],
    ["get", "/site/director-message", () => ({ visible: !state.empty, content: state.empty ? null : F.director })],

    // ── العامّ ──
    ["get", "/public/topics", (r: Req) => ({ ...page(F.publicTopics, r), counts: { all: 2, available: 1, reserved: 1 } })],
    ["get", "/public/topic-filters", () => F.publicFilters],
    ["get", "/public/topics/:id", (r: Req) => ({ topic: F.publicTopicDetail(r.params.id!) })],
    ["get", "/public/departments", () => ({ departments: L([F.department, F.department2]).map((d) => ({ id: d.id, name: d.name })) })],
    ["get", "/public/specializations", () => ({ specializations: L([F.specialization, F.specialization2]).map((s) => ({ id: s.id, name: s.name, departmentId: F.department.id })) })],
    ["get", "/verify/:token", (r: Req) =>
      r.params.token === "missing"
        ? { found: false }
        : { ...F.supervisionSnapshot, found: true, status: "active", documentNumber: F.supervisionDoc.documentNumber, barcode: F.supervisionDoc.barcode, issuedAt: F.supervisionDoc.createdAt, revokedAt: null }],

    // ── القوائم المشتركة ──
    ["get", "/common/specializations", () => ({ specializations: L([F.specialization, F.specialization2]).map((s) => ({ id: s.id, name: s.name, level: s.level, departmentId: F.department.id, department: { id: F.department.id, name: F.department.name }, filiereId: F.filiere.id, filiere: { id: F.filiere.id, name: F.filiere.name } })) })],
    ["get", "/common/academic-years", () => ({ academicYears: L([F.year, F.pastYear]) })],
    ["get", "/common/faculties", () => ({ faculties: L([F.faculty]) })],
    ["get", "/common/departments", () => ({ departments: L([F.department, F.department2]) })],
    ["get", "/common/topic-types", () => ({ types: L(F.topicTypes).map(({ id, name, code, color, departmentId }) => ({ id, name, code, color, departmentId })) })],
    ["get", "/common/professors", () => ({ professors: L(F.professorOptions) })],

    // ── الطالب ──
    ["get", "/student/dashboard", () =>
      state.empty
        ? { ...F.studentDashboard, stage: "choose_topic", requests: [], project: null, attention: { overdueMilestones: [], dueThisWeek: [], rejectedRequests: [] } }
        : F.studentDashboard],
    ["get", "/student/students/lookup", (r: Req) => {
      const s = F.students.find((x) => x.registrationNumber === r.query.registration);
      return { student: s ? { id: s.id, registrationNumber: s.registrationNumber, user: s.user, specialization: { name: F.specialization.name }, isSelf: s.userId === me().id, otherGroup: s.id === F.student4.id ? "project" : null } : null };
    }],
    ["get", "/student/group-requests", () => ({ requests: L(F.studentRequests) })],
    ["post", "/student/group-requests", (r: Req) => ({ request: { ...F.studentRequests[2], ...(r.body as object), id: "gr-new", status: "pending" } })],
    ["delete", "/student/group-requests/:id", ok],
    // No deadline unless a test sets one: choosing as it always was.
    ["get", "/student/selection-window", () => ({ window: F.studentSelection() })],
    ["get", "/student/my-project", () => ({ project: state.empty ? null : F.myProject })],

    // ── الأستاذ ──
    ["get", "/professor/dashboard", () => (state.empty ? { ...F.professorDashboard, committee: [], recentSubmissions: [], topics: [], projects: [], agenda: [], attention: { rejectedTopics: [], pendingTopics: [], approvedNotPublished: [], openWithoutRequests: [], overdueMilestones: [], dueThisWeek: [], awaitingReview: [] } } : F.professorDashboard)],
    ["get", "/professor/topics", () => ({ topics: L(F.profTopics) })],
    ["post", "/professor/topics", (r: Req) => ({ topic: { ...F.profTopics[1], ...(r.body as object), id: "t-new", status: "pending" } })],
    ["post", "/professor/topics/with-group", (r: Req) => ({ topic: { ...F.profTopics[1], ...(r.body as object), id: "t-new", status: "pending" } })],
    ["get", "/professor/topics/:id", (r: Req) => ({ topic: F.profTopicDetail(r.params.id!) })],
    ["put", "/professor/topics/:id", (r: Req) => ({ topic: { ...F.profTopicDetail(r.params.id!), ...(r.body as object) } })],
    ["delete", "/professor/topics/:id", ok],
    ["get", "/professor/groups", () => ({ groups: L(F.profGroups) })],
    ["get", "/professor/groups/:id", () => ({ group: F.profGroup })],
    ["get", "/professor/groups/:id/milestones", () => ({ milestones: L(F.profGroup.milestones!) })],
    ["post", "/professor/groups/:id/milestones", (r: Req) => ({ milestone: { ...F.profGroup.milestones![3], ...(r.body as object), id: "ms-new" } })],
    ["put", "/professor/milestones/:id", (r: Req) => ({ milestone: { ...byId(F.profGroup.milestones!, r.params.id!), ...(r.body as object) } })],
    ["delete", "/professor/milestones/:id", ok],
    // No limit by default: the professor sends as ever.
    ["get", "/professor/topic-quota", () => ({ year: { id: F.year.id, title: F.year.title }, max: null, used: 2 })],
    [
      "get",
      "/professor/students/search",
      (r: Req) => {
        // Nothing typed and no specialization: nothing — never the whole university.
        if (!String(r.query.q ?? "").trim() && !r.query.specializationId) return { students: [], total: 0 };
        const found = F.students.filter(
          (s) => nameOrNumber(s, r.query.q) && (!r.query.specializationId || s.specialization?.id === r.query.specializationId),
        );
        return {
          students: found.map((s) => ({
            id: s.id,
            registrationNumber: s.registrationNumber,
            user: { firstName: s.user!.firstName, lastName: s.user!.lastName, avatarUrl: null, gender: s.user!.gender },
            specialization: { id: s.specialization!.id, name: s.specialization!.name },
          })),
          total: found.length,
        };
      },
    ],

    // ── وثيقة الإشراف ──
    ["get", "/supervision-documents/topics/:id/preview", () => ({ snapshot: F.supervisionSnapshot, active: state.empty ? null : F.supervisionDoc })],
    ["post", "/supervision-documents/topics/:id", () => ({ document: F.supervisionDoc, created: true })],
    ["get", "/supervision-documents", (r: Req) => page([F.supervisionDoc], r)],
    ["get", "/supervision-documents/:id", () => ({ document: F.supervisionDoc })],
    ["patch", "/supervision-documents/:id/revoke", () => ({ document: { ...F.supervisionDoc, status: "revoked", revokedAt: F.days(0) } })],
    ["post", "/supervision-documents/:id/print", () => ({
      document: { ...F.supervisionDoc, printedAt: F.days(0), printedByRole: "admin", printedByName: "مسؤول المنصّة", printCount: 1, lastPrintedAt: F.days(0) },
    })],

    // ── الرسائل ──
    ["get", "/messages/inbox", (r: Req) => page(F.inbox(me()), r)],
    ["get", "/messages/sent", (r: Req) => page(F.sent(me()), r)],
    ["get", "/messages/summary", () => ({ unread: state.empty ? 0 : 1, inbox: L(F.inbox(me())).length, sent: L(F.sent(me())).length })],
    ["get", "/messages/unread-count", () => ({ count: state.empty ? 0 : 1 })],
    ["get", "/messages/contacts", () => ({ items: L(F.contacts(me())), counts: { admin: 1, professor: 3, student: 4 } })],
    ["get", "/messages/audience", () => ({ count: 4, sample: F.studentUsers.slice(0, 3).map(F.messageUser) })],
    ["get", "/messages/conversations", () => ({ items: L(F.conversations(me())), unread: state.empty ? 0 : 2 })],
    ["get", "/messages/chat/:userId", (r: Req) => F.chat(me(), r.params.userId!)],
    ["patch", "/messages/chat/:userId/read", ok],
    ["patch", "/messages/read-all", ok],
    // A file is a draft on the server once uploaded; its id is what a message carries.
    [
      "post",
      "/messages/attachments",
      (r: Req) => {
        const file = (r.body as { file?: File }).file;
        return { attachment: { id: `att-${file?.name ?? "file"}`, fileName: file?.name ?? "file", mimeType: file?.type || "application/pdf", size: file?.size ?? 0 } };
      },
    ],
    ["delete", "/messages/attachments/:id", ok],
    ["get", "/messages/attachments/:id", () => new Blob(["%PDF-1.7"], { type: "application/pdf" })],
    ["post", "/messages", (r: Req) => ({ message: { ...F.thread(me(), "m-new").thread[1], ...(r.body as object) } })],
    ["post", "/messages/broadcast", { id: "b1", recipients: 4 }],
    ["post", "/messages/:id/reply", (r: Req) => ({ message: { ...F.thread(me(), r.params.id!).thread[1], id: "m-reply", body: (r.body as { body: string }).body } })],
    ["patch", "/messages/:id/read", ok],
    ["patch", "/messages/:id/unread", ok],
    // After «/read-all»: one segment too, and the first match answers.
    [
      "patch",
      "/messages/:id",
      (r: Req) => ({
        message: { ...F.thread(me(), r.params.id!).thread[1], id: r.params.id, body: (r.body as { body: string }).body, editedAt: new Date().toISOString() },
      }),
    ],
    ["delete", "/messages/:id/for-everyone", ok],
    ["get", "/messages/:id", (r: Req) => F.thread(me(), r.params.id!)],
    ["delete", "/messages/:id", ok],

    // ── الإدارة: اللوحة ──
    ["get", "/admin/stats/overview", { stats: { students: 4, professors: 3, topics: 6, approvedTopics: 1, projects: 1, defenses: 1 } }],
    ["get", "/admin/dashboard", () =>
      state.empty
        ? { ...F.adminDashboard, academicYear: null, pendingProposals: [], recentRequests: [], upcomingDefenses: [], attention: { staleProposals: [], openWithoutRequests: [] }, topicBreakdown: [], studentsPerSpecialization: [], monthlyGrowth: [] }
        : F.adminDashboard],

    // ── المستخدمون ──
    ["get", "/admin/users", (r: Req) => page(F.allUsers, r)],
    ["post", "/admin/users", echo("user", F.studentUsers[0]!)],
    ["get", "/admin/users/:id", (r: Req) => ({ user: F.userDetail(byId(F.allUsers, r.params.id!)) })],
    ["patch", "/admin/users/:id", (r: Req) => ({ user: { ...byId(F.allUsers, r.params.id!), ...(r.body as object) } })],
    ["patch", "/admin/users/:id/status", ok],
    ["patch", "/admin/users/:id/verification", ok],
    ["post", "/admin/users/:id/reset-password", ok],
    ["delete", "/admin/users/:id", ok],

    // ── الطلبة والأساتذة ──
    ["get", "/admin/students/export", blob],
    ["get", "/admin/students/import/template", blob],
    ["post", "/admin/students/import/preview", importReport],
    ["post", "/admin/students/import", { created: 1, accounts: [{ registrationNumber: "202039012399", firstName: null, lastName: "بلقاسم", firstNameLatin: "Ali", lastNameLatin: "Belkacem", password: "Aa123456" }], accountsFile: "eGxzeA==" }],
    ["get", "/admin/students", (r: Req) => page(studentsFor(r.query), r)],
    ["post", "/admin/students", echo("student", F.student1)],
    ["get", "/admin/students/:id", (r: Req) => ({ student: byId(F.students, r.params.id!) })],
    ["patch", "/admin/students/:id", (r: Req) => ({ student: { ...byId(F.students, r.params.id!), ...(r.body as object) } })],
    ["delete", "/admin/students/:id", ok],
    ["get", "/admin/professors/import/template", blob],
    ["post", "/admin/professors/import/preview", importReport],
    ["post", "/admin/professors/import", { created: 1, accounts: [{ employeeNumber: "EMP-099", universityEmail: "new@univ-msila.dz", firstName: "جديد", lastName: "أستاذ", firstNameLatin: null, lastNameLatin: null, password: "Aa123456" }], accountsFile: "eGxzeA==" }],
    ["get", "/admin/professors", (r: Req) => page(F.professors.filter((p) => hit(p, r.query.search) && hit(p, r.query.quickSearch)), r)],
    ["post", "/admin/professors", echo("professor", F.prof1)],
    ["get", "/admin/professors/:id", (r: Req) => ({
      professor: {
        ...byId(F.professors, r.params.id!),
        topics: L(F.topics).map((t) => ({ id: t.id, title: t.title, status: t.status, maxStudents: t.maxStudents, createdAt: t.createdAt, specialization: { id: F.specialization.id, name: F.specialization.name }, _count: t._count })),
      },
    })],
    ["patch", "/admin/professors/:id", (r: Req) => ({ professor: { ...byId(F.professors, r.params.id!), ...(r.body as object) } })],
    ["delete", "/admin/professors/:id", ok],
    ["post", "/admin/uploads/image", { url: "/uploads/cards/new.jpg" }],

    // ── البنية الأكاديمية ──
    ["get", "/admin/faculties", () => ({ faculties: L([F.faculty]) })],
    ["post", "/admin/faculties", echo("faculty", F.faculty)],
    ["patch", "/admin/faculties/:id", echo("faculty", F.faculty)],
    ["delete", "/admin/faculties/:id", ok],
    ["get", "/admin/departments", () => ({ departments: L([F.department, F.department2]) })],
    ["post", "/admin/departments", echo("department", F.department)],
    ["patch", "/admin/departments/:id", echo("department", F.department)],
    ["delete", "/admin/departments/:id", ok],
    ["get", "/admin/topic-types", (r: Req) => ({ types: L(F.topicTypes).filter((x) => !r.query.departmentId || x.departmentId === r.query.departmentId) })],
    ["post", "/admin/topic-types", echo("type", { ...F.topicTypes[0], id: "tt-new", topicsCount: 0 })],
    ["patch", "/admin/topic-types/:id", echo("type", F.topicTypes[0]!)],
    ["delete", "/admin/topic-types/:id", ok],
    ["get", "/admin/specializations", () => ({ specializations: L([F.specialization, F.specialization2]) })],
    ["post", "/admin/specializations", echo("specialization", F.specialization)],
    ["patch", "/admin/specializations/:id", echo("specialization", F.specialization)],
    ["delete", "/admin/specializations/:id", ok],
    ["get", "/admin/domains", () => ({ domains: L([F.domain]) })],
    ["post", "/admin/domains", echo("domain", F.domain)],
    ["patch", "/admin/domains/:id", echo("domain", F.domain)],
    ["delete", "/admin/domains/:id", ok],
    ["get", "/admin/filieres", () => ({ filieres: L([F.filiere]) })],
    ["post", "/admin/filieres", echo("filiere", F.filiere)],
    ["patch", "/admin/filieres/:id", echo("filiere", F.filiere)],
    ["delete", "/admin/filieres/:id", ok],
    ["post", "/admin/academic-structure", { faculty: F.faculty, created: { departments: 1, domains: 1, filieres: 1, specializations: 2 } }],
    ["get", "/admin/academic-years", () => ({ academicYears: L([F.year, F.pastYear]) })],
    ["post", "/admin/academic-years", echo("academicYear", F.year)],
    ["patch", "/admin/academic-years/:id/activate", (r: Req) => ({ academicYear: { ...byId([F.year, F.pastYear], r.params.id!), isActive: true } })],
    ["patch", "/admin/academic-years/:id", echo("academicYear", F.year)],
    ["delete", "/admin/academic-years/:id", ok],
    ["get", "/admin/academic-years/:id/proposal-window", (r: Req) => F.proposalWindow(byId([F.year, F.pastYear], r.params.id!))],
    [
      "put",
      "/admin/academic-years/:id/proposal-window",
      (r: Req) => {
        const { opensOn, closesOn } = r.body as { opensOn: string; closesOn: string };
        return F.proposalWindow(
          byId([F.year, F.pastYear], r.params.id!),
          new Date(`${opensOn}T00:00:00.000+01:00`).toISOString(),
          new Date(`${closesOn}T23:59:59.999+01:00`).toISOString(),
        );
      },
    ],
    ["delete", "/admin/academic-years/:id/proposal-window", (r: Req) => F.proposalWindow(byId([F.year, F.pastYear], r.params.id!))],
    ["get", "/admin/academic-years/:id/selection-window", (r: Req) => F.selectionWindow(byId([F.year, F.pastYear], r.params.id!))],
    ["get", "/admin/academic-years/:id/team-size", (r: Req) => F.teamSizeState(byId([F.year, F.pastYear], r.params.id!))],
    ["get", "/admin/academic-years/:id/team-size/preview", (r: Req) => F.teamSizeImpact(r.query as Record<string, string>)],
    [
      "put",
      "/admin/academic-years/:id/team-size",
      (r: Req) => {
        const { rules, applyToExisting } = r.body as { rules: Record<string, { n: number; mode: "exact" | "max" } | null>; applyToExisting: boolean };
        const kept = Object.fromEntries(Object.entries(rules).filter(([, v]) => v));
        return {
          ...F.teamSizeState(byId([F.year, F.pastYear], r.params.id!), Object.keys(kept).length ? kept : null),
          applied: { changed: applyToExisting ? 3 : 0 },
        };
      },
    ],
    ["delete", "/admin/academic-years/:id/team-size", (r: Req) => F.teamSizeState(byId([F.year, F.pastYear], r.params.id!))],
    ["get", "/admin/academic-years/:id/topic-quota", (r: Req) => F.topicQuotaState(byId([F.year, F.pastYear], r.params.id!))],
    [
      "put",
      "/admin/academic-years/:id/topic-quota",
      (r: Req) => F.topicQuotaState(byId([F.year, F.pastYear], r.params.id!), (r.body as { max: number }).max),
    ],
    ["delete", "/admin/academic-years/:id/topic-quota", (r: Req) => F.topicQuotaState(byId([F.year, F.pastYear], r.params.id!))],
    [
      "put",
      "/admin/academic-years/:id/selection-window",
      (r: Req) => {
        const { opensOn, closesOn } = r.body as { opensOn: string; closesOn: string };
        return F.selectionWindow(
          byId([F.year, F.pastYear], r.params.id!),
          new Date(`${opensOn}T00:00:00.000+01:00`).toISOString(),
          new Date(`${closesOn}T23:59:59.999+01:00`).toISOString(),
        );
      },
    ],
    ["delete", "/admin/academic-years/:id/selection-window", (r: Req) => F.selectionWindow(byId([F.year, F.pastYear], r.params.id!))],
    ["get", "/admin/university-domains", () => ({ domains: L(F.universityDomains) })],
    ["post", "/admin/university-domains", (r: Req) => ({ domain: { ...F.universityDomains[1], id: "ud-new", domain: (r.body as { domain: string }).domain } })],
    ["patch", "/admin/university-domains/:id/default", ok],
    ["delete", "/admin/university-domains/:id", ok],

    // ── الأرشيف ──
    ["get", "/admin/archive/years", () => ({ items: L(F.archiveYears) })],
    ["get", "/admin/archive/years/:id/readiness", (r: Req) => F.readiness(r.params.id!)],
    ["get", "/admin/archive/years/:id", (r: Req) => F.yearRecord(r.params.id!)],
    ["post", "/admin/archive/years/:id/close", { archived: true, activeYearId: null }],
    ["post", "/admin/archive/years/:id/reopen", { reopened: true, active: false }],

    // ── المواضيع ──
    ["get", "/admin/topics/titles-list", (r: Req) => ({
      mode: r.query.mode ?? "before",
      year: { id: F.year.id, title: F.year.title },
      groups: state.empty
        ? []
        : [
            {
              specialization: { id: F.specialization.id, name: F.specialization.name, level: "master" },
              filiere: { id: F.filiere.id, name: F.filiere.name },
              department: { id: F.department.id, name: F.department.name },
              faculty: { id: F.faculty.id, name: F.faculty.name },
              rows: [
                {
                  id: F.topicFull.id,
                  title: F.topicFull.title,
                  status: "full",
                  maxStudents: 3,
                  supervisor: { id: F.prof1.id, firstName: "كريم", lastName: "منصوري", firstNameLatin: "Karim", lastNameLatin: "Mansouri", grade: ["أستاذ محاضر أ"], email: F.prof1.universityEmail },
                  students: [{ firstName: "أمين", lastName: "حداد", firstNameLatin: "Amine", lastNameLatin: "Haddad", registrationNumber: F.student1.registrationNumber, isLeader: true }],
                },
              ],
            },
          ],
    })],
    ["get", "/admin/topics/export", blob],
    ["get", "/admin/topics/export/preview", (r: Req) => ({ preview: F.topicExportPreview(String(r.query.lang ?? "ar")) })],
    ["get", "/admin/topics/import/template", blob],
    ["post", "/admin/topics/import/preview", importReport],
    ["post", "/admin/topics/import", { created: 1, topics: [{ title: "موضوع مستورد", professor: "كريم منصوري", specialization: F.specialization.name, status: "مقبول" }] }],
    ["get", "/admin/topics/assigned/import/template", blob],
    ["post", "/admin/topics/assigned/import/preview", importReport],
    ["post", "/admin/topics/assigned/import", { created: 1, assigned: 2, topics: [{ title: "موضوع مُسنَد", professor: "كريم منصوري", students: "أمين حداد، ليلى قاسمي", specialization: F.specialization.name }] }],
    ["post", "/admin/topics/assigned", echo("topic", F.topicFull)],
    ["patch", "/admin/topics/:id/assignment", (r: Req) => ({ topic: { ...byId(F.topics, r.params.id!), ...(r.body as object) } })],
    ["get", "/admin/topics", (r: Req) => page(F.topics, r)],
    ["post", "/admin/topics", echo("topic", F.topicPending)],
    ["get", "/admin/topics/:id", (r: Req) => ({ topic: F.adminTopicDetail(r.params.id!) })],
    ["patch", "/admin/topics/:id/:action", ok],
    ["delete", "/admin/topics/:id", ok],

    // ── المراحل ──
    ["get", "/admin/projects/:id/milestones", () => ({ milestones: L(F.milestones) })],
    ["post", "/admin/projects/:id/milestones", (r: Req) => ({ milestone: { ...F.milestones[3], ...(r.body as object), id: "ms-new" } })],
    ["patch", "/admin/milestones/:id", (r: Req) => ({ milestone: { ...byId(F.milestones, r.params.id!), ...(r.body as object) } })],
    ["delete", "/admin/milestones/:id", ok],

    // ── طلبات المجموعات ──
    ["get", "/admin/group-requests/by-topic", (r: Req) => ({ ...page(F.requestTopics, r), counts: { pending: 1, accepted: 1, rejected: 1, all: 3 }, pageTotal: L(F.requestTopics).length })],
    ["get", "/admin/group-requests", (r: Req) => page(F.groupRequests, r)],
    ["get", "/admin/group-requests/:id", (r: Req) => ({ groupRequest: byId(F.groupRequests, r.params.id!) })],
    ["patch", "/admin/group-requests/:id/accept", ok],
    ["patch", "/admin/group-requests/:id/reject", ok],
    ["patch", "/admin/group-requests/:id/leader/:studentId", ok],
    ["delete", "/admin/group-requests/:id/members/:studentId", ok],
    ["delete", "/admin/group-requests/:id", ok],

    // ── المشاريع ──
    ["get", "/admin/projects", (r: Req) => ({
      ...page([F.project, F.project2].filter((p) => (r.query.defense === "none" ? !p.defense : true) && hit(p, r.query.search)), r),
      stats: { total: 2, defenseScheduled: 1, defenseDone: 0, noDefense: 1, withOverdue: 1, noPlan: 1 },
    })],
    ["get", "/admin/projects/:id", (r: Req) => ({ project: byId([F.project, F.project2], r.params.id!) })],
    ["patch", "/admin/projects/:id/supervisor", ok],
    ["post", "/admin/projects/:id/assign", ok],
    ["delete", "/admin/projects/:id/members/:studentId", ok],
    ["patch", "/admin/projects/:id/leader/:studentId", ok],
    ["delete", "/admin/projects/:id", ok],

    // ── المناقشات ──
    ["get", "/admin/defenses/conflicts", { room: [], professors: [] }],
    ["get", "/admin/defenses", (r: Req) => ({ ...page([{ ...F.defense, group: F.project }], r), stats: { ...F.defenseStats, readyToSchedule: 1 } })],
    ["post", "/admin/defenses", echo("defense", F.defense)],
    ["get", "/admin/defenses/:id", () => ({ defense: F.defenseDetail })],
    ["patch", "/admin/defenses/:id", echo("defense", F.defense)],
    ["delete", "/admin/defenses/:id", ok],

    // ── واجهة الموقع (الإدارة) ──
    ["get", "/admin/home-slides", () => ({ slides: L(F.slides) })],
    ["post", "/admin/home-slides/batch", (r: Req) => ({ slides: (r.body as { slides: object[] }).slides.map((s, i) => ({ ...F.slides[0], ...s, id: `sl-new${i}` })) })],
    ["patch", "/admin/home-slides/order", () => ({ slides: F.slides })],
    ["patch", "/admin/home-slides/:id", (r: Req) => ({ slide: { ...byId(F.slides, r.params.id!), ...(r.body as object) } })],
    ["delete", "/admin/home-slides/:id", ok],
    ["get", "/admin/news", () => ({ news: L(F.news) })],
    ["post", "/admin/news", (r: Req) => ({ item: { ...F.news[0], ...(r.body as object), id: "n-new" } })],
    ["patch", "/admin/news/:id", (r: Req) => ({ item: { ...byId(F.news, r.params.id!), ...(r.body as object) } })],
    ["delete", "/admin/news/:id", ok],
    ["get", "/admin/director-message", () => ({ director: state.empty ? null : F.director })],
    ["put", "/admin/director-message", (r: Req) => ({ director: r.body })],
    ["get", "/admin/about-page", () => ({ content: state.empty ? null : F.about })],
    ["put", "/admin/about-page", (r: Req) => ({ content: r.body })],
    ["get", "/admin/login-page", () => ({ content: state.empty ? null : F.loginContent })],
    ["put", "/admin/login-page", (r: Req) => ({ content: r.body })],
    ["get", "/admin/supervision-sheet", () => ({ content: null, defaults: DEFAULT_SUPERVISION_TEMPLATE })],
    ["put", "/admin/supervision-sheet", (r: Req) => ({ content: r.body, defaults: DEFAULT_SUPERVISION_TEMPLATE })],
    ["delete", "/admin/supervision-sheet", () => ({ content: null, defaults: DEFAULT_SUPERVISION_TEMPLATE })],
    ["get", "/admin/site-texts", { texts: { ar: {}, fr: {}, en: {}, hidden: [] } }],
    ["put", "/admin/site-texts", (r: Req) => ({ texts: r.body })],
    ["get", "/admin/mail-templates", () => F.mailTemplates],
    ["put", "/admin/mail-templates", (r: Req) => ({ templates: r.body })],
    // The message drawn from the draft: its subject as written, else the platform's.
    [
      "post",
      "/admin/mail-templates/preview",
      (r: Req) => {
        const d = r.body as { templates: Record<string, Record<string, string>>; kind: string; lang: "ar" | "en" | "fr" };
        const key = `mail.${d.kind}.subject`;
        return { subject: d.templates[d.lang]?.[key] ?? F.mailTemplates.defaults[d.lang][key], html: `<p>${d.kind}</p>` };
      },
    ],
    ["post", "/admin/mail-templates/test", () => ({ message: "sent", to: F.mailTemplates.testTo })],

    // ── السجلّ ──
    ["get", "/admin/audit-logs", (r: Req) => page(F.auditLogs, r)],
    ["get", "/admin/audit-logs/actors", () => ({ actors: L(F.auditActors) })],
    ["get", "/admin/audit-logs/summary", F.auditSummary],
    ["get", "/admin/audit-logs/countries", () => ({ countries: L(F.auditCountries) })],
    // مكتب التفعيل: طالبٌ واحد معروف برقمه، وما سواه «غير موجود».
    [
      "get",
      "/admin/activation/settings",
      { required: false, counts: { students: 120, notActivated: 37, verified: 54, suspended: 2, pendingRequests: 1 } },
    ],
    // The desk's list: filtered here as the server filters it, by name or number and by state.
    [
      "get",
      "/admin/activation/students",
      (r: Req) => {
        const q = String(r.query.q ?? "").toLowerCase();
        const state = String(r.query.state ?? "all");
        const items = L(F.deskStudents).filter(
          (s) =>
            (!q ||
              [s.firstName, s.lastName, s.firstNameLatin, s.lastNameLatin, s.registrationNumber].join(" ").toLowerCase().includes(q)) &&
            (state === "all" ||
              (state === "notActivated" && !s.activated) ||
              (state === "activated" && s.activated) ||
              (state === "verified" && s.verified) ||
              (state === "unverified" && !s.verified)),
        );
        return { items, total: items.length, page: Number(r.query.page ?? 1), limit: Number(r.query.limit ?? 10) };
      },
    ],
    ["get", "/admin/activation/students/:id", (r: Req) => ({ ...F.studentProfile, id: r.params.id })],
    [
      "get",
      "/admin/activation/student",
      (r: Req) => {
        if (r.query.registrationNumber !== F.deskStudent.registrationNumber)
          throw { status: 404, data: { message: "الطالب غير موجود.", errorCode: "RESOURCE_NOT_FOUND" } };
        return F.deskStudent;
      },
    ],
    // طلبات التفعيل بالصور: طلبٌ واحد ينتظر، وصورتاه.
    ["get", "/admin/activation/requests", () => ({ items: L([F.activationRequest]), total: L([F.activationRequest]).length })],
    ["get", "/admin/activation/requests/:id/card", () => new Blob(["card"], { type: "image/jpeg" })],
    ["get", "/admin/activation/requests/:id/selfie", () => new Blob(["selfie"], { type: "image/jpeg" })],
    ["post", "/admin/activation/requests/:id/approve", ok],
    ["post", "/admin/activation/requests/:id/reject", ok],
    // طلبات كلمة المرور: طلبٌ واحد ينتظر، وصورة بطاقته.
    ["get", "/admin/password-requests", () => ({ items: L([F.passwordRequest]), total: L([F.passwordRequest]).length })],
    ["get", "/admin/password-requests/:id/card", () => new Blob(["card"], { type: "image/jpeg" })],
    ["post", "/admin/password-requests/:id/approve", ok],
    ["post", "/admin/password-requests/:id/reject", ok],
  ] as [Method, string, Reply][]
).map(([m, p, r]) => compile(m, p, r));

export type Call = Req;

export const fake = {
  calls: [] as Call[],
  unknown: [] as string[],
  overrides: [] as Route[],
  get empty() {
    return state.empty;
  },
  /** من دخل، كما يعرفه الخادم (يضعه `signIn`). */
  set session(u: AuthUser | null) {
    state.session = u;
  },
  set empty(v: boolean) {
    state.empty = v;
  },

  /** جوابٌ آخر لمسار — يسبق ما في الجدول حتى `reset`. */
  on(method: Method, path: string, reply: Reply) {
    this.overrides.unshift(compile(method, path, reply));
  },

  /** رفضٌ كما يرسله الخادم: `{ message, errorCode }` برمز الحالة. */
  fail(method: Method, path: string, status = 500, message = "تعذّر تنفيذ الطلب", errorCode?: string) {
    this.on(method, path, () => {
      throw { status, data: { message, ...(errorCode ? { errorCode } : {}) } };
    });
  },

  /**
   * يُمسك الجواب حتى يُطلق — كشبكةٍ بطيئة: ما تفعله الشاشة بين الطلب وجوابه
   * يُرى. يعيد دالّة الإطلاق؛ والجواب بعدها كما كان سيكون.
   */
  hold(method: Method, path: string) {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const base = ROUTES.find((r) => r.method === method && r.pattern.source === compile(method, path, null).pattern.source);
    if (!base) throw new Error(`no route ${method} ${path}`);
    this.on(method, path, async (req: Req) => {
      await gate;
      return typeof base.reply === "function" ? (base.reply as (r: Req) => unknown)(req) : base.reply;
    });
    return release;
  },

  /**
   * يُرفض الطلب ما لم يحمل ما يشترطه `ok` — ثمّ يُجاب كما كان سيُجاب. كالخادم
   * حين يطلب تحقّق الدخول: بلا حلٍّ ⇒ 428، وبه ⇒ الدخول نفسه.
   */
  refuseUnless(
    method: Method,
    path: string,
    ok: (req: Req) => boolean,
    status: number,
    message: string,
    errorCode?: string,
    /** حقولٌ أخرى في الرفض، بحسب الطلب — درجة التحقّق مثلاً. */
    extra?: (req: Req) => Record<string, unknown>,
  ) {
    const base = ROUTES.find((r) => r.method === method && r.pattern.source === compile(method, path, null).pattern.source);
    if (!base) throw new Error(`no route ${method} ${path}`);
    this.on(method, path, (req: Req) => {
      if (!ok(req)) throw { status, data: { message, ...(errorCode ? { errorCode } : {}), ...extra?.(req) } };
      return typeof base.reply === "function" ? (base.reply as (r: Req) => unknown)(req) : base.reply;
    });
  },

  /** الطلبات بطريقةٍ ومسارٍ (والمسار نصٌّ أو تعبير). */
  find(method: Method, path: string | RegExp) {
    return this.calls.filter((c) => c.method === method && (typeof path === "string" ? c.path === path : path.test(c.path)));
  },

  /** ما أُرسل بغير GET — ما غيّر شيئاً. */
  get writes() {
    return this.calls.filter((c) => c.method !== "get");
  },

  reset() {
    this.calls = [];
    this.unknown = [];
    this.overrides = [];
    state.empty = false;
    state.accountWrites = 0;
    state.session = null;
  },
};

const parse = (data: unknown) => {
  if (typeof data !== "string") return data instanceof FormData ? Object.fromEntries(data.entries()) : data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

export const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? "get").toLowerCase() as Method;
  const path = (config.url ?? "").split("?")[0]!.replace(/^\/api/, "");
  const query = (config.params ?? {}) as Record<string, unknown>;
  const body = parse(config.data);

  for (const route of [...fake.overrides, ...ROUTES]) {
    if (route.method !== method) continue;
    const m = route.pattern.exec(path);
    if (!m) continue;
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1]!)]));
    const req: Req = { method, path, params, query, body };
    fake.calls.push(req);
    try {
      const data = await (typeof route.reply === "function" ? (route.reply as (r: Req) => unknown)(req) : route.reply);
      return { data: data instanceof Blob ? data : structuredClone(data), status: 200, statusText: "OK", headers: {}, config };
    } catch (e) {
      const { status, data } = e as { status: number; data: unknown };
      // طلبٌ ينتظر ملفّاً يأتيه الخطأ ملفّاً أيضاً، كما في المتصفّح.
      const body = config.responseType === "blob" ? new Blob([JSON.stringify(data)], { type: "application/json" }) : data;
      const response = { data: body, status, statusText: "", headers: new AxiosHeaders(), config };
      throw new AxiosError(`Request failed with status code ${status}`, status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST", config, {}, response);
    }
  }

  fake.unknown.push(`${method.toUpperCase()} ${path}`);
  fake.calls.push({ method, path, params: {}, query, body });
  return { data: {}, status: 200, statusText: "OK", headers: {}, config };
};

/** يركّب المحوِّل على عميل الواجهة وعلى axios نفسه (طلب التجديد يخرج منه). */
export function installFakeApi() {
  client.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
}
