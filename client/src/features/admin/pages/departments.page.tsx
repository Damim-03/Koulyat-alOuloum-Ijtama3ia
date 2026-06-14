import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Network,
  Building2,
  Layers,
} from "lucide-react";
import {
  useDepartments,
  useDeleteDepartment,
} from "../hooks/admin-hook";
import { DepartmentFormDialog } from "../components/department.form";
import type { Department } from "../../../types/admin";

const PAGE_SIZE = 10;

export function AdminDepartmentsPage() {
  const { t } = useTranslation();

  const { data: departments, isLoading } = useDepartments();
  const deleteDepartment = useDeleteDepartment();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

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
  const totalSpecs = list.reduce((acc, d) => acc + (d._count?.specializations ?? 0), 0);
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
    if (confirm(t("admin.confirmDeleteDept", { name: d.name }))) deleteDepartment.mutate(d.id);
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">{t("admin.departmentsTitle")}</h1>
          <p className="mt-1 text-sm text-clay">{t("admin.departmentsSubtitle")}</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
        >
          <Plus size={18} />
          {t("admin.addDepartment")}
        </button>
      </div>

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={Network} value={list.length} label={t("admin.totalDepartments")} tint="bg-soft-sage/30 text-forest" />
        <StatTile icon={Building2} value={faculties} label={t("admin.activeFaculties")} tint="bg-gold/15 text-gold" />
        <StatTile icon={Layers} value={totalSpecs} label={t("admin.linkedSpecs")} tint="bg-sage/20 text-sage" />
      </div>

      {/* Search */}
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-clay" size={18} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("admin.searchDepartment")}
            className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-5 py-3 text-xs font-medium">{t("admin.deptName")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("admin.code")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("admin.faculty")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("admin.specializations")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("admin.professors")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-clay">{"\u2026"}</td></tr>
              )}

              {!isLoading && pageItems.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-clay">{t("admin.noDepartments")}</td></tr>
              )}

              {pageItems.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-forest/[0.03]">
                  <td className="px-5 py-3.5 text-sm font-medium text-forest">{d.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-forest/10 px-2 py-0.5 font-mono text-[11px] font-bold text-forest" dir="ltr">
                      {d.code}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay">{d.faculty?.name ?? "\u2014"}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-grid min-w-7 place-items-center rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">
                      {d._count?.specializations ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-grid min-w-7 place-items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      {d._count?.professors ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(d)}
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        title={t("admin.edit")}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(d)}
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
              from: filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, filtered.length),
              total: filtered.length,
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
            <span className="px-3 text-sm text-forest">{page} / {totalPages}</span>
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