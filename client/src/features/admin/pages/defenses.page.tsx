import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Users,
  CalendarClock,
  CheckCircle2,
  Clock,
  DoorOpen,
} from "lucide-react";
import {
  useAdminDefenses,
  useDeleteDefense,
} from "../hooks/admin-hook";
import type { AdminDefense } from "../../../types/admin";

function initials(first?: string | null, last?: string | null, fallback = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

const PAGE_SIZE = 10;

export function AdminDefensesPage() {
  const { t, i18n } = useTranslation();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<{ search?: string }>({});

  const { data, isLoading } = useAdminDefenses({ page, limit: PAGE_SIZE, ...applied });
  const deleteDefense = useDeleteDefense();

  const defenses = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Stats from the current page.
  const now = Date.now();
  const upcoming = defenses.filter((d) => new Date(d.date).getTime() >= now).length;
  const graded = defenses.filter((d) => d.grade != null).length;

  function applyFilters() {
    setApplied({ search: search || undefined });
    setPage(1);
  }
  function handleDelete(d: AdminDefense) {
    if (confirm(t("admin.confirmDeleteDefense"))) deleteDefense.mutate(d.id);
  }

  function fmtDate(iso: string) {
    const date = new Date(iso);
    const locale = i18n.language || "ar";
    return {
      day: new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(date),
      month: new Intl.DateTimeFormat(locale, { month: "short" }).format(date),
      year: new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date),
      time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date),
    };
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">{t("admin.defensesTitle")}</h1>
          <p className="mt-1 text-sm text-clay">{t("admin.defensesSubtitle")}</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep">
          <Plus size={18} />
          {t("admin.scheduleDefense")}
        </button>
      </div>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={CalendarClock} value={total} label={t("admin.totalDefenses")} tint="bg-soft-sage/30 text-forest" />
        <StatTile icon={Clock} value={upcoming} label={t("admin.upcomingDefenses")} tint="bg-amber-100 text-amber-600" />
        <StatTile icon={CheckCircle2} value={graded} label={t("admin.gradedDefenses")} tint="bg-emerald-100 text-emerald-600" />
        <StatTile icon={DoorOpen} value="\u2014" label={t("admin.bookedRooms")} tint="bg-gold/15 text-gold" />
      </div>

      {/* Search */}
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-clay" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder={t("admin.searchDefense")}
              className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <button
            onClick={applyFilters}
            className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >
            {t("admin.applyFilter")}
          </button>
        </div>
      </div>

      {/* Timeline cards */}
      <div className="space-y-3">
        {isLoading && (
          <div className="py-16 text-center text-sm text-clay">{"\u2026"}</div>
        )}

        {!isLoading && defenses.length === 0 && (
          <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center text-sm text-clay">
            {t("admin.noDefenses")}
          </div>
        )}

        {defenses.map((d) => {
          const dt = fmtDate(d.date);
          const isUpcoming = new Date(d.date).getTime() >= now;
          const members = d.group?.members ?? [];
          const topicTitle = d.group?.topic?.title ?? "\u2014";

          return (
            <div
              key={d.id}
              className="flex overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
            >
              {/* Date side */}
              <div className={`flex w-24 flex-col items-center justify-center px-3 py-5 text-center ${
                isUpcoming ? "bg-forest text-cream" : "bg-forest/5 text-clay"
              }`}>
                <span className="font-serif text-2xl font-bold leading-none">{dt.day}</span>
                <span className="text-xs">{dt.month}</span>
                <span className="text-[10px] opacity-70">{dt.year}</span>
                <span className="mt-1 text-[10px] opacity-80">{dt.time}</span>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col justify-between gap-3 p-4 md:flex-row md:items-center">
                <div className="min-w-0">
                  <h3 className="mb-1.5 font-serif text-base font-bold text-forest">{topicTitle}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-clay">
                    <span className="flex items-center gap-1">
                      <MapPin size={13} />
                      {d.room || "\u2014"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={13} />
                      {members.length} {t("admin.membersShort")}
                    </span>
                    {d.grade != null && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {t("admin.grade")}: {d.grade}/20
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Member avatars */}
                  <div className="flex -space-x-2 flex-row-reverse">
                    {members.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        className="grid size-7 place-items-center rounded-full border-2 border-cream-card bg-gradient-to-br from-forest to-forest-deep text-[10px] font-bold text-cream"
                      >
                        {initials(m.student?.user?.firstName, m.student?.user?.lastName)}
                      </div>
                    ))}
                  </div>
                  <button className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest">
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(d)}
                    className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
          >
            {"\u2039"}
          </button>
          <span className="px-3 text-sm text-forest">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
          >
            {"\u203a"}
          </button>
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof CalendarClock;
  value: number | string;
  label: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <div className={`grid size-11 place-items-center rounded-full ${tint}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="font-serif text-xl font-bold text-forest">{value}</p>
        <p className="text-[11px] text-clay">{label}</p>
      </div>
    </div>
  );
}