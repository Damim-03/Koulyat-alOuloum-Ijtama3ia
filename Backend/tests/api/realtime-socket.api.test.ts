/**
 * الزمن الحقيقي — مصافحة Socket.IO والغرف.
 *
 * هذه الطبقة كانت **صفراً بالكامل**: ١٤٠ سطراً موصولةً بالإنتاج لم يُنفَّذ
 * منها سطرٌ واحد تحت ٦٤٨ اختباراً. والسبب بنيويّ لا كسل — بقيّة الاختبارات
 * تستورد `app.ts`، وSocket.IO يعيش في `server.ts`، فبقيت خارج الشبكة.
 *
 * وما بقي بلا شاهدٍ ليس تفصيلاً: تعليق `socket-auth.ts` يقول إن التنفيذ
 * السابق كان يقبل الغرف من العميل —
 *
 *     socket.on("join", (p) => { socket.join(room.user(p.userId));
 *                                socket.join(room.role(p.role)); });
 *
 * — فكان أيّ أحدٍ يفتح سوكيت **بلا رمزٍ أصلاً** يدخل `role:admin` ويستقبل كل
 * إشعارٍ وكل حدث تغييرٍ موجَّهٍ للإدارة. وهذا الملفّ هو الشاهد على أن الباب
 * أُغلق فعلاً.
 *
 * ولذلك يستورد **`server.ts` نفسه** لا نسخةً منه: لو بنيتُ خادماً مكافئاً هنا
 * لأثبتُّ أن `installSocketSecurity` تعمل — لا أن أحداً يستدعيها. والفرق بين
 * الاثنين هو الفرق بين اختبارٍ يحرس وآخر يُطمئن.
 */
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";

import jwt from "jsonwebtoken";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { Server as IOServer } from "socket.io";

import { prisma } from "../../src/core/prisma/client";
import { config } from "../../src/core/config/app.config";
import { signAccessToken, signRefreshToken } from "../../src/core/auth/tokens";
import { room } from "../../src/core/realtime/realtime";
import {
  broadcastChange,
  emitToUsers,
  pushNotification,
} from "../../src/core/realtime/realtime";
import { seed, teardown, residue, TAG, type Fixture } from "../helpers/fixture";

let f: Fixture;
let httpServer: HttpServer;
let io: IOServer;
let url = "";

/** كل عميلٍ فُتح في اختبار، ليُغلق بعده مهما كان مصيره. */
let open: ClientSocket[] = [];

const claimsFor = (
  userId: string,
  role: "admin" | "professor" | "student",
  refId: string,
  over: Partial<{ tokenVersion: number; sid: string }> = {},
) => ({
  userId,
  role: role as never,
  refId,
  tokenVersion: 0,
  sid: `${TAG}-sid-${Math.random().toString(36).slice(2)}`,
  ...over,
});

/** يفتح اتّصالاً وينتظر نتيجته: يُرجع العميل عند القبول، ويرمي عند الرفض. */
function connect(
  auth: { token?: string; header?: string } = {},
): Promise<ClientSocket> {
  const socket = ioClient(url, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
    auth: auth.token ? { token: auth.token } : {},
    extraHeaders: auth.header ? { authorization: auth.header } : undefined,
  });
  open.push(socket);

  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => reject(err));
  });
}

/** يتوقّع الرفض ويُرجع سببه المعلن. */
async function refused(auth: Parameters<typeof connect>[0] = {}) {
  await expect(connect(auth)).rejects.toBeDefined();
  // نُعيد المحاولة لالتقاط الرسالة نفسها دون افتراضٍ عن شكل الخطأ.
  return connect(auth).catch((e: Error) => e.message);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ينتظر حتى يصير الشرط صحيحاً، أو يفشل بمهلة. */
async function waitUntil(fn: () => boolean, ms = 2000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (fn()) return;
    await sleep(10);
  }
  throw new Error("انقضت المهلة قبل تحقّق الشرط");
}

/** الغرف التي دخلها هذا الاتّصال **على الخادم** — لا ما يدّعيه العميل. */
async function serverRooms(socket: ClientSocket) {
  await waitUntil(() => io.sockets.sockets.has(socket.id!));
  return io.sockets.sockets.get(socket.id!)!.rooms;
}

