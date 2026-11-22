import express from "express";
import request from "supertest";
import { z } from "zod";
import { issuesMessage, languageMiddleware, listOf, parseLang, tr, withLang } from "./index";
import { zmsg } from "./zod";
import { MESSAGES } from "./messages";
import { NotFoundException } from "../utils/appErros";
import { errorHandler } from "../middleware/errorHandler.middleware";

/** رسائل الخادم بلغة الواجهة — العربية والإنجليزية والفرنسية. */

describe("parseLang", () => {
  it.each([
    ["ar", "ar"],
    ["en-US,en;q=0.9", "en"],
    ["fr-FR", "fr"],
    ["de", "ar"],
    [undefined, "ar"],
  ])("%s ⇒ %s", (header, lang) => {
    expect(parseLang(header)).toBe(lang);
  });
});

describe("tr", () => {
  it("the same key in each language, with its values", () => {
    expect(tr("notFound.topic", undefined, "ar")).toBe("الموضوع غير موجود.");
    expect(tr("notFound.topic", undefined, "en")).toBe("Topic not found.");
    expect(tr("notFound.topic", undefined, "fr")).toBe("Sujet introuvable.");
    expect(tr("site.newsLimit", { max: 12 }, "en")).toContain("12 news items");
  });

  it("Arabic counts agree with their number", () => {
    const n = (count: number) => tr("count.students", { count }, "ar");
    expect([n(1), n(2), n(3), n(11), n(100)]).toEqual([
      "طالبٌ واحد",
      "طالبان",
      "3 طلاب",
      "11 طالباً",
      "100 طالب",
    ]);
    expect(tr("count.students", { count: 1 }, "en")).toBe("1 student");
    expect(tr("count.students", { count: 3 }, "fr")).toBe("3 étudiants");
  });

  it("outside a request it is Arabic; inside one, the request's language", () => {
    expect(tr("notFound.user")).toBe("المستخدم غير موجود.");
    expect(withLang("fr", () => tr("notFound.user"))).toBe("Utilisateur introuvable.");
  });

  it("lists read in each language", () => {
    expect(listOf(["أ", "ب", "ج"], "ar")).toBe("أ، ب وج");
    expect(listOf(["a", "b", "c"], "en")).toBe("a, b and c");
    expect(listOf(["a", "b"], "fr")).toBe("a et b");
    // واحدٌ بلا رابط، ولا شيءَ نصٌّ فارغ — لا «undefined».
    expect(listOf(["وحده"], "ar")).toBe("وحده");
    expect(listOf([], "en")).toBe("");
    // وبلا لغةٍ صريحة: لغة الطلب الجاري.
    expect(withLang("fr", () => listOf(["a", "b"]))).toBe("a et b");
  });

  it("a value left out stays visible as its gap, and nothing throws", () => {
    // نصٌّ: الموضع الناقص يبقى «{{max}}» كما هو، لا يصير «undefined».
    expect(tr("site.newsLimit", {}, "en")).toContain("{{max}}");
    // ودالّةٌ (صيغ الجمع) تُنادى بلا قيمٍ أصلاً: تُرجع نصّاً ولا ترمي.
    expect(typeof tr("count.students")).toBe("string");
  });

  it("a language outside the three falls back to Arabic, the platform's own", () => {
    expect(tr("notFound.topic", undefined, "de" as never)).toBe("الموضوع غير موجود.");
  });

  it("validation problems in one line: each at its field, the whole body as «(root)»", () => {
    const line = withLang("en", () =>
      issuesMessage([
        { path: ["user", "email"], message: "Invalid email" },
        { path: [], message: "Expected object" },
      ]),
    );
    expect(line).toBe("Invalid data: user.email: Invalid email | (root): Expected object");
  });

  it("every message has its three languages", () => {
    for (const [key, entry] of Object.entries(MESSAGES))
      for (const lang of ["ar", "en", "fr"] as const)
        expect([key, lang, typeof entry[lang]]).not.toEqual([key, lang, "undefined"]);
  });
});

describe("a request in English gets its errors in English", () => {
  const app = express();
  app.use(languageMiddleware);
  app.get("/missing", async () => {
    // بعد انتظار: اللغة تبقى مع الطلب عبر ما يُنتظَر فيه.
    await new Promise((r) => setTimeout(r, 5));
    throw new NotFoundException(tr("notFound.topic"));
  });
  app.get("/zod", (req) => {
    z.object({ title: z.string().min(1, zmsg("v.titleRequired")) }).parse({ title: "" });
  });
  app.use(errorHandler);

  it.each([
    ["ar", "الموضوع غير موجود."],
    ["en", "Topic not found."],
    ["fr", "Sujet introuvable."],
  ])("Accept-Language: %s", async (lang, message) => {
    const res = await request(app).get("/missing").set("Accept-Language", lang).expect(404);
    expect(res.body.message).toBe(message);
  });

  it("a schema's own message is translated when it validates", () => {
    const schema = z.object({ title: z.string().min(1, zmsg("v.titleRequired")) });
    const issue = withLang("en", () => schema.safeParse({ title: "" }).error!.issues[0]!);
    expect(issue.message).toBe("The title is required.");
  });
});
