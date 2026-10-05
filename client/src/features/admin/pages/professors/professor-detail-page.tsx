import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Mail,
  Phone,
  IdCard,
  Building2,
  GraduationCap,
  BadgeCheck,
  ShieldAlert,
  Clock,
  CalendarDays,
  FileText,
  Award,
  Tag,
  AtSign,
  Pencil,
  Trash2,
  Hash,
  Users,
  Briefcase,
  CheckCircle2,
  PieChart,
  Activity,
} from "lucide-react";
import type { Professor, ProfessorTopicLite } from "../../../../types/admin";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { DangerConfirm } from "../../../../components/dialog/danger-confirm";
import {
  useProfessor,
  useDeleteProfessor,
  useSetUserVerification,
} from "../../hooks/admin-hook";
import { ProfessorEditDialog } from "../../components/dialog/professor/professor-edit-dialog.form";
import { HeaderTrail } from "../../components/ui/hierarchy-header";
import i18n from "../../../../i18n/i18n";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { noneText } from "../../../../lib/none-text";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { otherScriptName, personName } from "../../../../lib/person-name";
import {
  AcademicPath,
  EmptyNote,
  Field,
  FieldGrid,
  HeroButton,
  HeroChip,
  HeroFact,
  HeroStat,
  ListRow,
  MetaItem,
  ProfileHero,
  RecordCard,
} from "../../components/ui/profile-kit";

/** The label of each state a topic can be in. */
const TOPIC_STATUS_KEY: Record<string, string> = {
  pending: "stu.reqStatus.pending",
  approved: "status.approved",
  open: "status.open",
  full: "status.full",
  rejected: "status.rejected",
  archived: "status.archived",
};

// Ordered palette for the status-distribution bar + legend — the same colours
// as each topic row's edge.
const STATUS_BAR: { key: string; labelKey: string; bar: string }[] = [
  { key: "approved", labelKey: "status.approved", bar: "bg-emerald-500" },
  { key: "open", labelKey: "status.open", bar: "bg-sky-500" },
  { key: "full", labelKey: "status.full", bar: "bg-gold" },
  { key: "pending", labelKey: "stu.reqStatus.pending", bar: "bg-amber-400" },
  { key: "rejected", labelKey: "status.rejected", bar: "bg-rose-400" },
  { key: "archived", labelKey: "status.archived", bar: "bg-clay/60" },
];

