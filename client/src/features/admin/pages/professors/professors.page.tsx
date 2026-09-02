import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  AtSign,
  BadgeCheck,
  UserCog,
  FileText,
  FolderKanban,
  BookOpen,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  useProfessors,
  useFaculties,
  useDepartments,
  useFilieres,
} from "../../hooks/admin-hook";
import type { Filiere } from "../../../../types/admin";
import { UserFormDialog } from "../../components/dialog/user/user-form-dialog.form";
import { SearchField } from "../../components/ui/search-field";

const PAGE_SIZE = 10;

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  return (first?.[0] ?? "") + (last?.[0] ?? "") || fallback;
}
export function AdminProfessorsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang } = useParams();
  const goToProfessor = (pid: string) =>
    navigate(`/${lang}/admin/professors/${pid}`);

  const [search, setSearch] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [email, setEmail] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(true);

  // debounced search terms
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedEmployeeNumber, setDebouncedEmployeeNumber] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedEmployeeNumber(employeeNumber.trim()),
      350,
    );
    return () => clearTimeout(id);
  }, [employeeNumber]);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedEmail(email.trim()), 350);
    return () => clearTimeout(id);
  }, [email]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [
    debouncedSearch,
    debouncedEmployeeNumber,
    debouncedEmail,
    facultyId,
    departmentId,
    filiereId,
  ]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      // `search` is the person's name; the other two target one field each.
      search: debouncedSearch || undefined,
      employeeNumber: debouncedEmployeeNumber || undefined,
      email: debouncedEmail || undefined,
      facultyId: facultyId || undefined,
      departmentId: departmentId || undefined,
      filiereId: filiereId || undefined,
    }),
    [
      page,
      debouncedSearch,
      debouncedEmployeeNumber,
      debouncedEmail,
      facultyId,
      departmentId,
      filiereId,
    ],
  );

  const { data, isLoading, isFetching } = useProfessors(params);
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();

  // ── cascading option lists ──
  const deptOptions = useMemo(
    () =>
      (departments ?? []).filter(
        (d) => !facultyId || d.facultyId === facultyId,
      ),
    [departments, facultyId],
  );
  const filiereOptions = useMemo(
    () =>
      (filieres ?? []).filter((f) => {
        if (departmentId && f.departmentId !== departmentId) return false;
        if (facultyId && !departmentId) {
          const d = (departments ?? []).find((dd) => dd.id === f.departmentId);
          if (d && d.facultyId !== facultyId) return false;
        }
        return true;
      }),
    [filieres, departmentId, facultyId, departments],
  );

  useEffect(() => {
    if (departmentId && !deptOptions.some((d) => d.id === departmentId))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDepartmentId("");
  }, [deptOptions, departmentId]);
  useEffect(() => {
    if (filiereId && !filiereOptions.some((f) => f.id === filiereId))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFiliereId("");
  }, [filiereOptions, filiereId]);

  const professors = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const topicsOnPage = professors.reduce(
    (acc, p) => acc + (p._count?.topics ?? 0),
    0,
  );

  const facultyName = faculties?.find((f) => f.id === facultyId)?.name;
  const deptName = departments?.find((d) => d.id === departmentId)?.name;
  const filiereName = filieres?.find((f) => f.id === filiereId)?.name;

  const activeFilters =
    (debouncedSearch ? 1 : 0) +
    (debouncedEmployeeNumber ? 1 : 0) +
    (debouncedEmail ? 1 : 0) +
    (facultyId ? 1 : 0) +
    (departmentId ? 1 : 0) +
    (filiereId ? 1 : 0);

  function clearAll() {
    setSearch("");
    setEmployeeNumber("");
    setEmail("");
    setFacultyId("");
    setDepartmentId("");
    setFiliereId("");
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
          value="—"
          label={t("admin.currentProjects")}
          tint="bg-gold/15 text-gold"
        />
        <StatTile
          icon={BookOpen}
          value="—"
          label={t("admin.assignedCourses")}
          tint="bg-clay/15 text-clay"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        {/* Header */}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-forest/5"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-forest" />

            <span className="font-semibold text-forest">{t("admin.filters")}</span>

            {activeFilters > 0 && (
              <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold">
                {activeFilters}
              </span>
            )}
          </div>

          {filtersOpen ? (
            <ChevronUp size={20} className="text-clay" />
          ) : (
            <ChevronDown size={20} className="text-clay" />
          )}
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            filtersOpen
              ? "max-h-162.5 border-t border-forest/10 p-4"
              : "max-h-0"
          }`}
        >
          {/* Search: one field per identifier */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <SearchField
              icon={Search}
              label={t("admin.searchByName")}
              placeholder={t("admin.searchByNamePlaceholder")}
              value={search}
              onChange={setSearch}
            />
            <SearchField
              icon={BadgeCheck}
              label={t("admin.employeeNumber")}
              placeholder={t("admin.searchByEmployeeNumberPlaceholder")}
              value={employeeNumber}
              onChange={setEmployeeNumber}
            />
            <SearchField
              icon={AtSign}
              label={t("admin.universityEmail")}
              placeholder={t("admin.searchByEmailPlaceholder")}
              value={email}
              onChange={setEmail}
            />
          </div>

          {/* Faculty → Department → Filiere */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label={t("admin.facultyLabel")}
              value={facultyId}
              onChange={setFacultyId}
              placeholder={t("admin.allFacultiesShort")}
              options={(faculties ?? []).map((f) => ({
                v: f.id,
                l: f.name,
              }))}
            />

            <Select
              label={t("admin.department")}
              value={departmentId}
              onChange={setDepartmentId}
              placeholder={t("admin.allDepartments")}
              options={deptOptions.map((d) => ({
                v: d.id,
                l: d.name,
              }))}
            />

            <Select
              label={t("admin.filiere")}
              value={filiereId}
              onChange={setFiliereId}
              placeholder={t("admin.allFilieresShort")}
              options={filiereOptions.map((f) => ({
                v: f.id,
                l: f.name,
              }))}
            />
          </div>

          {/* Active Filters */}
          {activeFilters > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-forest/10 pt-3">
              <SlidersHorizontal size={14} className="text-clay" />

              {debouncedSearch && (
                <Chip
                  label={`${t("admin.chipName")}: ${debouncedSearch}`}
                  onClear={() => setSearch("")}
                />
              )}

              {debouncedEmployeeNumber && (
                <Chip
                  label={`${t("admin.employeeNumber")}: ${debouncedEmployeeNumber}`}
                  onClear={() => setEmployeeNumber("")}
                />
              )}

              {debouncedEmail && (
                <Chip
                  label={`${t("admin.chipEmail")}: ${debouncedEmail}`}
                  onClear={() => setEmail("")}
                />
              )}

              {facultyName && (
                <Chip
                  label={t("admin.chipFaculty", { value: facultyName })}
                  onClear={() => setFacultyId("")}
                />
              )}

              {deptName && (
                <Chip
                  label={t("admin.chipDepartment", { value: deptName })}
                  onClear={() => setDepartmentId("")}
                />
              )}

              {filiereName && (
                <Chip
                  label={t("admin.chipFiliere", { value: filiereName })}
                  onClear={() => setFiliereId("")}
                />
              )}

              <button
                onClick={clearAll}
                className="ms-auto inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:underline"
              >
                <X size={13} />{t("admin.clearAll")}</button>
            </div>
          )}
        </div>
      </div>

      {/* count */}
      <div className="mb-3 flex items-center gap-2 text-sm text-clay">
        <UserCog size={15} />
        <span>{t("admin.professorsCount", { count: total })}</span>
        {isFetching && (
          <span className="text-[11px] text-clay/70">{t("admin.refreshingSuffix")}</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-240 text-start">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="w-20 px-4 py-3 text-xs font-medium">
                  {t("admin.avatarColumn")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.firstNameColumn")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">{t("admin.lastName")}</th>
                <th className="px-4 py-3 text-xs font-medium">
                  {t("admin.employeeNumber")}
                </th>
                <th className="px-4 py-3 text-xs font-medium">{t("admin.searchByEmail")}</th>
                <th className="px-4 py-3 text-xs font-medium">{t("admin.facultyLabel")}</th>
                <th className="px-4 py-3 text-xs font-medium">{t("admin.department")}</th>
                <th className="px-4 py-3 text-xs font-medium">{t("admin.filiere")}</th>
                <th className="px-4 py-3 text-xs font-medium">{t("admin.tagLabel")}</th>
                <th className="px-4 py-3 text-xs font-medium">{t("admin.gradeLabel")}</th>
                <th className="px-4 py-3 text-xs font-medium">{t("common.topics")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-10 text-center text-sm text-clay"
                  >
                    {"\u2026"}
                  </td>
                </tr>
              )}
              {!isLoading && professors.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-12 text-center text-sm text-clay"
                  >
                    {t("admin.noProfessors")}
                  </td>
                </tr>
              )}

              {professors.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => goToProfessor(p.id)}
                  className="cursor-pointer align-top transition-colors hover:bg-forest/4"
                >
                  <td className="px-4 py-3.5">
                    {p.user?.avatarUrl ? (
                      <img
                        src={p.user.avatarUrl}
                        alt=""
                        className="size-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                        {initials(p.user?.firstName, p.user?.lastName)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-forest">
                    {p.user?.firstName ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-forest">
                    {p.user?.lastName ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay" dir="ltr">
                    {p.employeeNumber}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay" dir="ltr">
                    {p.universityEmail}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay">
                    {p.department?.faculty?.name ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay">
                    {p.department?.name ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-clay">
                    <FiliereCell filieres={p.department?.filieres} />
                  </td>
                  <td className="px-4 py-3.5">
                    <TagPills
                      items={p.tags}
                      tint="bg-soft-sage/40 text-forest"
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <TagPills items={p.grade} tint="bg-gold/15 text-gold" />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-grid min-w-7 place-items-center rounded-full bg-forest/8 px-2 py-0.5 text-xs font-bold text-forest">
                      {p._count?.topics ?? 0}
                    </span>
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

/* ── department filieres, compact ─────────────────────────── */
function FiliereCell({ filieres }: { filieres?: Filiere[] }) {
  const { t } = useTranslation();
  const list = filieres ?? [];
  if (list.length === 0) return <span>{"\u2014"}</span>;
  const shown = list.slice(0, 2).map((f) => f.name);
  const extra = list.length - shown.length;
  return (
    <span className="text-xs leading-relaxed">
      {shown.join(t("admin.comma"))}
      {extra > 0 && <span className="text-clay/70"> +{extra}</span>}
    </span>
  );
}

/* ── string[] → small pills ───────────────────────────────── */
function TagPills({ items, tint }: { items?: string[]; tint: string }) {
  const list = items ?? [];
  if (list.length === 0) return <span className="text-clay">{"\u2014"}</span>;
  return (
    <div className="flex max-w-40 flex-wrap gap-1">
      {list.map((tg) => (
        <span
          key={tg}
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tint}`}
        >
          {tg}
        </span>
      ))}
    </div>
  );
}

/* ── labeled select ───────────────────────────────────────── */
function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-clay">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
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

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-forest/8 px-2.5 py-1 text-[11px] text-forest">
      {label}
      <button onClick={onClear} className="text-clay hover:text-red-500">
        <X size={12} />
      </button>
    </span>
  );
}
