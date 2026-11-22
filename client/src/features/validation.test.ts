import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import "../i18n/i18n";
import * as admin from "./admin/validation/admin.schema";
import * as auth from "./auth/validation/auth.schema";
import * as professor from "./professor/validation/professor.schema";
import * as student from "./student/validation/student.schema";

/**
 * قواعد الإدخال في الواجهة — ترفض ما يرفضه الخادم قبل الرحلة إليه.
 *
 * لكلّ مخطّط: مدخلٌ صالحٌ يمرّ، ومدخلٌ يخالف كلّ قاعدة يُرفض في الحقول
 * المتوقّعة، وكلّ رسالة رفضٍ جملةٌ مترجمة لا مفتاحُ ترجمة («validation.x»)
 * — وهو ما يظهر للمستخدم تحت الحقل.
 */
const UUID = "e1000000-0000-4000-8000-000000002526";

type Case = { name: string; schema: ZodType; valid: unknown; invalid: unknown; fields: string[] };
const CASES: Case[] = [
  {
    name: "createUserSchema",
    schema: admin.createUserSchema,
    valid: { username: "samir", password: "secret1", role: "admin" },
    invalid: { firstName: " ", lastName: " ", email: "x", username: "ab", password: "1", role: "admin" },
    fields: ["firstName", "lastName", "email", "username", "password"],
  },
  {
    name: "createUserSchema — بلا بريدٍ ولا اسم مستخدم",
    schema: admin.createUserSchema,
    valid: { email: "a@b.dz", password: "secret1", role: "student" },
    invalid: { password: "secret1", role: "student" },
    fields: ["email"],
  },
  {
    name: "updateUserSchema",
    schema: admin.updateUserSchema,
    valid: { email: "", gender: null },
    invalid: { email: "not-mail" },
    fields: ["email"],
  },
  { name: "resetPasswordSchema", schema: admin.resetPasswordSchema, valid: { password: "secret1" }, invalid: { password: "123" }, fields: ["password"] },
  {
    name: "createStudentSchema",
    schema: admin.createStudentSchema,
    valid: { firstNameLatin: "Amine", lastNameLatin: "HADDAD", password: "secret1", registrationNumber: "202039012345", specializationId: UUID, academicYearId: UUID },
    invalid: { firstNameLatin: "أمين", lastNameLatin: "", email: "x", password: "1", registrationNumber: " ", specializationId: "spec1", academicYearId: "y1" },
    fields: ["firstNameLatin", "lastNameLatin", "email", "password", "registrationNumber", "specializationId", "academicYearId"],
  },
  { name: "updateStudentSchema", schema: admin.updateStudentSchema, valid: { gender: "female" }, invalid: { specializationId: "x" }, fields: ["specializationId"] },
  {
    name: "createProfessorSchema",
    schema: admin.createProfessorSchema,
    valid: { firstNameLatin: "Karim", lastNameLatin: "MANSOURI", password: "secret1", employeeNumber: "1234567890123", universityEmail: "k.m@univ-msila.dz", departmentId: UUID },
    invalid: { firstNameLatin: "", lastNameLatin: "Ma5", password: "", employeeNumber: "12", universityEmail: "k.m", departmentId: "dep1" },
    fields: ["firstNameLatin", "lastNameLatin", "password", "employeeNumber", "universityEmail", "departmentId"],
  },
  { name: "updateProfessorSchema", schema: admin.updateProfessorSchema, valid: {}, invalid: { universityEmail: "nope" }, fields: ["universityEmail"] },
  { name: "facultySchema", schema: admin.facultySchema, valid: { name: "كلية", code: "F-1" }, invalid: { name: " ", code: "" }, fields: ["name", "code"] },
  { name: "departmentSchema", schema: admin.departmentSchema, valid: { name: "قسم", code: "D-1", facultyId: UUID }, invalid: { name: "", code: "", facultyId: "f" }, fields: ["name", "code", "facultyId"] },
  { name: "specializationSchema", schema: admin.specializationSchema, valid: { name: "تخصص", level: "master", departmentId: UUID }, invalid: { name: "", level: "master", departmentId: "d" }, fields: ["name", "departmentId"] },
  { name: "academicYearSchema", schema: admin.academicYearSchema, valid: { title: "2026/2027" }, invalid: { title: " " }, fields: ["title"] },
  { name: "createDefenseSchema", schema: admin.createDefenseSchema, valid: { groupId: UUID, date: "2026-11-20", room: "قاعة 1", grade: "15" }, invalid: { groupId: "g1", date: "", room: " " }, fields: ["groupId", "date", "room"] },
  { name: "updateDefenseSchema", schema: admin.updateDefenseSchema, valid: { grade: 12 }, invalid: { grade: 25 }, fields: ["grade"] },
  { name: "studentLoginSchema", schema: auth.studentLoginSchema, valid: { registrationNumber: "1", password: "p" }, invalid: { registrationNumber: "", password: "" }, fields: ["registrationNumber", "password"] },
  { name: "professorLoginSchema", schema: auth.professorLoginSchema, valid: { universityEmail: "a@b.dz", password: "p" }, invalid: { universityEmail: "a", password: "" }, fields: ["universityEmail", "password"] },
  { name: "adminLoginSchema", schema: auth.adminLoginSchema, valid: { email: "a@b.dz", password: "p" }, invalid: { email: "a", password: "" }, fields: ["email", "password"] },
  {
    name: "createTopicSchema",
    schema: professor.createTopicSchema,
    valid: { title: "ع", description: "و", maxStudents: "2", specializationId: "s", academicYearId: "y", references: [{ title: "د", url: "https://example.org" }] },
    invalid: { title: "", description: "", maxStudents: 11, specializationId: "", academicYearId: "", requirements: [" "], references: [{ title: "", url: "x" }] },
    fields: ["title", "description", "maxStudents", "specializationId", "academicYearId", "requirements.0", "references.0.title", "references.0.url"],
  },
  {
    name: "createTopicWithGroupSchema",
    schema: professor.createTopicWithGroupSchema,
    valid: { title: "ع", description: "و", maxStudents: 2, specializationId: "s", academicYearId: "y", memberRegistrationNumbers: ["1"], leaderRegistrationNumber: "1" },
    invalid: { title: "ع", description: "و", maxStudents: 0, specializationId: "s", academicYearId: "y", memberRegistrationNumbers: [], leaderRegistrationNumber: " " },
    fields: ["maxStudents", "memberRegistrationNumbers", "leaderRegistrationNumber"],
  },
  { name: "updateTopicSchema", schema: professor.updateTopicSchema, valid: { maxStudents: "3" }, invalid: { title: "" }, fields: ["title"] },
  {
    name: "createMilestoneSchema",
    schema: professor.createMilestoneSchema,
    valid: { title: "م", deadline: "2026-12-01T10:00", order: "1" },
    invalid: { title: "", deadline: "", order: 0 },
    fields: ["title", "deadline", "order"],
  },
  { name: "updateMilestoneSchema", schema: professor.updateMilestoneSchema, valid: { status: "completed" }, invalid: { status: "done" }, fields: ["status"] },
  {
    name: "createGroupRequestSchema",
    schema: student.createGroupRequestSchema,
    valid: { topicId: "t", priority: "1", memberRegistrationNumbers: ["2"] },
    invalid: { topicId: "", priority: 0, memberRegistrationNumbers: [" ", "1"] },
    fields: ["topicId", "priority", "memberRegistrationNumbers.0"],
  },
  // A list past its limit is refused for its size alone: zod (4.6) no longer
  // checks every element of an oversized collection — the fix for the memory
  // it could be made to exhaust (GHSA-mrhx-c7xc-m3w5). Its elements are
  // looked at once the list fits.
  {
    name: "createGroupRequestSchema — أعضاء أكثر من الحدّ",
    schema: student.createGroupRequestSchema,
    valid: { topicId: "t", priority: "1", memberRegistrationNumbers: Array(9).fill("1") },
    invalid: { topicId: "t", priority: "1", memberRegistrationNumbers: [" ", ...Array(9).fill("1")] },
    fields: ["memberRegistrationNumbers"],
  },
];

const KEY_LIKE = /^[a-z][\w-]*(\.[\w-]+)+$/i;

describe.each(CASES)("$name", ({ schema, valid, invalid, fields }) => {
  it("المدخل الصالح يمرّ", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("والمخالف يُرفض في حقوله، برسائل مترجمة", () => {
    const r = schema.safeParse(invalid);
    expect(r.success).toBe(false);
    const issues = r.error!.issues;
    expect(issues.map((i) => i.path.join(".")).sort()).toEqual(expect.arrayContaining(fields.sort()));
    for (const i of issues) {
      expect(i.message).toBeTruthy();
      expect(i.message).not.toMatch(KEY_LIKE);
    }
  });
});
