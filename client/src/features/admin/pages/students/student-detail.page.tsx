import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Mail,
  Phone,
  AtSign,
  IdCard,
  Hash,
  Layers,
  Network,
  Building2,
  GraduationCap,
  CalendarDays,
  Clock,
  BadgeCheck,
  ShieldAlert,
  FileText,
  Users,
  User,
  FolderKanban,
  MessagesSquare,
  Crown,
  Pencil,
  Trash2,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { useStudent, useDeleteStudent } from "../../hooks/admin-hook";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { StudentEditDialog } from "../../components/dialog/student/student-edit-dialog.form";
import { HeaderTrail } from "../../components/ui/hierarchy-header";
import { useTranslation } from "react-i18next";
import i18n from "../../../../i18n/i18n";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS: Record<string, { labelKey: string; cls: string }> = {
  pending: { labelKey: "stu.reqStatus.pending", cls: "bg-amber-100 text-amber-600" },
  accepted: { labelKey: "status.accepted", cls: "bg-emerald-100 text-emerald-600" },
  approved: { labelKey: "status.approved", cls: "bg-emerald-100 text-emerald-600" },
  rejected: { labelKey: "status.rejected", cls: "bg-red-100 text-red-500" },
  open: { labelKey: "status.open", cls: "bg-soft-sage/50 text-forest" },
  full: { labelKey: "status.full", cls: "bg-gold/15 text-gold" },
  archived: { labelKey: "status.archived", cls: "bg-clay/15 text-clay" },
};
const pill = (s: string) =>
  STATUS[s] ?? { label: s, cls: "bg-clay/15 text-clay" };

function initials(first?: string | null, last?: string | null) {
  return (first?.[0] ?? "") + (last?.[0] ?? "") || "\u061f";
}
function fmtDate(iso?: string | null) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "\u2014"
    : d.toLocaleDateString(i18n.language, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}
function personName(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "\u2014";
}