/** يلتقط أوّل حدثٍ بهذا الاسم، أو `null` إن لم يصل خلال المهلة. */
function catchEvent(socket: ClientSocket, event: string, ms = 400) {
  return new Promise<unknown>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(event, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  await teardown();
  f = await seed(16);

  /*
   * `PORT=0` يأتي من `.env.test` — «أعطني أي منفذٍ حرّ». ولا يصلح ضبطه هنا:
   * `app.config` يُقرأ لحظة الاستيراد، وقد قُرئ قبل أن يصل التنفيذ إلى هذا
   * السطر. والتأكيد أدناه يجعل الشرط مرئياً بدل أن يكون افتراضاً صامتاً —
   * فأخذُ منفذ التطوير من صاحبه ليس عطلاً يُكتشف بسهولة.
   */
  expect(config.PORT).toBe(0);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../../src/server") as typeof import("../../src/server");
  httpServer = mod.server;
  io = mod.io;

  if (!httpServer.listening) await once(httpServer, "listening");
  const address = httpServer.address() as AddressInfo;
  url = `http://127.0.0.1:${address.port}`;
});

afterEach(() => {
  for (const s of open) s.close();
  open = [];
});

/*
 * كل خطوة محروسة بـ`?.`: لو سقط `beforeAll` لبقي بعض هذه غير مُعرَّف، ورميةٌ
 * هنا تمنع `$disconnect` فيبقى اتّصال القاعدة مفتوحاً — ولا يخرج Jest. وقد
 * وقع ذلك فعلاً: تأكيدٌ فاشل في التجهيز عُلِّق التشغيل عشر دقائق بلا رسالة
 * تدلّ عليه.
 */
afterAll(async () => {
  io?.close();
  if (httpServer?.listening) {
    httpServer.close();
    await once(httpServer, "close");
  }
  await teardown();
  expect(await residue()).toBe(0);
  await prisma.$disconnect();
});

//
// ═══ حارسٌ قبل الباب ═══
//

