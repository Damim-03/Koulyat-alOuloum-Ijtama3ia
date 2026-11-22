import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n/i18n";
import { datedName, downloadBase64, downloadBlob, XLSX_MIME } from "./download";
import { downscaleImage } from "./downscale-image";
import { assetUrl } from "./asset-url";
import { joinList } from "./join-list";
import { cn, formatDate } from "./utils";
import { pingServer } from "./api/health";
import { useUIStore } from "../store/ui.store";
import { useAuthStore } from "../store/auth.store";

/** أدوات الواجهة الصغيرة — كلٌّ منها يُستعمل في صفحاتٍ كثيرة. */
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("download", () => {
  let clicked: { href: string; download: string }[] = [];
  beforeEach(() => {
    clicked = [];
    URL.createObjectURL = vi.fn(() => "blob:test") as never;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
  });

  it("ملفٌّ يُنزَّل باسمه، ولا يبقى رابطه في الصفحة ولا في الذاكرة", async () => {
    vi.useFakeTimers();
    downloadBlob(new Blob(["x"]), "report.xlsx");
    expect(clicked).toEqual([{ href: "blob:test", download: "report.xlsx" }]);
    expect(document.querySelector("a[download]")).toBeNull();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("ومن base64 بنوع Excel ما لم يُذكر غيره", () => {
    downloadBase64(btoa("PK"), "accounts.xlsx");
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]![0] as Blob;
    expect([blob.type, blob.size]).toEqual([XLSX_MIME, 2]);
  });

  it("واسمٌ مؤرَّخٌ بيوم التنزيل", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));
    expect([datedName("students"), datedName("list", "csv")]).toEqual(["students-2026-10-19.xlsx", "list-2026-10-19.csv"]);
  });
});

describe("downscaleImage", () => {
  const drawn: { w: number; h: number }[] = [];
  let ctx: object | null = {};
  let blob: Blob | null = new Blob(["jpeg"], { type: "image/jpeg" });
  let loads = true;

  beforeEach(() => {
    drawn.length = 0;
    ctx = { fillRect: vi.fn(), drawImage: vi.fn() };
    blob = new Blob(["jpeg"], { type: "image/jpeg" });
    loads = true;
    URL.createObjectURL = vi.fn(() => "blob:img") as never;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      drawn.push({ w: this.width, h: this.height });
      return ctx as never;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(blob));
  });
  /** صورةٌ بأبعادٍ معطاة — تُحمَّل (أو تفشل) فور ضبط مصدرها. */
  const withImage = (w: number, h: number) =>
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = w;
        naturalHeight = h;
        onload?: () => void;
        onerror?: () => void;
        set src(_: string) {
          queueMicrotask(() => (loads ? this.onload?.() : this.onerror?.()));
        }
      },
    );
  const file = (name: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type: "image/png" });

  it("صغيرةٌ وخفيفة ⇒ كما هي، بلا إعادة ترميز", async () => {
    withImage(800, 600);
    const f = file("a.png", 1000);
    expect(await downscaleImage(f)).toBe(f);
    expect(drawn).toEqual([]);
  });

  it("كبيرة ⇒ أطول ضلعٍ 1920، JPEG باسمها", async () => {
    withImage(4000, 3000);
    const out = await downscaleImage(file("campus.png", 1000));
    expect(drawn).toEqual([{ w: 1920, h: 1440 }]);
    expect([out.name, out.type]).toEqual(["campus.jpg", "image/jpeg"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:img");
  });

  it("وثقيلةٌ بأبعادٍ صغيرة ⇒ تُعاد ترميزاً؛ واسمٌ بلا أساس ⇒ image.jpg", async () => {
    withImage(800, 600);
    const out = await downscaleImage(file(".png", 2 * 1024 * 1024));
    expect(drawn).toEqual([{ w: 800, h: 600 }]);
    expect(out.name).toBe("image.jpg");
  });

  it("متصفّحٌ بلا رسم، أو ترميزٌ يفشل ⇒ الأصل", async () => {
    withImage(4000, 3000);
    const f = file("a.png", 10);
    ctx = null;
    expect(await downscaleImage(f)).toBe(f);
    ctx = { fillRect: vi.fn(), drawImage: vi.fn() };
    blob = null;
    expect(await downscaleImage(f)).toBe(f);
  });

  it("وصورةٌ لا تُقرأ ⇒ يُرفض، ويُحرَّر رابطها", async () => {
    withImage(10, 10);
    loads = false;
    await expect(downscaleImage(file("broken.png", 10))).rejects.toThrow("Unreadable image");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:img");
  });
});

