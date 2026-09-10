/**
 * إعداد يعمل قبل كل ملفّ اختبار في الواجهة.
 *
 * يضيف مطابقات DOM (`toBeInTheDocument` وأخواتها)، وينظّف الشجرة بعد كل
 * اختبار حتى لا يرى اختبارٌ بقايا ما قبله — وهو أشيع سبب لاختبارات تنجح
 * منفردة وتفشل مجتمعة.
 */
import "@testing-library/jest-dom/vitest";
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
