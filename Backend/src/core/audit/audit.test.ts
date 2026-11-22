jest.mock("../prisma/client", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    faculty: { findUnique: jest.fn() },
    auditLog: { create: jest.fn(), deleteMany: jest.fn() },
  },
}));

// Where an address is (core/geo): one address known, the rest nowhere. A plain
// function, not a mock: nothing between the tests resets it.
jest.mock("../geo/geo", () => ({
  geoOf: async (ip?: string | null) =>
    ip === "41.100.1.1" ? { country: "DZ", region: "Tlemcen", city: "Remchi", isp: "Telecom Algeria" } : null,
}));

import { EventEmitter } from "node:events";
import type { Request, Response } from "express";

import { prisma } from "../prisma/client";
import { Prisma } from "../../generated/prisma";
import { audit, auditBefore, auditNow, auditWrites, locate, pruneFailedSignIns, pruneSignIns, sanitize } from "./audit";

const db = prisma as unknown as {
  user: { findUnique: jest.Mock };
  faculty: { findUnique: jest.Mock };
  auditLog: { create: jest.Mock; deleteMany: jest.Mock };
};
/** الصفّ الذي كُتب آخراً. */
const row = () => db.auditLog.create.mock.lastCall![0].data;
/** يترك ما بدأه `audit` (بلا انتظار) يكتمل. */
const settle = () => new Promise((r) => setImmediate(r));

describe("audit — what a row may say about a request", () => {
  it("hides every secret, keeping only that one was given", () => {
    expect(
      sanitize({
        password: "12/05/2003",
        newPassword: "Tamtam#Oasis42",
        currentPassword: "x",
        code: "123456",
        challenge: "eyJ…",
        refreshToken: "abc",
        recoveryCodes: ["a", "b"],
        firstName: "أسامة",
        registrationNumber: "202131012345",
      }),
    ).toEqual({
      password: "[hidden]",
      newPassword: "[hidden]",
      currentPassword: "[hidden]",
      code: "[hidden]",
      challenge: "[hidden]",
      refreshToken: "[hidden]",
      recoveryCodes: "[hidden]",
      firstName: "أسامة",
      registrationNumber: "202131012345",
    });
  });

  it("hides secrets at any depth, and cuts what is too long", () => {
    const out = sanitize({ items: [{ email: "a@b.dz", password: "p" }], note: "x".repeat(400) }) as {
      items: { email: string; password: string }[];
      note: string;
    };
    expect(out.items[0]).toEqual({ email: "a@b.dz", password: "[hidden]" });
    expect(out.note.length).toBe(301);
    const long = sanitize(Array.from({ length: 30 }, (_, i) => i)) as unknown[];
    expect(long[long.length - 1]).toBe("… +10");
  });

  it("leaves out what is empty", () => {
    expect(sanitize({ password: "", note: undefined, ok: false })).toEqual({ ok: false });
  });
});

describe("audit — what a row may say about a request (the rest)", () => {
  it("dates as ISO, buffers by their size, and what is not data is left out", () => {
    expect(sanitize({ at: new Date("2026-10-13T08:00:00Z"), file: Buffer.alloc(3), run: () => 1 })).toEqual({
      at: "2026-10-13T08:00:00.000Z",
      file: "[3 bytes]",
    });
  });
});

describe("audit — who did it, readable after the account is gone", () => {
  const account = (over: Record<string, unknown>) => ({
    email: null,
    username: null,
    firstName: null,
    lastName: null,
    firstNameLatin: null,
    lastNameLatin: null,
    student: null,
    professor: null,
    ...over,
  });
  const labelFor = async (found: unknown) => {
    db.user.findUnique.mockResolvedValueOnce(found);
    await auditNow({ action: "x", actor: { id: "u1", role: "professor" } });
    return row().actorLabel;
  };

  beforeEach(() => {
    db.user.findUnique.mockReset();
    db.auditLog.create.mockReset().mockResolvedValue({});
  });

  /** الاسم بالعربية، وإلّا باللاتينية؛ ثم ما يُعرف به: البريد، أو بريد الجامعة، أو رقم التسجيل، أو اسم الدخول. */
  it("a name, then what the account is known by", async () => {
    expect(await labelFor(account({ firstNameLatin: "Youcef", lastNameLatin: "HAMADI", professor: { universityEmail: "y.hamadi@univ.dz" } }))).toBe(
      "Youcef HAMADI · y.hamadi@univ.dz",
    );
    expect(await labelFor(account({ student: { registrationNumber: "202039012345" } }))).toBe("202039012345");
    expect(await labelFor(account({ username: "registrar" }))).toBe("registrar");
  });

  it("nothing readable, or an account already gone ⇒ no label", async () => {
    expect(await labelFor(account({}))).toBeNull();
    expect(await labelFor(null)).toBeNull();
  });

  it("no actor and no request ⇒ nothing looked up, and the row says so", async () => {
    await auditNow({ action: "system.cleanup" });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(row()).toMatchObject({ actorId: null, actorLabel: null, ip: null, userAgent: null, details: Prisma.DbNull });
  });

  /** يُكتب بعد الحدث ولا يقف في طريقه: صفٌّ لا يُكتب يُذكر في سجلّ الخادم، والطلب ينجح. */
  it("a row that cannot be written is logged, and the caller never sees it", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    db.auditLog.create.mockRejectedValueOnce(new Error("db down"));
    try {
      expect(() => audit({ action: "user.delete" })).not.toThrow();
      await settle();
      expect(JSON.parse(logged.mock.calls[0]![0] as string)).toEqual({
        level: "error",
        scope: "audit",
        action: "user.delete",
        message: "db down",
      });
    } finally {
      logged.mockRestore();
    }
  });
});

