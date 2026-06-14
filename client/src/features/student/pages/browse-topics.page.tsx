import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, Users2, BadgeCheck, FileText, ArrowLeft } from "lucide-react";
import {
  useBrowseTopics,
  useSpecializations,
  useAcademicYears,
} from "../hooks/Student-hook";

export function StudentBrowseTopicsPage() {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [applied, setApplied] = useState<{
    search?: string;
    specializationId?: string;
    academicYearId?: string;
  }>({});

  const { data: topics, isLoading } = useBrowseTopics(applied);
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();

  function applyFilters() {
    setApplied({
      search: search.trim() || undefined,
      specializationId: specializationId || undefined,
      academicYearId: academicYearId || undefined,
    });
  }

  const list = topics ?? [];
  const field =
    "rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-forest">
          {t("stu.browseTitle")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-clay">
          {t("stu.browseDesc")}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
              placeholder={t("stu.searchPlaceholder")}
              className={`${field} w-full pr-10`}
            />
          </div>
          <select
            value={specializationId}
            onChange={(e) => setSpecializationId(e.target.value)}
            className={field}
          >
            <option value="">{t("stu.allSpecs")}</option>
            {specs?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className={field}
          >
            <option value="">{t("stu.allYears")}</option>
            {years?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.title}
              </option>
            ))}
          </select>
          <button
            onClick={applyFilters}
            className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >
            {t("stu.applyFilter")}
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl bg-forest/5"
            />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border-2 border-dashed border-forest/15 bg-cream-card py-20 text-center">
          <Search size={36} className="mb-2 text-forest/30" />
          <p className="text-sm text-clay">{t("stu.noTopics")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((tp) => {
            const profName = [
              tp.professor?.user?.firstName,
              tp.professor?.user?.lastName,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              // الكليك على الكرت كامل ينقل لصفحة التفاصيل (رابط نسبي يحفظ بادئة اللغة)
              <Link
                key={tp.id}
                to={tp.id}
                className="group flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-forest/5"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <BadgeCheck size={12} />{" "}
                    {tp.specialization?.name ?? t("stu.open")}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest/8 px-2 py-0.5 text-[11px] font-medium text-forest">
                    <Users2 size={12} /> {tp.maxStudents}
                  </span>
                </div>

                <h3 className="mb-1 line-clamp-2 font-serif text-base font-bold text-forest">
                  {tp.title}
                </h3>
                <p className="mb-3 line-clamp-2 flex-1 text-[13px] leading-relaxed text-clay">
                  {tp.description}
                </p>

                <div className="mb-3 space-y-1 text-[12px] text-clay">
                  {profName && (
                    <p>
                      {t("stu.supervisor")}: {profName}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span>{tp.academicYear?.title ?? ""}</span>
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      {tp._count?.groupRequests ?? 0} {t("stu.requestsShort")}
                    </span>
                  </div>
                </div>

                {/* CTA مرئي فقط — الكرت كله رابط، فلا نضع زرّ حقيقي بداخله */}
                <span className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-forest to-forest-deep py-2.5 text-[13px] font-bold text-cream transition group-hover:-translate-y-px">
                  {t("stu.viewDetails")}
                  <ArrowLeft size={14} className="rtl:rotate-180" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
