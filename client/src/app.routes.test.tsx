import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { fake } from "./test/fake-api";
import { renderApp, type Who } from "./test/render-app";
import * as F from "./test/fixtures";

/**
 * كلّ صفحةٍ في الواجهة تُفتح — بالدور الذي يملكها، وبالبيانات وبدونها.
 *
 * ما يُحرس هنا هو ما يراه المستخدم أوّلاً: الصفحة تفتح ولا تنهار، وتعرض
 * ما جاءها من الخادم (عنوانٌ أو اسمٌ من البيانات)، ولا تطلب مساراً لا يعرفه
 * الخادم، ولا تكتب في وحدة التحكّم خطأً. وفي اليوم الأوّل — القوائم كلّها
 * فارغة — تعرض حالتها الفارغة بدل أن تنهار على `undefined`.
 */
type Case = [path: string, as: Who, shows: string | RegExp];

const PUBLIC: Case[] = [
  ["/ar", null, /مذكّرتي|مذكرتي/],
  ["/ar/topics", "student", F.topicOpen.title],
  ["/ar/topics/t-open", null, F.topicOpen.title],
  ["/ar/about", null, "منصة لتسيير مذكرات التخرّج."],
  ["/ar/403", null, /403|غير مصرّح|غير مصرح/],
  ["/ar/verify", null, /./],
  ["/ar/verify/tok-verify-1", null, F.supervisionDoc.documentNumber],
  ["/ar/login", null, "جامعة المسيلة"],
  ["/fr/topics", "professor", F.topicOpen.title],
  ["/en/about", null, "منصة لتسيير مذكرات التخرّج."],
];

const PROFESSOR: Case[] = [
  ["/ar/professor", "professor", F.topicFull.title],
  ["/ar/professor/topics", "professor", F.topicOpen.title],
  ["/ar/professor/topics/t-open", "professor", F.topicOpen.title],
  ["/ar/professor/topics/t-full", "professor", F.topicFull.title],
  ["/ar/professor/milestones", "professor", F.topicFull.title],
  ["/ar/professor/groups", "professor", F.topicFull.title],
  [`/ar/professor/groups/${F.ID.g1}`, "professor", F.topicFull.title],
  ["/ar/professor/messages", "professor", /./],
  ["/ar/professor/account", "professor", "EMP-001"],
];

const STUDENT: Case[] = [
  ["/ar/student", "student", F.topicFull.title],
  ["/ar/student/requests", "student", F.topicOpen.title],
  ["/ar/student/project", "student", F.topicFull.title],
  ["/ar/student/messages", "student", /./],
  ["/ar/student/account", "student", F.student1.registrationNumber],
];