describe("auditWrites — every successful change, as the route that made it", () => {
  beforeEach(() => db.auditLog.create.mockReset().mockResolvedValue({}));

  /** ما ردّ عليه وسيطٌ على الموجّه بلا مسارٍ مطابق: يُسجَّل بالمسار المطلوب. ومصفوفةٌ في الجسم تُحفظ كما هي. */
  it("a write answered with no matched route ⇒ recorded by its path; a list body is kept", async () => {
    const res = Object.assign(new EventEmitter(), { statusCode: 200, locals: {}, json: jest.fn() });
    const next = jest.fn();
    const req = { method: "POST", path: "/", params: {}, body: ["a", "b"], get: () => undefined } as unknown as Request;

    auditWrites(req, res as unknown as Response, next);
    res.emit("finish");
    await settle();

    expect(next).toHaveBeenCalled();
    expect(row()).toMatchObject({ action: "POST /", targetType: null, targetId: null, details: { body: ["a", "b"] } });
  });
});

describe("audit — what the platform read itself is kept whole", () => {
  it("no key hidden by its name, empty fields kept, two levels deeper", () => {
    expect(sanitize({ code: "FSS", changes: [{ field: "members", from: ["a", "b"], to: null }] }, 0, false)).toEqual({
      code: "FSS",
      changes: [{ field: "members", from: ["a", "b"], to: null }],
    });
    // What was sent keeps hiding them.
    expect(sanitize({ code: "FSS" })).toEqual({ code: "[hidden]" });
  });

  beforeEach(() => {
    db.user.findUnique.mockReset();
    db.faculty.findUnique.mockReset();
    db.auditLog.create.mockReset().mockResolvedValue({});
  });

  it("what was sent and what was read side by side; a value that is not an object, as `value`", async () => {
    await auditNow({ action: "x", details: { body: { name: "a" } }, facts: { changes: [{ field: "name", from: "b", to: "a" }] } });
    expect(row().details).toEqual({ body: { name: "a" }, changes: [{ field: "name", from: "b", to: "a" }] });
    await auditNow({ action: "x", details: "text" });
    expect(row().details).toEqual({ value: "text" });
    await auditNow({ action: "x", facts: {} });
    expect(row().details).toBe(Prisma.DbNull);
  });

  it("the target named: given, read from it, or nothing when it cannot be", async () => {
    await auditNow({ action: "x", actor: { label: "console" }, targetType: "users", targetId: "u1", targetLabel: "given" });
    expect(row().targetLabel).toBe("given");
    expect(db.user.findUnique).not.toHaveBeenCalled();

    db.user.findUnique.mockResolvedValueOnce({ firstName: "أ", lastName: "ب", email: "a@b.dz", student: null, professor: null });
    await auditNow({ action: "x", actor: { label: "console" }, targetType: "users", targetId: "u1" });
    expect(row().targetLabel).toBe("أ ب · a@b.dz");

    db.user.findUnique.mockRejectedValueOnce(new Error("db down"));
    await auditNow({ action: "x", actor: { label: "console" }, targetType: "users", targetId: "u1" });
    expect(row().targetLabel).toBeNull();

    await auditNow({ action: "x", actor: { label: "console" }, targetType: "session", targetId: "s1" });
    expect(row().targetLabel).toBeNull();
  });
});

