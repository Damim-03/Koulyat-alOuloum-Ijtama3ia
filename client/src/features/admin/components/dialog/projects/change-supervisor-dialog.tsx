import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowDown, BellRing, Loader2, UserCog } from "lucide-react";

import { FormDialog } from "../../form/form-dialog";
import { useChangeSupervisor } from "../../../hooks/admin-hook";
import { ProfessorPicker } from "../../ui/professor-picker";
import { UserAvatar } from "../../../../../components/ui/user-avatar";
import { personName } from "../../../../../lib/person-name";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Hands a project to another supervisor.
 *
 * This lived in a small dialog as a `<select>` of the first hundred
 * professors, beside a copy of the milestone list. It is a decision about one
 * person, so it gets a searchable picker, the current supervisor beside the
 * new one, and a word about what else it touches: both professors are
 * notified, and a jury seat still held by the old supervisor stays theirs
 * until the defence is edited.
 */
export function ChangeSupervisorDialog({
  open,
  onClose,
  groupId,
  current,
  committeeSeatHeldByCurrent,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  current?: any;
  /** The current supervisor sits on the jury in the supervisor seat. */
  committeeSeatHeldByCurrent?: boolean;
}) {
  const { t } = useTranslation();
  const change = useChangeSupervisor();
  const [next, setNext] = useState("");
  const same = !!next && next === current?.id;

  function close() {
    if (change.isPending) return;
    setNext("");
    onClose();
  }

  return (
    <FormDialog
      open={open}
      onClose={close}
      title={t("admin.changeSupervisor")}
      subtitle={t("admin.proj.supervisorForm.subtitle")}
      icon={UserCog}
      size="md"
      footer={
        <>
          <button
            type="button"
            disabled={!next || same || change.isPending}
            data-testid="supervisor-save"
            onClick={() =>
              change.mutate(
                { id: groupId, professorId: next },
                {
                  onSuccess: () => {
                    setNext("");
                    onClose();
                  },
                },
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {change.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserCog size={16} />}
            {t("admin.proj.supervisorForm.confirm")}
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
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-clay">{t("admin.proj.supervisorForm.current")}</p>
          <div className="flex items-center gap-3 rounded-xl border border-forest/10 bg-cream-2 p-3">
            <UserAvatar user={current?.user} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-forest">
                {personName(current?.user) || "—"}
              </p>
              <p className="truncate text-[11px] text-clay" dir="ltr">
                {current?.universityEmail ?? current?.user?.email ?? ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center text-clay">
          <ArrowDown size={18} />
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium text-clay">{t("admin.proj.supervisorForm.next")}</p>
          <ProfessorPicker value={next} onChange={setNext} />
          {same && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
              {t("admin.proj.supervisorForm.same")}
            </p>
          )}
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-forest/5 px-3 py-2.5 text-[11px] leading-relaxed text-clay">
          <BellRing size={13} className="mt-0.5 shrink-0 text-gold" />
          {t("admin.proj.supervisorForm.notify")}
        </p>
        {committeeSeatHeldByCurrent && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {t("admin.proj.supervisorForm.committeeSeat")}
          </p>
        )}
      </div>
    </FormDialog>
  );
}
