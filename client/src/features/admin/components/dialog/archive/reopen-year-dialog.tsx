import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArchiveRestore, Check, Info, Loader2, Star } from "lucide-react";

import { FormDialog } from "../../form/form-dialog";
import { useReopenYear } from "../../../hooks/admin-hook";
import type { ArchiveYear } from "../../../../../types/admin";

/**
 * Reopening a closed year: its frozen record gives way to the live rows
 * again, and it takes new work — for a correction, a late grade, a student
 * who was forgotten. It can be made the current year at the same time.
 */
export function ReopenYearDialog({
  open,
  onClose,
  year,
  currentTitle,
}: {
  open: boolean;
  onClose: () => void;
  year: ArchiveYear;
  /** The year that is current now, if there is one. */
  currentTitle?: string | null;
}) {
  if (!open) return null;
  return <Body onClose={onClose} year={year} currentTitle={currentTitle} />;
}

function Body({ onClose, year, currentTitle }: { onClose: () => void; year: ArchiveYear; currentTitle?: string | null }) {
  const { t } = useTranslation();
  const reopen = useReopenYear();
  // With no current year, the reopened one naturally becomes it.
  const [activate, setActivate] = useState(!currentTitle);

  function close() {
    if (reopen.isPending) return;
    onClose();
  }

  return (
    <FormDialog
      open
      onClose={close}
      title={t("admin.yearArchive.reopen.title", { year: year.title })}
      subtitle={t("admin.yearArchive.reopen.subtitle")}
      icon={ArchiveRestore}
      size="md"
      footer={
        <>
          <button
            type="button"
            disabled={reopen.isPending}
            data-testid="reopen-year-confirm"
            onClick={() => reopen.mutate({ id: year.id, activate }, { onSuccess: () => onClose() })}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft disabled:opacity-50"
          >
            {reopen.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArchiveRestore size={16} />}
            {t("admin.yearArchive.reopen.confirm")}
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ul className="space-y-2 text-[12.5px] text-forest">
          {[t("admin.yearArchive.reopen.effectLive"), t("admin.yearArchive.reopen.effectOpen"), t("admin.yearArchive.reopen.effectCloseAgain")].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              {line}
            </li>
          ))}
        </ul>

        <div className="flex items-start gap-2.5 rounded-xl border border-sky-300/50 bg-sky-500/5 p-3 text-[11.5px] leading-relaxed text-forest">
          <Info size={15} className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-300" />
          {t("admin.yearArchive.reopen.snapshotNote")}
        </div>

        <button
          type="button"
          role="checkbox"
          aria-checked={activate}
          onClick={() => setActivate((v) => !v)}
          data-testid="reopen-year-activate"
          className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-start transition ${
            activate ? "border-gold/60 bg-gold/10" : "border-forest/15 hover:bg-forest/5"
          }`}
        >
          <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition ${activate ? "border-gold bg-gold text-forest-deep" : "border-forest/25"}`}>
            {activate && <Check size={13} strokeWidth={3} />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-forest">
              <Star size={14} className="text-gold" />
              {t("admin.yearArchive.reopen.activate")}
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-relaxed text-clay">
              {currentTitle
                ? t("admin.yearArchive.reopen.activateHint", { current: currentTitle })
                : t("admin.yearArchive.reopen.activateHintNone")}
            </span>
          </span>
        </button>
      </div>
    </FormDialog>
  );
}
