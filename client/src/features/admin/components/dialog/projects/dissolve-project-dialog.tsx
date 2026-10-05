import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertOctagon, Check, FileText, Gavel, Loader2, Trash2, X } from "lucide-react";

import { FormDialog } from "../../form/form-dialog";
import { useDissolveProject } from "../../../hooks/admin-hook";

/**
 * Dissolves a project — the only way back from a group formed by mistake.
 *
 * The server refuses while the group carries submissions or a defence, and
 * the project payload now says so in advance; this dialog shows those
 * blockers instead of letting the click fail. What *will* happen is spelled
 * out too, and the reason typed here is what the students read.
 */
export function DissolveProjectDialog({
  open,
  onClose,
  onDissolved,
  groupId,
  topicTitle,
  members,
  milestones,
  blockers,
}: {
  open: boolean;
  onClose: () => void;
  onDissolved: () => void;
  groupId: string;
  topicTitle: string;
  members: number;
  milestones: number;
  blockers: { submissions: number; defense: boolean };
}) {
  const { t } = useTranslation();
  const dissolve = useDissolveProject();
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const blocked = blockers.submissions > 0 || blockers.defense;

  function close() {
    if (dissolve.isPending) return;
    setReason("");
    setSure(false);
    onClose();
  }

  return (
    <FormDialog
      open={open}
      onClose={close}
      title={t("admin.proj.dissolve.title")}
      subtitle={topicTitle}
      icon={AlertOctagon}
      size="md"
      footer={
        <>
          <button
            type="button"
            disabled={blocked || !sure || dissolve.isPending}
            data-testid="dissolve-confirm"
            onClick={() =>
              dissolve.mutate(
                { groupId, reason: reason.trim() || undefined },
                { onSuccess: () => onDissolved() },
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {dissolve.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {t("admin.proj.dissolve.confirm")}
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
        {blocked ? (
          <div className="rounded-xl border border-red-300/60 bg-red-500/10 p-4" data-testid="dissolve-blocked">
            <p className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">
              {t("admin.proj.dissolve.blockedTitle")}
            </p>
            <ul className="space-y-1.5 text-[12px] text-red-700 dark:text-red-300">
              {blockers.submissions > 0 && (
                <li className="flex items-center gap-2">
                  <FileText size={13} />
                  {t("admin.proj.dissolve.blockSubmissions", { n: blockers.submissions })}
                </li>
              )}
              {blockers.defense && (
                <li className="flex items-center gap-2">
                  <Gavel size={13} />
                  {t("admin.proj.dissolve.blockDefense")}
                </li>
              )}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-red-700/80 dark:text-red-300/80">
              {t("admin.proj.dissolve.blockedHint")}
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 text-[11px] font-bold tracking-wide text-gold">{t("admin.proj.dissolve.effects")}</p>
              <ul className="space-y-1.5 text-[12px] text-forest">
                {[
                  t("admin.proj.dissolve.effectMembers", { n: members }),
                  t("admin.proj.dissolve.effectMilestones", { n: milestones }),
                  t("admin.proj.dissolve.effectTopic"),
                  t("admin.proj.dissolve.effectNotify"),
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <X size={13} className="mt-0.5 shrink-0 text-red-500" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-forest">
                {t("admin.proj.dissolve.reason")}
                <span className="ms-1 text-[10px] font-normal text-clay">({t("admin.proj.dissolve.reasonNote")})</span>
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                data-testid="dissolve-reason"
                placeholder={t("admin.proj.dissolve.reasonPlaceholder")}
                className="w-full resize-y rounded-xl border border-forest/15 bg-cream px-3 py-2.5 text-sm text-forest outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
              />
            </label>

            <button
              type="button"
              role="checkbox"
              aria-checked={sure}
              onClick={() => setSure((v) => !v)}
              data-testid="dissolve-sure"
              className="flex w-full items-start gap-2.5 rounded-xl border border-forest/15 p-3 text-start transition hover:bg-forest/5"
            >
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition ${
                  sure ? "border-red-600 bg-red-600 text-white" : "border-forest/30"
                }`}
              >
                {sure && <Check size={13} />}
              </span>
              <span className="text-[12px] leading-relaxed text-forest">{t("admin.proj.dissolve.sure")}</span>
            </button>
          </>
        )}
      </div>
    </FormDialog>
  );
}
