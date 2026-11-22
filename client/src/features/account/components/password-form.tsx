import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, KeyRound, Lightbulb, Lock, MonitorSmartphone, X } from "lucide-react";
import type { MyAccount } from "../../../types/account";
import { useChangeMyPassword } from "../account.api";
import {
  ownerOf,
  passwordChecks,
  passwordIssue,
  passwordIssueText,
  passwordLevel,
  type PasswordOwner,
} from "../lib/password-rules";
import { Field, PrimaryBtn, Secret } from "./form-bits";

/** The rules a new password must meet, as a checklist under the field. */
const RULES = ["length", "mix", "notCommon", "notPersonal"] as const;

/**
 * How strong a new password is, and the server's rules ticked off one by one
 * (lib/password-rules) — under the field on the account page, and on the
 * student's activation form.
 */
export function PasswordChecklist({ value, owner }: { value: string; owner: PasswordOwner }) {
  const { t } = useTranslation();
  const checks = passwordChecks(value, owner);
  const level = passwordLevel(value, owner);
  const LEVEL = [
    { label: "—", bar: "bg-forest/10", text: "text-clay" },
    { label: t("admin.account.password.weak"), bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-300" },
    { label: t("admin.account.password.fair"), bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-300" },
    { label: t("admin.account.password.good"), bar: "bg-sky-500", text: "text-sky-600 dark:text-sky-300" },
    { label: t("admin.account.password.strong"), bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-300" },
  ];
  return (
    <div className="rounded-3xl border border-forest/10 bg-cream-2/40 p-5">
      <div className="mb-3 flex items-center justify-between text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 text-clay">
          <Lock size={14} className="text-gold" />
          {t("admin.account.password.strength")}
        </span>
        <b className={LEVEL[level].text} data-testid="acc-pw-level">{LEVEL[level].label}</b>
      </div>
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-2 rounded-full transition-colors duration-300 ${i <= level ? LEVEL[level].bar : "bg-forest/10"}`} />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-2">
        {RULES.map((k) => {
          const pass = !!value && checks[k];
          return (
            <li key={k} className={`flex items-center gap-2 ${pass ? "text-emerald-700 dark:text-emerald-300" : "text-clay"}`}>
              <span className={`grid size-5 shrink-0 place-items-center rounded-full ${pass ? "bg-emerald-500/15" : "bg-forest/6"}`}>
                {pass ? <Check size={12} /> : <X size={11} className="opacity-60" />}
              </span>
              {t(`admin.account.password.rule.${k}`)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Changing the password — on the account page, and on the screen that asks
 * for it before anything else when the administration handed it out.
 *
 * The checklist is the server's own policy (lib/password-rules): a password
 * that ticks every line is one the server will take.
 */
export function PasswordForm({ a, onChanged, compact }: { a: MyAccount; onChanged?: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const change = useChangeMyPassword();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const owner = ownerOf(a);
  const issue = next ? passwordIssue(next, owner) : null;
  const ok = !!cur && !!next && !issue && again === next && next !== cur;
  const newError = next && next === cur ? t("admin.account.err.samePassword") : passwordIssueText(t, next, issue);

  return (
    <form
      className={compact ? "space-y-4" : "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        change.mutate(
          { currentPassword: cur, newPassword: next },
          {
            onSuccess: () => {
              setCur("");
              setNext("");
              setAgain("");
              onChanged?.();
            },
          },
        );
      }}
    >
      <div className="space-y-4">
        <Field label={t("admin.account.currentPassword")}>
          <Secret value={cur} onChange={setCur} autoComplete="current-password" testId="acc-pw-current" />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("admin.account.password.new")} error={newError}>
            <Secret value={next} onChange={setNext} autoComplete="new-password" testId="acc-pw-new" />
          </Field>
          <Field
            label={t("admin.account.password.confirm")}
            error={again && again !== next ? t("admin.account.err.mismatch") : undefined}
            hint={again && again === next && next ? t("admin.account.password.matches") : undefined}
          >
            <Secret value={again} onChange={setAgain} autoComplete="new-password" testId="acc-pw-again" />
          </Field>
        </div>

        <PasswordChecklist value={next} owner={owner} />

        <div className="flex flex-wrap items-center gap-3">
          <p className="flex flex-1 items-start gap-2 text-[12px] leading-relaxed text-clay">
            <MonitorSmartphone size={15} className="mt-0.5 shrink-0 text-gold" />
            {t("admin.account.password.othersOut")}
          </p>
          <PrimaryBtn type="submit" disabled={!ok} busy={change.isPending} icon={KeyRound} testId="acc-pw-submit">
            {t("admin.account.password.submit")}
          </PrimaryBtn>
        </div>
      </div>

      {!compact && (
        <aside className="h-fit rounded-3xl border border-gold/25 bg-gold/5 p-5">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-forest">
            <Lightbulb size={16} className="text-gold" />
            {t("admin.account.password.tipsTitle")}
          </p>
          <ul className="space-y-2.5 text-[12px] leading-relaxed text-forest/85">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                {t(`admin.account.password.tip${n}`)}
              </li>
            ))}
          </ul>
        </aside>
      )}
    </form>
  );
}
