/**
 * الاتصالات الحيّة لحسابٍ واحد — على خادم Socket.IO مزيّف.
 *
 * تغيير كلمة المرور يُنهي الجلسات إلا جهازه، ويُبقي اتّصال هذا الجهاز حيّاً
 * باسم جلسته الجديدة (`moveSessionSockets`)، فيصله تسجيل الخروج اللاحق. وقائمة
 * أجهزة الحساب تعرف أيّها متّصلٌ الآن (`liveSessionIds`). وفشلُ الخادم في هذا
 * كلّه لا يُفشل الطلب الذي طلبه.
 */
import type { Server } from "socket.io";

import { disconnectSessions, liveSessionIds, moveSessionSockets, setRealtimeServer } from "./realtime";

type FakeSocket = { data: { sid?: string }; emit: jest.Mock; disconnect: jest.Mock };
const sock = (sid?: string): FakeSocket => ({ data: { sid }, emit: jest.fn(), disconnect: jest.fn() });

let sockets: FakeSocket[] = [];
const fetchSockets = jest.fn(async () => sockets);
const io = {
  in: jest.fn(() => ({ fetchSockets })),
  to: jest.fn(() => ({ emit: jest.fn() })),
} as unknown as Server;

describe("realtime — اتصالات حسابٍ واحد", () => {
  it("قبل أن يقوم الخادم ⇒ لا اتصال حيّ، ولا رمية", async () => {
    expect(await liveSessionIds("u1")).toEqual(new Set());
  });

  describe("والخادم قائم", () => {
    beforeAll(() => setRealtimeServer(io));
    beforeEach(() => {
      jest.clearAllMocks();
      sockets = [];
    });

    it("إنهاء الجلسات إلا جهازاً واحداً ⇒ يُبلَّغ الآخرون ويُقطعون، ويبقى هو", async () => {
      const mine = sock("s-mine");
      const other = sock("s-other");
      sockets = [mine, other];

      await disconnectSessions("u1", undefined, "s-mine");

      expect(mine.disconnect).not.toHaveBeenCalled();
      expect(other.emit).toHaveBeenCalledWith("session:revoked", {});
      expect(other.disconnect).toHaveBeenCalledWith(true);
    });

    it("نقل الاتصال إلى الجلسة الجديدة: اتصالات الجلسة القديمة وحدها", async () => {
      const old = sock("s-old");
      const kept = sock("s-kept");
      sockets = [old, kept];

      await moveSessionSockets("u1", "s-old", "s-new");

      expect([old.data.sid, kept.data.sid]).toEqual(["s-new", "s-kept"]);
    });

    it("وبلا جلسةٍ قديمة لا شيء يُنقل، ولا يُسأل الخادم", async () => {
      await moveSessionSockets("u1", undefined, "s-new");
      expect(fetchSockets).not.toHaveBeenCalled();
    });

    it("الجلسات الحيّة: ما له اتصال، واتصالٌ بلا جلسة لا يُعدّ", async () => {
      sockets = [sock("s-1"), sock(), sock("s-2")];
      expect(await liveSessionIds("u1")).toEqual(new Set(["s-1", "s-2"]));
    });

    /** الحضور زينة: خادمٌ لا يجيب ⇒ لا أحد متّصلاً، ولا يسقط الطلب. والنقل كذلك. */
    it("وخادمٌ لا يجيب ⇒ لا اتصال حيّ، والنقل لا يرمي", async () => {
      fetchSockets.mockRejectedValueOnce(new Error("adapter down"));
      expect(await liveSessionIds("u1")).toEqual(new Set());

      fetchSockets.mockRejectedValueOnce(new Error("adapter down"));
      await expect(moveSessionSockets("u1", "s-old", "s-new")).resolves.toBeUndefined();
    });
  });
});
