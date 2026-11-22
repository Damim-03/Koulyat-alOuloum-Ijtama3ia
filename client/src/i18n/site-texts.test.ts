import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEXTS,
  asSiteTexts,
  defaultText,
  looksLikeEmail,
  safeHttpUrl,
  withOverrides,
} from "./site-texts";
import { ALL_TEXT_FIELDS, HIDEABLE_IDS, TEXT_SECTIONS } from "../features/admin/pages/homepage/texts-registry";

const at = (tree: Record<string, unknown>, key: string) =>
  key.split(".").reduce<unknown>((n, s) => (n as Record<string, unknown>)?.[s], tree);

describe("site texts", () => {
  it("reads a default text by key, lists included", () => {
    expect(defaultText("ar", "hero.title")).toBe("منصة إدارة مذكرات التخرج");
    expect(defaultText("en", "features.items.1.title")).toBe(at(DEFAULT_TEXTS.en, "features.items.1.title"));
    expect(defaultText("ar", "features.items")).toBeUndefined(); // a list, not a text
    expect(defaultText("ar", "nope.nothing")).toBeUndefined();
    expect(defaultText("ar", "__proto__.toString")).toBeUndefined();
  });

  it("replaces existing texts only, and leaves the defaults untouched", () => {
    const bundle = withOverrides("ar", {
      "hero.title": "عنوانٌ جديد",
      "features.items.0.title": "ميزةٌ أولى",
      "officialLinks.2.url": "https://example.dz",
      "made.up.key": "x",
      "features.items": "not a list",
      "constructor.prototype": "x",
      "hero.badge": "   ",
    });
    expect(at(bundle, "hero.title")).toBe("عنوانٌ جديد");
    expect(at(bundle, "features.items.0.title")).toBe("ميزةٌ أولى");
    expect(Array.isArray(at(bundle, "features.items"))).toBe(true);
    expect(at(bundle, "officialLinks.2.url")).toBe("https://example.dz");
    expect(at(bundle, "made")).toBeUndefined();
    expect(at(bundle, "hero.badge")).toBe(defaultText("ar", "hero.badge")); // blank ⇒ original
    // the source files are not mutated
    expect(defaultText("ar", "hero.title")).toBe("منصة إدارة مذكرات التخرج");
    expect(at(withOverrides("ar"), "hero.title")).toBe("منصة إدارة مذكرات التخرج");
  });

  it("accepts only a well-formed set", () => {
    expect(asSiteTexts({ ar: { "hero.title": "x" } })).toEqual({ ar: { "hero.title": "x" }, fr: {}, en: {}, hidden: [] });
    expect(asSiteTexts({ hidden: ["home.news"] })?.hidden).toEqual(["home.news"]);
    expect(asSiteTexts({ hidden: "home.news" })).toBeNull();
    expect(asSiteTexts({ hidden: [3] })).toBeNull();
    expect(asSiteTexts({ ar: { "hero.title": 3 } })).toBeNull();
    expect(asSiteTexts({ ar: ["x"] })).toBeNull();
    expect(asSiteTexts("x")).toBeNull();
  });

  it("links only to http(s), mails only to an address", () => {
    expect(safeHttpUrl("https://www.mesrs.dz")).toBe("https://www.mesrs.dz/");
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("www.mesrs.dz")).toBeUndefined();
    expect(looksLikeEmail("contact@univ-eloued.dz")).toBe(true);
    expect(looksLikeEmail("contact at univ")).toBe(false);
  });
});

describe("texts editor registry", () => {
  it("every field is a text in all three languages", () => {
    const missing = ALL_TEXT_FIELDS.flatMap((f) =>
      (["ar", "en", "fr"] as const).filter((l) => defaultText(l, f.key) === undefined).map((l) => `${l}:${f.key}`),
    );
    expect(missing).toEqual([]);
  });

  it("every hideable element has its own id, in the server's format", () => {
    expect(HIDEABLE_IDS.length).toBe(new Set(HIDEABLE_IDS).size);
    // Mirrors HIDE_ID in Backend/src/modules/site/site.validation.ts.
    for (const id of HIDEABLE_IDS) expect(id).toMatch(/^[a-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+){1,5}$/);
  });

  it("the way back to this editor can never be hidden", () => {
    const site = ALL_TEXT_FIELDS.find((f) => f.key === "admin.site.nav");
    const dashboard = ALL_TEXT_FIELDS.find((f) => f.key === "dash.dashboard");
    expect(site?.hide).toBeUndefined();
    expect(dashboard?.hide).toBeUndefined();
  });

  it("no field is listed twice", () => {
    const keys = ALL_TEXT_FIELDS.map((f) => f.key);
    expect(keys.length).toBe(new Set(keys).size);
  });

  it("every label, group and section has its wording", () => {
    for (const lang of ["ar", "en", "fr"] as const) {
      for (const s of TEXT_SECTIONS) {
        expect(defaultText(lang, `admin.texts.section.${s.id}.title`), `${lang} ${s.id}`).toBeTruthy();
        expect(defaultText(lang, `admin.texts.section.${s.id}.hint`)).toBeTruthy();
        for (const g of s.groups) expect(defaultText(lang, `admin.texts.group.${g.id}`), `${lang} ${g.id}`).toBeTruthy();
      }
      for (const f of ALL_TEXT_FIELDS)
        if (f.label) expect(defaultText(lang, `admin.texts.f.${f.label}`), `${lang} ${f.label}`).toBeTruthy();
    }
  });
});
