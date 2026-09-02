import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Network,
  Building2,
  Layers,
  Users,
  ChevronLeft,
} from "lucide-react";
import { useDepartments, useDeleteDepartment } from "../../hooks/admin-hook";

import type { Department } from "../../../../types/admin";
import { DepartmentFormDialog } from "../../components/dialog/department/department.form";
import { CoverBanner } from "../../components/ui/cover-banner";

const PAGE_SIZE = 9;

export function AdminDepartmentsPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  const { data: departments, isLoading } = useDepartments();
  const deleteDepartment = useDeleteDepartment();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = departments ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.faculty?.name?.toLowerCase().includes(q),
    );
  }, [list, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stat strip values.
  const totalSpecs = list.reduce(
    (acc, d) => acc + (d._count?.specializations ?? 0),
    0,
  );
  const faculties = new Set(list.map((d) => d.facultyId)).size;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(d: Department) {
    setEditing(d);
    setDialogOpen(true);
  }
  function handleDelete(d: Department) {
    if (confirm(t("admin.confirmDeleteDept", { name: d.name })))
      deleteDepartment.mutate(d.id);
  }
  function openDomains(d: Department) {
    navigate(`/admin/faculties/${d.facultyId}/departments/${d.id}`);
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold text-forest">
            {t("admin.departmentsTitle")}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-clay">
              {t("admin.departmentsSubtitle")}
            </p>
            <span className="inline-flex items-center rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-medium text-forest">
              {list.length} {t("admin.departmentsShort")}
            </span>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft active:scale-[0.98]"
        >
          <Plus size={18} />
          {t("admin.addDepartment")}
        </button>
      </div>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          icon={Network}
          value={list.length}
          label={t("admin.totalDepartments")}
          tint="bg-soft-sage/30 text-forest"
        />
        <StatTile
          icon={Building2}
          value={faculties}
          label={t("admin.activeFaculties")}
          tint="bg-gold/15 text-gold"
        />
        <StatTile
          icon={Layers}
          value={totalSpecs}
          label={t("admin.linkedSpecs")}
          tint="bg-sage/20 text-sage"
        />
      </div>

      {/* Search */}
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-3 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="relative">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("admin.searchDepartment")}
            className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
      ) : pageItems.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.noDepartments")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((d) => (
            <div
              key={d.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:border-gold/40"
            >
              <div className="p-5">
                <CoverBanner src={d.coverUrl} />
                <div className="mb-4 flex items-start justify-between">
                  <div className="grid size-14 place-items-center rounded-xl bg-soft-sage/30 text-forest transition group-hover:bg-forest/5">
                    <Network size={26} />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(d)}
                      title={t("admin.edit")}
                      className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      title={t("admin.delete")}
                      className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="mb-4 space-y-1">
                  <span
                    className="font-mono text-[11px] font-bold uppercase tracking-widest text-gold"
                    dir="ltr"
                  >
                    {d.code}
                  </span>
                  <h3
                    onClick={() => openDomains(d)}
                    className="cursor-pointer font-serif text-lg font-bold text-forest transition hover:text-gold"
                  >
                    {d.name}
                  </h3>
                  <p className="flex items-center gap-1 text-[11px] text-clay">
                    <Building2 size={12} />
                    {d.faculty?.name ?? "\u2014"}
                  </p>
                </div>

                <div className="flex items-center gap-4 border-t border-forest/10 pt-3">
                  <span
                    title={t("admin.specializations")}
                    className="flex items-center gap-1.5 text-xs text-clay"
                  >
                    <Layers size={14} className="text-gold" />
                    <span className="font-bold text-forest">
                      {d._count?.specializations ?? 0}
                    </span>
                  </span>
                  <span
                    title={t("admin.professors")}
                    className="flex items-center gap-1.5 text-xs text-clay"
                  >
                    <Users size={14} className="text-sage" />
                    <span className="font-bold text-forest">
                      {d._count?.professors ?? 0}
                    </span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => openDomains(d)}
                className="mt-auto flex items-center justify-end gap-1 bg-cream-2 px-5 py-3.5 text-sm font-bold text-forest transition hover:text-gold"
              >
                {t("admin.viewDetails")}
                <ChevronLeft
                  size={16}
                  className="transition rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1 ltr:rotate-180"
                />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1">
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
      )}

      <DepartmentFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        department={editing}
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
  icon: typeof Network;
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
