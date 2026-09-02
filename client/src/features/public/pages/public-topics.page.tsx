import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, User, Lock, Bookmark } from "lucide-react";
import {
  usePublicTopics,
  usePublicDepartments,
  usePublicSpecializations,
} from "../hooks/public-hook";
import { useAuth } from "../../../hooks/use-auth";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import type { PublicTopic } from "../../../types/public.types";

const PAGE_SIZE = 9;

export function PublicTopicsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang } = useParams();

  // Topics are for LOGGED-IN users only. A visitor (not authenticated) is sent
  // to the login page, remembering this path so they return here afterwards.
  const { isAuthenticated } = useAuth();
  const { localePath } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(localePath(PATHS.login), {
        state: { from: location.pathname },
        replace: true,
      });
    }
  }, [isAuthenticated, navigate, localePath, location.pathname]);

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [availability, setAvailability] = useState<
    "" | "available" | "reserved"
  >("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<Record<string, string | undefined>>(
    {},
  );

  const { data, isLoading } = usePublicTopics({
    page,
    limit: PAGE_SIZE,
    ...applied,
  });
  const { data: departments } = usePublicDepartments();
  // Specializations are scoped to the chosen department (cascading filter).
  const { data: specializations } = usePublicSpecializations(
    departmentId || undefined,
  );

  const topics = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applyFilters() {
    setApplied({
      search: search || undefined,
      departmentId: departmentId || undefined,
      specializationId: specializationId || undefined,
      availability: availability || undefined,
    });
    setPage(1);
  }

  function openDetail(id: string) {
    navigate(`/${lang}/topics/${id}`);
  }

  // Visitors are being redirected to login — render nothing to avoid a flash
  // of the topics page.
  if (!isAuthenticated) return null;

  return (
    <div className="font-body mx-auto w-full max-w-7xl px-6 py-10">
      {/* Page header */}
      <div className="mb-8 text-center md:text-start">
        <h1 className="font-serif text-3xl font-bold text-forest">
          {t("public.topicsTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-clay">
          {t("public.topicsSubtitle")}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder={t("public.searchPlaceholder")}
              className="w-full rounded-xl border border-forest/15 bg-white py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>

          {/* Department → resets specialization when changed */}
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setSpecializationId("");
            }}
            className="rounded-xl border border-forest/15 bg-white px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("public.allDepartments")}</option>
            {(departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Specialization (scoped to department) */}
          <select
            value={specializationId}
            onChange={(e) => setSpecializationId(e.target.value)}
            className="rounded-xl border border-forest/15 bg-white px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("public.allSpecializations")}</option>
            {(specializations ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Availability */}
          <select
            value={availability}
            onChange={(e) =>
              setAvailability(e.target.value as typeof availability)
            }
            className="rounded-xl border border-forest/15 bg-white px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("public.allStatuses")}</option>
            <option value="available">{t("public.available")}</option>
            <option value="reserved">{t("public.reserved")}</option>
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-clay">
            {t("public.resultsCount", { count: total })}
          </span>
          <button
            onClick={applyFilters}
            className="rounded-xl bg-forest px-6 py-2 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >
            {t("public.applyFilter")}
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
      ) : topics.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("public.noTopics")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {topics.map((tp) => (
            <TopicCard
              key={tp.id}
              topic={tp}
              onOpen={() => openDetail(tp.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="grid size-10 place-items-center rounded-lg border border-forest/20 text-forest transition hover:bg-forest hover:text-cream disabled:opacity-40"
          >
            {"\u203a"}
          </button>
          <span className="px-3 text-sm font-bold text-forest">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="grid size-10 place-items-center rounded-lg border border-forest/20 text-forest transition hover:bg-forest hover:text-cream disabled:opacity-40"
          >
            {"\u2039"}
          </button>
        </div>
      )}
    </div>
  );
}

function TopicCard({
  topic,
  onOpen,
}: {
  topic: PublicTopic;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const profName =
    [topic.professor?.user?.firstName, topic.professor?.user?.lastName]
      .filter(Boolean)
      .join(" ") || "\u2014";

  return (
    <div className="flex h-full flex-col rounded-xl border border-forest/10 bg-white p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(38,66,61,0.1)]">
      <div className="mb-4 flex items-start justify-between">
        {topic.isAvailable ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
            {t("public.available")}
          </span>
        ) : (
          <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">
            {t("public.reserved")}
          </span>
        )}
        {topic.isAvailable ? (
          <Bookmark size={18} className="text-forest/30" />
        ) : (
          <Lock size={16} className="text-forest/30" />
        )}
      </div>

      <button onClick={onOpen} className="mb-3 text-start">
        <h3 className="font-serif text-lg font-bold leading-tight text-forest transition hover:text-gold">
          {topic.title}
        </h3>
      </button>

      <div className="mb-4 flex items-center gap-2 text-clay">
        <User size={16} />
        <span className="text-xs">{profName}</span>
      </div>

      {topic.specialization?.name && (
        <div className="mb-4">
          <span className="rounded-lg bg-soft-sage/30 px-3 py-1 text-[12px] font-medium text-forest">
            {topic.specialization.name}
          </span>
        </div>
      )}

      <p className="mb-6 line-clamp-2 text-sm text-clay">{topic.description}</p>

      <div className="mt-auto flex items-center justify-between border-t border-forest/10 pt-5">
        <button
          onClick={onOpen}
          className="rounded-lg bg-forest px-5 py-2 text-sm font-bold text-cream transition hover:bg-forest-deep"
        >
          {t("public.viewDetails")}
        </button>
        {topic.isAvailable ? (
          <button
            onClick={onOpen}
            className="text-sm font-semibold text-gold hover:underline"
          >
            {t("public.applyRequest")}
          </button>
        ) : (
          <span className="cursor-not-allowed text-sm font-semibold text-clay/50">
            {t("public.notAvailable")}
          </span>
        )}
      </div>
    </div>
  );
}
