import { useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpLeft,
  Award,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  FileText,
  Flag,
  Gavel,
  GraduationCap,
  Hash,
  History,
  Info,
  Layers,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  StickyNote,
  Trash2,
  UserCheck,
  UserCog,
  UserMinus,
  Users,
} from "lucide-react";

import {
  useDeleteDefense,
  useProject,
  useRemoveProjectMember,
  useSetProjectLeader,
} from "../../hooks/admin-hook";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { MilestoneManager } from "../../components/ui/milestone-manager";
import { ProjectMembersDialog } from "../../components/dialog/projects/project-members-dialog.form";
import { ProjectDefenseDialog } from "../../components/dialog/projects/project-defense-dialog";
import { ChangeSupervisorDialog } from "../../components/dialog/projects/change-supervisor-dialog";
import { DissolveProjectDialog } from "../../components/dialog/projects/dissolve-project-dialog";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { statusChip } from "../../utils/status-styles";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { None } from "../../../../lib/none";
import i18n from "../../../../i18n/i18n";
import { ActionButton, EmptyNote, ProgressRing, RecordTile, SectionCard } from "./project-ui";
import {
  daysUntil,
  fmtDate,
  fmtDateTime,
  fmtTime,
  formatGrade,
  gradeMention,
  isLate,
  nameOf,
  percent,
  projectAlerts,
  relative,
  type ProjectAlert,
} from "./project-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A project's own page — everything the administration knows about one team,
 * and everything it can do to it, in one place.
 *
 * Projects were the only admin entity reachable through a dialog alone. The
 * page first replaced the dialog's address; it now also replaces its
 * controls: supervisor, members, leader, timeline, defence, jury and the
 * dissolve are all here, each next to the facts it changes. What needs
 * attention is worked out from those facts and listed first.
 */

const ROLE_ORDER: Record<string, number> = { president: 0, supervisor: 1, examiner: 2 };

