import { useTranslation } from "react-i18next";

/**
 * Dates as the dashboards speak them — absolute, and relative to today.
 *
 * Shared by the student and professor screens, which all put a deadline
 * next to "in 3 days" / "2 days late"; two copies would drift apart.
 */
export function useDates() {
  const { t, i18n } = useTranslation();

  function fmtDate(iso: string, withTime = false) {
    try {
      return new Intl.DateTimeFormat(
        i18n.language || "ar",
        withTime
          ? { dateStyle: "medium", timeStyle: "short" }
          : { dateStyle: "medium" },
      ).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  /** Days from today — negative means the date has passed. */
  function daysFrom(iso: string) {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return Math.round(
      (new Date(iso).setHours(0, 0, 0, 0) - midnight.getTime()) / 86400000,
    );
  }

  function relative(iso: string) {
    const d = daysFrom(iso);
    if (d === 0) return t("pro.today");
    if (d === 1) return t("pro.tomorrow");
    if (d < 0) return t("pro.lateByDays", { count: Math.abs(d) });
    return t("pro.inDays", { count: d });
  }

  return { fmtDate, daysFrom, relative };
}
