import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AtSign,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  Clock,
  ExternalLink,
  FileText,
  FolderKanban,
  GitBranch,
  GraduationCap,
  Hash,
  History,
  IdCard,
  Landmark,
  Layers,
  LogIn,
  Mail,
  MonitorSmartphone,
  Phone,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Target,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useDates } from "../../../../hooks/use-dates";
import { useLanguage } from "../../../../hooks/use-language";
import { personName, otherScriptName } from "../../../../lib/person-name";
import { deviceOf } from "../../../../lib/user-agent";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import {
  AcademicPath,
  EmptyNote,
  Field,
  FieldGrid,
  HeroChip,
  HeroFact,
  HeroStat,
  ListRow,
  MetaItem,
  ProfileHero,
  RecordCard,
} from "../../components/ui/profile-kit";
import { useStudentProfile, type StudentProfile as Profile } from "../../api/activation.api";
import { opTitle } from "../audit/audit-catalog";

/**
 * الطالب كاملاً، لمن يقرّر في شأنه (Backend activation-desk): من هو، وأين
 * يدرس، وما طلب من مواضيع، وما مشروعه، وما فعل حسابه مؤخّراً في المنصّة —
 * في صفحة التفعيل نفسها، فلا تُغادَر لتُعرف.
 */
export function StudentProfileView({ id }: { id: string }) {
  const q = useStudentProfile(id);
  if (q.isLoading) return <LoadingArea className="py-24" />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => q.refetch()} />;
  return <ProfileBody p={q.data} />;
}

