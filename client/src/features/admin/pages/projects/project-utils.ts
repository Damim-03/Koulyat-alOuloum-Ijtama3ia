import i18n from "../../../../i18n/i18n";
import { noneText } from "../../../../lib/none-text";
import { personName } from "../../../../lib/person-name";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ما تشترك فيه صفحتا المشاريع: التواريخ، والأسماء، و«متأخرة»، وتنبيهات
 * الصحّة. في ملفٍّ بلا مكوّنات حتى يبقى تحديث الوحدات الساخن سليماً.
 */

const DAY = 86_400_000;

/** Whole days from today to `date`; negative once it has passed. */
export function daysUntil(date: string | Date) {
  const d = new Date(date);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - start.getTime()) / DAY);
}

export function nameOf(u: any) {
  return personName(u) || "—";
}

export function fmtDate(value?: string | Date | null, style: "medium" | "long" | "full" = "medium") {
  if (!value) return noneText();
  return new Date(value).toLocaleDateString(i18n.language, { dateStyle: style });
}

export function fmtDateTime(value?: string | Date | null) {
  if (!value) return noneText();
  return new Date(value).toLocaleString(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function fmtTime(value: string | Date) {
  return new Date(value).toLocaleTimeString(i18n.language, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3 days ago" / "in 2 days" in the page language. */
export function relative(value: string | Date) {
  const days = daysUntil(value);
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
  if (Math.abs(days) < 1) {
    const hours = Math.round((new Date(value).getTime() - Date.now()) / 3_600_000);
    return rtf.format(hours, "hour");
  }
  if (Math.abs(days) < 45) return rtf.format(days, "day");
  return rtf.format(Math.round(days / 30), "month");
}

export function fileSize(bytes?: number | null) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Late by its flag *or* by its date — the same rule the professor and student
 * spaces use. A milestone nobody updated past its deadline is still late.
 */
export function isLate(m: { status?: string; deadline?: string | Date }) {
  if (m.status === "completed") return false;
  if (m.status === "overdue") return true;
  return !!m.deadline && new Date(m.deadline).getTime() < Date.now();
}

export function percent(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function formatGrade(grade?: number | null) {
  if (grade === null || grade === undefined) return null;
  return Number.isInteger(grade) ? String(grade) : grade.toFixed(2).replace(/0$/, "");
}

/** Mention on a grade, on the usual Algerian 0–20 scale. */
export function gradeMention(grade?: number | null) {
  if (grade === null || grade === undefined) return null;
  if (grade >= 16) return "excellent";
  if (grade >= 14) return "veryGood";
  if (grade >= 12) return "good";
  if (grade >= 10) return "fair";
  return "fail";
}

// ─── health ─────────────────────────────────────────────────────────────────

export type AlertLevel = "danger" | "warn" | "info" | "good";
export type AlertTarget = "defense" | "committee" | "milestones" | "members" | "supervisor";

export interface ProjectAlert {
  id: string;
  level: AlertLevel;
  /** Key under `admin.proj.alert.*`. */
  key: string;
  params?: Record<string, string | number>;
  /** The section that fixes it, so the alert can jump there. */
  target?: AlertTarget;
}

const ORDER: Record<AlertLevel, number> = { danger: 0, warn: 1, info: 2, good: 3 };

/**
 * What needs the administration's attention on one project, worst first.
 *
 * Each of these was either invisible or had to be pieced together from three
 * cards: a jury with no president, a defence left "scheduled" after its date,
 * a supervisor seat held by someone who no longer supervises the project.
 */
export function projectAlerts(project: any): ProjectAlert[] {
  const out: ProjectAlert[] = [];
  const topic = project?.topic ?? {};
  const members = (project?.members ?? []) as any[];
  const milestones = (project?.milestones ?? []) as any[];
  const def = project?.defense;
  const committee = (def?.committee ?? []) as any[];

  // ── team ──
  if (members.length > 0 && !members.some((m) => m.isLeader))
    out.push({ id: "noLeader", level: "warn", key: "noLeader", target: "members" });

  const max = Number(topic.maxStudents) || 0;
  if (max > 0 && members.length < max)
    out.push({
      id: "seats",
      level: "info",
      key: "seatsOpen",
      params: { n: max - members.length, max },
      target: "members",
    });

  const mismatched = members.filter(
    (m) =>
      m.student?.specialization?.id &&
      topic.specialization?.id &&
      m.student.specialization.id !== topic.specialization.id,
  ).length;
  if (mismatched > 0)
    out.push({ id: "spec", level: "warn", key: "specMismatch", params: { n: mismatched }, target: "members" });

  // ── plan ──
  const late = milestones.filter(isLate).length;
  const done = milestones.filter((m) => m.status === "completed").length;
  if (milestones.length === 0)
    out.push({ id: "noPlan", level: "warn", key: "noPlan", target: "milestones" });
  if (late > 0)
    out.push({ id: "late", level: "danger", key: "late", params: { n: late }, target: "milestones" });

  // ── defence ──
  if (!def) {
    if (milestones.length > 0 && done === milestones.length)
      out.push({ id: "ready", level: "good", key: "readyForDefense", target: "defense" });
  } else {
    const days = daysUntil(def.date);
    if (def.status === "scheduled" && days < 0)
      out.push({ id: "stale", level: "danger", key: "defenseStale", target: "defense" });
    if (def.status === "scheduled" && days >= 0 && days <= 7)
      out.push({
        id: "soon",
        level: "info",
        key: days === 0 ? "defenseToday" : "defenseSoon",
        params: { n: days },
        target: "defense",
      });
    if (def.status === "completed" && (def.grade === null || def.grade === undefined))
      out.push({ id: "noGrade", level: "warn", key: "noGrade", target: "defense" });
    if (def.status === "cancelled")
      out.push({ id: "cancelled", level: "info", key: "defenseCancelled", target: "defense" });

    if (def.status !== "cancelled") {
      if (committee.length === 0)
        out.push({ id: "noJury", level: "warn", key: "noCommittee", target: "committee" });
      else {
        if (!committee.some((c) => c.role === "president"))
          out.push({ id: "noPresident", level: "warn", key: "noPresident", target: "committee" });
        const seat = committee.find((c) => c.role === "supervisor");
        if (seat && topic.professorId && seat.professorId !== topic.professorId)
          out.push({ id: "supSeat", level: "warn", key: "committeeSupervisorMismatch", target: "committee" });
        if (!seat && committee.every((c) => c.professorId !== topic.professorId))
          out.push({ id: "supAbsent", level: "info", key: "supervisorNotOnCommittee", target: "committee" });
      }
    }
  }

  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}

/** The one line a list card leads with: the most pressing thing, or none. */
export function cardTone(p: any): "danger" | "gold" | "good" | "neutral" {
  const def = p?.defense;
  const overdue = p?.progress?.overdue ?? 0;
  if (overdue > 0) return "danger";
  if (def?.status === "scheduled" && daysUntil(def.date) < 0) return "danger";
  if (def?.status === "completed") return "good";
  if (def?.status === "scheduled") return "gold";
  return "neutral";
}
