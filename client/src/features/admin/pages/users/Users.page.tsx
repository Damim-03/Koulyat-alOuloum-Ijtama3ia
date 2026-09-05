import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  X,
  AtSign,
  IdCard,
  Users as UsersIcon,
  SlidersHorizontal,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useUsers } from "../../hooks/admin-hook";
import { UserFormDialog } from "../../components/dialog/user/user-form-dialog.form";
import { SearchField } from "../../components/ui/search-field";
import {
  ErrorDialog,
  toErrorInfo,
} from "../../../../components/dialog/error-dialog";
import { SuccessDialog } from "../../../../components/dialog/success-dialog";
import i18n from "../../../../i18n/i18n";
import { UserAvatar } from "../../../../components/ui/user-avatar";

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-gold/20 text-gold",
  admin: "bg-forest/10 text-forest",
  professor: "bg-sage/20 text-sage",
  student: "bg-soft-sage/30 text-forest",
};
const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 10;

type SortKey = "newest" | "oldest" | "name";

export function AdminUsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang } = useParams();
  const goToUser = (uid: string) => navigate(`/${lang}/admin/users/${uid}`);

  // filter inputs
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [verified, setVerified] = useState(""); // "" | "true" | "false"
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // debounced search terms
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [debouncedRegNumber, setDebouncedRegNumber] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedEmail(email.trim()), 350);
    return () => clearTimeout(id);
  }, [email]);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedRegNumber(regNumber.trim()), 350);
    return () => clearTimeout(id);
  }, [regNumber]);

  // reset to page 1 whenever any filter changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [
    debouncedSearch,
    debouncedEmail,
    debouncedRegNumber,
    role,
    status,
    verified,
    sort,
  ]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      // `search` is the person's name; the other two target one field each.
      search: debouncedSearch || undefined,
      email: debouncedEmail || undefined,
      registrationNumber: debouncedRegNumber || undefined,
      role: role || undefined,
      status: status || undefined,
      // these two are sent as-is; backend may ignore them until wired
      isVerified: verified || undefined,
      sort,
    }),
    [
      page,
      debouncedSearch,
      debouncedEmail,
      debouncedRegNumber,
      role,
      status,
      verified,
      sort,
    ],
  );

  const { data, isLoading, isFetching, error, refetch } = useUsers(params);

  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErrorDialogOpen(true);
    }
  }, [error]);

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeFilters =
    (debouncedSearch ? 1 : 0) +
    (debouncedEmail ? 1 : 0) +
    (debouncedRegNumber ? 1 : 0) +
    (role ? 1 : 0) +
    (status ? 1 : 0) +
    (verified ? 1 : 0);

  function clearAll() {
    setSearch("");
    setEmail("");
    setRegNumber("");
    setRole("");
    setStatus("");
    setVerified("");
    setSort("newest");
  }

  function fmtDate(iso: string) {
    try {
      return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
        new Date(iso),
      );
    } catch {
      return iso;
    }
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("admin.usersTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">{t("admin.usersSubtitle")}</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
        >
          <Plus size={18} />
          {t("admin.addUser")}
        </button>
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
              ? "max-h-175 border-t border-forest/10 p-4"
              : "max-h-0"
          }`}
        >
          {/* search row: one field per identifier an admin might have */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <SearchField
              icon={Search}
              label={t("admin.searchByName")}
              placeholder={t("admin.searchByNamePlaceholder")}
              value={search}
              onChange={setSearch}
            />
            <SearchField
              icon={AtSign}
              label={t("admin.searchByEmail")}
              placeholder={t("admin.searchByEmailPlaceholder")}
              value={email}
              onChange={setEmail}
            />
            <SearchField
              icon={IdCard}
              label={t("admin.searchByRegNumber")}
              hint={t("admin.searchByRegNumberHint")}
              placeholder={t("admin.searchByRegNumberPlaceholder")}
              value={regNumber}
              onChange={setRegNumber}
            />
          </div>

          {/* selects row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Select
              label={t("admin.role")}
              value={role}
              onChange={setRole}
              options={[
                { v: "", l: t("admin.allRoles") },
                { v: "owner", l: t("role.owner") },
                { v: "admin", l: t("role.admin") },
                { v: "professor", l: t("role.professor") },
                { v: "student", l: t("role.student") },
              ]}
            />

            <Select
              label={t("admin.statusLabel")}
              value={status}
              onChange={setStatus}
              options={[
                { v: "", l: t("admin.allStatuses") },
                { v: "active", l: t("admin.statusActive") },
                { v: "suspended", l: t("admin.statusSuspended") },
              ]}
            />

            <Select
              label={t("admin.verificationColumn")}
              value={verified}
              onChange={setVerified}
              options={[
                { v: "", l: t("pro.all") },
                { v: "true", l: t("admin.verified") },
                { v: "false", l: t("admin.unverified") },
              ]}
            />

            <Select
              label={t("pro.order")}
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { v: "newest", l: t("admin.sortNewest") },
                { v: "oldest", l: t("admin.sortOldest") },
                { v: "name", l: t("admin.sortNameAlpha") },
              ]}
            />
          </div>

          {/* active filters + clear */}
          {activeFilters > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-forest/10 pt-3">
              <SlidersHorizontal size={14} className="text-clay" />

              {debouncedSearch && (
                <Chip
                  label={`${t("admin.chipName")}: ${debouncedSearch}`}
                  onClear={() => setSearch("")}
                />
              )}

              {debouncedEmail && (
                <Chip
                  label={`${t("admin.chipEmail")}: ${debouncedEmail}`}
                  onClear={() => setEmail("")}
                />
              )}

              {debouncedRegNumber && (
                <Chip
                  label={`${t("admin.chipRegNumber")}: ${debouncedRegNumber}`}
                  onClear={() => setRegNumber("")}
                />
              )}

              {role && (
                <Chip
                  label={t("admin.chipRole", { value: t(`role.${role}`) })}
                  onClear={() => setRole("")}
                />
              )}

              {status && (
                <Chip
                  label={t("admin.chipStatus", {
                    value:
                      status === "active"
                        ? t("admin.statusActive")
                        : t("admin.statusSuspended"),
                  })}
                  onClear={() => setStatus("")}
                />
              )}

              {verified && (
                <Chip
                  label={verified === "true" ? t("admin.verified") : t("admin.unverified")}
                  onClear={() => setVerified("")}
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

      {/* results count */}
      <div className="mb-3 flex items-center gap-2 text-sm text-clay">
        <UsersIcon size={15} />
        <span>
          {total} {total === 1 ? t("admin.userWord") : t("admin.userWord")}
        </span>
        {isFetching && (
          <span className="text-[11px] text-clay/70">{t("admin.refreshingSuffix")}</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="w-20 px-5 py-3 text-xs font-medium">
                  {t("admin.avatarColumn")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.firstName")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.lastName")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.username")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.email")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.role")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.statusLabel")}
                </th>
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.createdAt")}
                </th>
                <th className="w-10 px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-10 text-center text-sm text-clay"
                  >
                    {"\u2026"}
                  </td>
                </tr>
              )}

              {!isLoading && users.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-sm text-clay"
                  >
                    {t("admin.noUsers")}
                  </td>
                </tr>
              )}

              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => goToUser(u.id)}
                  className="cursor-pointer transition-colors hover:bg-forest/4"
                >
                  <td className="px-5 py-3.5">
                    <UserAvatar user={u} size={36} />
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-forest">
                    {u.firstName ?? "\u2014"}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-forest">
                    {u.lastName ?? "\u2014"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay" dir="ltr">
                    {u.username ? `@${u.username}` : "\u2014"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay" dir="ltr">
                    {u.email ?? "\u2014"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_STYLES[u.role] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {t(`role.${u.role}`, { defaultValue: u.role })}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[u.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {t(
                        u.status === "active"
                          ? "admin.statusActive"
                          : "admin.statusSuspended",
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay">
                    {fmtDate(u.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-clay">
                    <ChevronLeft size={16} className="opacity-50 ltr:rotate-180" />
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

      <UserFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />

      <SuccessDialog
        title={t("toast.userCreated")}
        message={t("toast.accountCreated")}
        open={false}
        onClose={function (): void {
          throw new Error("Function not implemented.");
        }}
      />

      <ErrorDialog
        open={errorDialogOpen}
        error={error ? toErrorInfo(error) : null}
        onClose={() => setErrorDialogOpen(false)}
        onRetry={() => {
          setErrorDialogOpen(false);
          refetch();
        }}
      />
    </div>
  );
}

/* ── labeled select ───────────────────────────────────────── */
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
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
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ── active-filter chip ───────────────────────────────────── */
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
