import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import {
  Plus,
  Hash,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  Network,
  Layers,
  GitBranch,
} from "lucide-react";
import {
  useFaculties,
  useDepartments,
  useDomains,
  useDeleteDomain,
} from "../../hooks/admin-hook";
import type { Domain } from "../../../../types/admin";
import { DomainFormDialog } from "../../components/dialog/domain/domain-dialog.form";
import { CoverBanner } from "../../components/ui/cover-banner";
import { SearchField } from "../../components/ui/search-field";
import {
  HierarchyHeader,
  HeaderBadge,
} from "../../components/ui/hierarchy-header";

export function DepartmentDetailPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { facultyId = "", departmentId = "" } = useParams();

  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: domains, isLoading } = useDomains(departmentId);
  const deleteDomain = useDeleteDomain();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Domain | null>(null);

  const faculty = useMemo(
    () => (faculties ?? []).find((f) => f.id === facultyId),
    [faculties, facultyId],
  );
  const department = useMemo(
    () => (departments ?? []).find((d) => d.id === departmentId),
    [departments, departmentId],
  );

  const list = useMemo(() => domains ?? [], [domains]);

  // Client-side filters: the list arrives whole, so no request is needed.
  const [nameQuery, setNameQuery] = useState("");
  const [codeQuery, setCodeQuery] = useState("");
  const visible = useMemo(() => {
    const n = nameQuery.trim().toLowerCase();
    const c = codeQuery.trim().toLowerCase();
    return list.filter(
      (x) =>
        (!n || (x.name ?? "").toLowerCase().includes(n)) &&
        (!c || (x.code ?? "").toLowerCase().includes(c)),
    );
  }, [list, nameQuery, codeQuery]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(dm: Domain) {
    setEditing(dm);
    setDialogOpen(true);
  }
  function handleDelete(dm: Domain) {
    if (confirm(t("admin.confirmDeleteDomain", { name: dm.name })))
      deleteDomain.mutate(dm.id);
  }

  const facultyUrl = `/admin/faculties/${facultyId}`;
  const domainUrl = (id: string) =>
    `/admin/faculties/${facultyId}/departments/${departmentId}/domains/${id}`;

  return (
    <div className="font-body">
      {!department && departments ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
          {t("admin.departmentNotFound")}
        </div>
      ) : (
        <>
          <HierarchyHeader
            crumbs={[
              { label: t("admin.facultiesBreadcrumb"), to: "/admin/faculties" },
              { label: faculty?.name, to: facultyUrl },
              { label: department?.name },
            ]}
            backLabel={t("admin.backToFaculty")}
            backTo={facultyUrl}
            icon={Network}
            title={department?.name ?? "…"}
            subtitle={t("admin.departmentDomainsSubtitle")}
            code={department?.code}
            coverUrl={department?.coverUrl}
            badges={
              <HeaderBadge>
                {list.length} {t("admin.domainsShort")}
              </HeaderBadge>
            }
            action={
              <button
                onClick={openCreate}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft active:scale-[0.98]"
              >
                <Plus size={18} />
                {t("admin.addDomain")}
              </button>
            }
          />

          {/* Filters — one field per identifier, as on the other lists. */}
          {list.length > 0 && (
            <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)] md:grid-cols-2">
              <SearchField
                icon={Search}
                label={t("admin.filterByName")}
                placeholder={t("admin.filterNamePlaceholder")}
                value={nameQuery}
                onChange={setNameQuery}
              />
              <SearchField
                icon={Hash}
                label={t("admin.filterByCode")}
                placeholder={t("admin.filterCodePlaceholder")}
                value={codeQuery}
                onChange={setCodeQuery}
              />
            </div>
          )}

          {/* Domains */}
          {isLoading ? (
            <div className="py-20 text-center text-sm text-clay">
              {"\u2026"}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center text-sm text-clay">
              {t("admin.noDomains")}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center text-sm text-clay">
              {t("admin.noFilterResults")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((dm) => (
                <div
                  key={dm.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:border-gold/40"
                >
                  <div className="p-5">
                    <CoverBanner src={dm.coverUrl} />
                    <div className="mb-4 flex items-start justify-between">
                      <div className="grid size-14 place-items-center rounded-xl bg-soft-sage/30 text-forest transition group-hover:bg-forest/5">
                        <Layers size={26} />
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(dm)}
                          title={t("admin.edit")}
                          className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(dm)}
                          title={t("admin.delete")}
                          className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span
                        className="font-mono text-[11px] font-bold uppercase tracking-widest text-gold"
                        dir="ltr"
                      >
                        {dm.code}
                      </span>
                      <h3
                        onClick={() => navigate(domainUrl(dm.id))}
                        className="cursor-pointer font-serif text-lg font-bold text-forest transition hover:text-gold"
                      >
                        {dm.name}
                      </h3>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-forest/10 bg-cream-2 px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-xs text-clay">
                      <GitBranch size={14} />
                      {dm._count?.filieres ?? 0} {t("admin.filieresShort")}
                    </span>
                    <button
                      onClick={() => navigate(domainUrl(dm.id))}
                      className="flex items-center gap-1 text-sm font-bold text-forest transition hover:text-gold"
                    >
                      {t("admin.viewDetails")}
                      <ChevronLeft
                        size={16}
                        className="transition rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1 ltr:rotate-180"
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <DomainFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        domain={editing}
        departmentId={departmentId}
      />
    </div>
  );
}