describe("pruning: refused sign-ins, and the sign-ins of students and professors", () => {
  beforeEach(() => db.auditLog.deleteMany.mockReset());

  it("deletes what is older than the retention, an administrator's sign-ins excepted", async () => {
    db.auditLog.deleteMany.mockResolvedValue({ count: 4 });
    const DAYS_90 = 90 * 24 * 60 * 60 * 1000;
    const before = Date.now();
    expect(await pruneSignIns(90)).toBe(4);
    const after = Date.now();
    const where = db.auditLog.deleteMany.mock.lastCall![0].where;
    expect(where).toMatchObject({ action: { in: ["auth.login", "auth.logout"] }, actorRole: { in: ["student", "professor"] } });
    // Ninety days before the moment it ran — somewhere between the two clocks read around it.
    expect(where.createdAt.lt.getTime()).toBeGreaterThanOrEqual(before - DAYS_90);
    expect(where.createdAt.lt.getTime()).toBeLessThanOrEqual(after - DAYS_90);

    expect(await pruneFailedSignIns()).toBe(4);
    expect(db.auditLog.deleteMany.mock.lastCall![0].where.action.in).toContain("auth.loginFailed");
  });

  it("never throws: a failure is logged and nothing counted", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    db.auditLog.deleteMany.mockRejectedValue(new Error("db down"));
    try {
      expect(await pruneSignIns()).toBe(0);
      expect(JSON.parse(logged.mock.calls[0]![0] as string)).toMatchObject({ scope: "audit", action: "pruneSignIns", message: "db down" });
    } finally {
      logged.mockRestore();
    }
  });
});

describe("locate — what a change is about, from its route", () => {
  const at = (method: string, baseUrl: string | undefined, path: string, params: Record<string, unknown> = {}, user?: object) =>
    locate({ method, baseUrl, route: { path }, path, params, user } as unknown as Request);

  it("an item by its id; the administration's routes read as they always did", () => {
    expect(at("PATCH", "/api/admin", "/students/:id", { id: "s1" })).toEqual({ action: "PATCH /students/:id", kind: "students", id: "s1", mode: "existing" });
    expect(at("PUT", "/api/professor", "/topics/:id", { id: "t1" })).toEqual({ action: "PUT /professor/topics/:id", kind: "topics", id: "t1", mode: "existing" });
    expect(at("PATCH", "/api/admin", "/students/:id", { id: 7 }).id).toBeNull();
  });

  it("a create: what the route ends with when that is a kind, else what it starts with", () => {
    expect(at("POST", "/api/admin", "/projects/:groupId/milestones")).toMatchObject({ kind: "milestones", mode: "created" });
    expect(at("POST", "/api/admin", "/topics/assigned")).toMatchObject({ kind: "topics", mode: "created" });
    expect(at("POST", "/api/student", "/group-requests")).toMatchObject({ action: "POST /student/group-requests", kind: "group-requests" });
  });

  it("the supervision documents' router is named after them", () => {
    expect(at("PATCH", "/api/supervision-documents", "/:id/revoke", { id: "d1" })).toMatchObject({ kind: "supervision-documents", id: "d1", mode: "existing" });
    expect(at("POST", "/api/supervision-documents", "/topics/:topicId")).toMatchObject({ kind: "supervision-documents", mode: "created" });
  });

  it("a page of the site, one's own account, and the rest", () => {
    expect(at("PUT", "/api/admin", "/site-texts")).toEqual({ action: "PUT /site-texts", kind: "site-texts", id: "site-texts", mode: "page" });
    expect(at("PATCH", "/api/account", "/", {}, { userId: "u1" })).toEqual({ action: "PATCH /account", kind: "users", id: "u1", mode: "self" });
    expect(at("POST", "/api/account", "/email")).toEqual({ action: "POST /account/email", kind: "users", id: null, mode: "self" });
    expect(at("PATCH", "/api/admin", "/home-slides/order")).toEqual({ action: "PATCH /home-slides/order", kind: "home-slides", id: null, mode: "none" });
    expect(at("PATCH", undefined, "/")).toEqual({ action: "PATCH /", kind: null, id: null, mode: "none" });
  });
});

