import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Users, BadgeCheck } from "lucide-react";
import { useBrowseTopics, useApplyToTopic } from "../hooks/Student-hook";
import type { BrowseTopic } from "../../../types/student.types";

export function StudentBrowseTopicsPage() {
  const { t } = useTranslation();
  const { data: topics, isLoading } = useBrowseTopics();
  const apply = useApplyToTopic();

  const [spec, setSpec] = useState("all");
  const [level, setLevel] = useState("all");

  // unique specialization options derived from data
  const specs = useMemo(() => {
    const map = new Map<string, string>();
    (topics ?? []).forEach((tp) => {
      if (tp.specialization) map.set(tp.specialization.id, tp.specialization.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [topics]);

  const filtered = (topics ?? []).filter((tp) => {
    if (spec !== "all" && tp.specialization?.id !== spec) return false;
    if (level !== "all" && tp.specialization?.level !== level) return false;
    return true;
  });

  const field =
    "rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm text-forest outline-none focus:border-gold";

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Search size={20} className="text-gold" />
        <h2 className="font-serif text-2xl font-bold text-forest">{t("stu.browseTitle")}</h2>
      </div>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-clay">{t("stu.browseDesc")}</p>

      {/* filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-forest/10 bg-cream-card p-4">
        <div className="min-w-44 flex-1">
          <label className="mb-1 block text-[12px] text-clay">{t("stu.filterSpec")}</label>
          <select value={spec} onChange={(e) => setSpec(e.target.value)} className={`${field} w-full`}>
            <option value="all">{t("stu.allSpecs")}</option>
            {specs.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-44 flex-1">
          <label className="mb-1 block text-[12px] text-clay">{t("stu.filterLevel")}</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={`${field} w-full`}>
            <option value="all">{t("stu.allLevels")}</option>
            <option value="licence">{t("stu.levelLicence")}</option>
            <option value="master">{t("stu.levelMaster")}</option>
            <option value="doctorate">{t("stu.levelDoctorate")}</option>
          </select>
        </div>
      </div>

      {/* grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-52 animate-pulse rounded-2xl bg-forest/5" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border-2 border-dashed border-forest/15 bg-cream-card py-20 text-center">
          <Search size={36} className="mb-2 text-forest/30" />
          <p className="text-sm text-clay">{t("stu.noTopics")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tp) => (
            <TopicCard key={tp.id} topic={tp} onApply={() => apply.mutate({ topicId: tp.id, priority: 1 })} applying={apply.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicCard({ topic, onApply, applying }: { topic: BrowseTopic; onApply: () => void; applying: boolean }) {
  const { t } = useTranslation();
  const full = topic.takenSeats >= topic.maxStudents;
  const profName =
    topic.professor?.title ||
    [topic.professor?.user?.firstName, topic.professor?.user?.lastName].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 transition hover:shadow-lg hover:shadow-forest/5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          <BadgeCheck size={12} /> {topic.specialization?.name ?? t("stu.open")}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
          full ? "bg-red-100 text-red-600" : "bg-forest/8 text-forest"
        }`}>
          <Users size={12} /> {topic.takenSeats}/{topic.maxStudents}
        </span>
      </div>

      <h3 className="mb-1 line-clamp-2 font-serif text-base font-bold text-forest">{topic.title}</h3>
      <p className="mb-3 line-clamp-2 flex-1 text-[13px] leading-relaxed text-clay">{topic.description}</p>

      {profName && <p className="mb-3 text-[12px] text-clay">{t("stu.supervisor")}: {profName}</p>}

      <div className="border-t border-forest/10 pt-3">
        {topic.hasApplied ? (
          <span className="block rounded-lg bg-forest/5 py-2 text-center text-[12px] font-medium text-forest/60">{t("stu.alreadyApplied")}</span>
        ) : full ? (
          <span className="block rounded-lg bg-forest/5 py-2 text-center text-[12px] font-medium text-clay">{t("stu.full")}</span>
        ) : (
          <button
            onClick={onApply}
            disabled={applying}
            className="w-full rounded-lg bg-gradient-to-br from-forest to-forest-deep py-2 text-center text-[13px] font-bold text-cream transition hover:-translate-y-px disabled:opacity-60"
          >
            {t("stu.apply")}
          </button>
        )}
      </div>
    </div>
  );
}
