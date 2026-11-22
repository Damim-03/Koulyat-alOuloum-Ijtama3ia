/**
 * ميزانية الأحداث لكلّ اتّصال — بساعةٍ يُديرها الاختبار.
 *
 * اختبار الـAPI (realtime-socket) يُغرق اتّصالاً حقيقياً ويرى أنه قُطع. وهنا
 * ما لا يُرى من هناك: أن الرصيد يعود مع الزمن، وأن ما فوق الميزانية يُسقط
 * بصمت — لا بخطأ، فخطأٌ يُمرَّر إلى `next` يجعل Socket.IO يُطلق حدث «error»
 * على الاتّصال، وبلا مستمعٍ له يسقط الخادم كلّه.
 */
import type { Socket } from "socket.io";

import { limitClientEvents } from "./socket-auth";

type Middleware = (packet: unknown[], next: (err?: Error) => void) => void;

/** اتّصالٌ مزيّف: يحفظ الوسيط ويعدّ ما مرّ وما قُطع. */
function fakeSocket() {
  let middleware: Middleware | null = null;
  const state = { passed: 0, errors: 0, disconnected: false };
  const socket = {
    use(fn: Middleware) {
      middleware = fn;
    },
    disconnect() {
      state.disconnected = true;
    },
  };
  const send = (n: number) => {
    for (let i = 0; i < n; i++)
      middleware!(["typing", {}], (err) => (err ? state.errors++ : state.passed++));
  };
  return { socket: socket as unknown as Socket, state, send };
}

describe("limitClientEvents", () => {
  it("يمرّر دفعةً بحجم الميزانية، ويُسقط ما فوقها بلا خطأ", () => {
    let now = 0;
    const { socket, state, send } = fakeSocket();
    limitClientEvents(socket, () => now);

    send(25);
    expect(state.passed).toBe(20);
    expect(state.errors).toBe(0);
    expect(state.disconnected).toBe(false);
  });

  it("والرصيد يعود مع الزمن: حدثان في الثانية", () => {
    let now = 0;
    const { socket, state, send } = fakeSocket();
    limitClientEvents(socket, () => now);

    send(20);
    expect(state.passed).toBe(20);
    now += 1000;
    send(5);
    expect(state.passed).toBe(22);
  });

  it("واستعمالُ الواجهة الحقيقيّ — «يكتب…» كلّ ثانيتين ونصف — لا يُمسّ أبداً", () => {
    let now = 0;
    const { socket, state, send } = fakeSocket();
    limitClientEvents(socket, () => now);

    for (let i = 0; i < 1000; i++) {
      send(1);
      now += 2500;
    }
    expect(state.passed).toBe(1000);
    expect(state.disconnected).toBe(false);
  });

  it("ومن يُصرّ على الإغراق يُقطع اتّصاله", () => {
    let now = 0;
    const { socket, state, send } = fakeSocket();
    limitClientEvents(socket, () => now);

    send(20 + 99);
    expect(state.disconnected).toBe(false);
    send(1);
    expect(state.disconnected).toBe(true);
  });
});