describe("auditWrites — before and after", () => {
  const faculty = (name: string) => ({ name, code: "F", coverUrl: null, iconUrl: null });
  const fakeRes = () => Object.assign(new EventEmitter(), { statusCode: 200, locals: {} as Record<string, unknown>, json: jest.fn() });
  const request = (over: Record<string, unknown>) =>
    ({ baseUrl: "/api/admin", params: {}, body: {}, get: () => undefined, user: { userId: "a1", role: "admin" }, ...over }) as unknown as Request;
  /** Lets the reads and the write that follow a step finish. */
  const flush = async () => {
    for (let i = 0; i < 5; i++) await settle();
  };

  beforeEach(() => {
    db.user.findUnique.mockReset().mockResolvedValue(null);
    db.faculty.findUnique.mockReset();
    db.auditLog.create.mockReset().mockResolvedValue({});
  });

  it("on a router: the item read when its id is known, before the change; the fields that changed written after", async () => {
    const res = fakeRes();
    const next = jest.fn();
    const req = request({ method: "PATCH", path: "/faculties/f1", body: { name: "B" } });
    auditWrites(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);

    // The route matched: Express sets it, then asks for the id.
    Object.assign(req, { route: { path: "/faculties/:id" }, params: { id: "f1" } });
    db.faculty.findUnique.mockResolvedValueOnce(faculty("A")).mockResolvedValueOnce(faculty("B"));
    auditBefore(req, res as unknown as Response, next);
    await flush();
    expect(next).toHaveBeenCalledTimes(2);

    res.emit("finish");
    await flush();
    expect(row()).toMatchObject({
      action: "PATCH /faculties/:id",
      targetType: "faculties",
      targetId: "f1",
      targetLabel: "B",
      details: { body: { name: "B" }, changes: [{ field: "name", from: "A", to: "B" }] },
    });
  });

  it("a create: its id from the answer, and what it holds", async () => {
    const res = fakeRes();
    const req = request({ method: "POST", path: "/faculties", route: { path: "/faculties" }, body: { name: "A", code: "F" } });
    db.faculty.findUnique.mockResolvedValueOnce(faculty("A"));
    const sent = res.json;
    auditWrites(req, res as unknown as Response, jest.fn());
    await flush();
    (res as unknown as Response).json({ message: "Faculty created", faculty: { id: "f9" } });
    // Still answered: the answer is only read on its way out.
    expect(sent).toHaveBeenCalledWith({ message: "Faculty created", faculty: { id: "f9" } });
    res.emit("finish");
    await flush();
    expect(row()).toMatchObject({ targetId: "f9", targetLabel: "A", details: { created: { name: "A", code: "F" } } });
  });

  it("a delete: what it held; and the counts an answer gives", async () => {
    const res = fakeRes();
    const req = request({ method: "DELETE", path: "/faculties/f1", route: { path: "/faculties/:id" }, params: { id: "f1" } });
    db.faculty.findUnique.mockResolvedValueOnce(faculty("A")).mockResolvedValueOnce(null);
    auditWrites(req, res as unknown as Response, jest.fn());
    await flush();
    (res as unknown as Response).json({ message: "Faculty deleted", removed: 1 });
    res.emit("finish");
    await flush();
    expect(row()).toMatchObject({ targetLabel: "A", details: { deleted: { name: "A", code: "F" }, result: { removed: 1 } } });
  });

  it("a refused change, a read, one's own bell: nothing written", async () => {
    const res = fakeRes();
    const next = jest.fn();
    auditWrites(request({ method: "POST", path: "/faculties", route: { path: "/faculties" } }), res as unknown as Response, next);
    await flush();
    res.statusCode = 400;
    res.emit("finish");
    await flush();

    auditWrites(request({ method: "GET", path: "/faculties" }), fakeRes() as unknown as Response, next);
    auditWrites(request({ method: "PATCH", path: "/notifications/read-all" }), fakeRes() as unknown as Response, next);
    // Asked for an id with nothing pending (a read, or the bell): straight on.
    auditBefore(request({ method: "GET" }), fakeRes() as unknown as Response, next);
    auditBefore(request({ method: "PATCH" }), fakeRes() as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(5);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("a change that cannot be recorded is logged; the request was already answered", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const res = fakeRes();
      const req = request({ method: "PATCH", path: "/home-slides/order", route: { path: "/home-slides/order" } });
      Object.defineProperty(req, "body", {
        get: () => {
          throw new Error("unreadable");
        },
      });
      auditWrites(req, res as unknown as Response, jest.fn());
      await flush();
      res.emit("finish");
      await flush();
      expect(JSON.parse(logged.mock.calls[0]![0] as string)).toMatchObject({ scope: "audit", action: "PATCH", message: "unreadable" });
    } finally {
      logged.mockRestore();
    }
  });
});

describe("audit — where the address was", () => {
  beforeEach(() => db.auditLog.create.mockReset().mockResolvedValue({}));

  it("the country, wilaya, city and network of the address, as known the day it was written", async () => {
    await auditNow({ action: "auth.login", actor: { label: "x" }, device: { ip: "41.100.1.1", userAgent: null } });
    expect(row()).toMatchObject({ ip: "41.100.1.1", country: "DZ", region: "Tlemcen", city: "Remchi", isp: "Telecom Algeria" });
    await auditNow({ action: "auth.login", actor: { label: "x" }, device: { ip: "::1", userAgent: null } });
    expect(row()).toMatchObject({ country: null, region: null, city: null, isp: null });
  });
});