describe("assetUrl", () => {
  it("لا مسار ⇒ لا رابط؛ والمطلق كما هو؛ والنسبيّ بأصل الـAPI إن ضُبط", () => {
    expect([assetUrl(null), assetUrl(""), assetUrl("https://cdn.dz/a.png")]).toEqual([undefined, undefined, "https://cdn.dz/a.png"]);
    expect(assetUrl("/uploads/a.png")).toBe("/uploads/a.png");
    vi.stubEnv("VITE_API_ORIGIN", "https://api.univ.dz");
    expect(assetUrl("/uploads/a.png")).toBe("https://api.univ.dz/uploads/a.png");
  });
});

describe("joinList و cn و formatDate", () => {
  it("قائمةٌ بفاصلة لغتها، بلا الفارغ", async () => {
    expect(joinList(["أ", null, "ب", false, undefined, "ج"], "ar")).toBe("أ، ب، ج");
    expect(joinList(["a", "", "b"], "fr")).toBe("a, b");
    await i18n.changeLanguage("en");
    expect(joinList(["a", "b"])).toBe("a, b");
    await i18n.changeLanguage("ar");
    // ولغةٌ لم تُعرف بعد ⇒ العربية.
    const lang = i18n.language;
    i18n.language = undefined as never;
    expect(joinList(["أ", "ب"])).toBe("أ، ب");
    i18n.language = lang;
  });

  it("الأصناف تُدمج، والمتعارض منها يغلبه الأخير", () => {
    const hidden = false as boolean;
    expect(cn("p-2", hidden && "hidden", "p-4", ["text-sm"])).toBe("p-4 text-sm");
  });

  it("التاريخ بالجزائرية افتراضاً، نصّاً كان أو تاريخاً", () => {
    const d = new Date("2026-10-19T12:00:00Z");
    const ar = new Intl.DateTimeFormat("ar-DZ", { year: "numeric", month: "long", day: "numeric" }).format(d);
    expect([formatDate(d), formatDate(d.toISOString())]).toEqual([ar, ar]);
    expect(formatDate(d, "fr")).toContain("2026");
  });
});

describe("pingServer", () => {
  it("الخادم يجيب ⇒ نعم؛ يجيب بخطأ أو لا يُبلغ ⇒ لا", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false }).mockRejectedValueOnce(new Error("down"));
    vi.stubGlobal("fetch", fetch);
    expect([await pingServer(), await pingServer(), await pingServer()]).toEqual([true, false, false]);
    expect(fetch.mock.calls[0]![0]).toBe("/api/health");
    expect(fetch.mock.calls[0]![1]).toMatchObject({ cache: "no-store" });
  });

  it("ولا جواب في المهلة ⇒ يُلغى الطلب، ولا", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      (_: string, { signal }: { signal: AbortSignal }) =>
        new Promise((_r, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    const answer = pingServer(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await answer).toBe(false);
  });
});

describe("createSocket", () => {
  it("لا يتّصل بنفسه، ويُرسل التوكن الحاليّ عند كلّ اتصال — من الأصل نفسه أو من العنوان المضبوط", async () => {
    const io = vi.fn((...args: unknown[]) => ({ args }));
    vi.doMock("socket.io-client", () => ({ io }));
    vi.doMock("../config/env", () => ({ env: { VITE_API_URL: "/api", VITE_SOCKET_URL: "" } }));
    const sameOrigin = await import("./socket/socket");
    sameOrigin.createSocket();
    const options = io.mock.calls[0]![0] as { autoConnect: boolean; auth: (cb: (d: { token: string }) => void) => void };
    expect(options.autoConnect).toBe(false);

    const sent: string[] = [];
    useAuthStore.setState({ accessToken: "tok" });
    options.auth((d) => sent.push(d.token));
    useAuthStore.setState({ accessToken: null });
    options.auth((d) => sent.push(d.token));
    expect(sent).toEqual(["tok", ""]);

    vi.resetModules();
    vi.doMock("../config/env", () => ({ env: { VITE_API_URL: "/api", VITE_SOCKET_URL: "https://rt.univ.dz" } }));
    (await import("./socket/socket")).createSocket();
    expect(io.mock.calls[1]![0]).toBe("https://rt.univ.dz");
    vi.doUnmock("socket.io-client");
    vi.doUnmock("../config/env");
    vi.resetModules();
  });
});

