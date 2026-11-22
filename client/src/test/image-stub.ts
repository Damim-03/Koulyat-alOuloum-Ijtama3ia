/**
 * الصور في jsdom كما في المتصفّح — بقدر ما تحتاجه الواجهة.
 *
 * jsdom لا يحمّل صورةً ولا يرسم على لوحة: `<img src="blob:…">` لا يطلق
 * `load` ولا `error` أبداً، فكلّ ما ينتظر صورةً (التصغير قبل الرفع، القصّ)
 * ينتظر إلى الأبد ولا يُختبر. فهنا:
 *
 *   - رابطٌ من `URL.createObjectURL` لملفّ صورة ⇒ `load` بأبعادٍ (1600×1200)،
 *     ولما ليس صورة، أو صورةٍ أوّل ما فيها «BROKEN» ⇒ `error`، كمتصفّحٍ لا
 *     يفهمها. وما سوى ذلك (روابط الخادم) لا يُحمَّل، كما كان.
 *   - لوحة الرسم: سياقٌ ثنائيّ الأبعاد يقبل كلّ أمرٍ ولا يرسم، و`toBlob`
 *     و`toDataURL` بصورةٍ صغيرةٍ من النوع المطلوب.
 */
const blobs = new Map<string, Blob>();
const realCreate = URL.createObjectURL?.bind(URL);
let n = 0;
URL.createObjectURL = (obj: Blob | MediaSource) => {
  const url = realCreate ? realCreate(obj as Blob) : `blob:test/${++n}`;
  if (obj instanceof Blob) blobs.set(url, obj);
  return url;
};
URL.revokeObjectURL ??= () => {};

const size = new WeakMap<HTMLImageElement, { w: number; h: number }>();
const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src")!;
Object.defineProperty(HTMLImageElement.prototype, "src", {
  configurable: true,
  get() {
    return srcDesc.get!.call(this);
  },
  set(value: string) {
    srcDesc.set!.call(this, value);
    const blob = blobs.get(value);
    if (!blob) return;
    void blob.text().then((text) => {
      const ok = blob.type.startsWith("image/") && !text.startsWith("BROKEN");
      if (ok) size.set(this, { w: 1600, h: 1200 });
      this.dispatchEvent(new Event(ok ? "load" : "error"));
    });
  },
});
for (const [prop, key] of [
  ["naturalWidth", "w"],
  ["naturalHeight", "h"],
] as const)
  Object.defineProperty(HTMLImageElement.prototype, prop, {
    configurable: true,
    get() {
      return size.get(this)?.[key] ?? 0;
    },
  });

const noop = () => {};
const context = (canvas: HTMLCanvasElement) =>
  new Proxy(
    {
      canvas,
      createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      measureText: (s: string) => ({ width: s.length * 6 }),
    } as Record<string | symbol, unknown>,
    { get: (target, key) => (key in target ? target[key] : noop), set: () => true },
  );
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  return context(this);
} as never;
HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, type = "image/png") {
  setTimeout(() => cb(new Blob(["IMG"], { type })), 0);
};
HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,iVBORw0KGgo=";
