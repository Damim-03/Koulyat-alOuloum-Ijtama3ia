/**
 * «يكتب…» — يُنقل إلى من يُكتب إليه، وحده، وبإذن.
 */
jest.mock("./messages.service", () => ({ mayWrite: jest.fn() }));

import { EventEmitter } from "node:events";
import type { Server } from "socket.io";

import { mayWrite } from "./messages.service";
import { installMessageEvents } from "./messages.socket";

const allowed = mayWrite as jest.Mock;

/** خادمٌ مزيّف: يسجّل ما بُثّ ولمن. */
function fakeServer() {
  const io = new EventEmitter() as EventEmitter & { to: jest.Mock; emitted: { room: string; event: string; data: unknown }[] };
  io.emitted = [];
  io.to = jest.fn((room: string) => ({ emit: (event: string, data: unknown) => io.emitted.push({ room, event, data }) }));
  installMessageEvents(io as unknown as Server);
  return io;
}

/** يتّصل مستخدمٌ ويقول «أكتب إلى…»، وينتظر ما يترتّب. */
async function connect(io: ReturnType<typeof fakeServer>, userId?: string) {
  const socket = new EventEmitter() as EventEmitter & { user?: { userId: string } };
  if (userId) socket.user = { userId };
  io.emit("connection", socket);
  return async (payload: unknown) => {
    for (const listener of socket.listeners("typing")) await (listener as (p: unknown) => Promise<void>)(payload);
  };
}

const A = "user-a";
const B = "user-b";

beforeEach(() => allowed.mockReset().mockResolvedValue(true));

describe("typing", () => {
  it("يصل إلى غرفة من يُكتب إليه، ومعه من يكتب وهل ما زال", async () => {
    const io = fakeServer();
    const type = await connect(io, A);
    await type({ to: B });
    await type({ to: B, active: false });
    expect(io.emitted).toEqual([
      { room: `user:${B}`, event: "typing", data: { from: A, active: true } },
      { room: `user:${B}`, event: "typing", data: { from: A, active: false } },
    ]);
  });

  it("والإذن يُسأل مرّةً لكلّ دفعة: الضربات التالية من الذاكرة", async () => {
    const io = fakeServer();
    const type = await connect(io, "cache-a");
    await type({ to: "cache-b" });
    await type({ to: "cache-b" });
    await type({ to: "cache-b" });
    expect(allowed).toHaveBeenCalledTimes(1);
  });

  it("ومن لا يحقّ له أن يكتب إليه لا يُنقل عنه شيء", async () => {
    allowed.mockResolvedValue(false);
    const io = fakeServer();
    const type = await connect(io, "denied-a");
    await type({ to: "denied-b" });
    expect(io.emitted).toEqual([]);
  });

  it("وما ليس معرّفاً، أو هو صاحبه، أو حمولةٌ فارغة ⇒ لا شيء، ولا سؤال", async () => {
    const io = fakeServer();
    const type = await connect(io, A);
    for (const payload of [null, "x", {}, { to: 42 }, { to: A }, { to: "bad id!" }, { to: "x".repeat(65) }]) await type(payload);
    expect(allowed).not.toHaveBeenCalled();
    expect(io.emitted).toEqual([]);
  });

  it("واتّصالٌ بلا مستخدمٍ موثَّق لا يُصغى إليه", async () => {
    const io = fakeServer();
    const socket = new EventEmitter();
    io.emit("connection", socket);
    expect(socket.listenerCount("typing")).toBe(0);
  });

  it("وعطلٌ في السؤال لا يصير خطأً — «يكتب…» لا يستحقّ ذلك", async () => {
    allowed.mockRejectedValue(new Error("db down"));
    const io = fakeServer();
    const type = await connect(io, "err-a");
    await expect(type({ to: "err-b" })).resolves.toBeUndefined();
    expect(io.emitted).toEqual([]);
  });

  it("والذاكرة لا تكبر بلا حدّ: بعد خمسة آلاف زوجٍ تُفرغ وتبدأ من جديد", async () => {
    const io = fakeServer();
    const type = await connect(io, "flood");
    for (let i = 0; i <= 5000; i++) await type({ to: `t${i}` });
    allowed.mockClear();
    await type({ to: "t0" }); // كان في الذاكرة قبل أن تُفرغ
    expect(allowed).toHaveBeenCalledTimes(1);
  });
});
