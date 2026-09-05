import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Search, X, Check } from "lucide-react";

import { useProfessors } from "../../hooks/admin-hook";
import { UserAvatar } from "./user-avatar";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Supervisor picker.
 *
 * A plain <select> could only ever show one page of professors, and the list
 * endpoint caps `limit` at 100 — so on a faculty with more staff the person
 * you wanted simply was not in the list, with nothing on screen to say so.
 *
 * This searches on the server instead (`quickSearch`, which matches name,
 * university email, username, account email and employee number), so the
 * whole roster is reachable however the user happens to remember the person.
 * Opening it without typing still shows the first page to browse.
 */

interface Props {
  value: string;
  onChange: (professorId: string) => void;
  className?: string;
}

function fullName(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ");
}
export function ProfessorPicker({ value, onChange, className = "" }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(id);
  }, [term]);

  // Close on an outside click, the same behaviour a native select has.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // 100 is the server's ceiling for `limit`; asking for more is rejected
  // outright, which is what made this list come back empty.
  const { data, isFetching } = useProfessors({
    page: 1,
    limit: 100,
    quickSearch: debounced || undefined,
  });
  const results = (data?.items ?? []) as any[];

  // The chosen professor may not be in the current result page, so it is
  // looked up separately and never disappears while searching.
  const { data: selectedData } = useProfessors(
    value ? { page: 1, limit: 100 } : undefined,
  );
  const selected = useMemo(
    () => ((selectedData?.items ?? []) as any[]).find((p) => p.id === value),
    [selectedData, value],
  );

  const label = selected
    ? fullName(selected.user) || selected.universityEmail
    : "";

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      {/* trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-[46px] w-full items-center justify-between gap-2 rounded-xl border border-forest/15 bg-cream px-3 py-2 text-start text-sm outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20"
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <UserAvatar user={selected.user} size={26} />
            <span className="min-w-0">
              <span className="block truncate text-forest">{label}</span>
              {(selected.universityEmail || selected.user?.username) && (
                <span
                  className="block truncate text-[10.5px] text-clay"
                  dir="ltr"
                >
                  {selected.universityEmail || selected.user?.username}
                </span>
              )}
            </span>
          </span>
        ) : (
          <span className="truncate text-clay">
            {t("admin.selectProfessor")}
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={0}
              aria-label={t("admin.clearSelection")}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange("");
                }
              }}
              className="grid size-5 place-items-center rounded text-clay transition hover:bg-forest/10 hover:text-forest"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-clay transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* panel */}
      {open && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-forest/15 bg-cream-card shadow-[0_12px_32px_rgba(38,66,61,0.18)]">
          <div className="relative border-b border-forest/10 p-2">
            <Search
              className="absolute top-1/2 end-4 -translate-y-1/2 text-clay"
              size={15}
            />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t("admin.searchProfessorAny")}
              className="w-full rounded-lg border border-forest/15 bg-cream py-1.5 pe-8 ps-2.5 text-sm text-forest outline-none transition focus:border-sage"
            />
          </div>

          <div role="listbox" className="max-h-60 overflow-y-auto">
            {isFetching && results.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-clay">{"…"}</p>
            )}
            {!isFetching && results.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-clay">
                {t("admin.noProfessors")}
              </p>
            )}
            {results.map((p) => {
              const isSel = p.id === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setTerm("");
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-start transition hover:bg-forest/5 ${
                    isSel ? "bg-gold/10" : ""
                  }`}
                >
                  <UserAvatar user={p.user} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-forest">
                      {fullName(p.user) || "—"}
                    </span>
                    <span
                      className="block truncate text-[11px] text-clay"
                      dir="ltr"
                    >
                      {p.universityEmail || p.user?.username || ""}
                    </span>
                  </span>
                  {isSel && (
                    <Check size={15} className="shrink-0 text-gold" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