export function AdminStudentDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id, lang } = useParams<{ id: string; lang: string }>();

  const { data: student, isLoading } = useStudent(id ?? null) as {
    data: any;
    isLoading: boolean;
  };
  const deleteStudent = useDeleteStudent();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const backToList = () => navigate(`/${lang}/admin/students`);
  const goToTopic = (topicId?: string) =>
    topicId && navigate(`/${lang}/admin/topics/${topicId}`);

  function confirmDelete() {
    if (!student) return;
    deleteStudent.mutate(student.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        backToList();
      },
    });
  }

  if (isLoading) {
    return (
      <div className="font-body grid place-items-center py-24 text-sm text-clay">
        {"\u2026"}
      </div>
    );
  }

  if (!student) {
    return (
      <div className="font-body py-24 text-center">
        <p className="text-sm text-clay">{t("admin.studentNotFound")}</p>
        <button
          onClick={backToList}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
        >
          <ArrowRight size={16} className="ltr:rotate-180" />{t("admin.backToStudents")}</button>
      </div>
    );
  }

  const u = student.user ?? {};
  const name = personName(u) || student.registrationNumber || "\u2014";
  const spec = student.specialization;
  const filiere = spec?.filiere;
  const dept = filiere?.department;
  const faculty = dept?.faculty;

  const applications = student.applications ?? [];
  const ledRequests = student.ledGroupRequests ?? [];
  const memberRequests = student.groupRequestMembers ?? [];
  const projectMembers = student.projectMembers ?? [];
  const hasProject = projectMembers.length > 0;

  const pathChain = [
    faculty?.name,
    dept?.name,
    filiere?.name,
    spec?.name,
  ].filter(Boolean) as string[];

  const info: {
    icon: typeof Mail;
    label: string;
    value: string;
    dir?: "ltr";
  }[] = [
    {
      icon: Mail,
      label: t("admin.email"),
      value: u.email || "\u2014",
      dir: "ltr",
    },
    {
      icon: AtSign,
      label: t("admin.username"),
      value: u.username || "\u2014",
      dir: "ltr",
    },
    {
      icon: Phone,
      label: t("admin.phone"),
      value: u.phone || "\u2014",
      dir: "ltr",
    },
    {
      icon: IdCard,
      label: t("pro.regNumber"),
      value: student.registrationNumber || "\u2014",
      dir: "ltr",
    },
    { icon: Layers, label: t("admin.specializationLabelAlt"), value: spec?.name ?? "\u2014" },
    { icon: Network, label: t("admin.filiere"), value: filiere?.name ?? "\u2014" },
    { icon: Building2, label: t("admin.department"), value: dept?.name ?? "\u2014" },
    { icon: GraduationCap, label: t("admin.facultyLabel"), value: faculty?.name ?? "\u2014" },
    {
      icon: CalendarDays,
      label: t("pro.academicYear"),
      value: student.academicYear?.title ?? "\u2014",
    },
    { icon: Clock, label: t("admin.lastSignIn"), value: fmtDate(u.lastLoginAt) },
    {
      icon: CalendarDays,
      label: t("admin.joinedOn"),
      value: fmtDate(u.createdAt),
    },
  ];

  const hasActivity =
    applications.length +
      ledRequests.length +
      memberRequests.length +
      projectMembers.length >
    0;

  // How many activity cards will render. One card should span the full width;
  // pairing it with an empty half looks worse than not splitting at all.
  const activityCards =
    1 + // the applications card always renders
    (ledRequests.length > 0 ? 1 : 0) +
    (memberRequests.length > 0 ? 1 : 0) +
    (projectMembers.length > 0 ? 1 : 0);

  return (
    <div className="font-body">
      {/* ── Student hero card ── */}
      <div className="relative overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_10px_40px_rgba(38,66,61,0.10)]">
        <div className="relative h-36 bg-linear-to-l from-forest via-forest-deep to-forest">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,var(--color-cream)_1px,transparent_0)] bg-size-[18px_18px]" />
          <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-gold/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-6 left-24 size-40 rounded-full bg-sage/20 blur-3xl" />
          <GraduationCap
            className="pointer-events-none absolute -bottom-3 left-6 size-28 text-cream/10"
            strokeWidth={1.5}
          />
          <Sparkles
            size={16}
            className="pointer-events-none absolute left-6 bottom-6 text-gold/60"
          />

          {/* Same trail strip the hierarchy pages use. */}
          <HeaderTrail
            crumbs={[
              { label: t("dash.students"), to: "/admin/students" },
              { label: name },
            ]}
            backLabel={t("admin.backToStudents")}
            backTo="/admin/students"
            className="relative"
          />
        </div>

        <div className="px-6 pb-6 sm:px-8">
          {/* avatar overlapping banner */}
          <div className="-mt-16 flex">
            <div className="relative">
              {u.avatarUrl ? (
                <img
                  src={u.avatarUrl}
                  alt=""
                  className="h-28 w-[5.44rem] rounded-2xl border-4 border-cream-card object-cover shadow-lg"
                />
              ) : (
                <div className="grid h-28 w-[5.44rem] place-items-center rounded-2xl border-4 border-cream-card bg-linear-to-br from-gold to-gold-soft text-3xl font-bold text-forest-deep shadow-lg">
                  {initials(u.firstName, u.lastName)}
                </div>
              )}
              <span
                className={`absolute bottom-1 left-1 size-6 rounded-full border-4 border-cream-card ${
                  u.status === "active" ? "bg-emerald-500" : "bg-red-500"
                }`}
                title={u.status === "active" ? t("admin.statusActive") : t("admin.statusSuspended")}
              />
            </div>
          </div>

          {/* name + action buttons */}
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold text-forest sm:text-3xl">
                {name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {/* The registration number is the student's identifier, so it
                    leads the row as a card-style chip rather than loose text. */}
                <span
                  /* a ring, not a border — it outlines without adding height,
                     so this chip stays level with the plain ones beside it */
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-forest ring-1 ring-gold/45 ring-inset"
                  title={t("pro.regNumber")}
                >
                  <IdCard size={13} className="text-gold" />
                  <span dir="ltr" className="font-mono tracking-wide">
                    {student.registrationNumber}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-soft-sage/40 px-2.5 py-0.5 text-xs font-semibold text-forest">
                  <User size={12} />{t("roles.student")}</span>
                {student.academicYear?.title && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold">
                    <CalendarDays size={12} /> {student.academicYear.title}
                  </span>
                )}
                {u.status === "active" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                    <BadgeCheck size={12} />{t("admin.statusActive")}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-500">
                    <ShieldAlert size={12} />{t("admin.statusSuspended")}</span>
                )}
                {hasProject ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                    <FolderKanban size={12} />{t("admin.hasProject")}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-clay/15 px-2.5 py-0.5 text-xs font-semibold text-clay">
                    <FolderKanban size={12} />{t("admin.noProjectYet")}</span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
              >
                <Pencil size={15} />{t("pro.edit")}</button>
              <button
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-50"
              >
                <Trash2 size={15} />{t("pro.delete")}</button>
            </div>
          </div>

          {/* quick meta */}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-clay">
            <span className="inline-flex items-center gap-1.5" dir="ltr">
              <Mail size={14} /> {u.email || "\u2014"}
            </span>
            {spec?.name && (
              <span className="inline-flex items-center gap-1.5">
                <Layers size={14} /> {spec.name}
              </span>
            )}
            {faculty?.name && (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap size={14} /> {faculty.name}
              </span>
            )}
          </div>

          {/* academic path chain */}
          {pathChain.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-clay">
                <Network size={13} />{t("admin.pathLabel")}</span>
              {pathChain.map((n, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      i === pathChain.length - 1
                        ? "bg-soft-sage/50 text-forest"
                        : "bg-cream-2 text-clay"
                    }`}
                  >
                    {n}
                  </span>
                  {i < pathChain.length - 1 && (
                    <ChevronLeft size={11} className="text-clay/40 ltr:rotate-180" />
                  )}
                </span>
              ))}
            </div>
          )}

          {/* stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat
              icon={FileText}
              value={applications.length}
              label={t("admin.individualApplications")}
              tint="bg-emerald-100 text-emerald-600"
            />
            <MiniStat
              icon={Users}
              value={ledRequests.length + memberRequests.length}
              label={t("admin.groupRequests")}
              tint="bg-soft-sage/40 text-forest"
            />
            <MiniStat
              icon={FolderKanban}
              value={projectMembers.length}
              label={t("dash.myProject")}
              tint="bg-gold/15 text-gold"
            />
            <MiniStat
              icon={BadgeCheck}
              value={u.isVerified ? t("admin.verified") : t("admin.unverified")}
              label={t("admin.accountStatus")}
              tint="bg-forest/8 text-forest"
            />
          </div>
        </div>
      </div>

      {/* ── Personal information ── */}
      <div className="mt-6 rounded-3xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)] sm:p-8">
        <h2 className="mb-5 flex items-center gap-2 font-serif text-lg font-bold text-forest">
          <span className="grid size-8 place-items-center rounded-lg bg-forest/5">
            <IdCard size={17} />
          </span>{t("admin.personalInformation")}</h2>
        <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {info.map((row) => (
            <InfoRow
              key={row.label}
              icon={row.icon}
              label={row.label}
              value={row.value}
              dir={row.dir}
            />
          ))}
        </div>
      </div>

      {/* Activity — two columns on wide screens so the cards stop
          stacking with half the row empty. */}
      <div
        className={`mt-6 grid grid-cols-1 items-start gap-6 [&>div]:mt-0 [&>div]:h-full ${
          activityCards > 1 ? "xl:grid-cols-2" : ""
        }`}
      >
        {/* ── Individual applications ── */}
        <Section
          icon={FileText}
          title={t("admin.individualTopicApplications")}
          count={applications.length}
        >
          {applications.length === 0 ? (
            <Empty icon={FileText} text={t("admin.noIndividualApplications")} />
          ) : (
            <ul className="space-y-2">
              {applications.map((a: any) => (
                <LinkRow
                  key={a.id}
                  title={a.topic?.title ?? "\u2014"}
                  status={a.status}
                  meta={[
                    a.topic?.professor?.user &&
                      `${personName(a.topic.professor.user)}`,
                    a.priority != null && t("admin.priorityN", { n: a.priority }),
                  ]}
                  metaIcons={[User, Hash]}
                  onClick={() => goToTopic(a.topic?.id)}
                />
              ))}
            </ul>
          )}
        </Section>

        {/* ── Led group requests ── */}
        {ledRequests.length > 0 && (
          <Section
            icon={Crown}
            title={t("admin.groupRequestsAsLeader")}
            count={ledRequests.length}
          >
            <ul className="space-y-2">
              {ledRequests.map((r: any) => (
                <LinkRow
                  key={r.id}
                  title={r.topic?.title ?? "\u2014"}
                  status={r.status}
                  meta={[
                    r.members && t("admin.membersCountN", { count: r.members.length }),
                    r.createdAt && fmtDate(r.createdAt),
                  ]}
                  metaIcons={[Users, CalendarDays]}
                  onClick={() => goToTopic(r.topic?.id)}
                />
              ))}
            </ul>
          </Section>
        )}

        {/* ── Member of group requests ── */}
        {memberRequests.length > 0 && (
          <Section
            icon={Users}
            title={t("admin.groupRequestsAsMember")}
            count={memberRequests.length}
          >
            <ul className="space-y-2">
              {memberRequests.map((m: any) => (
                <LinkRow
                  key={m.id ?? m.request?.id}
                  title={m.request?.topic?.title ?? "\u2014"}
                  status={m.request?.status}
                  meta={[
                    m.request?.leader?.user &&
                      t("admin.leaderName", { name: personName(m.request.leader.user) }),
                  ]}
                  metaIcons={[Crown]}
                  onClick={() => goToTopic(m.request?.topic?.id)}
                />
              ))}
            </ul>
          </Section>
        )}

        {/* ── Final project + defense ── */}
        {projectMembers.length > 0 && (
          <Section
            icon={FolderKanban}
            title={t("admin.finalProject")}
            count={projectMembers.length}
          >
            <ul className="space-y-2">
              {projectMembers.map((pm: any) => {
                const g = pm.group ?? {};
                return (
                  <li key={pm.id}>
                    <button
                      onClick={() => goToTopic(g.topic?.id)}
                      className="group flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest/10 bg-cream-2 px-4 py-3 text-start transition hover:border-gold/40 hover:bg-gold/5"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-forest group-hover:text-forest-deep">
                          {pm.isLeader && (
                            <Crown size={13} className="text-gold" />
                          )}
                          {g.topic?.title ?? "\u2014"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-clay">
                          {g.topic?.professor?.user && (
                            <span className="inline-flex items-center gap-1">
                              <User size={12} />{" "}
                              {personName(g.topic.professor.user)}
                            </span>
                          )}
                          {g.defense ? (
                            <span className="inline-flex items-center gap-1 text-gold">
                              <MessagesSquare size={12} /> {t("admin.defenseColon")}{" "}
                              {fmtDate(g.defense.date)}
                              {g.defense.room ? ` · ${g.defense.room}` : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <MessagesSquare size={12} />{t("admin.noDefenseYet")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {g.topic?.status && (
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${pill(g.topic.status).cls}`}
                          >
                            {t(pill(g.topic.status).labelKey)}
                          </span>
                        )}
                        <ChevronLeft
                          size={18}
                          className="text-clay/40 transition rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5 group-hover:text-gold ltr:rotate-180"
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}
      </div>

      {/* empty overall */}
      {!hasActivity && (
        <div className="mt-6 grid place-items-center gap-2 rounded-3xl border border-forest/10 bg-cream-card py-14 text-center shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <div className="grid size-14 place-items-center rounded-full bg-forest/5 text-clay">
            <FileText size={24} />
          </div>
          <p className="text-sm font-medium text-forest">{t("admin.noActivityYet")}</p>
          <p className="text-xs text-clay">{t("admin.noActivityBody")}</p>
        </div>
      )}

      {/* dialogs */}
      {editOpen && (
        <StudentEditDialog
          open
          student={student}
          onClose={() => setEditOpen(false)}
        />
      )}
      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title={t("admin.deleteStudent")}
        message={t("admin.confirmDeleteStudentLong", { name })}
        confirmLabel={t("admin.yesDelete")}
        cancelLabel={t("pro.cancel")}
        loading={deleteStudent.isPending}
        onConfirm={confirmDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ── section wrapper ─────────────────────────────────────────── */
function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof Mail;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-3xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)] sm:p-8">
      <h2 className="mb-5 flex items-center gap-2 font-serif text-lg font-bold text-forest">
        <span className="grid size-8 place-items-center rounded-lg bg-forest/5">
          <Icon size={17} />
        </span>
        {title}
        {count != null && (
          <span className="rounded-full bg-forest/8 px-2 py-0.5 text-xs font-bold text-forest">
            {count}
          </span>
        )}
      </h2>
      {children}
    </div>
  );
}

