import { useTranslation } from "react-i18next";
import { BookOpen, Crown, ExternalLink, GraduationCap, Layers, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { useAdminTopic } from "../../../hooks/admin-hook";
import { useLangNavigate } from "../../../../../hooks/useLangNavigate";
import { statusChip } from "../../../utils/status-styles";
import { personName } from "../../../../../lib/person-name";
import { levelName } from "../../../../../lib/spec-level";
import { ErrorRetry } from "../../../../../components/ui/error-retry";
import { UserAvatar } from "../../../../../components/ui/user-avatar";

type Member = {
  id: string;
  isLeader: boolean;
  student?: { registrationNumber?: string | null; user?: Parameters<typeof personName>[0] } | null;
};

/**
 * نظرةٌ على مذكّرة — لوحةٌ جانبية بجانب نافذة عدد الطلبة.
 *
 * ما يلزم لتقرير ما يُفعل بموضوعٍ يخالف العدد، بلا مغادرة النافذة: عنوانه
 * وحاله ومستواه، ومشرفه ومساعده، ومقاعده وطلبته بأسمائهم وأرقامهم — ومقابلها
 * العددُ المختار لمستواه. ومنها إلى صفحة الموضوع لما هو أدقّ.
 */
export function TopicPeek({ topicId, rule, onClose }: { topicId: string; rule?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { data: topic, isLoading, isError, refetch } = useAdminTopic(topicId);
  const members = ((topic as { projectGroup?: { members?: Member[] } | null } | undefined)?.projectGroup?.members ?? []) as Member[];
  const over = rule !== undefined && members.length > rule;

  return (
    /*
      Beside the dialog on a wide screen, stretched to its height: the box takes
      the row's height and the glance fills it, scrolling inside — so a long
      team never makes it taller than the dialog. Over it on a narrow screen.
    */
    <aside
      aria-labelledby="topic-peek-title"
      data-testid="topic-peek"
      className="fixed inset-y-3 end-3 z-70 w-[min(92vw,400px)] lg:relative lg:inset-auto lg:z-auto lg:w-[400px] lg:shrink-0 lg:self-stretch"
    >
      <div className="animate-scale-in flex h-full flex-col overflow-hidden rounded-[22px] border border-gold/20 bg-cream-card shadow-[0_30px_90px_-30px_rgba(10,20,17,0.8)] lg:absolute lg:inset-0">
        <header className="flex items-center gap-3 border-b border-forest/10 bg-cream-2/70 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
            <BookOpen size={17} />
          </span>
          <h4 id="topic-peek-title" className="min-w-0 flex-1 text-[13px] font-bold text-forest">
            {t("admin.teamSize.peekTitle")}
          </h4>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("admin.teamSize.peekClose")}
            className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/8 hover:text-forest"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-3" aria-hidden>
              <div className="h-6 w-3/4 animate-pulse rounded-lg bg-forest/8" />
              <div className="h-20 animate-pulse rounded-xl bg-forest/5" />
              <div className="h-24 animate-pulse rounded-xl bg-forest/5" />
            </div>
          ) : isError || !topic ? (
            <ErrorRetry onRetry={() => refetch()} />
          ) : (
            <>
              <div>
                <p className="font-serif text-[16px] leading-snug font-bold text-forest" dir="auto" data-testid="topic-peek-name">
                  {topic.title}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusChip(topic.status)}`}>
                    {t(`status.${topic.status}`, { defaultValue: topic.status })}
                  </span>
                  {topic.specialization?.level && (
                    <span className="rounded-full bg-forest/8 px-2.5 py-0.5 text-[11px] font-semibold text-forest/75">
                      {levelName(topic.specialization.level, t)}
                    </span>
                  )}
                  {topic.type && (
                    <span className="rounded-full bg-gold/12 px-2.5 py-0.5 text-[11px] font-semibold text-gold">{topic.type.name}</span>
                  )}
                </div>
              </div>

              {/* Its supervisor, face and name. */}
              <div className="flex items-center gap-3 rounded-xl bg-cream-2/60 p-3 ring-1 ring-forest/8" data-testid="topic-peek-supervisor">
                <UserAvatar user={topic.professor?.user} size={46} />
                <span className="min-w-0">
                  <span className="block text-[11px] text-clay">{t("admin.teamSize.peekSupervisor")}</span>
                  <span className="block truncate text-[14px] font-bold text-forest">{personName(topic.professor?.user) || "—"}</span>
                  {topic.professor?.universityEmail && (
                    <span className="block truncate text-[11px] text-clay" dir="ltr">
                      {topic.professor.universityEmail}
                    </span>
                  )}
                </span>
              </div>

              <dl className="divide-y divide-forest/8 overflow-hidden rounded-xl bg-cream-2/60 ring-1 ring-forest/8">
                {topic.coSupervisor && (
                  <Row icon={UserRound} label={t("admin.teamSize.peekCoSupervisor")} value={personName(topic.coSupervisor.user) || "—"} />
                )}
                <Row icon={Layers} label={t("admin.teamSize.peekSpecialization")} value={topic.specialization?.name ?? "—"} />
                <Row icon={GraduationCap} label={t("admin.teamSize.peekYear")} value={topic.academicYear?.title ?? "—"} />
              </dl>

              {/* Its seats and students, against the number chosen for its level. */}
              <div className={`rounded-xl p-3 ring-1 ${over ? "bg-amber-500/8 ring-amber-500/25" : "bg-cream-2/60 ring-forest/8"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-forest">
                    <Users size={14} className="text-gold" />
                    {t("admin.teamSize.peekStudents")}
                  </span>
                  <span className="text-[11.5px] font-semibold text-forest/80 tabular-nums" data-testid="topic-peek-seats">
                    {t("admin.teamSize.peekSeats", { members: members.length, max: topic.maxStudents })}
                  </span>
                </div>
                {rule !== undefined && (
                  <p className={`mt-1 text-[11.5px] ${over ? "font-semibold text-amber-700 dark:text-amber-300" : "text-clay"}`} data-testid="topic-peek-rule">
                    {t(over ? "admin.teamSize.peekOver" : "admin.teamSize.peekRule", { what: t("teamSize.count", { count: rule }), n: members.length - rule })}
                  </p>
                )}
                {members.length === 0 ? (
                  <p className="mt-2 text-[11.5px] text-clay">{t("admin.teamSize.peekNoStudents")}</p>
                ) : (
                  <ul className="mt-2.5 space-y-1.5">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 rounded-lg bg-cream-card px-2.5 py-1.5 ring-1 ring-forest/8">
                        <span className={`grid size-6 shrink-0 place-items-center rounded-md ${m.isLeader ? "bg-gold text-forest-deep" : "bg-forest/6 text-forest/50"}`}>
                          {m.isLeader ? <Crown size={12} /> : <UserRound size={12} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-forest">{personName(m.student?.user) || "—"}</span>
                        <span className="shrink-0 font-mono text-[11px] text-clay" dir="ltr">
                          {m.student?.registrationNumber ?? ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {(topic.summary || topic.description) && (
                <p className="line-clamp-5 text-[12.5px] leading-relaxed text-forest/80" dir="auto">
                  {topic.summary || topic.description}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="border-t border-forest/10 bg-cream-2/50 p-3">
          <button
            type="button"
            onClick={() => navigate(`/admin/topics/${topicId}`)}
            data-testid="topic-peek-open"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-bold text-cream transition hover:bg-forest-deep"
          >
            <ExternalLink size={15} />
            {t("admin.teamSize.peekOpen")}
          </button>
        </footer>
      </div>
    </aside>
  );
}

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2">
      <Icon size={13} className="mt-0.5 shrink-0 text-sage" />
      <dt className="w-24 shrink-0 text-[11px] text-clay">{label}</dt>
      <dd className="min-w-0 flex-1 text-[12.5px] font-semibold text-forest" dir="auto">
        {value}
      </dd>
    </div>
  );
}