export function AdminProjectDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const location = useLocation();
  const { id, lang } = useParams<{ id: string; lang: string }>();

  const [membersOpen, setMembersOpen] = useState(false);
  const [defenseOpen, setDefenseOpen] = useState(false);
  const [supervisorOpen, setSupervisorOpen] = useState(false);
  const [dissolveOpen, setDissolveOpen] = useState(false);
  const [deleteDefenseOpen, setDeleteDefenseOpen] = useState(false);
  const [removing, setRemoving] = useState<any | null>(null);

  const { data, isLoading, isError, refetch } = useProject(id ?? null);
  const project = data as any;
  const setLeader = useSetProjectLeader();
  const removeMember = useRemoveProjectMember();
  const deleteDefense = useDeleteDefense();

  // Back to the list as it was left — filters, page and all.
  const from = (location.state as { from?: string } | null)?.from ?? "";
  const back = () => navigate(`/admin/projects${from}`);
  const to = (path: string) => `/${lang}${path}`;

  if (isLoading) return <LoadingArea className="py-20" />;

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
  const spec = topic.specialization;
  const members = (project.members ?? []) as any[];
  const milestones = (project.milestones ?? []) as any[];
  const def = project.defense;
  const committee = ([...(def?.committee ?? [])] as any[]).sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9),
  );
  const supervisor = topic.professor;
  const insights = project.insights;
  const actions = project.actions ?? {
    canDissolve: false,
    dissolveBlockers: { submissions: 0, defense: !!def },
  };

  const done = milestones.filter((m) => m.status === "completed").length;
  const late = milestones.filter(isLate).length;
  const pct = percent(done, milestones.length);
  const max = Number(topic.maxStudents) || 0;
  const submissions =
    insights?.submissions ?? milestones.reduce((n, m) => n + (m._count?.submissions ?? 0), 0);
  const alerts = projectAlerts(project);
  const supervisorSeat = committee.find((c) => c.role === "supervisor");

  const path = [
    spec?.filiere?.department?.faculty?.name,
    spec?.filiere?.department?.name,
    spec?.filiere?.name,
    spec?.name,
  ].filter(Boolean) as string[];

  function jump(target?: string) {
    if (target) document.getElementById(`project-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t("admin.proj.linkCopied"));
    } catch {
      toast.error(t("admin.proj.linkCopyFailed"));
    }
  }

  return (
    <div className="font-body">
      {/* ── top bar ─────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={back}
          className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 font-serif text-sm font-bold text-forest transition hover:bg-forest/5"
        >
          <ChevronRight size={18} className="ltr:rotate-180" />
          {t("admin.backToProjects")}
        </button>
        <div className="flex items-center gap-2">
          <ActionButton icon={Link2} size="sm" variant="ghost" onClick={copyLink}>
            {t("admin.proj.copyLink")}
          </ActionButton>
          {topic.id && (
            <Link
              to={to(`/admin/topics/${topic.id}`)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-clay transition hover:bg-forest/5 hover:text-forest"
            >
              <ExternalLink size={13} />
              {t("admin.proj.topicPage")}
            </Link>
          )}
        </div>
      </div>

      {/* ── hero ────────────────────────────────────────────── */}
      <section className="forest-glow relative mb-6 overflow-hidden rounded-3xl text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)]">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-24 -start-10 size-80 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative px-6 pt-6 pb-5 lg:px-8 lg:pt-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              {/* where it sits */}
              {path.length > 0 && (
                <p className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] text-cream/65">
                  <Building2 size={12} className="text-gold-soft" />
                  {path.map((p, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      {i > 0 && <span className="text-cream/35">›</span>}
                      <span className={i === path.length - 1 ? "font-semibold text-cream/90" : ""}>{p}</span>
                    </span>
                  ))}
                </p>
              )}

              <h1 className="font-serif text-2xl leading-snug font-bold text-cream lg:text-[28px]" data-testid="project-title">
                {topic.title ?? <None />}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                {topic.academicYear?.title && (
                  <span className="rounded-full border border-white/10 bg-cream/10 px-2.5 py-1 font-medium text-cream/90" dir="ltr">
                    {topic.academicYear.title}
                  </span>
                )}
                {spec?.level && (
                  <span className="rounded-full border border-white/10 bg-cream/10 px-2.5 py-1 font-medium text-cream/90">
                    {t(`admin.proj.level.${spec.level}`, { defaultValue: spec.level })}
                  </span>
                )}
                {topic.status && (
                  <span className="rounded-full bg-gold/20 px-2.5 py-1 font-bold text-gold-soft">
                    {t(`admin.proj.topicStatus.${topic.status}`, { defaultValue: t(`status.${topic.status}`) })}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-cream/60">
                  <History size={12} />
                  {insights?.origin?.kind === "request"
                    ? t("admin.proj.originRequest", { date: fmtDate(insights.origin.since) })
                    : t("admin.proj.originAssignment", { date: fmtDate(project.createdAt) })}
                </span>
              </div>

              {/* what can be done, all in reach */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDefenseOpen(true)}
                  data-testid="project-defense-action"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-forest-deep transition hover:bg-gold-soft"
                >
                  {def ? <Pencil size={14} /> : <CalendarPlus size={14} />}
                  {def ? t("admin.proj.editDefense") : t("admin.proj.scheduleDefense")}
                </button>
                <HeroButton icon={Users} onClick={() => setMembersOpen(true)} testId="project-members-action">
                  {t("admin.manageMembers")}
                </HeroButton>
                <HeroButton icon={UserCog} onClick={() => setSupervisorOpen(true)} testId="project-supervisor-action">
                  {t("admin.changeSupervisor")}
                </HeroButton>
                <HeroButton icon={ListChecks} onClick={() => jump("milestones")}>
                  {t("admin.proj.gotoTimeline")}
                </HeroButton>
              </div>
            </div>

            {/* supervisor */}
            <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-cream/10 p-4 backdrop-blur-sm xl:w-80">
              <p className="mb-3 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-gold-soft">
                <ShieldCheck size={12} />
                {t("admin.supervisor")}
              </p>
              <div className="flex items-center gap-3">
                <UserAvatar user={supervisor?.user} size={52} radius="rounded-2xl" tone="gold" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-cream">{nameOf(supervisor?.user)}</p>
                  {Array.isArray(supervisor?.grade) && supervisor.grade.length > 0 && (
                    <p className="truncate text-[11px] text-cream/70">{supervisor.grade.join("، ")}</p>
                  )}
                  {supervisor?.department?.name && (
                    <p className="truncate text-[11px] text-cream/55">{supervisor.department.name}</p>
                  )}
                </div>
              </div>
              {(supervisor?.universityEmail || supervisor?.user?.email) && (
                <a
                  href={`mailto:${supervisor.universityEmail ?? supervisor.user.email}`}
                  className="mt-3 flex items-center gap-1.5 truncate rounded-lg bg-cream/5 px-2.5 py-1.5 text-[11px] text-cream/80 transition hover:bg-cream/10"
                  dir="ltr"
                >
                  <Mail size={12} className="shrink-0" />
                  <span className="truncate">{supervisor.universityEmail ?? supervisor.user.email}</span>
                </a>
              )}
              {supervisor?.id && (
                <Link
                  to={to(`/admin/professors/${supervisor.id}`)}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-gold-soft transition hover:text-gold"
                >
                  {t("admin.proj.openProfile")}
                  <ArrowUpLeft size={12} className="ltr:-scale-x-100" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="relative grid grid-cols-2 gap-px border-t border-white/10 bg-white/5 sm:grid-cols-3 xl:grid-cols-6">
          <Kpi label={t("admin.proj.col.progress")}>
            <div className="flex items-center gap-3">
              <ProgressRing
                value={pct}
                size={46}
                stroke={5}
                tone={late > 0 ? "danger" : "cream"}
                track="stroke-white/15"
                textClass="text-cream"
                label={t("admin.proj.col.progress")}
              />
            </div>
          </Kpi>
          <Kpi label={t("admin.milestones")} value={`${done}/${milestones.length}`} hint={t("admin.proj.kpi.doneOfTotal")} />
          <Kpi
            label={t("admin.proj.kpi.late")}
            value={late}
            tone={late > 0 ? "danger" : "muted"}
            hint={late > 0 ? t("admin.proj.kpi.needsFollowUp") : t("admin.proj.kpi.onTrack")}
          />
          <Kpi
            label={t("admin.proj.kpi.submissions")}
            value={submissions}
            hint={insights?.lastSubmissionAt ? t("admin.proj.kpi.last", { when: relative(insights.lastSubmissionAt) }) : t("admin.proj.card.noActivity")}
          />
          <Kpi
            label={t("admin.proj.col.team")}
            value={max ? `${members.length}/${max}` : members.length}
            tone={max && members.length < max ? "warn" : "neutral"}
            hint={max && members.length < max ? t("admin.proj.kpi.seatsLeft", { n: max - members.length }) : t("admin.proj.kpi.teamFull")}
          />
          <Kpi label={t("admin.defenseLabel")} value={defenseKpi(def, t)} tone={def?.status === "scheduled" && daysUntil(def.date) < 0 ? "danger" : def ? "gold" : "muted"} hint={def ? fmtDate(def.date) : t("admin.proj.kpi.notScheduled")} />
        </div>
      </section>

      {/* ── attention ───────────────────────────────────────── */}
      <AlertsPanel alerts={alerts} onJump={jump} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {/* ── main column ── */}
        <div className="space-y-6 xl:col-span-2">
          <SectionCard
            id="project-milestones"
            icon={ListChecks}
            title={t("admin.timeline")}
            count={milestones.length}
            subtitle={
              milestones.length
                ? t("admin.proj.timelineSubtitle", { done, total: milestones.length, pct })
                : t("admin.proj.timelineEmpty")
            }
          >
            <MilestoneManager groupId={project.id} />
          </SectionCard>

          <SectionCard
            id="project-members"
            icon={Users}
            title={t("admin.members")}
            count={max ? `${members.length}/${max}` : members.length}
            subtitle={t("admin.proj.membersSubtitle")}
            bodyClass="p-0"
            actions={
              <ActionButton icon={Users} size="sm" onClick={() => setMembersOpen(true)}>
                {t("admin.manageMembers")}
              </ActionButton>
            }
          >
            {members.length === 0 ? (
              <div className="p-5">
                <EmptyNote icon={Users} title={t("admin.noMembers")} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Compact enough for the main column: the actions must be in
                    view, not behind a horizontal scroll. */}
                <table className="w-full min-w-[560px] text-start" data-testid="project-members-table">
                  <thead>
                    <tr className="bg-forest/5 text-clay">
                      <th className="px-5 py-3 text-start text-[11px] font-semibold">{t("admin.proj.memberCol.student")}</th>
                      <th className="px-4 py-3 text-start text-[11px] font-semibold">{t("admin.proj.memberCol.path")}</th>
                      <th className="px-4 py-3 text-start text-[11px] font-semibold">{t("admin.proj.memberCol.lastSeen")}</th>
                      <th className="px-4 py-3 text-end text-[11px] font-semibold">{t("admin.proj.memberCol.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-forest/10">
                    {members.map((m) => {
                      const st = m.student;
                      const sp = st?.specialization;
                      // Nothing in the API forces a member to share the
                      // topic's specialization, so a mismatch is said aloud.
                      const mismatch = !!sp?.id && !!spec?.id && sp.id !== spec.id;
                      return (
                        <tr key={m.id} className={m.isLeader ? "bg-gold/5" : "transition-colors hover:bg-forest/4"}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                user={st?.user}
                                size={38}
                                className={m.isLeader ? "ring-2 ring-gold ring-offset-2 ring-offset-cream-card" : ""}
                              />
                              <div className="min-w-0">
                                <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                                  <span className="truncate">{nameOf(st?.user)}</span>
                                  {m.isLeader && (
                                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9.5px] font-bold text-gold">
                                      <Crown size={10} />
                                      {t("admin.leader")}
                                    </span>
                                  )}
                                </p>
                                <p className="truncate text-[11px] text-clay tabular-nums" title={st?.user?.email ?? undefined}>
                                  <span dir="ltr">{st?.registrationNumber ?? "—"}</span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-52 px-4 py-3 text-[12px]">
                            <p className={`flex items-center gap-1 truncate ${mismatch ? "font-semibold text-amber-600 dark:text-amber-400" : "text-forest"}`}>
                              {sp?.name ?? <None />}
                              {mismatch && (
                                <AlertTriangle size={11} aria-label={t("admin.memberDifferentSpec")} className="shrink-0" />
                              )}
                            </p>
                            <p className="truncate text-[10.5px] text-clay" title={sp?.filiere?.department?.name}>
                              {[sp?.filiere?.name, st?.academicYear?.title].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-clay">
                            {st?.user?.lastLoginAt ? relative(st.user.lastLoginAt) : t("admin.proj.neverSignedIn")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-0.5">
                              {!m.isLeader && (
                                <IconAction
                                  icon={Star}
                                  label={t("admin.setAsLeader")}
                                  disabled={setLeader.isPending}
                                  onClick={() => setLeader.mutate({ groupId: project.id, studentId: st.id })}
                                  hover="hover:bg-gold/15 hover:text-gold"
                                />
                              )}
                              {st?.id && (
                                <Link
                                  to={to(`/admin/students/${st.id}`)}
                                  title={t("admin.proj.openProfile")}
                                  aria-label={t("admin.proj.openProfile")}
                                  className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/10 hover:text-forest"
                                >
                                  <ArrowUpLeft size={15} className="ltr:-scale-x-100" />
                                </Link>
                              )}
                              <IconAction
                                icon={UserMinus}
                                label={members.length <= 1 ? t("admin.proj.lastMemberHint") : t("admin.proj.removeMember")}
                                disabled={members.length <= 1}
                                onClick={() => setRemoving(m)}
                                hover="hover:bg-red-500/10 hover:text-red-500"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <TopicBrief topic={topic} href={topic.id ? to(`/admin/topics/${topic.id}`) : undefined} />
        </div>

        {/* ── side column ── */}
        <div className="space-y-6">
          <SectionCard
            id="project-defense"
            icon={Gavel}
            title={t("admin.defenseLabel")}
            actions={
              def && (
                <>
                  <IconAction icon={Pencil} label={t("admin.proj.editDefense")} onClick={() => setDefenseOpen(true)} />
                  <IconAction
                    icon={Trash2}
                    label={t("admin.proj.deleteDefense")}
                    onClick={() => setDeleteDefenseOpen(true)}
                    hover="hover:bg-red-500/10 hover:text-red-500"
                  />
                </>
              )
            }
          >
            {!def ? (
              <EmptyNote
                icon={CalendarClock}
                title={t("admin.noDefenseYet")}
                hint={
                  milestones.length > 0 && done === milestones.length
                    ? t("admin.proj.defenseReadyHint")
                    : t("admin.proj.defenseEmptyHint")
                }
                action={
                  <ActionButton icon={CalendarPlus} variant="gold" onClick={() => setDefenseOpen(true)}>
                    {t("admin.proj.scheduleDefense")}
                  </ActionButton>
                }
              />
            ) : (
              <DefenseBody def={def} onEdit={() => setDefenseOpen(true)} />
            )}
          </SectionCard>

          <SectionCard
            id="project-committee"
            icon={UserCheck}
            title={t("admin.committee")}
            count={def ? committee.length : undefined}
            actions={
              def && (
                <IconAction icon={Pencil} label={t("admin.proj.editCommittee")} onClick={() => setDefenseOpen(true)} />
              )
            }
          >
            {committee.length === 0 ? (
              <EmptyNote
                icon={UserCheck}
                title={t("admin.noCommittee")}
                hint={def ? t("admin.proj.committeeEmptyHint") : t("admin.proj.committeeNeedsDefense")}
              />
            ) : (
              <ul className="space-y-2">
                {committee.map((c) => {
                  const wrongSeat = c.role === "supervisor" && topic.professorId && c.professorId !== topic.professorId;
                  return (
                    <li
                      key={c.id}
                      className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                        c.role === "president" ? "border-gold/40 bg-gold/5" : "border-forest/10 bg-cream-2/50"
                      }`}
                    >
                      <UserAvatar user={c.professor?.user} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-forest">{nameOf(c.professor?.user)}</p>
                        <p className="flex items-center gap-1 text-[11px] text-clay">
                          {c.role === "president" ? <Crown size={11} className="text-gold" /> : c.role === "supervisor" ? <UserCheck size={11} /> : <Gavel size={11} />}
                          {t(`committeeRole.${c.role}`, { defaultValue: c.role })}
                          {c.professorId === topic.professorId && c.role !== "supervisor" && (
                            <span className="text-[10px]">· {t("admin.proj.isSupervisor")}</span>
                          )}
                        </p>
                        {wrongSeat && (
                          <p className="mt-0.5 text-[10.5px] text-amber-700 dark:text-amber-300">
                            {t("admin.proj.alert.committeeSupervisorMismatch")}
                          </p>
                        )}
                      </div>
                      {c.professor?.id && (
                        <Link
                          to={to(`/admin/professors/${c.professor.id}`)}
                          aria-label={t("admin.proj.openProfile")}
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-forest/10 hover:text-forest"
                        >
                          <ArrowUpLeft size={14} className="ltr:-scale-x-100" />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            icon={ClipboardList}
            title={t("admin.proj.record")}
            subtitle={t("admin.proj.recordSubtitle")}
            bodyClass="p-4"
          >
            <div className="grid grid-cols-2 gap-2.5" data-testid="project-record">
              <RecordTile span icon={Hash} tone="gold" label={t("admin.proj.recordId")}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(project.id);
                      toast.success(t("admin.proj.idCopied"));
                    } catch {
                      /* nothing to copy into */
                    }
                  }}
                  title={project.id}
                  className="group flex w-full items-center justify-between gap-2 rounded-lg border border-forest/10 bg-cream-card px-3 py-1.5 transition hover:border-gold/40"
                >
                  <span className="truncate font-mono text-[14px] tracking-wider tabular-nums" dir="ltr">
                    {String(project.id).slice(0, 8).toUpperCase()}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-clay transition group-hover:text-gold">
                    <Copy size={12} />
                    {t("admin.proj.copy")}
                  </span>
                </button>
              </RecordTile>

              <RecordTile icon={CalendarCheck} tone="sky" label={t("admin.proj.createdAt")} sub={relative(project.createdAt)}>
                {fmtDate(project.createdAt)}
              </RecordTile>
              <RecordTile
                icon={Clock}
                tone="violet"
                label={t("admin.proj.updatedAt")}
                sub={project.updatedAt ? fmtDate(project.updatedAt) : undefined}
              >
                {project.updatedAt ? relative(project.updatedAt) : "—"}
              </RecordTile>

              <RecordTile
                span
                icon={History}
                tone="emerald"
                label={t("admin.proj.origin")}
                sub={insights?.origin?.since ? t("admin.proj.originSince", { date: fmtDate(insights.origin.since) }) : undefined}
              >
                {insights?.origin?.kind === "request" && insights.origin.requestId ? (
                  <Link
                    to={to(`/admin/group-requests/${insights.origin.requestId}`)}
                    className="inline-flex items-center gap-1.5 text-forest transition hover:text-gold"
                  >
                    {t("admin.proj.originRequestShort")}
                    <ArrowUpLeft size={13} className="ltr:-scale-x-100" />
                  </Link>
                ) : (
                  t("admin.proj.originAssignmentShort")
                )}
              </RecordTile>

              <RecordTile
                span
                icon={Layers}
                tone="gold"
                label={t("admin.specialization")}
                sub={
                  [spec?.filiere?.name, spec?.level && t(`admin.proj.level.${spec.level}`, { defaultValue: spec.level })]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
              >
                {spec?.name ?? <None />}
              </RecordTile>

              <RecordTile
                icon={GraduationCap}
                tone="sky"
                label={t("admin.academicYear")}
                sub={topic.academicYear?.isActive ? t("admin.proj.currentYear") : undefined}
              >
                <span dir="ltr" className="tabular-nums">
                  {topic.academicYear?.title ?? "—"}
                </span>
              </RecordTile>
              <RecordTile
                icon={Users}
                tone={max && members.length < max ? "amber" : "emerald"}
                label={t("admin.proj.capacity")}
                sub={
                  max && members.length < max
                    ? t("admin.proj.kpi.seatsLeft", { n: max - members.length })
                    : t("admin.proj.kpi.teamFull")
                }
              >
                <span dir="ltr" className="tabular-nums">
                  {max ? `${members.length} / ${max}` : members.length}
                </span>
                {max > 0 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-forest/10">
                    <div
                      className={`h-full rounded-full ${members.length < max ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${percent(members.length, max)}%` }}
                    />
                  </div>
                )}
              </RecordTile>

              <RecordTile
                span
                icon={FileText}
                tone="rose"
                label={t("admin.proj.lastSubmission")}
                sub={insights?.lastSubmissionAt ? relative(insights.lastSubmissionAt) : undefined}
              >
                {insights?.lastSubmissionAt ? (
                  fmtDateTime(insights.lastSubmissionAt)
                ) : (
                  <span className="font-medium text-clay">{t("admin.proj.card.noActivity")}</span>
                )}
              </RecordTile>
            </div>
          </SectionCard>

          {/* danger zone */}
          <section className="overflow-hidden rounded-2xl border border-red-300/50 bg-red-500/5" data-testid="project-danger-zone">
            <div className="flex items-start gap-3 p-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                <AlertOctagon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-base font-bold text-red-700 dark:text-red-300">{t("admin.proj.dissolve.title")}</h2>
                <p className="mt-1 text-[11.5px] leading-relaxed text-clay">
                  {actions.canDissolve ? t("admin.proj.dissolve.intro") : t("admin.proj.dissolve.introBlocked")}
                </p>
                <div className="mt-3">
                  <ActionButton icon={Trash2} variant="danger" size="sm" onClick={() => setDissolveOpen(true)} testId="project-dissolve">
                    {t("admin.proj.dissolve.open")}
                  </ActionButton>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── dialogs ─────────────────────────────────────────── */}
      <ProjectMembersDialog
        open={membersOpen}
        groupId={membersOpen ? project.id : null}
        topicId={topic.id}
        topicTitle={topic.title ?? ""}
        maxStudents={max || undefined}
        specializationId={spec?.id}
        allowDissolve={false}
        onClose={() => setMembersOpen(false)}
        onChanged={() => refetch()}
      />
      <ProjectDefenseDialog
        open={defenseOpen}
        onClose={() => setDefenseOpen(false)}
        groupId={project.id}
        supervisorId={topic.professorId}
        defense={def}
      />
      <ChangeSupervisorDialog
        open={supervisorOpen}
        onClose={() => setSupervisorOpen(false)}
        groupId={project.id}
        current={supervisor}
        committeeSeatHeldByCurrent={!!supervisorSeat && supervisorSeat.professorId === topic.professorId}
      />
      <DissolveProjectDialog
        open={dissolveOpen}
        onClose={() => setDissolveOpen(false)}
        onDissolved={() => navigate(`/admin/projects${from}`)}
        groupId={project.id}
        topicTitle={topic.title ?? ""}
        members={members.length}
        milestones={milestones.length}
        blockers={actions.dissolveBlockers}
      />
      <ConfirmDialog
        open={deleteDefenseOpen}
        tone="danger"
        title={t("admin.proj.deleteDefense")}
        message={t("admin.proj.deleteDefenseConfirm")}
        confirmLabel={t("admin.confirmDelete")}
        cancelLabel={t("admin.cancel")}
        loading={deleteDefense.isPending}
        onConfirm={() => def && deleteDefense.mutate(def.id, { onSettled: () => setDeleteDefenseOpen(false) })}
        onClose={() => setDeleteDefenseOpen(false)}
      />
      <ConfirmDialog
        open={!!removing}
        tone="danger"
        title={t("admin.proj.removeMember")}
        message={t("admin.proj.removeMemberConfirm", { name: nameOf(removing?.student?.user) })}
        confirmLabel={t("admin.proj.removeMember")}
        cancelLabel={t("admin.cancel")}
        loading={removeMember.isPending}
        onConfirm={() =>
          removing &&
          removeMember.mutate(
            { groupId: project.id, studentId: removing.student.id },
            { onSettled: () => setRemoving(null) },
          )
        }
        onClose={() => setRemoving(null)}
      >
        {removing?.isLeader && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            <Info size={12} className="mt-0.5 shrink-0" />
            {t("admin.proj.removeLeaderHint")}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ─── pieces ──────────────────────────────────────────────────────────────────

function defenseKpi(def: any, t: (k: string, o?: any) => string) {
  if (!def) return "—";
  if (def.status === "completed") {
    const g = formatGrade(def.grade);
    return g !== null ? `${g}/20` : t("admin.proj.defenseState.completed");
  }
  if (def.status === "cancelled") return t("admin.proj.defenseState.cancelled");
  const d = daysUntil(def.date);
  if (d < 0) return t("admin.proj.kpi.overdueDefense");
  if (d === 0) return t("admin.defenseToday");
  return t("admin.proj.kpi.inDays", { n: d });
}

function HeroButton({
  icon: Icon,
  children,
  onClick,
  testId,
}: {
  icon: typeof Users;
  children: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-cream/10 px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-cream/20"
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

const KPI_TONE = {
  neutral: "text-cream",
  muted: "text-cream/60",
  danger: "text-red-300",
  warn: "text-amber-200",
  gold: "text-gold-soft",
} as const;

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  children,
}: {
  label: string;
  value?: ReactNode;
  hint?: string;
  tone?: keyof typeof KPI_TONE;
  children?: ReactNode;
}) {
  return (
    <div className="bg-forest-deep/40 px-5 py-4">
      <p className="mb-1.5 truncate text-[10.5px] font-medium text-cream/60">{label}</p>
      {children ?? <p className={`font-serif text-xl leading-tight font-bold tabular-nums ${KPI_TONE[tone]}`}>{value}</p>}
      {hint && <p className="mt-1 truncate text-[10.5px] text-cream/50">{hint}</p>}
    </div>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  hover = "hover:bg-forest/10 hover:text-forest",
}: {
  icon: typeof Star;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hover?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid size-8 place-items-center rounded-lg text-clay transition disabled:cursor-not-allowed disabled:opacity-35 ${hover}`}
    >
      <Icon size={15} />
    </button>
  );
}

const ALERT_STYLE = {
  danger: { box: "border-red-300/60 bg-red-500/8", icon: "text-red-600 dark:text-red-400", Icon: AlertOctagon },
  warn: { box: "border-amber-300/60 bg-amber-500/8", icon: "text-amber-600 dark:text-amber-400", Icon: AlertTriangle },
  info: { box: "border-sky-300/50 bg-sky-500/8", icon: "text-sky-600 dark:text-sky-400", Icon: Info },
  good: { box: "border-emerald-300/50 bg-emerald-500/8", icon: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 },
} as const;

function AlertsPanel({ alerts, onJump }: { alerts: ProjectAlert[]; onJump: (target?: string) => void }) {
  const { t } = useTranslation();
  if (alerts.length === 0)
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-300/50 bg-emerald-500/8 px-5 py-4" data-testid="project-alerts-clear">
        <CheckCircle2 size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="text-sm font-semibold text-forest">{t("admin.proj.allClear")}</p>
          <p className="text-[11px] text-clay">{t("admin.proj.allClearHint")}</p>
        </div>
      </div>
    );

  return (
    <section className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_24px_rgba(38,66,61,0.06)]" data-testid="project-alerts">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={16} className="text-gold" />
        <h2 className="font-serif text-base font-bold text-forest">{t("admin.proj.attention")}</h2>
        <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest tabular-nums">{alerts.length}</span>
      </div>
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {alerts.map((a) => {
          const s = ALERT_STYLE[a.level];
          return (
            <li key={a.id} className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${s.box}`} data-testid={`alert-${a.id}`}>
              <s.Icon size={16} className={`shrink-0 ${s.icon}`} />
              <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-forest">{t(`admin.proj.alert.${a.key}`, a.params)}</p>
              {a.target && (
                <button
                  type="button"
                  onClick={() => onJump(a.target)}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-clay transition hover:bg-forest/10 hover:text-forest"
                >
                  {t("admin.proj.goThere")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DefenseBody({ def, onEdit }: { def: any; onEdit: () => void }) {
  const { t } = useTranslation();
  const d = new Date(def.date);
  const days = daysUntil(def.date);
  const stale = def.status === "scheduled" && days < 0;
  const g = formatGrade(def.grade);
  const mention = gradeMention(def.grade);

  return (
    <div className="space-y-4">
      <div className="flex items-stretch gap-3">
        <div className="grid w-20 shrink-0 place-items-center rounded-2xl bg-forest py-3 text-center text-cream shadow-inner">
          <div>
            <p className="text-[10px] font-semibold text-cream/70">
              {d.toLocaleDateString(i18n.language, { month: "short" })}
            </p>
            <p className="font-serif text-3xl leading-none font-bold">{d.getDate()}</p>
            <p className="mt-1 text-[10px] text-cream/70">{d.getFullYear()}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-sm font-bold text-forest">{d.toLocaleDateString(i18n.language, { weekday: "long" })}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-clay">
            <Clock size={12} />
            {fmtTime(def.date)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-clay">
            <MapPin size={12} />
            {def.room || "—"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusChip(def.status)}`}>
              {t(`admin.proj.defenseState.${def.status}`, { defaultValue: def.status })}
            </span>
            {def.status === "scheduled" && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  stale || days <= 7 ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-gold/15 text-gold"
                }`}
              >
                {stale ? t("admin.proj.card.defenseStale") : days === 0 ? t("admin.defenseToday") : t("admin.defenseIn", { n: days })}
              </span>
            )}
          </div>
        </div>
      </div>

      {stale && (
        <button
          type="button"
          onClick={onEdit}
          className="flex w-full items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-start text-[11.5px] text-red-700 transition hover:bg-red-500/15 dark:text-red-300"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {t("admin.proj.staleAction")}
        </button>
      )}

      {g !== null && (
        <div className="flex items-center justify-between rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
          <span className="flex items-center gap-1.5 text-[12px] text-clay">
            <Award size={14} className="text-gold" />
            {t("admin.grade")}
          </span>
          <span className="text-end">
            <span className="font-serif text-xl font-bold text-forest tabular-nums">{g}</span>
            <span className="text-[11px] text-clay"> / 20</span>
            {mention && <span className="block text-[10.5px] font-semibold text-gold">{t(`admin.proj.mention.${mention}`)}</span>}
          </span>
        </div>
      )}

      {def.notes && (
        <div className="rounded-xl bg-cream-2 p-3">
          <p className="mb-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-clay">
            <StickyNote size={11} />
            {t("admin.notes")}
          </p>
          <p className="text-[12px] leading-relaxed whitespace-pre-line text-forest">{def.notes}</p>
        </div>
      )}
    </div>
  );
}

const POINT_TONE = {
  gold: {
    box: "border-gold/30 bg-gold/[0.04]",
    chip: "bg-gold/15 text-gold",
    head: "text-gold",
    num: "bg-gold/20 text-gold",
  },
  emerald: {
    box: "border-emerald-500/30 bg-emerald-500/[0.04]",
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    head: "text-emerald-700 dark:text-emerald-300",
    num: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
} as const;

/** Objectives or requirements: numbered, one per row, each readable alone. */
function PointList({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof Flag;
  title: string;
  items: string[];
  tone: keyof typeof POINT_TONE;
}) {
  const { t } = useTranslation();
  const look = POINT_TONE[tone];
  return (
    <div className={`rounded-2xl border p-4 ${look.box}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${look.chip}`}>
          <Icon size={15} />
        </span>
        <h3 className={`text-[14px] font-bold ${look.head}`}>{title}</h3>
        <span className="ms-auto rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest tabular-nums">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-forest/15 px-3 py-4 text-center text-[12.5px] text-clay">
          {t("admin.proj.notSet")}
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((text, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl bg-cream-card/80 px-3 py-2.5 ring-1 ring-forest/5">
              <span
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11.5px] font-bold tabular-nums ${look.num}`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 text-[13.5px] leading-relaxed break-words text-forest">{text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * What the team was asked to do — description, objectives, requirements and
 * references — set out so each can be read on its own, not as fine print.
 */
function TopicBrief({ topic, href }: { topic: any; href?: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : (x as any)?.title ?? "")).filter(Boolean) : [];
  const objectives = asList(topic.objectives);
  const requirements = asList(topic.requirements);
  const references = (Array.isArray(topic.references) ? topic.references : []).filter(
    (r: any) => r?.title || r?.url,
  ) as { title?: string; url?: string }[];
  const description = String(topic.description ?? "").trim();
  const long = description.length > 480;

  return (
    <SectionCard
      icon={BookOpen}
      title={t("admin.proj.aboutTopic")}
      subtitle={t("admin.proj.aboutTopicSubtitle")}
      actions={
        href && (
          <Link
            to={href}
            className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-1.5 text-[11.5px] font-semibold text-forest transition hover:border-gold/50 hover:bg-gold/10"
          >
            <ExternalLink size={13} />
            {t("admin.proj.topicPage")}
          </Link>
        )
      }
    >
      <div className="rounded-2xl border border-forest/10 border-s-4 border-s-gold bg-cream-2/60 p-4" data-testid="topic-description">
        <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-gold">
          <FileText size={14} />
          {t("admin.proj.descriptionLabel")}
        </p>
        {description ? (
          <>
            <p
              className={`text-[14px] leading-8 whitespace-pre-line break-words text-forest ${
                !expanded && long ? "line-clamp-6" : ""
              }`}
            >
              {description}
            </p>
            {long && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 text-[12px] font-semibold text-gold hover:underline"
              >
                {expanded ? t("admin.proj.showLess") : t("admin.proj.showMore")}
              </button>
            )}
          </>
        ) : (
          <p className="text-[13px] text-clay">{t("admin.proj.notSet")}</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <PointList icon={Flag} title={t("admin.objectivesLabel")} items={objectives} tone="gold" />
        <PointList icon={ListChecks} title={t("admin.requirementsLabel")} items={requirements} tone="emerald" />
      </div>

      {references.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-forest">
            <Link2 size={14} className="text-gold" />
            {t("admin.referencesLabel")}
            <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] tabular-nums">{references.length}</span>
          </p>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {references.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl border border-forest/10 bg-cream-2/50 px-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText size={15} className="shrink-0 text-gold" />
                  <span className="truncate text-[13px] font-medium text-forest">{r.title || r.url}</span>
                </span>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-forest/15 px-2.5 py-1 text-[11px] font-bold text-forest transition hover:border-gold/50 hover:bg-gold/10"
                  >
                    <ExternalLink size={12} />
                    {t("admin.openLink")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