function ProfileBody({ p }: { p: Profile }) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();
  const { localePath } = useLanguage();
  const name = personName(p.personal);
  const other = otherScriptName(p.personal);
  const a = p.account;
  const accepted = p.requests.filter((r) => r.status === "accepted").length;

  return (
    <div className="space-y-5" data-testid="student-profile">
      <ProfileHero
        avatar={<UserAvatar user={p.personal} width={92} height={112} radius="rounded-2xl" />}
        active={a.status === "active"}
        activeLabel={t(a.status === "active" ? "admin.activation.profile.active" : "admin.activation.student.suspended")}
        eyebrow={t("admin.activation.profile.eyebrow")}
        name={name}
        otherName={other || undefined}
        chips={
          <>
            <HeroChip icon={Hash} tone="gold" ltr mono>
              {p.registrationNumber}
            </HeroChip>
            {a.status !== "active" && (
              <HeroChip icon={ShieldX} tone="rose">
                {t("admin.activation.student.suspended")}
              </HeroChip>
            )}
            <HeroChip icon={a.activated ? ShieldCheck : ShieldAlert} tone={a.activated ? "emerald" : "amber"}>
              {t(a.activated ? "admin.activation.student.activated" : "admin.activation.student.notActivated")}
            </HeroChip>
            <HeroChip icon={BadgeCheck} tone={a.verified ? "emerald" : "glass"}>
              {t(a.verified ? "admin.struct.spec.verified" : "admin.account.security.notVerified")}
            </HeroChip>
            {a.request?.status === "pending" && (
              <HeroChip icon={Clock} tone="sky">
                {t("admin.activation.profile.requestPending")}
              </HeroChip>
            )}
          </>
        }
        facts={
          <>
            <HeroFact icon={GraduationCap} value={`${p.academic.specialization.name} · ${t(`admin.proj.level.${p.academic.specialization.level}`)}`} />
            <HeroFact icon={CalendarDays} value={p.academic.academicYear} />
          </>
        }
        actions={
          <Link
            to={localePath(`/admin/students/${p.id}`)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-cream backdrop-blur-sm transition hover:bg-white/[0.12]"
          >
            <ExternalLink size={15} />
            {t("admin.activation.profile.openFull")}
          </Link>
        }
        stats={
          <>
            <HeroStat
              icon={LogIn}
              label={t("admin.activation.profile.lastLogin")}
              value={a.lastLoginAt ? fmtDate(a.lastLoginAt) : t("admin.activation.student.neverLoggedIn")}
              hint={a.lastLoginAt ? fmtDate(a.lastLoginAt, true) : undefined}
              compact
              tone="sky"
            />
            <HeroStat icon={MonitorSmartphone} label={t("admin.activation.profile.devices")} value={a.devices} tone="glass" />
            <HeroStat
              icon={Target}
              label={t("admin.activation.profile.requests")}
              value={p.requests.length}
              hint={accepted ? t("admin.activation.profile.acceptedCount", { count: accepted }) : undefined}
              tone="gold"
            />
            <HeroStat
              icon={CalendarClock}
              label={t("admin.activation.profile.memberSince")}
              value={fmtDate(a.createdAt)}
              compact
              tone="emerald"
            />
          </>
        }
      />

      {a.request?.status === "rejected" && a.request.rejectionReason && (
        <p className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-[12.5px] leading-relaxed text-forest">
          <ShieldX size={16} className="mt-0.5 shrink-0 text-rose-500" />
          <span>
            <b className="text-rose-600 dark:text-rose-300">{t("admin.activation.profile.lastRefusal")}</b> {a.request.rejectionReason}
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
        <RecordCard icon={UserRound} title={t("admin.activation.profile.personal")}>
          <FieldGrid>
            <Field icon={IdCard} label={t("admin.activation.student.reg")} value={p.registrationNumber} ltr copy />
            <Field icon={Mail} label={t("admin.activation.profile.email")} value={p.personal.email ?? t("common.none")} ltr copy />
            <Field icon={AtSign} label={t("admin.activation.profile.username")} value={p.personal.username ?? t("common.none")} ltr />
            <Field icon={Phone} label={t("admin.activation.profile.phone")} value={p.personal.phone ?? t("common.none")} ltr copy />
            <Field
              icon={UserRound}
              label={t("admin.activation.profile.gender")}
              value={p.personal.gender ? t(p.personal.gender === "male" ? "admin.genderMale" : "admin.genderFemale") : t("common.none")}
            />
            <Field icon={CalendarClock} label={t("admin.activation.profile.memberSince")} value={fmtDate(a.createdAt, true)} />
          </FieldGrid>
        </RecordCard>

        <RecordCard icon={Landmark} title={t("admin.activation.profile.academic")}>
          <AcademicPath
            steps={[
              { icon: Landmark, label: t("admin.activation.profile.faculty"), value: p.academic.faculty },
              { icon: Building2, label: t("admin.activation.profile.department"), value: p.academic.department },
              { icon: GitBranch, label: t("admin.activation.profile.filiere"), value: p.academic.filiere },
              {
                icon: Layers,
                label: t("admin.activation.profile.specialization"),
                value: `${p.academic.specialization.name} · ${t(`admin.proj.level.${p.academic.specialization.level}`)}`,
              },
            ]}
          />
          <p className="mx-3 mt-1 flex items-center gap-2 rounded-xl bg-forest/[0.04] px-3 py-2 text-[12px] text-forest/80">
            <CalendarDays size={14} className="text-gold" />
            {t("admin.activation.profile.year", { year: p.academic.academicYear })}
            {p.academic.currentYear && (
              <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">
                {t("admin.activation.profile.currentYear")}
              </span>
            )}
          </p>
        </RecordCard>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
        <RecordCard icon={FileText} title={t("admin.activation.profile.topics")} count={p.requests.length}>
          {p.requests.length ? (
            <ul className="space-y-2.5" data-testid="profile-requests">
              {p.requests.map((r) => (
                <ListRow
                  key={r.id}
                  title={r.topic.title}
                  badge={
                    <span className="rounded-full bg-gold/12 px-2 py-0.5 text-[10.5px] font-bold text-gold">
                      {t(`admin.activation.profile.role.${r.role}`)}
                    </span>
                  }
                  state={r.status}
                  stateLabel={t(`admin.activation.profile.requestState.${r.status}`)}
                  meta={
                    <>
                      <MetaItem icon={Target}>{t("admin.activation.profile.priority", { n: r.priority })}</MetaItem>
                      <MetaItem icon={GraduationCap}>{personName(r.topic.supervisor)}</MetaItem>
                      <MetaItem icon={Users}>
                        {r.team.length ? r.team.map((m) => personName(m)).join("، ") : t("admin.activation.profile.alone")}
                      </MetaItem>
                      <MetaItem icon={Clock}>{fmtDate(r.createdAt)}</MetaItem>
                      {r.status === "rejected" && r.rejectionReason && (
                        <MetaItem icon={ShieldX} className="basis-full text-rose-600 dark:text-rose-300">
                          {r.rejectionReason}
                        </MetaItem>
                      )}
                    </>
                  }
                />
              ))}
            </ul>
          ) : (
            <EmptyNote icon={BookOpen} title={t("admin.activation.profile.noRequests")} hint={t("admin.activation.profile.noRequestsHint")} />
          )}
        </RecordCard>

        <RecordCard icon={FolderKanban} title={t("admin.activation.profile.project")}>
          {p.project ? <ProjectBox project={p.project} /> : <EmptyNote icon={FolderKanban} title={t("admin.activation.profile.noProject")} />}
        </RecordCard>
      </div>

      <RecordCard icon={History} title={t("admin.activation.profile.activity")} count={p.activity.length}>
        <Activity p={p} />
      </RecordCard>
    </div>
  );
}

function ProjectBox({ project }: { project: NonNullable<Profile["project"]> }) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();
  const m = project.milestones;
  const pct = m.total ? Math.round((m.completed / m.total) * 100) : 0;
  return (
    <div className="space-y-4 px-3 py-2" data-testid="profile-project">
      <div>
        <p className="font-serif text-[17px] font-bold leading-snug text-forest">{project.topic.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-clay">
          <MetaItem icon={GraduationCap}>{personName(project.topic.supervisor)}</MetaItem>
          {project.leader && <MetaItem icon={BadgeCheck}>{t("admin.activation.profile.role.leader")}</MetaItem>}
        </p>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[12px]">
          <span className="text-clay">{t("admin.activation.profile.milestones", { done: m.completed, total: m.total })}</span>
          {m.overdue > 0 && <span className="font-bold text-rose-600 dark:text-rose-300">{t("admin.activation.profile.overdue", { count: m.overdue })}</span>}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-forest/8">
          <div className="h-full rounded-full bg-linear-to-l from-gold to-gold-soft transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {project.team.map((s) => (
          <span key={s.registrationNumber} className="inline-flex items-center gap-1.5 rounded-full bg-forest/[0.05] px-3 py-1 text-[12px] text-forest ring-1 ring-forest/10">
            {s.leader && <BadgeCheck size={13} className="text-gold" />}
            {personName(s)}
          </span>
        ))}
      </div>
      {project.defense && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-gold/25 bg-gold/[0.06] px-4 py-3 text-[12.5px] text-forest">
          <CalendarDays size={15} className="text-gold" />
          <b>{t("admin.activation.profile.defense")}</b>
          {t("admin.activation.profile.defenseAt", { date: fmtDate(project.defense.date, true), room: project.defense.room })}
          {project.defense.grade != null && (
            <span className="ms-auto rounded-full bg-emerald-500/12 px-2.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
              {t("admin.activation.profile.grade", { grade: project.defense.grade })}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

const ACTIVITY_TONE = {
  ok: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  bad: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  topic: "bg-gold/15 text-gold",
} as const;

/** What the account did, newest first: what the audit log recorded, and the topics it asked for. */
function Activity({ p }: { p: Profile }) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();
  type Item = { key: string; at: string; icon: LucideIcon; tone: keyof typeof ACTIVITY_TONE; title: string; detail?: string | null };
  const items: Item[] = [
    ...p.activity.map((e) => ({
      key: e.id,
      at: e.createdAt,
      icon: e.success ? ShieldCheck : ShieldAlert,
      tone: (e.success ? "ok" : "bad") as Item["tone"],
      title: opTitle(t, e.action),
      detail: [deviceOf(e.userAgent), e.ip].filter(Boolean).join(" · ") || null,
    })),
    ...p.requests.map((r) => ({
      key: `request-${r.id}`,
      at: r.createdAt,
      icon: FileText,
      tone: "topic" as const,
      title: t("admin.activation.profile.requestedTopic", { title: r.topic.title }),
      detail: t(`admin.activation.profile.role.${r.role}`),
    })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  if (!items.length) return <EmptyNote icon={History} title={t("admin.activation.profile.noActivity")} />;
  return (
    <ol className="relative space-y-1 px-3 py-1" data-testid="profile-activity">
      <span aria-hidden className="absolute inset-y-4 start-[1.95rem] w-px bg-linear-to-b from-gold/40 via-forest/10 to-transparent" />
      {items.slice(0, 15).map((it) => (
        <li key={it.key} className="relative flex items-start gap-3 rounded-2xl px-1 py-2 transition hover:bg-forest/[0.03]">
          <span className={`relative grid size-9 shrink-0 place-items-center rounded-xl ring-4 ring-cream-card ${ACTIVITY_TONE[it.tone]}`}>
            <it.icon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-forest">{it.title}</p>
            {it.detail && (
              <p className="mt-0.5 truncate text-[11.5px] text-clay" dir="auto">
                {it.detail}
              </p>
            )}
          </div>
          <time className="shrink-0 pt-0.5 text-[11px] text-clay tabular-nums">{fmtDate(it.at, true)}</time>
        </li>
      ))}
    </ol>
  );
}
