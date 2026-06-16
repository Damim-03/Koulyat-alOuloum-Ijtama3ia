import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  UserCog,
  FileText,
  FolderKanban,
  BookOpen,
} from "lucide-react";
import { useProfessors, useDeleteProfessor } from "../hooks/admin-hook";
import { UserFormDialog } from "../components/user-form-dialog";
import type { Professor } from "../../../types/admin";

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}
function fullName(p: Professor) {
  const u = p.user;
  return (
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
    p.universityEmail ||
    "\u2014"
  );
}

const PAGE_SIZE = 10;

export function AdminProfessorsPage() {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<{ search?: string }>({});

  const { data, isLoading } = useProfessors({
    page,
    limit: PAGE_SIZE,
    ...applied,
  });
  const deleteProfessor = useDeleteProfessor();

  const [dialogOpen, setDialogOpen] = useState(false);

  const professors = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Sum of supervised topics across the current page (display only).
  const topicsOnPage = professors.reduce(
    (acc, p) => acc + (p._count?.topics ?? 0),
    0,
  );

  function applyFilters() {
    setApplied({ search: search || undefined });
    setPage(1);
  }
  function handleDelete(p: Professor) {
    if (confirm(t("admin.confirmDeleteProfessor", { name: fullName(p) }))) {
      deleteProfessor.mutate(p.id);
    }
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("admin.professorsTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">
            {t("admin.professorsSubtitle")}
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
        >
          <Plus size={18} />
          {t("admin.addProfessor")}
        </button>
      </div>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={UserCog}
          value={total}
          label={t("admin.totalProfessors")}
          tint="bg-soft-sage/30 text-forest"
        />
        <StatTile
          icon={FileText}
          value={topicsOnPage}
          label={t("admin.supervisedTopics")}
          tint="bg-emerald-100 text-emerald-600"
        />
        <StatTile
          icon={FolderKanban}
          value="\u2014"
          label={t("admin.currentProjects")}
          tint="bg-gold/15 text-gold"
        />
        <StatTile
          icon={BookOpen}
          value="\u2014"
          label={t("admin.assignedCourses")}
          tint="bg-clay/15 text-clay"
        />
      </div>

      {/* Search */}
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder={t("admin.searchProfessor")}
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

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.name")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.universityEmail")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.department")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.topicsCount")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-clay"
                  >
                    {"\u2026"}
                  </td>
                </tr>
              )}

              {!isLoading && professors.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm text-clay"
                  >
                    {t("admin.noProfessors")}
                  </td>
                </tr>
              )}

              {professors.map((p) => (
                <tr
                  key={p.id}
                  className="transition-colors hover:bg-forest/[0.03]"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                        {initials(p.user?.firstName, p.user?.lastName)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-forest">
                          {fullName(p)}
                        </p>
                        <p className="text-[11px] text-clay">
                          {p.employeeNumber}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay" dir="ltr">
                    {p.universityEmail}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay">
                    {p.department?.name ?? "\u2014"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-grid min-w-7 place-items-center rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">
                      {p._count?.topics ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        title={t("admin.view")}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        title={t("admin.edit")}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                        title={t("admin.delete")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-forest/10 px-5 py-3">
          <p className="text-xs text-clay">
            {t("admin.showingRange", {
              from: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, total),
              total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
              {"\u2039"}
            </button>
            <span className="px-3 text-sm text-forest">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
              {"\u203a"}
            </button>
          </div>
        </div>
      </div>

      <UserFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        lockedRole="professor"
      />
    </div>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof UserCog;
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
