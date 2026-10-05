import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Mail,
  Phone,
  AtSign,
  IdCard,
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
  SendHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  useStudent,
  useDeleteStudent,
  useSetUserVerification,
} from "../../hooks/admin-hook";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import {
  DangerConfirm,
  type DangerImpact,
} from "../../../../components/dialog/danger-confirm";
import { StudentEditDialog } from "../../components/dialog/student/student-edit-dialog.form";
import { HeaderTrail } from "../../components/ui/hierarchy-header";
import { useTranslation } from "react-i18next";
import i18n from "../../../../i18n/i18n";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { noneText } from "../../../../lib/none-text";
import { None } from "../../../../lib/none";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { otherScriptName, personName as nameByLang } from "../../../../lib/person-name";
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

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The label of each state a request or topic can be in. */
const STATUS_KEY: Record<string, string> = {
  pending: "stu.reqStatus.pending",
  accepted: "status.accepted",
  approved: "status.approved",
  rejected: "status.rejected",
  open: "status.open",
  full: "status.full",
  archived: "status.archived",
};
const statusLabel = (s?: string) => STATUS_KEY[s ?? ""] ?? "status.archived";

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
function personName(u: any) {
  return nameByLang(u) || "\u2014";
}

export function AdminStudentDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id, lang } = useParams<{ id: string; lang: string }>();

  const {
    data: student,
    isLoading,
    refetch,
  } = useStudent(id ?? null) as {
    data: any;
    isLoading: boolean;
    refetch: () => void;
  };
  const deleteStudent = useDeleteStudent();
  const setVerification = useSetUserVerification();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const backToList = () => navigate(`/${lang}/admin/students`);
  const goToTopic = (topicId?: string) =>
    topicId && navigate(`/${lang}/admin/topics/${topicId}`);

  /**
   * التوثيق يُرفع ويُسحب من هنا أيضاً.
   *
   * وحساب الطالب هو المقصود لا صفّ الطالب: المسار على `/users/:id`، فالمعرَّف
   * المُرسَل `userId` لا `student.id` — وهما مختلفان، والخلط بينهما يوثّق
   * حساباً آخر أو يردّ ٤٠٤.
   */
  function confirmVerification() {
    if (!student) return;
    setVerification.mutate(
      { id: student.userId, isVerified: !student.user?.isVerified },
      {
        onSuccess: () => {
          setVerifyOpen(false);
          refetch();
        },
      },
    );
  }

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
      <LoadingArea className="font-body py-24" />
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

  const ledRequests = student.ledGroupRequests ?? [];
  const memberRequests = student.groupRequestMembers ?? [];
  const projectMembers = student.projectMembers ?? [];
  const hasProject = projectMembers.length > 0;

  /**
   * ما يسقط مع الطالب.
   *
   * ليست القائمة تخويفاً: `deleteStudentService` يحذف في معاملةٍ واحدة
   * الملفّات المرفوعة وطلبات الالتحاق الفردية وعضويّات طلبات الفرق
   * والطلبات التي يقودها وعضويّات المشاريع، ثمّ الطالبَ وحسابَه. فالمعروض
   * هنا هو ما يفعله الخادم، بالأعداد التي في هذه الصفحة نفسها.
   */
  const deleteImpacts: DangerImpact[] = [
    {
      icon: User,
      label: t("admin.impactLoginAccount"),
      detail: u.email || undefined,
    },
    ...(ledRequests.length
      ? [
          {
            icon: Users,
            label: t("admin.impactLedRequests"),
            value: ledRequests.length,
            detail:
              ledRequests
                .map((r: any) => r.topic?.title)
                .filter(Boolean)
                .join("\u060c ") || undefined,
          },
        ]
      : []),
    ...(memberRequests.length
      ? [
          {
            icon: MessagesSquare,
            label: t("admin.impactMemberRequests"),
            value: memberRequests.length,
          },
        ]
      : []),
    ...(hasProject
      ? [
          {
            icon: FolderKanban,
            label: t("admin.impactProjectMembership"),
            detail: projectMembers[0]?.group?.topic?.title,
            heavy: true,
          },
        ]
      : []),
    { icon: FileText, label: t("admin.impactSubmissions") },
  ];

  const hasActivity =
    ledRequests.length +
      memberRequests.length +
      projectMembers.length >
    0;

  // How many activity cards will render. One card should span the full width;
  // pairing it with an empty half looks worse than not splitting at all.
  const activityCards =
    (ledRequests.length > 0 ? 1 : 0) +
    (memberRequests.length > 0 ? 1 : 0) +
    (projectMembers.length > 0 ? 1 : 0);

  const none = i18n.t("common.none");
  const other = otherScriptName(u);
  const isActive = u.status === "active";

  return (
    <div className="font-body space-y-6">
      <ProfileHero
        trail={
          <HeaderTrail
            crumbs={[{ label: t("dash.students"), to: "/admin/students" }, { label: name }]}
            backLabel={t("admin.backToStudents")}
            backTo="/admin/students"
          />
        }
        avatar={<UserAvatar user={u} width={96} height={124} radius="rounded-2xl" tone="gold" className="shadow-xl ring-4 ring-[color:var(--t-brand)]" />}
        active={isActive}
        activeLabel={isActive ? t("admin.statusActive") : t("admin.statusSuspended")}
        eyebrow={t("admin.profile.eyebrow_student")}
        name={name}
        otherName={other || undefined}
        chips={
          <>
            {/* The registration number is the student's identifier, so it leads. */}
            {student.registrationNumber && (
              <HeroChip icon={IdCard} tone="gold" ltr mono title={t("pro.regNumber")}>
                {student.registrationNumber}
              </HeroChip>
            )}
            <HeroChip icon={User}>{t("roles.student")}</HeroChip>
            {student.academicYear?.title && (
              <HeroChip icon={CalendarDays} ltr>
                {student.academicYear.title}
              </HeroChip>
            )}
            <HeroChip icon={isActive ? BadgeCheck : ShieldAlert} tone={isActive ? "emerald" : "rose"}>
              {isActive ? t("admin.statusActive") : t("admin.statusSuspended")}
            </HeroChip>
            {u.isVerified && (
              <HeroChip icon={BadgeCheck} tone="sky">
                {t("admin.verified")}
              </HeroChip>
            )}
            <HeroChip icon={FolderKanban} tone={hasProject ? "emerald" : "glass"}>
              {hasProject ? t("admin.hasProject") : t("admin.noProjectYet")}
            </HeroChip>
          </>
        }
        facts={
          <>
            {u.email && <HeroFact icon={Mail} value={u.email} ltr copy={u.email} />}
            {spec?.name && <HeroFact icon={Layers} value={spec.name} />}
            {faculty?.name && <HeroFact icon={GraduationCap} value={faculty.name} />}
          </>
        }
        actions={
          <>
            <HeroButton icon={Pencil} variant="primary" onClick={() => setEditOpen(true)}>
              {t("pro.edit")}
            </HeroButton>
            <HeroButton icon={u.isVerified ? ShieldAlert : BadgeCheck} variant={u.isVerified ? "glass" : "positive"} onClick={() => setVerifyOpen(true)}>
              {u.isVerified ? t("admin.unverifyAccount") : t("admin.verifyAccount")}
            </HeroButton>
            <HeroButton icon={Trash2} variant="danger" onClick={() => setConfirmOpen(true)}>
              {t("pro.delete")}
            </HeroButton>
          </>
        }
        stats={
          <>
            <HeroStat icon={Users} label={t("admin.groupRequests")} value={ledRequests.length + memberRequests.length} tone="sky" />
            <HeroStat icon={FolderKanban} label={t("dash.myProject")} value={projectMembers.length} tone="gold" />
            <HeroStat
              icon={BadgeCheck}
              label={t("admin.accountStatus")}
              value={u.isVerified ? t("admin.verified") : t("admin.unverified")}
              tone={u.isVerified ? "emerald" : "glass"}
              compact
            />
            <HeroStat icon={Clock} label={t("admin.lastSignIn")} value={fmtDate(u.lastLoginAt)} tone="amber" compact />
          </>
        }
      />

      {/* ── the record ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <RecordCard icon={IdCard} title={t("admin.profile.identity")}>
            <FieldGrid cols={2}>
              <Field icon={IdCard} label={t("pro.regNumber")} value={student.registrationNumber || none} ltr copy />
              <Field icon={Mail} label={t("admin.email")} value={u.email || none} ltr copy />
              <Field icon={Phone} label={t("admin.phone")} value={u.phone || none} ltr copy />
              <Field icon={AtSign} label={t("admin.username")} value={u.username || none} ltr />
            </FieldGrid>
          </RecordCard>
          <RecordCard icon={Clock} title={t("admin.profile.activity")} className="flex-1">
            <FieldGrid cols={2}>
              <Field icon={Clock} label={t("admin.lastSignIn")} value={fmtDate(u.lastLoginAt)} />
              <Field icon={CalendarDays} label={t("admin.joinedOn")} value={fmtDate(u.createdAt)} />
            </FieldGrid>
          </RecordCard>
        </div>
        <RecordCard icon={Network} title={t("admin.profile.path")} className="h-full">
          {faculty?.name || dept?.name || filiere?.name || spec?.name ? (
            <AcademicPath
              steps={[
                { icon: GraduationCap, label: t("admin.facultyLabel"), value: faculty?.name },
                { icon: Building2, label: t("admin.department"), value: dept?.name },
                { icon: Network, label: t("admin.filiere"), value: filiere?.name },
                { icon: Layers, label: t("admin.specializationLabelAlt"), value: spec?.name },
              ]}
            />
          ) : (
            <Field icon={Layers} label={t("admin.specializationLabelAlt")} value={none} />
          )}
          <div className="mx-3 mt-1 border-t border-forest/8 pt-1">
            <Field icon={CalendarDays} label={t("pro.academicYear")} value={student.academicYear?.title ?? noneText(true)} ltr />
          </div>
        </RecordCard>
      </div>

      {/* ── what they have done ── */}
      {hasActivity ? (
        <div className={`grid grid-cols-1 items-start gap-6 ${activityCards > 1 ? "xl:grid-cols-2" : ""}`}>
          {projectMembers.length > 0 && (
            <RecordCard icon={FolderKanban} title={t("admin.finalProject")} count={projectMembers.length}>
              <ul className="space-y-2">
                {projectMembers.map((pm: any) => {
                  const g = pm.group ?? {};
                  return (
                    <ListRow
                      key={pm.id}
                      title={g.topic?.title ?? <None />}
                      badge={
                        pm.isLeader && (
                          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold ring-1 ring-gold/30">{t("admin.leader")}</span>
                        )
                      }
                      state={g.topic?.status}
                      stateLabel={g.topic?.status ? t(statusLabel(g.topic.status)) : undefined}
                      onClick={() => goToTopic(g.topic?.id)}
                      meta={
                        <>
                          {g.topic?.professor?.user && <MetaItem icon={User}>{personName(g.topic.professor.user)}</MetaItem>}
                          {g.defense ? (
                            <MetaItem icon={MessagesSquare} className="text-gold">
                              {t("admin.defenseColon")} {fmtDate(g.defense.date)}
                              {g.defense.room ? ` · ${g.defense.room}` : ""}
                            </MetaItem>
                          ) : (
                            <MetaItem icon={MessagesSquare}>{t("admin.noDefenseYet")}</MetaItem>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </ul>
            </RecordCard>
          )}

          {ledRequests.length > 0 && (
            <RecordCard icon={SendHorizontal} title={t("admin.groupRequestsAsLeader")} count={ledRequests.length}>
              <ul className="space-y-2">
                {ledRequests.map((r: any) => (
                  <ListRow
                    key={r.id}
                    title={r.topic?.title ?? noneText()}
                    state={r.status}
                    stateLabel={t(statusLabel(r.status))}
                    onClick={() => goToTopic(r.topic?.id)}
                    meta={
                      <>
                        {r.members && <MetaItem icon={Users}>{t("admin.membersCountN", { count: r.members.length })}</MetaItem>}
                        {r.createdAt && <MetaItem icon={CalendarDays}>{fmtDate(r.createdAt)}</MetaItem>}
                      </>
                    }
                  />
                ))}
              </ul>
            </RecordCard>
          )}

          {memberRequests.length > 0 && (
            <RecordCard icon={Users} title={t("admin.groupRequestsAsMember")} count={memberRequests.length}>
              <ul className="space-y-2">
                {memberRequests.map((m: any) => (
                  <ListRow
                    key={m.id ?? m.request?.id}
                    title={m.request?.topic?.title ?? noneText()}
                    state={m.request?.status}
                    stateLabel={m.request?.status ? t(statusLabel(m.request.status)) : undefined}
                    onClick={() => goToTopic(m.request?.topic?.id)}
                    meta={
                      m.request?.leader?.user && (
                        <MetaItem icon={SendHorizontal}>{t("admin.leaderName", { name: personName(m.request.leader.user) })}</MetaItem>
                      )
                    }
                  />
                ))}
              </ul>
            </RecordCard>
          )}
        </div>
      ) : (
        <section className="rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]">
          <EmptyNote icon={FileText} title={t("admin.noActivityYet")} hint={t("admin.noActivityBody")} />
        </section>
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
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        title={
          u.isVerified ? t("admin.unverifyAccount") : t("admin.verifyAccount")
        }
        message={
          u.isVerified
            ? t("admin.confirmUnverifyUser", { name })
            : t("admin.confirmVerifyUser", { name })
        }
        confirmLabel={u.isVerified ? t("admin.unverify") : t("admin.verify")}
        loading={setVerification.isPending}
        onConfirm={confirmVerification}
      />

      <DangerConfirm
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        loading={deleteStudent.isPending}
        title={t("admin.deleteStudent")}
        name={name}
        kicker={t("admin.studentWord")}
        avatar={
          <UserAvatar user={u} width={52} height={64} radius="rounded-xl" />
        }
        facts={[
          {
            icon: IdCard,
            label: t("pro.regNumber"),
            value: student.registrationNumber || noneText(),
            dir: "ltr",
          },
          {
            icon: Mail,
            label: t("admin.email"),
            value: u.email || noneText(),
            dir: "ltr",
          },
          {
            icon: Layers,
            label: t("admin.specializationLabelAlt"),
            value: spec?.name ?? noneText(),
          },
          {
            icon: Building2,
            label: t("admin.department"),
            value: dept?.name ?? noneText(),
          },
          {
            icon: CalendarDays,
            label: t("pro.academicYear"),
            value: student.academicYear?.title ?? noneText(true),
          },
          {
            icon: u.status === "active" ? BadgeCheck : ShieldAlert,
            label: t("admin.statusLabel"),
            value:
              u.status === "active"
                ? t("admin.statusActive")
                : t("admin.statusSuspended"),
          },
        ]}
        impacts={deleteImpacts}
        warning={t("admin.irreversibleWarning")}
        confirmLabel={t("admin.yesDelete")}
      />
    </div>
  );
}
