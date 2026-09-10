import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const BACKEND = path.resolve(HERE, "..", "..", "Backend");
export const ACCOUNTS_FILE = path.join(HERE, ".accounts.json");

export interface Accounts {
  password: string;
  admin: { email: string };
  owner: { email: string };
  professor: { universityEmail: string };
  student: { registrationNumber: string };
  studentNoProject: { registrationNumber: string };
  specializationId: string;
  academicYearId: string;
}

/**
 * يبذر قاعدة الاختبار مرّةً واحدة قبل كل التشغيل.
 *
 * والبذر يجري في الخلفية بـ`tsx` لا هنا: هناك يعيش `prisma` وهناك يعيش
 * الحارس الذي يرفض أي قاعدة لا ينتهي اسمها بـ`_test`. واستنساخُ أيٍّ منهما
 * في هذه الحزمة كان سيصنع نسخةً ثانية تتباعد عن الأولى بصمت.
 *
 * والحسابات المُنشأة تُكتب في ملفٍّ يقرأه كل اختبار، فلا يُخمّن أحدٌ بريداً
 * ولا رقم تسجيل.
 */
export default function globalSetup() {
  const out = execFileSync("npm", ["run", "--silent", "e2e:seed"], {
    cwd: BACKEND,
    encoding: "utf8",
    shell: true,
  });

  // السطر الأخير وحده هو JSON: npm قد يطبع قبله ما يطبع.
  const json = out.slice(out.indexOf("{"));
  const accounts = JSON.parse(json) as Accounts;

  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf8");
}
