/**
 * قراءةُ حقل سقف الطلبات.
 *
 * الخطأُ الذي يستحقّ حارساً واحد: أن يُقرأ الفراغُ صفراً. الصفرُ يعني «لا
 * يُقبل طلبٌ قطّ»، فيُغلق الموضوع في وجه الطلبة كلِّهم بخانةٍ نُسي مسحها —
 * ولا يظهر ذلك في الشاشة، إنّما في طالبٍ يقول «لا أستطيع الإرسال».
 */
import { describe, it, expect } from "vitest";

import { capPayload, readCap } from "./request-cap";

describe("قراءة السقف", () => {
  it("الفراغُ بلا سقف، لا صفراً", () => {
    expect(readCap("")).toBe("");
    expect(readCap("   ")).toBe("");
    expect(capPayload(readCap(""))).toBeNull();
  });

  it("ويُحصر بين الواحد والخمسين", () => {
    expect(readCap("0")).toBe(1);
    expect(readCap("-4")).toBe(1);
    expect(readCap("999")).toBe(50);
    expect(readCap("3")).toBe(3);
  });

  it("ويُقصّ الكسر — الطلبات تُعدّ صحيحة", () => {
    expect(readCap("3.7")).toBe(3);
  });

  it("وما ليس عدداً يُقرأ بلا سقف لا بواحد", () => {
    expect(readCap("abc")).toBe("");
  });

  /** التعديلُ جزئيّ في الخلفية، فالفراغُ يُرسَل `null` لا يُحذف. */
  it("ويُرسَل العدد كما هو والفراغُ null", () => {
    expect(capPayload(5)).toBe(5);
    expect(capPayload("")).toBeNull();
  });
});
