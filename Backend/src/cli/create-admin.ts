/**
 * ينشئ حساب مسؤول (admin) — الطريقة الوحيدة لأول حسابٍ على قاعدةٍ جديدة.
 *
 * `dev-only/seed-accounts.sql` حساباتٌ تجريبية بكلمة مرورٍ مكتوبةٍ في المستودع،
 * فلا تصلح لسيرفر حقيقي (ولا تدخل صورة Docker). هذا الأمر يأخذ كلمة المرور من
 * صاحبها: من متغيّر بيئة، أو يسألها في الطرفية دون أن تظهر على الشاشة — وتخضع
 * لسياسة كلمات المرور (core/auth/password-policy) كأيّ كلمةٍ يختارها صاحبها.
 *
 * وعند أوّل دخولٍ يُطلب من المسؤول إعداد التحقّق بخطوتين (تطبيق المصادقة).
 *
 * الإنتاج (داخل الحاوية):   node dist/cli/create-admin.js
 * التطوير:                   npm run create-admin:dev
 *
 * المتغيّرات (كلّها اختيارية؛ الناقص يُسأل عنه إن كانت الطرفية تفاعلية):
 *   ADMIN_EMAIL، ADMIN_USERNAME (أحدهما على الأقل)
 *   ADMIN_PASSWORD
 *   ADMIN_FIRST_NAME، ADMIN_LAST_NAME
 *
 * لا يمسّ حساباً موجوداً: إن كان البريد أو اسم المستخدم مأخوذاً يتوقّف.
 *
 * والأجزاء مُصدَّرة ليختبرها `create-admin.test.ts`: كلّ ما يلمس الطرفية
 * (البيئة، والإدخال، والإخراج، والخروج) يصلها من `io` لا من `process`. ولا
 * يعمل الأمر إلّا حين يُشغَّل هو نفسه — لا حين يُستورَد.
 */
import "dotenv/config";
import readline from "node:readline/promises";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "../core/prisma/client";
import { config } from "../core/config/app.config";
import { passwordSchema } from "../modules/admin/admin.validation";
import { passwordIssue } from "../core/auth/password-policy";
import { auditNow } from "../core/audit/audit";
import { tr } from "../core/i18n";

/** خطأٌ يُطبع كما هو ويُنهي الأمر — لا أثر مكدّسٍ ولا رسالة داخلية. */
export class CliError extends Error {}

/** ما يلمسه الأمر من العالم خارجه. */
export interface CliIO {
  env: NodeJS.ProcessEnv;
  interactive: boolean;
  stdin: Pick<NodeJS.ReadStream, "setRawMode" | "resume" | "pause" | "setEncoding" | "on" | "off">;
  stdout: { write: (text: string) => unknown };
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => void;
  /** يسأل سؤالاً ظاهراً — `null` حين لا طرفية تُسأل. */
  question: ((prompt: string) => Promise<string>) | null;
  close: () => void;
}

export function processIO(): CliIO {
  const interactive = process.stdin.isTTY === true;
  const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
  return {
    env: process.env,
    interactive,
    stdin: process.stdin,
    stdout: process.stdout,
    log: console.log,
    error: console.error,
    exit: (code) => process.exit(code),
    question: rl ? (prompt) => rl.question(prompt) : null,
    close: () => rl?.close(),
  };
}

/** قيمة من البيئة، وإلّا سؤالٌ في الطرفية، وإلّا فارغة. */
export async function ask(io: CliIO, envKey: string, label: string): Promise<string> {
  const fromEnv = io.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  if (!io.question) return "";
  return (await io.question(`${label}: `)).trim();
}

/** يقرأ سطراً دون أن يعرضه — لكلمة المرور. */
export function askHidden(io: CliIO, label: string): Promise<string> {
  return new Promise((resolve) => {
    const { stdin } = io;
    io.stdout.write(`${label}: `);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          io.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          // Ctrl+C
          io.stdout.write("\n");
          io.exit(130);
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

export async function readPassword(io: CliIO): Promise<string> {
  const fromEnv = io.env.ADMIN_PASSWORD;
  if (fromEnv) return fromEnv;
  if (!io.interactive) {
    throw new CliError("ADMIN_PASSWORD is not set and the terminal is not interactive.");
  }
  const first = await askHidden(io, "Password (8–72 characters)");
  const second = await askHidden(io, "Repeat password");
  if (first !== second) throw new CliError("The two passwords do not match.");
  return first;
}

export interface AdminInput {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

/** بمَ يدخل: بريدٌ صالح، أو اسم مستخدم — قبل أن تُسأل كلمة المرور. */
export function checkIdentity(email: string, username: string) {
  if (!email && !username) throw new CliError("An email or a username is required.");
  if (email && !z.email().safeParse(email).success) {
    throw new CliError(`"${email}" is not a valid email address.`);
  }
}

/** يتحقّق، ثمّ ينشئ الحساب ويكتب ذلك في سجلّ العمليات. */
export async function createAdmin(input: AdminInput) {
  const email = input.email.trim().toLowerCase();
  const { username, firstName, lastName, password } = input;
  checkIdentity(email, username);

  const checked = passwordSchema.safeParse(password);
  if (!checked.success) throw new CliError(checked.error.issues[0]!.message);
  const issue = passwordIssue(password);
  if (issue) throw new CliError(tr(`password.${issue}`, undefined, "en"));

  const taken = await prisma.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(username ? [{ username }] : []),
      ],
    },
    select: { id: true },
  });
  if (taken) throw new CliError("A user with this email or username already exists.");

  const user = await prisma.user.create({
    data: {
      email: email || null,
      username: username || null,
      firstName: firstName || null,
      lastName: lastName || null,
      password: await bcrypt.hash(password, config.BCRYPT_ROUNDS),
      role: "admin",
      isVerified: true,
    },
    select: { id: true, email: true, username: true },
  });

  await auditNow({
    action: "cli.adminCreated",
    actor: { label: "server console" },
    targetType: "users",
    targetId: user.id,
    details: { email: user.email, username: user.username },
  });
  return user;
}

/** الأمر كاملاً: يسأل، وينشئ، ويقول ما جرى. يُعيد رمز الخروج. */
export async function run(io: CliIO): Promise<number> {
  try {
    const email = (await ask(io, "ADMIN_EMAIL", "Email (leave empty for none)")).toLowerCase();
    const username = await ask(io, "ADMIN_USERNAME", "Username (leave empty for none)");
    const firstName = await ask(io, "ADMIN_FIRST_NAME", "First name");
    const lastName = await ask(io, "ADMIN_LAST_NAME", "Last name");
    io.close();

    // Who first, then the password — no password is asked for an account
    // that could not be created anyway.
    checkIdentity(email, username);
    const password = await readPassword(io);
    const user = await createAdmin({ email, username, firstName, lastName, password });

    io.log(`✔ Admin created: ${user.email ?? user.username} (id ${user.id})`);
    if (config.REQUIRE_ADMIN_2FA) {
      io.log("  On first sign-in they will be asked to set up two-step verification (an authenticator app).");
    }
    return 0;
  } catch (err) {
    if (err instanceof CliError) io.error(`✖ ${err.message}`);
    else io.error("✖ Could not create the admin:", err instanceof Error ? err.message : err);
    return 1;
  }
}

/** The command's entry: its exit code, then the database let go. */
export async function main(io: CliIO = processIO()) {
  try {
    process.exitCode = await run(io);
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when started as a command (node dist/cli/create-admin.js), never on import.
// Jest never runs a file as the main module, so this one line is checked by
// running the command itself (as src/server.ts is left to its own run).
/* istanbul ignore next */
if (require.main === module) void main();
