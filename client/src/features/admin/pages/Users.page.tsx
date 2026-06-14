import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { useUsers, useSetUserStatus, useDeleteUser } from "../hooks/admin-hook";
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

export function AdminUsersPage() {
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<{
    search?: string;
    role?: string;
    status?: string;
  }>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useUsers({ page, limit: PAGE_SIZE, ...applied });
  const setUserStatus = useSetUserStatus();
  const deleteUser = useDeleteUser();

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applyFilters() {
    setApplied({
      search: search || undefined,
      role: role || undefined,
      status: status || undefined,
    });
    setPage(1);
  }

  function toggleStatus(u: UserLite) {
    setUserStatus.mutate({
      id: u.id,
      status: u.status === "active" ? "suspended" : "active",
    });
  }

  function handleDelete(u: UserLite) {
    if (confirm(t("admin.confirmDeleteUser", { name: fullName(u) }))) {
      deleteUser.mutate(u.id);
    }
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
      <div className="mb-6 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder={t("admin.searchUser")}
              className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </div>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("admin.allRoles")}</option>
            <option value="owner">{t("role.owner")}</option>
            <option value="admin">{t("role.admin")}</option>
            <option value="professor">{t("role.professor")}</option>
            <option value="student">{t("role.student")}</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value="">{t("admin.allStatuses")}</option>
            <option value="active">{t("admin.statusActive")}</option>
            <option value="suspended">{t("admin.statusSuspended")}</option>
          </select>

          <button
            onClick={applyFilters}
            className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
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
                <th className="px-5 py-3 text-xs font-medium">
                  {t("admin.actions")}
                </th>
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
                  className="transition-colors hover:bg-forest/[0.03]"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                        {initials(u.firstName, u.lastName)}
                      </div>
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
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        title={t("admin.edit")}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        title={t("admin.resetPassword")}
                      >
                        <KeyRound size={16} />
                      </button>
                      <button
                        onClick={() => toggleStatus(u)}
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                        title={
                          u.status === "active"
                            ? t("admin.suspend")
                            : t("admin.activate")
                        }
                      >
                        {u.status === "active" ? (
                          <Ban size={16} />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
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

      <UserFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
