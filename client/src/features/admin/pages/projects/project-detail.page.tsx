import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Users,
  ListChecks,
  CalendarCheck,
  MapPin,
  AlertTriangle,
  RotateCcw,
  Gavel,
  Award,
  StickyNote,
  Loader2,
  Settings2,
} from "lucide-react";

import { useProject } from "../../hooks/admin-hook";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { UserAvatar } from "../../components/ui/user-avatar";
import { statusChip } from "../../utils/status-styles";
import { ProjectDetailDialog } from "../../components/dialog/projects/project-detail-dialog.form";
import { MilestoneManager } from "../../components/ui/milestone-manager";
import i18n from "../../../../i18n/i18n";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A project's own page.
 *
 * Projects were the only admin entity reachable through a dialog alone —
 * students, users, professors and topics all have `:id` routes. A dialog has
 * no address: it cannot be linked to a colleague, bookmarked, or survive a
 * refresh, and it caps how much the screen can hold. The dialog stays for
 * quick edits; this is the page you can send someone.
 */

function nameOf(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "—";
}

function fmtDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(i18n.language, {
    dateStyle: "medium",
  });
}

/** Whole days from today; negative once past. */
function daysUntil(date: string | Date) {
  const d = new Date(date);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - start.getTime()) / 86400000);
}

