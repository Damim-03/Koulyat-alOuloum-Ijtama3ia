/**
 * مقبسٌ مزيّف بشكل `AppSocket` — ما تحتاجه الواجهة منه وحده.
 *
 * `server(event, payload)` يرسل حدثاً كما يرسله الخادم، فيصل كلّ من استمع
 * إليه؛ و`sent` ما أرسلته الصفحة (`emit`)؛ و`connect`/`disconnect` يغيّران
 * `connected` ويُطلقان حدثيهما كما يفعل socket.io.
 */
type Handler = (...args: unknown[]) => void;

export class FakeSocket {
  connected = false;
  id = "fake-socket";
  sent: { event: string; payload: unknown }[] = [];
  connects = 0;
  disconnects = 0;
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return this;
  }

  off(event: string, fn?: Handler) {
    if (fn) this.handlers.get(event)?.delete(fn);
    else this.handlers.delete(event);
    return this;
  }

  emit(event: string, payload?: unknown) {
    this.sent.push({ event, payload });
    return this;
  }

  /** ما يرسله الخادم. */
  server(event: string, ...args: unknown[]) {
    for (const fn of [...(this.handlers.get(event) ?? [])]) fn(...args);
  }

  listeners(event: string) {
    return this.handlers.get(event)?.size ?? 0;
  }

  connect() {
    this.connects++;
    if (!this.connected) {
      this.connected = true;
      this.server("connect");
    }
    return this;
  }

  disconnect(why = "io client disconnect") {
    this.disconnects++;
    if (this.connected) {
      this.connected = false;
      this.server("disconnect", why);
    }
    return this;
  }
}
