/**
 * إعداد يعمل قبل كل ملفّ اختبار في الواجهة.
 *
 * يضيف مطابقات DOM (`toBeInTheDocument` وأخواتها)، وينظّف الشجرة بعد كل
 * اختبار حتى لا يرى اختبارٌ بقايا ما قبله — وهو أشيع سبب لاختبارات تنجح
 * منفردة وتفشل مجتمعة.
 */
import "@testing-library/jest-dom/vitest";
import "./image-stub";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom لا يُنفّذ هذه، وبعض المكوّنات تعتمد عليها فتنهار بلا سبب واضح.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver ??= ResizeObserverStub as never;

// والمشاهد تظهر حين تبلغ الشاشة (use-reveal): في الاختبار كلّها على الشاشة.
class IntersectionObserverStub {
  private readonly cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element) {
    this.cb([{ isIntersecting: true, target, intersectionRatio: 1 } as IntersectionObserverEntry], this as never);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
window.IntersectionObserver ??= IntersectionObserverStub as never;

// jsdom لا يمرّر الصفحة: يكفي أن يوجد.
Element.prototype.scrollIntoView ??= function () {};
// وscrollTo وتشغيل الصوت موجودان فيه لكنّهما يكتبان «غير مُنفَّذ» مع كلّ
// نداء — مئاتُ أسطرٍ تُغرق ما يستحقّ القراءة في مخرجات الاختبار.
window.scrollTo = () => {};
HTMLMediaElement.prototype.load = function () {};
HTMLMediaElement.prototype.play = () => Promise.resolve();
HTMLMediaElement.prototype.pause = function () {};

// والسحب بالمؤشّر (قصّ الصورة) يمسك المؤشّر — jsdom لا يعرف ذلك.
Element.prototype.setPointerCapture ??= function () {};
Element.prototype.releasePointerCapture ??= function () {};
Element.prototype.hasPointerCapture ??= () => false;

// Web Animations: الحركة تنتهي في الحال — يكفي أن تنتهي.
Element.prototype.animate ??= function () {
  const done = Promise.resolve();
  return { finished: done, ready: done, cancel() {}, finish() {}, play() {}, pause() {}, onfinish: null } as unknown as Animation;
};
