import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  X,
  Users as UsersIcon,
  SlidersHorizontal,
  ChevronLeft,
} from "lucide-react";
import { useUsers } from "../hooks/admin-hook";
import { UserFormDialog } from "../components/user-form-dialog";
import type { UserLite } from "../../../types/admin";

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}
function fullName(u: UserLite) {
  return (
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    u.username ||
    u.email ||
    "\u2014"
  );
}

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
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [verified, setVerified] = useState(""); // "" | "true" | "false"
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  // debounced search term
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // reset to page 1 whenever any filter changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, role, status, verified, sort]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      role: role || undefined,
      status: status || undefined,
      // these two are sent as-is; backend may ignore them until wired
      isVerified: verified || undefined,
      sort,
    }),
    [page, debouncedSearch, role, status, verified, sort],
  );

  const { data, isLoading, isFetching } = useUsers(params);

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeFilters =
    (debouncedSearch ? 1 : 0) +
    (role ? 1 : 0) +
    (status ? 1 : 0) +
    (verified ? 1 : 0);

  function clearAll() {
    setSearch("");
    setRole("");
    setStatus("");
    setVerified("");
    setSort("newest");
  }

  function fmtDate(iso: string) {
    try {
      return new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(
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
      <div className="mb-4 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        {/* search row */}
        <div className="relative mb-3">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.searchUser")}
            className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-9 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-clay hover:text-forest"
            >
              <X size={16} />
            </button>
          )}
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
            label="التوثيق"
            value={verified}
            onChange={setVerified}
            options={[
              { v: "", l: "الكل" },
              { v: "true", l: "موثّق" },
              { v: "false", l: "غير موثّق" },
            ]}
          />
          <Select
            label="الترتيب"
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { v: "newest", l: "الأحدث" },
              { v: "oldest", l: "الأقدم" },
              { v: "name", l: "الاسم (أ-ي)" },
            ]}
          />
        </div>

        {/* active filters + clear */}
        {activeFilters > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-forest/10 pt-3">
            <SlidersHorizontal size={14} className="text-clay" />
            {debouncedSearch && (
              <Chip
                label={`بحث: ${debouncedSearch}`}
                onClear={() => setSearch("")}
              />
            )}
            {role && (
              <Chip
                label={`الدور: ${t(`role.${role}`)}`}
                onClear={() => setRole("")}
              />
            )}
            {status && (
              <Chip
                label={`الحالة: ${status === "active" ? "نشط" : "موقوف"}`}
                onClear={() => setStatus("")}
              />
            )}
            {verified && (
              <Chip
                label={verified === "true" ? "موثّق" : "غير موثّق"}
                onClear={() => setVerified("")}
              />
            )}
            <button
              onClick={clearAll}
              className="ms-auto inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:underline"
            >
              <X size={13} /> مسح الكل
            </button>
          </div>
        )}
      </div>

      {/* results count */}
      <div className="mb-3 flex items-center gap-2 text-sm text-clay">
        <UsersIcon size={15} />
        <span>
          {total} {total === 1 ? "مستخدم" : "مستخدم"}
        </span>
        {isFetching && (
          <span className="text-[11px] text-clay/70">· تحديث…</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.userColumn")}
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
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-clay"
                  >
                    {"\u2026"}
                  </td>
                </tr>
              )}

              {!isLoading && users.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
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
                  className="cursor-pointer transition-colors hover:bg-forest/[0.04]"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="size-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid size-9 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                          {initials(u.firstName, u.lastName)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-forest">
                          {fullName(u)}
                        </p>
                        {u.username && (
                          <p className="text-[11px] text-clay">@{u.username}</p>
                        )}
                      </div>
                    </div>
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
                    <ChevronLeft size={16} className="opacity-50" />
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
