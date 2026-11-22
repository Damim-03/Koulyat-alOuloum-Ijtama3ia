/**
 * إنشاء أوّل مسؤولٍ على سيرفرٍ جديد — من الطرفية.
 *
 * يُختبر بقاعدةٍ مزيّفة وطرفيةٍ مزيّفة: ما يُكتب، وما يُخفى، وCtrl+C، وكلّ
 * سببٍ يرفض لأجله الأمر إنشاء الحساب — ولا حسابَ يُنشأ في أيّ منها.
 */
jest.mock("../core/prisma/client", () => ({
  prisma: {
    user: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));
jest.mock("bcryptjs", () => ({ __esModule: true, default: { hash: jest.fn() } }));
jest.mock("node:readline/promises", () => ({
  __esModule: true,
  default: { createInterface: jest.fn() },
}));

import { EventEmitter } from "node:events";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";

import { prisma } from "../core/prisma/client";
import { config } from "../core/config/app.config";
import {
  ask,
  askHidden,
  checkIdentity,
  CliError,
  createAdmin,
  main,
  processIO,
  readPassword,
  run,
  type CliIO,
} from "./create-admin";

const db = prisma as unknown as {
  user: { findFirst: jest.Mock; create: jest.Mock; findUnique: jest.Mock };
  auditLog: { create: jest.Mock };
};
const hash = bcrypt.hash as unknown as jest.Mock;
const mutable = config as { REQUIRE_ADMIN_2FA: boolean };
const wasRequired = mutable.REQUIRE_ADMIN_2FA;

const GOOD = "Tamtam#Oasis42";

/** لوحة مفاتيح مزيّفة: كلّ قراءةٍ مخفيّة تأخذ السطر التالي ممّا «كُتب». */
class FakeStdin extends EventEmitter {
  constructor(public typed: string[] = []) {
    super();
  }
  setRawMode = jest.fn();
  resume = jest.fn();
  pause = jest.fn();
  setEncoding = jest.fn();
  override on(event: string | symbol, listener: (...args: unknown[]) => void) {
    super.on(event, listener);
    if (event === "data") queueMicrotask(() => this.emit("data", this.typed.shift() ?? ""));
    return this;
  }
}

function fakeIO(over: Partial<CliIO> & { typed?: string[]; answers?: string[] } = {}) {
  const { typed, answers, ...rest } = over;
  const written: string[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  const queue = [...(answers ?? [])];
  const io: CliIO = {
    env: {},
    interactive: false,
    stdin: new FakeStdin(typed) as unknown as CliIO["stdin"],
    stdout: { write: (t: string) => written.push(t) },
    log: (...a) => logs.push(a.join(" ")),
    error: (...a) => errors.push(a.join(" ")),
    exit: jest.fn(),
    question: answers ? jest.fn(async () => queue.shift() ?? "") : null,
    close: jest.fn(),
    ...rest,
  };
  return { io, written, logs, errors };
}

beforeEach(() => {
  db.user.findFirst.mockReset().mockResolvedValue(null);
  db.user.create.mockReset().mockImplementation(async ({ data }) => ({ id: "new-admin", email: data.email, username: data.username }));
  db.auditLog.create.mockReset().mockResolvedValue({});
  hash.mockReset().mockImplementation(async (p: string) => `hashed:${p}`);
  mutable.REQUIRE_ADMIN_2FA = wasRequired;
});

describe("checkIdentity — بمَ يدخل", () => {
  it("بريدٌ أو اسم مستخدم، والبريد صالح", () => {
    expect(() => checkIdentity("", "")).toThrow("An email or a username is required.");
    expect(() => checkIdentity("not-an-email", "")).toThrow('"not-an-email" is not a valid email address.');
    expect(() => checkIdentity("", "registrar")).not.toThrow();
    expect(() => checkIdentity("a@univ-eloued.dz", "")).not.toThrow();
  });
});

describe("createAdmin", () => {
  const input = { email: "  Dean@Univ-Eloued.DZ ", username: "", firstName: "يوسف", lastName: "", password: GOOD };

  it("ينشئ مسؤولاً موثّقاً بكلمةٍ مُعمّاة، ويكتب ذلك في سجلّ العمليات", async () => {
    const user = await createAdmin(input);

    expect(user).toEqual({ id: "new-admin", email: "dean@univ-eloued.dz", username: null });
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          email: "dean@univ-eloued.dz",
          username: null,
          firstName: "يوسف",
          lastName: null,
          password: `hashed:${GOOD}`,
          role: "admin",
          isVerified: true,
        },
      }),
    );
    expect(db.auditLog.create.mock.lastCall![0].data).toMatchObject({
      action: "cli.adminCreated",
      actorLabel: "server console",
      targetId: "new-admin",
    });
  });

  it("وباسم مستخدمٍ بلا بريد", async () => {
    await createAdmin({ ...input, email: "", username: "registrar" });
    expect(db.user.findFirst.mock.lastCall![0].where).toEqual({ OR: [{ username: "registrar" }] });
  });

  it.each([
    ["كلمةٌ قصيرة", "Ab1!x", /at least 8/],
    ["كلمةٌ شائعة", "Azerty2024!", /common passwords/],
    ["تاريخ ميلاد", "12/05/2003", /letters with digits/],
  ])("يرفض %s ولا ينشئ شيئاً", async (_label, password, message) => {
    await expect(createAdmin({ ...input, password })).rejects.toThrow(message);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("ولا يمسّ حساباً موجوداً", async () => {
    db.user.findFirst.mockResolvedValue({ id: "someone" });
    await expect(createAdmin(input)).rejects.toThrow("already exists");
    expect(db.user.create).not.toHaveBeenCalled();
  });
});

describe("الطرفية", () => {
  it("ask: البيئة أوّلاً، ثمّ السؤال، وإلّا فارغ", async () => {
    expect(await ask(fakeIO({ env: { ADMIN_EMAIL: "  a@b.dz " } }).io, "ADMIN_EMAIL", "Email")).toBe("a@b.dz");
    expect(await ask(fakeIO().io, "ADMIN_EMAIL", "Email")).toBe("");
    const { io } = fakeIO({ answers: ["  typed  "] });
    expect(await ask(io, "ADMIN_EMAIL", "Email")).toBe("typed");
    expect(io.question).toHaveBeenCalledWith("Email: ");
  });

  it("askHidden: لا يُعرض ما يُكتب، والمسح يمحو، وEnter ينهي", async () => {
    const { io, written } = fakeIO({ typed: ["ab\u007fc\bd\r"] });
    expect(await askHidden(io, "Password")).toBe("ad");
    const stdin = io.stdin as unknown as FakeStdin;
    expect(stdin.setRawMode.mock.calls).toEqual([[true], [false]]);
    expect(stdin.pause).toHaveBeenCalled();
    expect(stdin.listenerCount("data")).toBe(0);
    expect(written).toEqual(["Password: ", "\n"]);
  });

  it("askHidden: Ctrl+C يخرج بالرمز 130", async () => {
    const { io } = fakeIO({ typed: ["x\u0003"] });
    void askHidden(io, "Password");
    await new Promise((r) => setImmediate(r));
    expect(io.exit).toHaveBeenCalledWith(130);
  });

  it("readPassword: من البيئة؛ أو مرّتين متطابقتين؛ وإلّا يرفض", async () => {
    expect(await readPassword(fakeIO({ env: { ADMIN_PASSWORD: GOOD } }).io)).toBe(GOOD);
    await expect(readPassword(fakeIO().io)).rejects.toThrow("not interactive");
    expect(await readPassword(fakeIO({ interactive: true, typed: [`${GOOD}\r`, `${GOOD}\n`] }).io)).toBe(GOOD);
    await expect(readPassword(fakeIO({ interactive: true, typed: [`${GOOD}\r`, "other\r"] }).io)).rejects.toThrow(
      "do not match",
    );
  });

  it("processIO: بلا طرفيةٍ لا أسئلة؛ ومعها سؤالٌ يُطرح ويُغلق", async () => {
    const plain = processIO();
    expect(plain.question).toBeNull();
    expect(plain.env).toBe(process.env);
    plain.close();

    const rl = { question: jest.fn(async () => "answer"), close: jest.fn() };
    (readline.createInterface as jest.Mock).mockReturnValue(rl);
    const tty = process.stdin.isTTY;
    process.stdin.isTTY = true;
    try {
      const io = processIO();
      expect(io.interactive).toBe(true);
      expect(await io.question!("Q: ")).toBe("answer");
      io.close();
      expect(rl.close).toHaveBeenCalled();
    } finally {
      process.stdin.isTTY = tty;
    }
  });

  it("processIO: الخروج هو خروج العمليّة", () => {
    const exit = jest.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    processIO().exit(3);
    expect(exit).toHaveBeenCalledWith(3);
  });
});

describe("run — الأمر كاملاً", () => {
  const env = { ADMIN_EMAIL: "dean@univ-eloued.dz", ADMIN_PASSWORD: GOOD };

  it("من البيئة: ينشئ ويقول ذلك، ويذكّر بالتحقّق بخطوتين", async () => {
    mutable.REQUIRE_ADMIN_2FA = true;
    const { io, logs } = fakeIO({ env });
    expect(await run(io)).toBe(0);
    expect(logs[0]).toBe("✔ Admin created: dean@univ-eloued.dz (id new-admin)");
    expect(logs[1]).toContain("two-step verification");
    expect(io.close).toHaveBeenCalled();
  });

  it("ولا يذكّر به حين لا يُطلب، ويسمّي الحساب باسم مستخدمه إن لم يكن له بريد", async () => {
    mutable.REQUIRE_ADMIN_2FA = false;
    const { io, logs } = fakeIO({ env: { ADMIN_USERNAME: "registrar", ADMIN_PASSWORD: GOOD } });
    expect(await run(io)).toBe(0);
    expect(logs).toEqual(["✔ Admin created: registrar (id new-admin)"]);
  });

  it("تفاعلياً: يسأل عن كلّ شيء، والبريد بأحرفٍ صغيرة", async () => {
    const { io } = fakeIO({
      interactive: true,
      answers: ["Dean@Univ-Eloued.DZ", "", "يوسف", "حمادي"],
      typed: [`${GOOD}\r`, `${GOOD}\r`],
    });
    expect(await run(io)).toBe(0);
    expect(db.user.create.mock.lastCall![0].data).toMatchObject({ email: "dean@univ-eloued.dz", firstName: "يوسف", lastName: "حمادي" });
  });

  it("بريدٌ غير صالح يُرفض قبل أن تُسأل كلمة المرور", async () => {
    const { io, errors } = fakeIO({ interactive: true, answers: ["not-an-email", "", "", ""], typed: [] });
    expect(await run(io)).toBe(1);
    expect(errors).toEqual(['✖ "not-an-email" is not a valid email address.']);
    expect((io.stdin as unknown as FakeStdin).setRawMode).not.toHaveBeenCalled();
  });

  it("ورفضٌ معروف يُطبع كما هو؛ وعطلٌ غير متوقّع يُذكر بسببه", async () => {
    const refused = fakeIO({ env: { ...env, ADMIN_PASSWORD: "short" } });
    expect(await run(refused.io)).toBe(1);
    expect(refused.errors[0]).toMatch(/^✖ .*8/);

    db.user.create.mockRejectedValue(new Error("db down"));
    const broken = fakeIO({ env });
    expect(await run(broken.io)).toBe(1);
    expect(broken.errors).toEqual(["✖ Could not create the admin: db down"]);

    db.user.create.mockRejectedValue("not an Error");
    const odd = fakeIO({ env });
    expect(await run(odd.io)).toBe(1);
    expect(odd.errors).toEqual(["✖ Could not create the admin: not an Error"]);
  });

  it("CliError رسالةٌ للإنسان لا أثرٌ مكدّس", () => {
    expect(new CliError("x")).toBeInstanceOf(Error);
  });
});

describe("main — مدخل الأمر", () => {
  it("رمز الخروج للعمليّة، ثمّ تُترك القاعدة — نجح أم لا", async () => {
    const disconnect = jest.fn();
    (prisma as unknown as { $disconnect: jest.Mock }).$disconnect = disconnect;
    const exitCode = process.exitCode;
    try {
      await main(fakeIO({ env: { ADMIN_EMAIL: "dean@univ-eloued.dz", ADMIN_PASSWORD: GOOD } }).io);
      expect(process.exitCode).toBe(0);
      await main(fakeIO({ env: {} }).io);
      expect(process.exitCode).toBe(1);
      expect(disconnect).toHaveBeenCalledTimes(2);
    } finally {
      process.exitCode = exitCode;
    }
  });

  it("وبلا وسيطٍ — كما تشغّله الطرفية — يقرأ بيئة العمليّة وطرفيّتها", async () => {
    (prisma as unknown as { $disconnect: jest.Mock }).$disconnect = jest.fn();
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const saved = { email: process.env.ADMIN_EMAIL, username: process.env.ADMIN_USERNAME };
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_USERNAME;
    const exitCode = process.exitCode;
    try {
      await main();
      expect(process.exitCode).toBe(1);
      expect(error).toHaveBeenCalledWith("✖ An email or a username is required.");
    } finally {
      process.exitCode = exitCode;
      if (saved.email !== undefined) process.env.ADMIN_EMAIL = saved.email;
      if (saved.username !== undefined) process.env.ADMIN_USERNAME = saved.username;
    }
  });
});
