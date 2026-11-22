import { describe, expect, it } from "vitest";
import i18n from "../../../../i18n/i18n";
import { ago, countryName, describe as describeRow, ipKind, opKey, opTitle, operationOptions, placeOf, sessionLength } from "./audit-catalog";

/**
 * ما يعرفه سجلّ العمليات ليقول ما يقول: مفتاح كلّ عملية، وكلماتها، ومجالها؛
 * وما العنوان (الجهاز نفسه، شبكة داخلية)؛ وكم دامت الجلسة؛ ومنذ متى.
 */
const t = i18n.t.bind(i18n);

describe("audit catalog", () => {
  it("the key of an operation: every run of other characters one «_»", () => {
    expect(opKey("PATCH /students/:id")).toBe("PATCH_students_id");
    expect(opKey("PATCH /account")).toBe("PATCH_account");
    expect(opKey("auth.login")).toBe("auth_login");
  });

  it("an operation it does not know: its verb and its kind; an event it does not know: its name", () => {
    expect(opTitle(t, "DELETE /professor/widgets/:id")).toBe(`${t("admin.audit.verb.DELETE")} · widgets`);
    expect(opTitle(t, "POST /")).toBe(`${t("admin.audit.verb.POST")} · `);
    expect(opTitle(t, "system.cleanup")).toBe("system.cleanup");
  });

  it("an operation's area — known by name, or by the kind of thing it changed", () => {
    expect(describeRow(t, { action: "auth.logout", success: true, targetType: null })).toMatchObject({ area: "signin", verb: null, tone: "signin" });
    expect(describeRow(t, { action: "twoFactor.enabled", success: true, targetType: null })).toMatchObject({ area: "credentials", tone: "credentials" });
    expect(describeRow(t, { action: "PATCH /students/:id/new-thing", success: true, targetType: "students" })).toMatchObject({ area: "accounts", verb: "update" });
    expect(describeRow(t, { action: "system.cleanup", success: true, targetType: null })).toMatchObject({ area: null, tone: "neutral" });
    expect(describeRow(t, { action: "POST /faculties", success: false, targetType: "faculties" })).toMatchObject({ verb: "create", tone: "failed" });
  });

  it("a professor's route and the administration's, said apart in the filter", () => {
    const options = operationOptions(t);
    const admin = options.find((o) => o.value === "POST /projects/:groupId/milestones")!;
    const prof = options.find((o) => o.value === "POST /professor/groups/:groupId/milestones")!;
    expect(admin.label).toBe(prof.label);
    expect(prof.hint).toContain(t("admin.audit.role.professor"));
    expect(admin.hint).not.toContain(t("admin.audit.role.professor"));
  });

  it("an address: this machine, a private network, or the internet", () => {
    for (const ip of ["::1", "127.0.0.1", "::ffff:127.0.0.1"]) expect(ipKind(ip)).toBe("local");
    for (const ip of ["10.0.0.5", "192.168.1.20", "172.16.0.1", "172.31.255.1", "::ffff:10.1.1.1", "fd12:3456::1", "fe80::1"]) expect(ipKind(ip)).toBe("private");
    for (const ip of ["41.100.1.1", "172.32.0.1", "2001:db8::1"]) expect(ipKind(ip)).toBeNull();
    expect(ipKind(null)).toBeNull();
  });

  it("a country by its name in the page's language; a place in a few words", () => {
    expect(countryName("ar", "dz")).toBe("الجزائر");
    expect(countryName("fr", "DZ")).toBe("Algérie");
    // Not a code at all: said as it is.
    expect(countryName("ar", "not a code")).toBe("not a code");
    expect(placeOf("en", { city: "Remchi", country: "DZ" })).toBe("Remchi · Algeria");
    expect(placeOf("en", { city: null, country: "FR" })).toBe("France");
    expect(placeOf("en", {})).toBeNull();
  });

  it("how long a session lasted", () => {
    const end = "2026-11-09T12:00:00.000Z";
    expect(sessionLength(t, "2026-11-09T11:59:30.000Z", end)).toBe(t("admin.audit.lessThanMinute"));
    expect(sessionLength(t, "2026-11-09T11:20:00.000Z", end)).toBe(t("admin.audit.minutes", { m: 40 }));
    expect(sessionLength(t, "2026-11-09T09:45:00.000Z", end)).toBe(t("admin.audit.hoursMinutes", { h: 2, m: 15 }));
    // Nothing to say: no beginning, or one after the end.
    expect(sessionLength(t, undefined, end)).toBeNull();
    expect(sessionLength(t, "2026-11-09T13:00:00.000Z", end)).toBeNull();
  });

  it("how long ago, in the largest unit that fits", () => {
    const now = Date.parse("2026-11-09T12:00:00Z");
    expect(ago("en", "2026-11-09T11:59:50Z", now)).toBe("10 seconds ago");
    expect(ago("en", "2026-11-09T11:57:00Z", now)).toBe("3 minutes ago");
    expect(ago("en", "2026-11-09T09:00:00Z", now)).toBe("3 hours ago");
    expect(ago("en", "2026-11-08T12:00:00Z", now)).toBe("yesterday");
    expect(ago("en", "2026-09-01T12:00:00Z", now)).toBe("2 months ago");
    expect(ago("en", "2024-11-09T12:00:00Z", now)).toBe("2 years ago");
  });
});
