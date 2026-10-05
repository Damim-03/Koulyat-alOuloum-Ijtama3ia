import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertOctagon,
  AlertTriangle,
  Award,
  Ban,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Crown,
  DoorOpen,
  ExternalLink,
  FileText,
  FolderKanban,
  Gavel,
  GraduationCap,
  Hash,
  History,
  ListChecks,
  Mail,
  MapPin,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Timer,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import { useDefense, useDeleteDefense, useUpdateDefense } from "../../hooks/admin-hook";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { ProjectDefenseDialog } from "../../components/dialog/projects/project-defense-dialog";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { LoadingArea } from "../../../../components/ui/loading-area";
import i18n from "../../../../i18n/i18n";
import { ActionButton, EmptyNote, ProgressRing, RecordTile, SectionCard } from "../projects/project-ui";
import { formatGrade, gradeMention, nameOf, percent, relative } from "../projects/project-utils";
import { PHASE, byRole, clock, phaseOf } from "./defense-utils";
import { otherScriptName } from "../../../../lib/person-name";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * One defence, in full — what the schedule's card only summarises.
 *
 * When and where, and how long; who defends, with their numbers; who judges,
 * by role, with their rank and department; how far the project got; what
 * else holds the room that day; any clash of room or juror; and every action
 * in reach — edit, record the result, cancel or restore, delete.
 */