describe("sound", () => {
  type FakeAudio = { src: string; volume: number; currentTime: number; play: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn>; fire: (e: string) => void };
  let made: FakeAudio[] = [];
  let play: () => Promise<void> = () => Promise.resolve();
  let now = 0;

  beforeEach(() => {
    made = [];
    play = () => Promise.resolve();
    vi.resetModules();
    vi.spyOn(performance, "now").mockImplementation(() => (now += 1000));
    vi.stubGlobal(
      "Audio",
      class {
        volume = 1;
        currentTime = 5;
        preload = "";
        listeners: Record<string, () => void> = {};
        play = vi.fn(() => play());
        load = vi.fn();
        src: string;
        constructor(src: string) {
          this.src = src;
          made.push(this as unknown as FakeAudio);
        }
        addEventListener(e: string, cb: () => void) {
          this.listeners[e] = cb;
        }
        fire(e: string) {
          this.listeners[e]?.();
        }
      },
    );
    useUIStore.setState({ sound: true });
  });

  it("الصوت مُطفأ ⇒ لا شيء يُحمَّل ولا يُعزف", async () => {
    const s = await import("./sound");
    s.setSoundEnabled(false);
    expect(s.isSoundEnabled()).toBe(false);
    s.playCue("dialogYes");
    expect(made).toEqual([]);
  });

  it("يُعزف من أوّله بصوته، والصوت المطلوب يُقصر على 0–1؛ وعنصرٌ واحدٌ لكلّ إشارة", async () => {
    const s = await import("./sound");
    s.playCue("dialogYes");
    expect(made[0]).toMatchObject({ src: "/sounds/yes-in-dialog.mp3", volume: 0.4, currentTime: 0 });
    s.playCue("dialogYes", 7);
    expect([made.length, made[0]!.volume, made[0]!.play.mock.calls.length]).toEqual([1, 1, 2]);
  });

  it("والإشارة نفسها مرّتين في أقلّ من 70ms ⇒ مرّة", async () => {
    const s = await import("./sound");
    vi.mocked(performance.now).mockReturnValue(5_000_000);
    s.playCue("cancel");
    s.playCue("cancel");
    expect(made[0]!.play).toHaveBeenCalledTimes(1);
  });

  /** المتصفّح يمنع الصوت قبل أوّل نقرة — متوقَّعٌ لا يُحذَّر منه. والملفّ الغائب أو العزف الفاشل يُقال مرّة. */
  it("المنع قبل أوّل نقرة صامت؛ والملفّ الغائب والفشل يُحذَّر منهما مرّةً لكلّ إشارة", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = await import("./sound");
    play = () => Promise.reject(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    s.playCue("navigate");
    await Promise.resolve();
    expect(warn).not.toHaveBeenCalled();

    play = () => Promise.reject(Object.assign(new Error("x"), { name: "AbortError" }));
    s.playCue("navigate");
    s.playCue("navigate");
    await new Promise((r) => setTimeout(r, 0));
    made[0]!.fire("error");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("failed to play (AbortError)");
  });

  it("وعطلٌ في الصوت لا يُسقط شيئاً", async () => {
    const s = await import("./sound");
    vi.stubGlobal("Audio", class {
      constructor() {
        throw new Error("no audio here");
      }
    });
    expect(() => s.playCue("switchOn")).not.toThrow();
    expect(() => s.preloadCues("switchOn")).not.toThrow();
  });

  it("أوّل نقرةٍ في الصفحة تُحمِّل الإشارات الشائعة مسبقاً", async () => {
    await import("./sound");
    window.dispatchEvent(new Event("pointerdown"));
    expect(made.map((a) => a.src)).toContain("/sounds/change-pane.mp3");
    expect(made.every((a) => a.load.mock.calls.length === 1)).toBe(true);
  });
});