describe("مصافحة السوكيت — من يُقبل", () => {
  /**
   * هذا هو الاختبار الذي كان غيابه يعني أن الثغرة الأصلية قد تعود دون أن
   * يلاحظ أحد: اتّصالٌ بلا رمزٍ إطلاقاً.
   */
  it("بلا رمز ⇒ يُردّ عند المصافحة", async () => {
    expect(await refused()).toBe("UNAUTHORIZED");
  });

  it("ورمزٌ مشوّه ⇒ يُردّ", async () => {
    expect(await refused({ token: "ليس.رمزاً.أصلاً" })).toBe("UNAUTHORIZED");
  });

  it("ورمزٌ فارغ أو فراغات ⇒ يُردّ", async () => {
    expect(await refused({ token: "   " })).toBe("UNAUTHORIZED");
  });

  it("ورمزٌ صحيح ⇒ يُقبل", async () => {
    const token = signAccessToken(
      claimsFor(f.admin.id, "admin", f.admin.id) as never,
    );
    const socket = await connect({ token });
    expect(socket.connected).toBe(true);
  });

  /**
   * الترويسة مقبولةٌ عمداً حتى يُعيد العميل استعمال ما لديه للـHTTP. وهذا
   * طريقُ دخولٍ ثانٍ — فلو حُرِس أحدهما وأُهمل الآخر لبقي الباب مفتوحاً من
   * جهة.
   */
  it("والرمز عبر ترويسة Authorization ⇒ يُقبل كذلك", async () => {
    const token = signAccessToken(
      claimsFor(f.admin.id, "admin", f.admin.id) as never,
    );
    const socket = await connect({ header: `Bearer ${token}` });
    expect(socket.connected).toBe(true);
  });

  it("ورمز التحديث مقدَّماً كرمز وصول ⇒ يُردّ", async () => {
    const refresh = signRefreshToken(
      claimsFor(f.admin.id, "admin", f.admin.id) as never,
    );
    expect(await refused({ token: refresh })).toBe("UNAUTHORIZED");
  });

  it("ورمزٌ موقَّع بسرٍّ آخر ⇒ يُردّ", async () => {
    const forged = jwt.sign(
      { ...claimsFor(f.admin.id, "admin", f.admin.id), typ: "access" },
      "not-the-real-secret",
      {
        algorithm: "HS256",
        expiresIn: "15m",
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );
    expect(await refused({ token: forged })).toBe("UNAUTHORIZED");
  });

  /**
   * السرّ نفسه والمُصدِر نفسه والجمهور نفسه — لا يردّه إلا تثبيت الخوارزمية
   * في `verifyToken`. نظيره في `tokens.test.ts` يحرس الدالّة؛ وهذا يحرس أن
   * السوكيت يمرّ بها فعلاً.
   */
  it("ورمزٌ بخوارزمية HMAC أخرى بنفس السرّ ⇒ يُردّ", async () => {
    const other = jwt.sign(
      { ...claimsFor(f.admin.id, "admin", f.admin.id), typ: "access" },
      config.JWT_ACCESS_SECRET,
      {
        algorithm: "HS512",
        expiresIn: "15m",
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );
    expect(await refused({ token: other })).toBe("UNAUTHORIZED");
  });

  it("ورمزٌ منتهي الصلاحية ⇒ يُردّ", async () => {
    const expired = jwt.sign(
      { ...claimsFor(f.admin.id, "admin", f.admin.id), typ: "access" },
      config.JWT_ACCESS_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "-1s",
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );
    expect(await refused({ token: expired })).toBe("UNAUTHORIZED");
  });

  it("ورمزٌ لمستخدمٍ غير موجود ⇒ يُردّ", async () => {
    const ghost = signAccessToken(
      claimsFor("00000000-0000-0000-0000-000000000000", "admin", "x") as never,
    );
    expect(await refused({ token: ghost })).toBe("UNAUTHORIZED");
  });

  /**
   * الحساب الموقوف يُردّ بـ`FORBIDDEN` لا `UNAUTHORIZED`: الرمز سليم، والمنع
   * سببه حالة الحساب. والتمييز مقصود — رسالةٌ واحدة لكل شيء تُخفي عن العميل
   * أن عليه تسجيل الدخول من جديد بلا فائدة.
   */
  it("وحسابٌ موقوف ⇒ يُردّ بـ FORBIDDEN", async () => {
    const [s] = f.nextStudents(1);
    await prisma.user.update({
      where: { id: s!.userId },
      data: { status: "suspended" },
    });

    const token = signAccessToken(claimsFor(s!.userId, "student", s!.id) as never);
    expect(await refused({ token })).toBe("FORBIDDEN");
  });

  /**
   * الرافعتان مفصولتان عمداً — `tokenVersion` للحساب كلّه، و`sid` لجلسةٍ
   * واحدة. وكلتاهما تُقرأ في مصافحة السوكيت لا في HTTP وحده، وإلا بقي
   * الخروج «من كل الأجهزة» يترك السوكيت مفتوحاً.
   */
  it("و«الخروج من كل الأجهزة» يُبطل رمز السوكيت أيضاً", async () => {
    const [s] = f.nextStudents(1);
    const token = signAccessToken(claimsFor(s!.userId, "student", s!.id) as never);

    const before = await connect({ token });
    expect(before.connected).toBe(true);
    before.close();

    await prisma.user.update({
      where: { id: s!.userId },
      data: { tokenVersion: { increment: 1 } },
    });

    expect(await refused({ token })).toBe("UNAUTHORIZED");
  });

  it("وجلسةٌ واحدة مُبطَلة تُردّ وحدها", async () => {
    const [s] = f.nextStudents(1);
    const kept = claimsFor(s!.userId, "student", s!.id);
    const dropped = claimsFor(s!.userId, "student", s!.id);

    await prisma.revokedSession.create({
      data: {
        id: dropped.sid,
        userId: s!.userId,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    expect(await refused({ token: signAccessToken(dropped as never) })).toBe(
      "UNAUTHORIZED",
    );

    // والجلسة الأخرى للحساب نفسه ما تزال تعمل — وإلا لكان الإبطال شاملاً.
    const other = await connect({ token: signAccessToken(kept as never) });
    expect(other.connected).toBe(true);
  });
});

//
// ═══ الغرف: الخادم يقرّر، لا العميل ═══
//

describe("توزيع الغرف", () => {
  it("الاتّصال يدخل غرفة مستخدمه وغرفة دوره", async () => {
    const token = signAccessToken(
      claimsFor(f.admin.id, "admin", f.admin.id) as never,
    );
    const socket = await connect({ token });
    const rooms = await serverRooms(socket);

    expect(rooms.has(room.user(f.admin.id))).toBe(true);
    expect(rooms.has(room.role("admin"))).toBe(true);
  });

  /**
   * الواجهة كانت تنضمّ بمعرّف الملفّ (`Student.id`) بينما الخادم يبثّ إلى
   * `User.id`، فكانت رسائلٌ لا تصل أبداً. الخادم صار يضمّ الغرفتين معاً حتى
   * يبقى أي بثٍّ قديم عاملاً.
   */
  it("والطالب يدخل غرفة معرّف ملفّه أيضاً، لا معرّف حسابه وحده", async () => {
    const [s] = f.nextStudents(1);
    const token = signAccessToken(claimsFor(s!.userId, "student", s!.id) as never);
    const socket = await connect({ token });
    const rooms = await serverRooms(socket);

    expect(rooms.has(room.user(s!.userId))).toBe(true);
    expect(rooms.has(room.user(s!.id))).toBe(true);
    expect(rooms.has(room.role("student"))).toBe(true);
  });

  /**
   * الدور يُقرأ من القاعدة لا من الرمز. ورمزٌ يدّعي `admin` لحسابِ طالبٍ
   * حقيقيّ هو أدقّ صورة للهجوم: التوقيع صحيح، والحساب قائم، والادّعاء وحده
   * كاذب. فلو وُثِق بالحمولة لدخل صاحبه غرفة الإدارة.
   */
  it("ورمزٌ يدّعي دوراً أعلى لا يُدخل صاحبه غرفة ذلك الدور", async () => {
    const [s] = f.nextStudents(1);
    const lying = signAccessToken(
      claimsFor(s!.userId, "admin", s!.id) as never, // الادّعاء هنا
    );

    const socket = await connect({ token: lying });
    const rooms = await serverRooms(socket);

    expect(rooms.has(room.role("admin"))).toBe(false);
    expect(rooms.has(room.role("student"))).toBe(true);
  });

  /**
   * وهذا هو نصّ الثغرة القديمة: `join` كان يُدخل صاحبه أي غرفةٍ يسمّيها.
   * صار حدثاً عاجزاً — يُقبل لئلّا ينكسر عميلٌ قديم، ولا يفعل شيئاً.
   */
  it("و«join» القديم عاجز: لا يُدخل أحداً غرفةً لم يستحقّها", async () => {
    const [s] = f.nextStudents(1);
    const token = signAccessToken(claimsFor(s!.userId, "student", s!.id) as never);
    const socket = await connect({ token });
    await serverRooms(socket);

    socket.emit("join", { userId: f.admin.id, role: "admin" });
    socket.emit("join-room", f.admin.id);
    await sleep(150);

    const rooms = (await serverRooms(socket))!;
    expect(rooms.has(room.role("admin"))).toBe(false);
    expect(rooms.has(room.user(f.admin.id))).toBe(false);
  });
});

//
// ═══ العزل: ما يصل ومَن يصله ═══
//

describe("عزل ما يُبثّ", () => {
  /**
   * كل تأكيدٍ سلبيّ هنا مقرونٌ بشاهدٍ إيجابيّ في الاختبار نفسه: لو لم يصل
   * الإشعار إلى أحد لَنجح «لم يصل إلى الغريب» بلا معنى. المقصود أن يصل
   * لصاحبه ولا يصل لغيره — لا أن يسكت الخادم.
   */
  it("الإشعار يصل صاحبه ولا يصل غيره", async () => {
    const [a, b] = f.nextStudents(2);
    const mine = await connect({
      token: signAccessToken(claimsFor(a!.userId, "student", a!.id) as never),
    });
    const theirs = await connect({
      token: signAccessToken(claimsFor(b!.userId, "student", b!.id) as never),
    });
    await Promise.all([serverRooms(mine), serverRooms(theirs)]);

    const heard = catchEvent(mine, "notification");
    const overheard = catchEvent(theirs, "notification");

    pushNotification(a!.userId, { id: `${TAG}-n1`, title: `${TAG} خاصّ` });

    expect(await heard).toMatchObject({ id: `${TAG}-n1` });
    expect(await overheard).toBeNull();
  });

  it("و«تغيّر لهؤلاء» يصل المقصودين وحدهم", async () => {
    const [a, b] = f.nextStudents(2);
    const target = await connect({
      token: signAccessToken(claimsFor(a!.userId, "student", a!.id) as never),
    });
    const bystander = await connect({
      token: signAccessToken(claimsFor(b!.userId, "student", b!.id) as never),
    });
    await Promise.all([serverRooms(target), serverRooms(bystander)]);

    const heard = catchEvent(target, "data:changed");
    const overheard = catchEvent(bystander, "data:changed");

    emitToUsers([a!.userId], "projects", "updated", `${TAG}-p1`);

    expect(await heard).toMatchObject({ resource: "projects", action: "updated" });
    expect(await overheard).toBeNull();
  });

  /**
   * البثّ العامّ يصل الجميع عمداً: بنية أكاديمية لا سرّ فيها، وحمولته اسمُ
   * ما تغيّر لا الصفّ نفسه — فلا شيء يُسرَّب حتى لو وصل من لا يعنيه.
   */
  it("والبثّ العامّ يصل كل متّصل، وحمولته اسم المورد لا محتواه", async () => {
    const [a] = f.nextStudents(1);
    const student = await connect({
      token: signAccessToken(claimsFor(a!.userId, "student", a!.id) as never),
    });
    const admin = await connect({
      token: signAccessToken(claimsFor(f.admin.id, "admin", f.admin.id) as never),
    });
    await Promise.all([serverRooms(student), serverRooms(admin)]);

    const one = catchEvent(student, "data:changed");
    const two = catchEvent(admin, "data:changed");

    broadcastChange("faculties", "created", `${TAG}-fac`);

    const payload = (await one) as Record<string, unknown>;
    expect(payload).toMatchObject({ resource: "faculties", action: "created" });
    expect(Object.keys(payload).sort()).toEqual(["action", "at", "id", "resource"]);
    expect(await two).not.toBeNull();
  });

  /**
   * غرفة الدور مأهولةٌ لكن لا يبثّ إليها شيءٌ اليوم — لا مُصدِر لها في
   * `realtime.ts`. فنبثّ إليها من الاختبار مباشرةً: المقصود إثبات أن
   * **العضوية** صحيحة، حتى لا يُكتشف الخطأ يوم يُضاف أوّل بثٍّ إداري.
   */
  it("وغرفة الإدارة لا يسمعها طالبٌ متّصل", async () => {
    const [a] = f.nextStudents(1);
    const student = await connect({
      token: signAccessToken(claimsFor(a!.userId, "student", a!.id) as never),
    });
    const admin = await connect({
      token: signAccessToken(claimsFor(f.admin.id, "admin", f.admin.id) as never),
    });
    await Promise.all([serverRooms(student), serverRooms(admin)]);

    const heard = catchEvent(admin, "data:changed");
    const overheard = catchEvent(student, "data:changed");

    io.to(room.role("admin")).emit("data:changed", {
      resource: "users",
      at: new Date().toISOString(),
    });

    expect(await heard).toMatchObject({ resource: "users" });
    expect(await overheard).toBeNull();
  });

  it("والاتّصال المقطوع لا يبقى في غرفته", async () => {
    const [a] = f.nextStudents(1);
    const socket = await connect({
      token: signAccessToken(claimsFor(a!.userId, "student", a!.id) as never),
    });
    await serverRooms(socket);
    expect(io.sockets.adapter.rooms.get(room.user(a!.userId))?.size).toBe(1);

    socket.close();
    await waitUntil(() => !io.sockets.adapter.rooms.has(room.user(a!.userId)));
  });
});

//
// ═══ حارسٌ على البيئة نفسها ═══
//

describe("بيئة التشغيل", () => {
  /**
   * `server.ts` يستدعي `dotenv/config`، و`.env` فيه رابط قاعدة التطوير. ولولا
   * أن dotenv لا يدهس متغيّراً موجوداً لَكتب هذا الملفّ في قاعدة التطوير —
   * وقد رأينا من قبل ما يكلّفه ذلك. التأكيد هنا لأن السلامة قائمة على سلوكٍ
   * في مكتبةٍ خارجية، لا على شيءٍ نملكه.
   */
  it("استيراد server.ts لم يُبدّل قاعدة الاختبار", () => {
    expect(process.env.DATABASE_URL).toMatch(/_test(\?|$)/);
  });
});