export function AdminDefenseDetailPage() {
  const { t } = useTranslation();
  const { id, lang } = useParams<{ id: string; lang: string }>();
  const navigate = useLangNavigate();
  const { data: d, isLoading, isError, refetch } = useDefense(id ?? null);
  const updateDefense = useUpdateDefense();
  const deleteDefense = useDeleteDefense();
  const [edit, setEdit] = useState<null | { initialStatus?: "completed" }>(null);
  const [confirm, setConfirm] = useState<null | "cancel" | "delete">(null);

  const to = (p: string) => `/${lang}${p}`;
  const back = () => navigate("/admin/defenses");

  if (isLoading) return <LoadingArea className="py-20" />;
  if (isError || !d)
    return (
      <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center">
        <AlertTriangle size={28} className="mx-auto mb-3 text-red-500" />
        <p className="text-sm font-semibold text-forest">{t("admin.defenseDetail.notFound")}</p>
        <div className="mt-4 flex justify-center gap-2">
          <ActionButton icon={RotateCcw} onClick={() => refetch()}>
            {t("admin.retry")}
          </ActionButton>
          <ActionButton onClick={back}>{t("admin.defenseDetail.back")}</ActionButton>
        </div>
      </div>
    );

  const phase = phaseOf(d);
  const look = PHASE[phase];
  const topic = d.group?.topic ?? {};
  const spec = topic.specialization;
  const members = (d.group?.members ?? []) as any[];
  const committee = byRole((d.committee ?? []) as any[]);
  const start = new Date(d.date);
  const end = new Date(d.endsAt);
  const g = formatGrade(d.grade);
  const mention = gradeMention(d.grade);
  const prog = d.progress ?? { total: 0, completed: 0, late: 0, submissions: 0 };
  const clashes = [...(d.clashes?.room ?? []).map((c: any) => ({ ...c, kind: "room" })), ...(d.clashes?.professors ?? []).map((c: any) => ({ ...c, kind: "prof" }))];
  const hasPresident = committee.some((c) => c.role === "president");
  const supervisorSeated = committee.some((c) => c.professorId === topic.professorId);

  const path = [spec?.filiere?.department?.faculty?.name, spec?.filiere?.department?.name, spec?.filiere?.name, spec?.name].filter(Boolean);

  // What to fix before the day, worst first.
  const alerts: { level: "danger" | "warn" | "info"; text: string }[] = [];
  if (phase === "stale") alerts.push({ level: "danger", text: t("admin.proj.alert.defenseStale") });
  for (const c of clashes)
    alerts.push({
      level: "danger",
      text:
        c.kind === "room"
          ? t("admin.defensesPage.form.clashRoom", { room: c.room, title: c.title, time: clock(c.date) })
          : t("admin.defensesPage.form.clashProfessor", { name: c.name, title: c.title, time: clock(c.date) }),
    });
  if (d.status !== "cancelled" && committee.length === 0) alerts.push({ level: "warn", text: t("admin.proj.alert.noCommittee") });
  else if (d.status !== "cancelled" && !hasPresident) alerts.push({ level: "warn", text: t("admin.proj.alert.noPresident") });
  if (d.status === "completed" && g === null) alerts.push({ level: "warn", text: t("admin.proj.alert.noGrade") });
  if (d.status !== "cancelled" && committee.length > 0 && !supervisorSeated) alerts.push({ level: "info", text: t("admin.proj.alert.supervisorNotOnCommittee") });
  if (prog.late > 0) alerts.push({ level: "info", text: t("admin.defenseDetail.lateMilestones", { n: prog.late }) });

  return (
    <div className="font-body">
      {/* top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={back} className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 font-serif text-sm font-bold text-forest transition hover:bg-forest/5">
          <ChevronRight size={18} className="ltr:rotate-180" />
          {t("admin.defenseDetail.back")}
        </button>
        <div className="flex items-center gap-1">
          {d.group?.id && (
            <Link to={to(`/admin/projects/${d.group.id}`)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-clay transition hover:bg-forest/5 hover:text-forest">
              <ExternalLink size={13} />
              {t("admin.defenseDetail.openProject")}
            </Link>
          )}
        </div>
      </div>

      {/* ── hero ── */}
      <section className="forest-glow relative mb-6 overflow-hidden rounded-3xl text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)]">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-24 -start-10 size-80 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-stretch lg:px-8">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-gold-soft">
                <Gavel size={12} />
                {t("admin.defenseDetail.eyebrow")}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${look.chip}`} data-testid="detail-phase">
                {phase === "live" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
                {t(`admin.defensesPage.phase.${phase}`)}
              </span>
            </div>
            <h1 className="font-serif text-2xl leading-snug font-bold text-cream lg:text-[28px]" data-testid="detail-title">
              {topic.title}
            </h1>
            {path.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-cream/65">
                <Building2 size={12} className="text-gold-soft" />
                {path.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span className="text-cream/35">›</span>}
                    <span className={i === path.length - 1 ? "font-semibold text-cream/90" : ""}>{p}</span>
                  </span>
                ))}
                {topic.academicYear?.title && <span className="ms-1 rounded-full border border-white/10 bg-cream/10 px-2 py-0.5" dir="ltr">{topic.academicYear.title}</span>}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {d.status !== "completed" && d.status !== "cancelled" && (
                <button type="button" onClick={() => setEdit({ initialStatus: "completed" })} className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-bold text-forest-deep transition hover:bg-gold-soft" data-testid="detail-result">
                  <CheckCircle2 size={14} />
                  {t("admin.defensesPage.recordResult")}
                </button>
              )}
              <HeroBtn icon={Pencil} onClick={() => setEdit({})} testId="detail-edit">
                {t("admin.proj.editDefense")}
              </HeroBtn>
              {d.status === "cancelled" ? (
                <HeroBtn icon={RotateCcw} onClick={() => updateDefense.mutate({ id: d.id, data: { status: "scheduled" } })}>
                  {t("admin.defensesPage.restore")}
                </HeroBtn>
              ) : d.status !== "completed" ? (
                <HeroBtn icon={Ban} onClick={() => setConfirm("cancel")}>
                  {t("admin.defensesPage.cancelAction")}
                </HeroBtn>
              ) : null}
              <HeroBtn icon={Trash2} onClick={() => setConfirm("delete")} danger>
                {t("admin.proj.deleteDefense")}
              </HeroBtn>
            </div>
          </div>

          {/* the date, as a calendar leaf */}
          <div className="w-full shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-cream/10 text-center backdrop-blur-sm lg:w-64">
            <div className="bg-gold/90 py-2 text-[12px] font-bold text-forest-deep">
              {start.toLocaleDateString(i18n.language, { weekday: "long" })}
            </div>
            <div className="px-4 py-4">
              <p className="font-serif text-5xl leading-none font-bold text-cream tabular-nums">{start.getDate()}</p>
              <p className="mt-1 text-[13px] text-cream/80">{start.toLocaleDateString(i18n.language, { month: "long", year: "numeric" })}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-[13px] font-bold text-cream tabular-nums">
                <Clock size={13} />
                {clock(start)} – {clock(end)}
              </p>
              <p className="mt-2 flex items-center justify-center gap-3 text-[11.5px] text-cream/70">
                <span className="inline-flex items-center gap-1">
                  <Timer size={12} />
                  {t("admin.defensesPage.form.minutes", { n: d.durationMinutes ?? 60 })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} />
                  {d.room}
                </span>
              </p>
              {phase === "scheduled" && <p className="mt-2 text-[12px] font-semibold text-gold-soft">{relative(d.date)}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* ── what needs attention ── */}
      {alerts.length > 0 && (
        <section className="mb-6 grid grid-cols-1 gap-2 lg:grid-cols-2" data-testid="detail-alerts">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[12.5px] leading-relaxed text-forest ${
                a.level === "danger" ? "border-red-300/60 bg-red-500/[0.08]" : a.level === "warn" ? "border-amber-300/60 bg-amber-500/[0.08]" : "border-sky-300/50 bg-sky-500/[0.08]"
              }`}
            >
              {a.level === "danger" ? (
                <AlertOctagon size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              ) : (
                <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${a.level === "warn" ? "text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400"}`} />
              )}
              {a.text}
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* jury */}
          <SectionCard
            icon={ShieldCheck}
            title={t("admin.committee")}
            count={committee.length}
            subtitle={t("admin.defenseDetail.juryHint")}
            actions={<ActionButton icon={Pencil} size="sm" onClick={() => setEdit({})}>{t("admin.proj.editCommittee")}</ActionButton>}
          >
            {committee.length === 0 ? (
              <EmptyNote icon={UserCheck} title={t("admin.noCommittee")} hint={t("admin.proj.committeeEmptyHint")} />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="detail-jury">
                {committee.map((c) => (
                  <PersonCard
                    key={c.id}
                    user={c.professor?.user}
                    highlight={c.role === "president"}
                    badge={
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                          c.role === "president" ? "bg-gold/20 text-gold" : c.role === "supervisor" ? "bg-sky-500/12 text-sky-700 dark:text-sky-300" : "bg-forest/10 text-forest"
                        }`}
                      >
                        {c.role === "president" ? <Crown size={11} /> : c.role === "supervisor" ? <UserCheck size={11} /> : <Gavel size={11} />}
                        {t(`committeeRole.${c.role}`)}
                      </span>
                    }
                    lines={[
                      Array.isArray(c.professor?.grade) && c.professor.grade.length ? c.professor.grade.join("، ") : null,
                      c.professor?.department?.name ?? null,
                    ]}
                    email={c.professor?.universityEmail ?? c.professor?.user?.email}
                    href={c.professor?.id ? to(`/admin/professors/${c.professor.id}`) : undefined}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* team */}
          <SectionCard icon={Users} title={t("admin.defensesPage.team")} count={members.length} subtitle={t("admin.defenseDetail.teamHint")}>
            {members.length === 0 ? (
              <EmptyNote icon={Users} title={t("admin.noMembers")} />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="detail-team">
                {members.map((m) => {
                  const mismatch = m.student?.specialization?.id && spec?.id && m.student.specialization.id !== spec.id;
                  return (
                    <PersonCard
                      key={m.id}
                      user={m.student?.user}
                      highlight={m.isLeader}
                      badge={
                        m.isLeader ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-bold text-gold">
                            <Crown size={11} />
                            {t("admin.leader")}
                          </span>
                        ) : null
                      }
                      lines={[
                        <span key="r" className="inline-flex items-center gap-1 tabular-nums" dir="ltr">
                          <Hash size={11} />
                          {m.student?.registrationNumber}
                        </span>,
                        <span key="s" className={mismatch ? "font-semibold text-amber-700 dark:text-amber-300" : ""}>
                          {m.student?.specialization?.name}
                          {mismatch && ` · ${t("admin.memberDifferentSpec")}`}
                        </span>,
                      ]}
                      email={m.student?.user?.email}
                      href={m.student?.id ? to(`/admin/students/${m.student.id}`) : undefined}
                    />
                  );
                })}
              </div>
            )}
            {topic.professor && (
              <div className="mt-4 border-t border-forest/10 pt-4">
                <p className="mb-2 text-[11px] font-bold tracking-wide text-clay">{t("admin.supervisor")}</p>
                <PersonCard
                  user={topic.professor.user}
                  badge={
                    supervisorSeated ? (
                      <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">{t("admin.defenseDetail.onJury")}</span>
                    ) : (
                      <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10.5px] font-bold text-clay">{t("admin.defenseDetail.notOnJury")}</span>
                    )
                  }
                  lines={[Array.isArray(topic.professor.grade) ? topic.professor.grade.join("، ") : null, topic.professor.department?.name]}
                  email={topic.professor.universityEmail}
                  href={to(`/admin/professors/${topic.professor.id}`)}
                />
              </div>
            )}
          </SectionCard>

          {/* project */}
          <SectionCard
            icon={FolderKanban}
            title={t("admin.defenseDetail.project")}
            actions={
              d.group?.id && (
                <Link to={to(`/admin/projects/${d.group.id}`)} className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-1.5 text-[11.5px] font-semibold text-forest transition hover:border-gold/50 hover:bg-gold/10">
                  <ExternalLink size={13} />
                  {t("admin.defenseDetail.openProject")}
                </Link>
              )
            }
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ProgressRing value={percent(prog.completed, prog.total)} size={84} stroke={7} tone={prog.late ? "danger" : "sage"} label={t("admin.proj.col.progress")} />
              <div className="grid flex-1 grid-cols-3 gap-2.5">
                <Mini icon={ListChecks} label={t("admin.milestones")} value={`${prog.completed}/${prog.total}`} />
                <Mini icon={AlertTriangle} label={t("admin.proj.kpi.late")} value={prog.late} danger={prog.late > 0} />
                <Mini icon={FileText} label={t("admin.proj.kpi.submissions")} value={prog.submissions} />
              </div>
            </div>
            {topic.description && (
              <div className="mt-4 rounded-2xl border border-forest/10 border-s-4 border-s-gold bg-cream-2/60 p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-gold">
                  <BookOpen size={13} />
                  {t("admin.proj.descriptionLabel")}
                </p>
                <p className="line-clamp-5 text-[13.5px] leading-7 whitespace-pre-line text-forest">{topic.description}</p>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── side ── */}
        <div className="space-y-6">
          <SectionCard icon={CalendarClock} title={t("admin.defenseDetail.session")} bodyClass="p-4">
            <div className="grid grid-cols-2 gap-2.5">
              <RecordTile span icon={CalendarDays} tone="gold" label={t("admin.defenseDate")} sub={relative(d.date)}>
                {start.toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </RecordTile>
              <RecordTile icon={Clock} tone="sky" label={t("admin.defenseDetail.time")}>
                <span className="tabular-nums">{clock(start)} – {clock(end)}</span>
              </RecordTile>
              <RecordTile icon={Timer} tone="violet" label={t("admin.defenseDetail.duration")}>
                {t("admin.defensesPage.form.minutes", { n: d.durationMinutes ?? 60 })}
              </RecordTile>
              <RecordTile icon={DoorOpen} tone="emerald" label={t("admin.room")}>
                {d.room}
              </RecordTile>
              <RecordTile icon={Gavel} tone="amber" label={t("admin.proj.defenseForm.status")}>
                {t(`admin.defensesPage.phase.${phase}`)}
              </RecordTile>
              <RecordTile span icon={Award} tone="gold" label={t("admin.grade")} sub={mention ? t(`admin.proj.mention.${mention}`) : d.status === "completed" ? t("admin.proj.alert.noGrade") : t("admin.defenseDetail.gradeLater")}>
                {g !== null ? (
                  <span className="font-serif text-2xl tabular-nums">
                    {g}
                    <span className="text-[13px] font-medium text-clay"> / 20</span>
                  </span>
                ) : (
                  "—"
                )}
              </RecordTile>
              {d.notes && (
                <RecordTile span icon={StickyNote} tone="rose" label={t("admin.notes")}>
                  <span className="text-[13px] font-medium leading-relaxed whitespace-pre-line">{d.notes}</span>
                </RecordTile>
              )}
            </div>
          </SectionCard>

          {/* the room's day */}
          <SectionCard icon={DoorOpen} title={t("admin.defenseDetail.roomDay", { room: d.room })} subtitle={t("admin.defenseDetail.roomDayHint")} bodyClass="p-4">
            <ol className="relative space-y-2" data-testid="detail-room-day">
              <span className="absolute top-3 bottom-3 start-[7px] w-px bg-forest/10" aria-hidden />
              {(d.roomDay ?? []).map((r: any) => (
                <li key={r.id} className="relative flex items-start gap-3">
                  <span className={`relative z-10 mt-1.5 size-3.5 shrink-0 rounded-full border-2 ${r.current ? "border-gold bg-gold" : "border-forest/25 bg-cream-card"}`} />
                  {r.current ? (
                    <div className="min-w-0 flex-1 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2">
                      <p className="text-[11px] font-bold text-gold tabular-nums">{clock(r.date)} – {clock(r.endsAt)} · {t("admin.defenseDetail.thisOne")}</p>
                      <p className="truncate text-[12.5px] font-semibold text-forest">{r.title}</p>
                    </div>
                  ) : (
                    <Link to={to(`/admin/defenses/${r.id}`)} className="min-w-0 flex-1 rounded-xl border border-forest/10 bg-cream-2/50 px-3 py-2 transition hover:border-gold/30">
                      <p className="text-[11px] font-semibold text-clay tabular-nums">{clock(r.date)} – {clock(r.endsAt)}</p>
                      <p className="truncate text-[12.5px] text-forest">{r.title}</p>
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard icon={ClipboardList} title={t("admin.proj.record")} bodyClass="p-4">
            <div className="grid grid-cols-2 gap-2.5">
              <RecordTile icon={Sparkles} tone="sky" label={t("admin.defenseDetail.created")} sub={relative(d.createdAt)}>
                {new Date(d.createdAt).toLocaleDateString(i18n.language)}
              </RecordTile>
              <RecordTile icon={History} tone="violet" label={t("admin.proj.updatedAt")} sub={new Date(d.updatedAt).toLocaleDateString(i18n.language)}>
                {relative(d.updatedAt)}
              </RecordTile>
              <RecordTile span icon={GraduationCap} tone="emerald" label={t("admin.defenseDetail.studentsCount")}>
                {members.length}
                {topic.maxStudents ? <span className="text-[12px] font-medium text-clay"> / {topic.maxStudents}</span> : null}
              </RecordTile>
            </div>
          </SectionCard>
        </div>
      </div>

      <ProjectDefenseDialog
        open={edit !== null}
        onClose={() => setEdit(null)}
        groupId={d.group?.id}
        supervisorId={topic.professorId}
        defense={d}
        initialStatus={edit?.initialStatus}
      />
      <ConfirmDialog
        open={!!confirm}
        tone="danger"
        title={confirm === "cancel" ? t("admin.defensesPage.cancelTitle") : t("admin.proj.deleteDefense")}
        message={confirm === "cancel" ? t("admin.defensesPage.cancelConfirm") : t("admin.proj.deleteDefenseConfirm")}
        confirmLabel={confirm === "cancel" ? t("admin.defensesPage.cancelAction") : t("admin.confirmDelete")}
        cancelLabel={t("admin.cancel")}
        loading={updateDefense.isPending || deleteDefense.isPending}
        onConfirm={() => {
          if (confirm === "cancel")
            updateDefense.mutate({ id: d.id, data: { status: "cancelled" } }, { onSettled: () => setConfirm(null) });
          else deleteDefense.mutate(d.id, { onSuccess: () => back(), onSettled: () => setConfirm(null) });
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function HeroBtn({
  icon: Icon,
  children,
  onClick,
  danger,
  testId,
}: {
  icon: typeof Pencil;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
        danger ? "border-red-300/40 bg-red-500/10 text-red-200 hover:bg-red-500/20" : "border-white/15 bg-cream/10 text-cream hover:bg-cream/20"
      }`}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

/** A person as a card: face, name in both scripts, role, the lines that say who they are. */
function PersonCard({
  user,
  badge,
  lines,
  email,
  href,
  highlight,
}: {
  user: any;
  badge?: ReactNode;
  lines: ReactNode[];
  email?: string | null;
  href?: string;
  highlight?: boolean;
}) {
  const other = otherScriptName(user);
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-3.5 transition ${highlight ? "border-gold/40 bg-gold/[0.06]" : "border-forest/10 bg-cream-2/40"}`}>
      <span className={`shrink-0 rounded-full p-[2px] ${highlight ? "bg-linear-to-br from-gold to-gold-soft" : "bg-forest/10"}`}>
        <span className="block rounded-full bg-cream-card p-[2px]">
          <UserAvatar user={user} size={44} />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {href ? (
            <Link to={href} className="truncate text-[14px] font-bold text-forest hover:text-gold">
              {nameOf(user)}
            </Link>
          ) : (
            <span className="truncate text-[14px] font-bold text-forest">{nameOf(user)}</span>
          )}
          {badge}
        </div>
        {other && (
          <p className="truncate text-[11.5px] text-clay">
            <bdi>{other}</bdi>
          </p>
        )}
        <div className="mt-1 space-y-0.5 text-[11.5px] text-clay">
          {lines.filter(Boolean).map((l, i) => (
            <p key={i} className="truncate">{l}</p>
          ))}
        </div>
        {email && (
          <a href={`mailto:${email}`} className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[11.5px] font-medium text-forest/80 hover:text-gold" dir="ltr">
            <Mail size={11} className="shrink-0" />
            <span className="truncate">{email}</span>
          </a>
        )}
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value, danger }: { icon: typeof Pencil; label: string; value: ReactNode; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${danger ? "border-red-300/50 bg-red-500/[0.06]" : "border-forest/10 bg-cream-2/50"}`}>
      <p className="flex items-center gap-1 text-[11px] text-clay">
        <Icon size={12} />
        {label}
      </p>
      <p className={`mt-1 font-serif text-xl font-bold tabular-nums ${danger ? "text-red-600 dark:text-red-400" : "text-forest"}`}>{value}</p>
    </div>
  );
}