const ADMIN: Case[] = [
  ["/ar/admin", "admin", F.topicPending.title],
  ["/ar/admin/students", "admin", F.student1.registrationNumber],
  ["/ar/admin/students/st1", "admin", F.student1.registrationNumber],
  ["/ar/admin/students/unassigned", "admin", /./],
  ["/ar/admin/users", "admin", "admin@univ-msila.dz"],
  ["/ar/admin/users/us1", "admin", F.student1.registrationNumber],
  ["/ar/admin/users/up1", "admin", "EMP-001"],
  ["/ar/admin/professors", "admin", "EMP-001"],
  ["/ar/admin/professors/p1", "admin", F.topicOpen.title],
  ["/ar/admin/specializations", "admin", F.specialization.name],
  [`/ar/admin/specializations/${F.ID.spec1}`, "admin", F.specialization.name],
  ["/ar/admin/topics", "admin", F.topicOpen.title],
  ["/ar/admin/topics/t-open", "admin", F.topicOpen.title],
  ["/ar/admin/topics/t-full", "admin", F.topicFull.title],
  ["/ar/admin/group-requests", "admin", F.topicOpen.title],
  ["/ar/admin/group-requests/gr1", "admin", F.topicOpen.title],
  ["/ar/admin/defenses", "admin", F.topicFull.title],
  ["/ar/admin/defenses/df1", "admin", F.topicFull.title],
  ["/ar/admin/projects", "admin", F.topicFull.title],
  [`/ar/admin/projects/${F.ID.g1}`, "admin", F.topicFull.title],
  ["/ar/admin/academic-years", "admin", F.year.title],
  // Parts of «المستخدمون» (users-hub): the audit log, and activation's requests and desk.
  ["/ar/admin/users?view=audit", "admin", "10.0.0.5"],
  ["/ar/admin/users?view=requests", "admin", F.activationRequest.registrationNumber],
  ["/ar/admin/users?view=desk", "admin", F.deskStudent.registrationNumber],
  ["/ar/admin/account", "admin", "admin@univ-msila.dz"],
  ["/ar/admin/faculties", "admin", F.faculty.name],
  [`/ar/admin/faculties/${F.ID.fac1}`, "admin", F.department.name],
  [`/ar/admin/faculties/${F.ID.fac1}/departments/${F.ID.dep1}`, "admin", F.domain.name],
  [`/ar/admin/faculties/${F.ID.fac1}/departments/${F.ID.dep1}/domains/dom1`, "admin", F.filiere.name],
  [`/ar/admin/faculties/${F.ID.fac1}/departments/${F.ID.dep1}/domains/dom1/filieres/fil1`, "admin", F.specialization.name],
  ["/ar/admin/messages", "admin", /./],
  ["/ar/admin/homepage", "admin", /./],
];

const ALL = [...PUBLIC, ...PROFESSOR, ...STUDENT, ...ADMIN];

let errors: string[] = [];
beforeEach(() => {
  fake.reset();
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void errors.push(a.map(String).join(" ").slice(0, 300)));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function visit(path: string, as: Who) {
  const app = renderApp(path, { as });
  await app.settle();
  return app;
}

describe.each([
  ["بالبيانات", false],
  ["فارغة", true],
] as const)("كلّ صفحة تُفتح — %s", (_, empty) => {
  it.each(ALL)("%s (%s)", async (path, as, shows) => {
    fake.empty = empty;
    const app = await visit(path, as);

    // لم يُعِده حارسٌ إلى الدخول أو إلى «غير مصرّح».
    expect(app.location().split("?")[0]).toBe(path.split("?")[0]!.replace(/\/$/, ""));
    expect(fake.unknown).toEqual([]);
    expect(errors).toEqual([]);
    if (!empty) expect((await screen.findAllByText(shows, { exact: false }, { timeout: 3000 })).length).toBeGreaterThan(0);
    else expect(document.body.textContent!.length).toBeGreaterThan(20);
  });
});

describe("الحرّاس على المسارات", () => {
  it.each([
    ["/ar/admin", null, "/ar/login"],
    ["/ar/topics", null, "/ar/login"],
    ["/ar/admin", "student", "/ar/403"],
    ["/ar/professor", "admin", "/ar/403"],
    ["/ar/student", "professor", "/ar/403"],
    ["/ar/dashboard", "student", "/ar/student"],
    ["/ar/dashboard", "professor", "/ar/professor"],
    ["/ar/dashboard", "admin", "/ar/admin"],
    ["/ar/login", "admin", "/ar/admin"],
    ["/ar/student/topics", "student", "/ar/topics"],
    ["/ar/student/topics/t-open", "student", "/ar/topics/t-open"],
    ["/ar/admin/home-slides", "admin", "/ar/admin/homepage"],
    // Pages of their own once, parts of «المستخدمون» now.
    ["/ar/admin/audit-log", "admin", "/ar/admin/users"],
    ["/ar/admin/activation", "admin", "/ar/admin/users"],
    ["/nowhere", null, "/ar"],
  ] as [string, Who, string][])("%s بدور %s ⇒ %s", async (path, as, to) => {
    const app = await visit(path, as);
    expect(app.location().split("?")[0]).toBe(to);
  });
});