export function AdminProjectDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { id } = useParams<{ id: string }>();
  const [manageOpen, setManageOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useProject(id ?? null);
  const project = data as any;

  const back = () => navigate("/admin/projects");

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24 text-clay">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center">
        <AlertTriangle size={28} className="mx-auto mb-3 text-red-500" />
        <p className="text-sm font-semibold text-forest">
          {isError ? t("admin.projectLoadFailed") : t("admin.projectNotFound")}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5"
          >
            <RotateCcw size={14} />
            {t("admin.retry")}
          </button>
          <button
            onClick={back}
            className="rounded-xl border border-forest/20 px-4 py-2 text-xs font-semibold text-clay transition hover:bg-forest/5"
          >
            {t("admin.backToProjects")}
          </button>
        </div>
      </div>
    );
  }

  const topic = project.topic ?? {};
  const members = (project.members ?? []) as any[];
  const milestones = (project.milestones ?? []) as any[];
  const def = project.defense;
  const committee = (def?.committee ?? []) as any[];

  const done = milestones.filter((m) => m.status === "completed").length;
  const overdue = milestones.filter((m) => m.status === "overdue").length;
  const pct = milestones.length
    ? Math.round((done / milestones.length) * 100)
    : 0;
  const defDays = def ? daysUntil(def.date) : null;
  const defSoon =
    def?.status === "scheduled" &&
    defDays !== null &&
    defDays >= 0 &&
    defDays <= 7;

  return (
    <div className="font-body">
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={back}
          className="inline-flex items-center gap-2 font-serif text-sm font-bold text-forest transition hover:opacity-80"
        >
          <ChevronRight size={18} className="ltr:rotate-180" />
          {t("admin.backToProjects")}
        </button>
      </div>

      {/* Hero */}
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
          <div className="min-w-0 space-y-3">
            <h1 className="font-serif text-2xl leading-tight font-bold text-forest lg:text-3xl">
              {topic.title ?? "—"}
            </h1>
            <div className="flex flex-wrap gap-2">
              {topic.specialization?.name && (
                <span className="rounded-full bg-soft-sage/30 px-3 py-1 text-[11px] font-medium text-forest">
                  {topic.specialization.name}
                </span>
              )}
              {topic.academicYear?.title && (
                <span
                  className="rounded-full bg-forest/5 px-3 py-1 text-[11px] font-medium text-clay"
                  dir="ltr"
                >
                  {topic.academicYear.title}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-medium text-gold">
                <Users size={13} />
                {members.length}
              </span>
              {/* The status belongs with the other facts about the project,
                  not stranded in the navigation bar above it. */}
              {topic.status && (
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusChip(topic.status)}`}
                >
                  {t(`status.${topic.status}`, { defaultValue: topic.status })}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-forest/10 bg-cream-2 p-4">
            <div className="text-start">
              <p className="text-[10px] text-clay">{t("admin.supervisor")}</p>
              <p className="text-sm font-bold text-forest">
                {nameOf(topic.professor?.user)}
              </p>
            </div>
            <UserAvatar
              user={topic.professor?.user}
              size={44}
              className="rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* ── main column ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Progress */}
          <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
              <ListChecks size={18} className="text-gold" />
              <h2 className="font-serif text-lg font-bold text-forest">
                {t("admin.timeline")}
              </h2>
              {milestones.length > 0 && (
                <span className="ms-auto text-sm font-bold text-forest tabular-nums">
                  {pct}%
                </span>
              )}
            </div>

            {milestones.length > 0 && (
              <>
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-clay">
                  <span>
                    {t("admin.milestonesDone", {
                      done,
                      total: milestones.length,
                    })}
                  </span>
                  {overdue > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                      <AlertTriangle size={11} />
                      {t("admin.overdueN", { n: overdue })}
                    </span>
                  )}
                </div>
                <div
                  className="mb-5 h-1.5 overflow-hidden rounded-full bg-forest/10"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-sage transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            )}

            {/* Administration can now shape the timeline too, so this is an
                editor rather than a read-only list. */}
            <MilestoneManager groupId={project.id} />
          </section>

          {/* Members */}
          <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-forest/10 pb-3">
              <Users size={18} className="text-gold" />
              <h2 className="font-serif text-lg font-bold text-forest">
                {t("admin.members")}
              </h2>
              <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest tabular-nums">
                {members.length}
              </span>
              {/* Moved out of the top bar, but not dropped: this dialog holds
                  the only controls for changing the supervisor and assigning
                  a student. */}
              <button
                onClick={() => setManageOpen(true)}
                className="ms-auto inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/5"
              >
                <Settings2 size={14} />
                {t("admin.projectDetails")}
              </button>
            </div>

            {members.length === 0 ? (
              <p className="py-4 text-center text-sm text-clay">
                {t("admin.noMembers")}
              </p>
            ) : (
              /* Same shape as the students list: one column per fact, a dark
                 header bar, avatar in its own cell. Someone who knows that
                 screen already knows how to read this one. */
              <div className="overflow-x-auto rounded-xl border border-forest/10">
                <table className="w-full text-start">
                  <thead>
                    <tr className="bg-forest text-cream">
                      <th className="w-20 px-4 py-3 text-start text-xs font-medium">
                        {t("admin.avatarColumn")}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium">
                        {t("admin.firstNameColumn")}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium">
                        {t("admin.lastName")}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium">
                        {t("admin.regNumber")}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium">
                        {t("admin.specialization")}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium">
                        {t("admin.filiere")}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium">
                        {t("admin.department")}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium">
                        {t("admin.facultyLabel")}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium">
                        {t("admin.academicYear")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-forest/10">
                    {members.map((m) => {
                      const st = m.student;
                      const sp = st?.specialization;
                      // Nothing in the API forces a member to share the
                      // topic's specialization, so a mismatch is worth saying
                      // out loud rather than leaving to be noticed.
                      const mismatch =
                        !!sp?.id &&
                        !!topic.specialization?.id &&
                        sp.id !== topic.specialization.id;

                      return (
                        <tr
                          key={m.id}
                          // The gold frame is the marker now: a full outline
                          // reads at a glance and implies no rank.
                          className={
                            m.isLeader
                              ? "bg-gold/5 outline-2 -outline-offset-2 outline-gold"
                              : "transition-colors hover:bg-forest/4"
                          }
                        >
                          <td className="px-4 py-3.5">
                            <UserAvatar user={st?.user} size={36} />
                          </td>
                          <td className="px-4 py-3.5 text-sm font-medium text-forest">
                            <span className="inline-flex items-center gap-1.5">
                              {st?.user?.firstName ?? "—"}
                              {m.isLeader && (
                                <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                                  {t("admin.leader")}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm font-medium text-forest">
                            {st?.user?.lastName ?? "—"}
                          </td>
                          <td
                            className="px-4 py-3.5 text-sm text-clay tabular-nums"
                            dir="ltr"
                          >
                            {st?.registrationNumber ?? "—"}
                          </td>
                          <td className="px-4 py-3.5 text-sm">
                            <span
                              className={
                                mismatch
                                  ? "font-semibold text-amber-600 dark:text-amber-400"
                                  : "text-clay"
                              }
                            >
                              {sp?.name ?? "—"}
                            </span>
                            {mismatch && (
                              <AlertTriangle
                                size={11}
                                aria-label={t("admin.memberDifferentSpec")}
                                className="ms-1.5 inline text-amber-600 dark:text-amber-400"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-clay">
                            {sp?.filiere?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-clay">
                            {sp?.filiere?.department?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-clay">
                            {sp?.filiere?.department?.faculty?.name ?? "—"}
                          </td>
                          <td
                            className="px-4 py-3.5 text-sm text-clay"
                            dir="ltr"
                          >
                            {st?.academicYear?.title ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* ── side column ── */}
        <div className="space-y-6">
          {/* Defence */}
          <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
              <Gavel size={18} className="text-gold" />
              <h2 className="font-serif text-lg font-bold text-forest">
                {t("admin.defenseLabel")}
              </h2>
            </div>

            {!def ? (
              <p className="py-4 text-center text-sm text-clay">
                {t("admin.noDefenseYet")}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusChip(def.status)}`}
                  >
                    {t(`status.${def.status}`, { defaultValue: def.status })}
                  </span>
                  {defSoon && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                      <AlertTriangle size={10} />
                      {defDays === 0
                        ? t("admin.defenseToday")
                        : t("admin.defenseIn", { n: defDays })}
                    </span>
                  )}
                </div>

                <dl className="space-y-2 text-[12px]">
                  <Row
                    icon={<CalendarCheck size={13} />}
                    label={t("admin.defenseLabel")}
                    value={fmtDate(def.date)}
                  />
                  {def.room && (
                    <Row
                      icon={<MapPin size={13} />}
                      label={t("admin.room")}
                      value={def.room}
                    />
                  )}
                  {def.grade !== null && def.grade !== undefined && (
                    <Row
                      icon={<Award size={13} />}
                      label={t("admin.grade")}
                      value={String(def.grade)}
                    />
                  )}
                </dl>

                {def.notes && (
                  <div className="rounded-xl bg-cream-2 p-3">
                    <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold text-clay">
                      <StickyNote size={11} />
                      {t("admin.notes")}
                    </p>
                    <p className="text-[12px] leading-relaxed whitespace-pre-line text-clay">
                      {def.notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Committee */}
          <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
              <Users size={18} className="text-gold" />
              <h2 className="font-serif text-lg font-bold text-forest">
                {t("admin.committee")}
              </h2>
            </div>

            {committee.length === 0 ? (
              <p className="py-4 text-center text-sm text-clay">
                {t("admin.noCommittee")}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {committee.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5">
                    <UserAvatar user={c.professor?.user} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-forest">
                        {nameOf(c.professor?.user)}
                      </p>
                      <p className="text-[11px] text-clay">
                        {t(`committeeRole.${c.role}`, {
                          defaultValue: c.role,
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ProjectDetailDialog
        projectId={manageOpen ? (id ?? null) : null}
        open={manageOpen}
        onClose={() => {
          setManageOpen(false);
          refetch();
        }}
      />
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="inline-flex shrink-0 items-center gap-1 text-clay">
        {icon}
        {label}
      </dt>
      <dd className="truncate text-end font-semibold text-forest">{value}</dd>
    </div>
  );
}
