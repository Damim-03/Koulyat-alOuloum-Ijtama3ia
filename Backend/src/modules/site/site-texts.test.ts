import { MAX_SITE_TEXTS, siteTextsSchema } from "./site.validation";

const parse = (v: unknown) => siteTextsSchema.safeParse(v);

describe("site texts schema", () => {
  it("keeps texts by key, drops the empty ones, fills missing languages", () => {
    const r = parse({ ar: { "hero.title": "  عنوان  ", "hero.badge": "" }, en: { "features.items.0.title": "One" } });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ ar: { "hero.title": "عنوان" }, fr: {}, en: { "features.items.0.title": "One" }, hidden: [] });
  });

  it("keeps a sorted, de-duplicated list of hidden elements", () => {
    const r = parse({ hidden: ["home.news", "footer.phone", "home.news", "sidebar.admin.dash.archive"] });
    expect(r.success).toBe(true);
    expect(r.data?.hidden).toEqual(["footer.phone", "home.news", "sidebar.admin.dash.archive"]);
    for (const id of ["news", "Home.news", "home..news", "home.__proto__", "home.news x"])
      expect(parse({ hidden: [id] }).success).toBe(false);
    expect(parse({ hidden: Array.from({ length: 201 }, (_, i) => `a.b${i}`) }).success).toBe(false);
  });

  it("rejects malformed and dangerous keys", () => {
    for (const key of ["", "hero..title", ".hero", "hero.", "hero title", "__proto__.x", "hero.constructor", "a.b.c.d.e.f.g.h"])
      expect(parse({ ar: { [key]: "x" }, fr: {}, en: {} }).success).toBe(false);
  });

  it("links are http(s) only; emails must be emails", () => {
    expect(parse({ ar: { "officialLinks.0.url": "javascript:alert(1)" } }).success).toBe(false);
    expect(parse({ ar: { "officialLinks.0.url": "www.mesrs.dz" } }).success).toBe(false);
    expect(parse({ ar: { "officialLinks.0.url": "https://www.mesrs.dz" } }).success).toBe(true);
    expect(parse({ en: { "footer.email": "not-an-email" } }).success).toBe(false);
    expect(parse({ en: { "footer.email": "contact@univ-eloued.dz" } }).success).toBe(true);
    // an empty link is "back to the original", not an error
    expect(parse({ ar: { "officialLinks.0.url": "" } }).success).toBe(true);
  });

  it("caps the size", () => {
    const many = Object.fromEntries(Array.from({ length: MAX_SITE_TEXTS + 1 }, (_, i) => [`k.n${i}`, "x"]));
    expect(parse({ ar: many }).success).toBe(false);
    expect(parse({ ar: { "hero.title": "x".repeat(1501) } }).success).toBe(false);
  });
});