/* ── clickable topic-style row ───────────────────────────────── */
function LinkRow({
  title,
  status,
  meta,
  metaIcons,
  onClick,
}: {
  title: string;
  status?: string;
  meta?: (string | false | null | undefined)[];
  metaIcons?: (typeof Mail)[];
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  const items = (meta ?? []).map((m, i) => ({ m, Icon: metaIcons?.[i] }));
  const st = status ? pill(status) : null;
  return (
    <li>
      <button
        onClick={onClick}
        className="group flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest/10 bg-cream-2 px-4 py-3 text-start transition hover:border-gold/40 hover:bg-gold/5"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-forest group-hover:text-forest-deep">
            {title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-clay">
            {items.map(({ m, Icon }, i) =>
              m ? (
                <span key={i} className="inline-flex items-center gap-1">
                  {Icon && <Icon size={12} />} {m}
                </span>
              ) : null,
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {st && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}
            >
              {t(st.labelKey)}
            </span>
          )}
          <ChevronLeft
            size={18}
            className="text-clay/40 transition rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5 group-hover:text-gold ltr:rotate-180"
          />
        </div>
      </button>
    </li>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Mail; text: string }) {
  return (
    <div className="grid place-items-center gap-2 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-forest/5 text-clay">
        <Icon size={22} />
      </div>
      <p className="text-sm text-clay">{text}</p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof Mail;
  value: number | string;
  label: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-2 p-3.5">
      <div
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${tint}`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-serif text-base font-bold text-forest">
          {value}
        </p>
        <p className="text-[11px] text-clay">{label}</p>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  dir?: "ltr";
}) {
  return (
    <div className="flex items-start gap-3 border-b border-forest/5 pb-3">
      <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-forest/5 text-forest">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-clay">{label}</p>
        <p className="truncate text-sm font-semibold text-forest" dir={dir}>
          {value}
        </p>
      </div>
    </div>
  );
}
