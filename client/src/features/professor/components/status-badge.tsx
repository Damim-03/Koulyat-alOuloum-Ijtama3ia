import { useTranslation } from "react-i18next";

const STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  accepted: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  overdue: "bg-red-100 text-red-700",
  open: "bg-sky-100 text-sky-700",
  in_progress: "bg-sky-100 text-sky-700",
  full: "bg-violet-100 text-violet-700",
  archived: "bg-gray-200 text-gray-600",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        STYLES[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}