function fullName(p: Professor) {
  return (
    personName(p.user) ||
    p.universityEmail ||
    "\u2014"
  );
}
function fmtDate(iso?: string | null) {
  if (!iso) return i18n.t("common.none");
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? i18n.t("common.none")
    : d.toLocaleDateString(i18n.language, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

export function AdminProfessorDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang, id } = useParams();

  const { data: professor, isLoading, isError, refetch } =
    useProfessor(id ?? null);
  const deleteProfessor = useDeleteProfessor();
  const setVerification = useSetUserVerification();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const backToList = () => navigate(`/${lang}/admin/professors`);
  const goToTopic = (topicId: string) =>
    navigate(`/${lang}/admin/topics/${topicId}`);

  /**
   * كما في صفحة الطالب: المُرسَل `userId` لا `professor.id` — المسار على
   * الحساب لا على صفّ الأستاذ.
   */
  function confirmVerification() {
    if (!professor) return;
    setVerification.mutate(
      { id: professor.userId, isVerified: !professor.user?.isVerified },
      {
        onSuccess: () => {
          setVerifyOpen(false);
          refetch();
        },
      },
    );
  }

  function confirmDelete() {
    if (!professor) return;
    deleteProfessor.mutate(professor.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        backToList();
      },
    });
  }

  if (isLoading) {
    return (
      <LoadingArea className="font-body py-24" />
    );
  }

  // انقطاعُ الاتّصال ليس «غير موجود»: يُقال ما جرى ويُعرض زرُّ إعادة.
  if (isError) {
    return <ErrorRetry onRetry={() => refetch()} />;
  }

  if (!professor) {
    return (
      <div className="font-body py-24 text-center">
        <p className="text-sm text-clay">{t("admin.professorNotFound")}</p>
        <button
          onClick={backToList}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
        >
          <ArrowRight size={16} className="ltr:rotate-180" />{t("admin.backToProfessors")}</button>
      </div>
    );
  }

  const p = professor;
  const facultyName = p.department?.faculty?.name ?? null;
  const tags = p.tags ?? [];
  const grades = p.grade ?? [];
  const topics = p.topics ?? [];
  const isActive = p.user?.status === "active";

  // ── computed analytics from the professor's own topics ──
  const totalTopics = p._count?.topics ?? topics.length;
  const statusCounts: Record<string, number> = {};
  for (const t of topics)
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
  const approved = statusCounts["approved"] ?? 0;
  const pending = statusCounts["pending"] ?? 0;
  const totalRequests = topics.reduce(
    (s, t) => s + (t._count?.groupRequests ?? 0),
    0,
  );
  const barSegs = STATUS_BAR.filter((s) => (statusCounts[s.key] ?? 0) > 0);
  const barTotal = topics.length || 1;

  const none = i18n.t("common.none");
  const other = otherScriptName(p.user);

  return (
    <div className="font-body space-y-6">
      <ProfileHero
        trail={
          <HeaderTrail
            crumbs={[{ label: t("dash.professors"), to: "/admin/professors" }, { label: fullName(p) }]}
            backLabel={t("admin.backToProfessors")}
            backTo="/admin/professors"
          />
        }
        avatar={<UserAvatar user={p.user} width={96} height={124} radius="rounded-2xl" tone="gold" className="shadow-xl ring-4 ring-[color:var(--t-brand)]" />}
        active={isActive}
        activeLabel={isActive ? t("admin.statusActive") : t("admin.statusSuspended")}
        eyebrow={t("admin.profile.eyebrow_professor")}
        name={fullName(p)}
        otherName={other || undefined}
        chips={
          <>
            {grades.map((g) => (
              <HeroChip key={`g-${g}`} icon={Award} tone="gold">
                {g}
              </HeroChip>
            ))}
            <HeroChip icon={isActive ? BadgeCheck : ShieldAlert} tone={isActive ? "emerald" : "rose"}>
              {isActive ? t("admin.statusActive") : t("admin.statusSuspended")}
            </HeroChip>
            {p.user?.isVerified && (
              <HeroChip icon={BadgeCheck} tone="sky">
                {t("admin.verified")}
              </HeroChip>
            )}
            {tags.map((tg) => (
              <HeroChip key={`t-${tg}`} icon={Tag}>
                {tg}
              </HeroChip>
            ))}
          </>
        }
        facts={
          <>
            {p.universityEmail && <HeroFact icon={Mail} value={p.universityEmail} ltr copy={p.universityEmail} />}
            {p.department?.name && <HeroFact icon={Building2} value={p.department.name} />}
            {facultyName && <HeroFact icon={GraduationCap} value={facultyName} />}
          </>
        }
        actions={
          <>
            <HeroButton icon={Pencil} variant="primary" onClick={() => setEditOpen(true)}>
              {t("pro.edit")}
            </HeroButton>
            <HeroButton icon={p.user?.isVerified ? ShieldAlert : BadgeCheck} variant={p.user?.isVerified ? "glass" : "positive"} onClick={() => setVerifyOpen(true)}>
              {p.user?.isVerified ? t("admin.unverifyAccount") : t("admin.verifyAccount")}
            </HeroButton>
            <HeroButton icon={Trash2} variant="danger" onClick={() => setConfirmOpen(true)}>
              {t("pro.delete")}
            </HeroButton>
          </>
        }
        stats={
          <>
            <HeroStat icon={Briefcase} label={t("admin.totalTopics")} value={totalTopics} tone="gold" />
            <HeroStat icon={CheckCircle2} label={t("admin.approvedTopicsShort")} value={approved} tone="emerald" />
            <HeroStat icon={Clock} label={t("stu.reqStatus.pending")} value={pending} tone="amber" />
            <HeroStat icon={Users} label={t("admin.totalRequests")} value={totalRequests} tone="sky" />
          </>
        }
      />

      {/* ── the record ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <RecordCard icon={IdCard} title={t("admin.profile.identity")} className="h-full">
          <FieldGrid cols={2}>
            <Field icon={Hash} label={t("admin.employeeNumber")} value={p.employeeNumber || none} ltr copy />
            <Field icon={Mail} label={t("admin.searchByEmail")} value={p.universityEmail || none} ltr copy />
            <Field icon={AtSign} label={t("admin.personalEmail")} value={p.user?.email || none} ltr copy />
            <Field icon={Phone} label={t("admin.phone")} value={p.user?.phone || none} ltr copy />
            <Field icon={IdCard} label={t("admin.username")} value={p.user?.username || none} ltr />
          </FieldGrid>
        </RecordCard>
        <div className="flex flex-col gap-6">
          <RecordCard icon={Building2} title={t("admin.profile.affiliation")}>
            {facultyName || p.department?.name ? (
              <AcademicPath
                steps={[
                  { icon: GraduationCap, label: t("admin.facultyLabel"), value: facultyName },
                  { icon: Building2, label: t("admin.department"), value: p.department?.name },
                ]}
              />
            ) : (
              <Field icon={Building2} label={t("admin.department")} value={none} />
            )}
          </RecordCard>
          <RecordCard icon={Activity} title={t("admin.profile.activity")} className="flex-1">
            <FieldGrid cols={1}>
              <Field icon={Clock} label={t("admin.lastSignIn")} value={fmtDate(p.user?.lastLoginAt)} />
              <Field icon={CalendarDays} label={t("admin.joinedOn")} value={fmtDate(p.user?.createdAt)} />
            </FieldGrid>
          </RecordCard>
        </div>
      </div>

      {/* ── the topics ── */}
      <div className={`grid grid-cols-1 items-start gap-6 ${topics.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]" : ""}`}>
        {topics.length > 0 && (
          <RecordCard icon={PieChart} title={t("admin.topicsByStatusDistribution")}>
            <div className="px-3 py-2">
              <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full bg-cream-2">
                {barSegs.map((s) => (
                  <div
                    key={s.key}
                    className={`${s.bar} h-full rounded-full transition-all duration-700`}
                    style={{ width: `${((statusCounts[s.key] ?? 0) / barTotal) * 100}%` }}
                    title={`${t(s.labelKey)}: ${statusCounts[s.key]}`}
                  />
                ))}
              </div>
              <ul className="mt-5 space-y-1">
                {barSegs.map((s) => {
                  const n = statusCounts[s.key] ?? 0;
                  return (
                    <li key={s.key} className="flex items-center gap-3 rounded-xl px-2 py-2 text-[13px] transition hover:bg-forest/[0.03]">
                      <span className={`size-2.5 shrink-0 rounded-full ${s.bar}`} />
                      <span className="flex-1 text-forest/85">{t(s.labelKey)}</span>
                      <b className="font-serif text-[15px] text-forest tabular-nums">{n}</b>
                      <span className="w-11 text-end text-[11.5px] text-clay tabular-nums">{Math.round((n / barTotal) * 100)}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </RecordCard>
        )}

        <RecordCard icon={Briefcase} title={t("admin.submittedTopics")} count={topics.length}>
          {topics.length === 0 ? (
            <EmptyNote icon={FileText} title={t("admin.noSubmittedTopics")} hint={t("admin.profile.noTopicsHint")} />
          ) : (
            <ul className="space-y-2">
              {topics.map((tp) => (
                <TopicRow key={tp.id} topic={tp} onClick={() => goToTopic(tp.id)} />
              ))}
            </ul>
          )}
        </RecordCard>
      </div>

      {/* dialogs */}
      <ProfessorEditDialog
        open={editOpen}
        professor={p}
        onClose={() => setEditOpen(false)}
      />
      <ConfirmDialog
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        title={
          p.user?.isVerified ? t("admin.unverifyAccount") : t("admin.verifyAccount")
        }
        message={
          p.user?.isVerified
            ? t("admin.confirmUnverifyUser", { name: fullName(p) })
            : t("admin.confirmVerifyUser", { name: fullName(p) })
        }
        confirmLabel={p.user?.isVerified ? t("admin.unverify") : t("admin.verify")}
        loading={setVerification.isPending}
        onConfirm={confirmVerification}
      />

      {/*
        المانع يُعرض قبل الضغط لا بعده.

        `deleteProfessorService` يرفض حذف أستاذٍ له موضوعٌ واحد فأكثر،
        ويردّ ٤٠٠ برسالةٍ تقول العدد وتطلب إعادة الإسناد أو الأرشفة. وكان
        ذلك يُعرف بعد الضغط على «نعم، احذف»؛ وصار يُقرأ في النافذة نفسها،
        والزرّ معطَّل. والعدد هنا هو `_count.topics` نفسه الذي يفحصه الخادم.
      */}
      <DangerConfirm
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        loading={deleteProfessor.isPending}
        title={t("admin.deleteProfessor")}
        name={fullName(p)}
        kicker={t("admin.professorWord")}
        avatar={
          <UserAvatar
            user={p.user}
            width={52}
            height={64}
            radius="rounded-xl"
          />
        }
        facts={[
          {
            icon: Hash,
            label: t("admin.employeeNumber"),
            value: p.employeeNumber || noneText(),
            dir: "ltr",
          },
          {
            icon: Mail,
            label: t("admin.universityEmail"),
            value: p.universityEmail || noneText(),
            dir: "ltr",
          },
          {
            icon: Building2,
            label: t("admin.department"),
            value: p.department?.name ?? noneText(),
          },
          {
            icon: GraduationCap,
            label: t("admin.facultyLabel"),
            value: facultyName ?? noneText(true),
          },
          {
            icon: Award,
            label: t("admin.gradeLabel"),
            value: grades.join("\u060c ") || noneText(true),
          },
          {
            icon: isActive ? BadgeCheck : ShieldAlert,
            label: t("admin.statusLabel"),
            value: isActive
              ? t("admin.statusActive")
              : t("admin.statusSuspended"),
          },
        ]}
        block={
          totalTopics > 0
            ? {
                message: t("admin.blockProfessorHasTopics", {
                  count: totalTopics,
                }),
                hint: t("admin.blockProfessorHasTopicsHint"),
              }
            : null
        }
        impacts={[
          {
            icon: Briefcase,
            label: t("admin.impactLoginAccount"),
            detail: p.user?.email || undefined,
          },
          { icon: Users, label: t("admin.impactCommitteeSeats") },
          { icon: FileText, label: t("admin.impactSubmissions") },
        ]}
        warning={t("admin.irreversibleWarning")}
        confirmLabel={t("admin.yesDelete")}
      />
    </div>
  );
}

function TopicRow({ topic, onClick }: { topic: ProfessorTopicLite; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <ListRow
      title={topic.title}
      state={topic.status}
      stateLabel={t(TOPIC_STATUS_KEY[topic.status] ?? "status.archived")}
      onClick={onClick}
      meta={
        <>
          {topic.specialization?.name && <MetaItem icon={GraduationCap}>{topic.specialization.name}</MetaItem>}
          <MetaItem icon={Users}>{t("admin.requestsCount", { count: topic._count?.groupRequests ?? 0 })}</MetaItem>
          <MetaItem icon={CalendarDays}>{fmtDate(topic.createdAt)}</MetaItem>
          <MetaItem icon={Hash}>{t("admin.maxCapacityN", { count: topic.maxStudents })}</MetaItem>
        </>
      }
    />
  );
}
