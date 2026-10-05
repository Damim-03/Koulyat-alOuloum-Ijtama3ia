import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Award,
  CalendarClock,
  Crown,
  Gavel,
  Loader2,
  MapPin,
  Plus,
  Save,
  StickyNote,
  Trash2,
  UserCheck,
  AlertTriangle,
  Clock,
  FolderKanban,
  Search,
  X,
} from "lucide-react";

import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import {
  useAdminProjects,
  useCreateDefense,
  useDefenseConflicts,
  useUpdateDefense,
} from "../../../hooks/admin-hook";
import { UserAvatar } from "../../../../../components/ui/user-avatar";
import i18n from "../../../../../i18n/i18n";
import { ProfessorPicker } from "../../ui/professor-picker";
import { Select } from "../../../../../components/ui/select";
import { personName } from "../../../../../lib/person-name";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Schedules a project's defence, or edits the one it has — date, room, status,
 * grade, notes and the whole jury in one form.
 *
 * The old dialog asked for a project from a list of a hundred and could not
 * seat a committee at all; the jury was only reachable through the API. Here
 * the project is already known, and the committee rules the server enforces
 * (one seat per professor, one president) are checked before sending, so the
 * form says what is wrong in place instead of returning a validation string.
 */

type Role = "president" | "supervisor" | "examiner";
type Status = "scheduled" | "completed" | "cancelled";

interface Seat {
  key: number;
  professorId: string;
  role: Role;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** The project. Without it — scheduling from the defences page — the form asks for one. */
  groupId?: string;
  /** The project's supervisor, offered as a one-click supervisor seat. */
  supervisorId?: string | null;
  defense?: any | null;
  /** Opens on this status — "record the result" opens on completed. */
  initialStatus?: Status;
  onSaved?: () => void;
}

const DURATIONS = [30, 45, 60, 90, 120];

const clock = (d: Date) => d.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

/** `yyyy-MM-ddTHH:mm` in local time, which is all datetime-local accepts. */
function toLocalInput(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProjectDefenseDialog(props: Props) {
  if (!props.open) return null;
  // Mounted per opening, so the form starts from the defence as it is now.
  return <DefenseForm key={props.defense?.id ?? "new"} {...props} />;
}

function DefenseForm({ onClose, groupId, supervisorId, defense, initialStatus, onSaved }: Props) {
  const { t } = useTranslation();
  const create = useCreateDefense();
  const update = useUpdateDefense();
  const editing = !!defense;

  const [date, setDate] = useState(() => toLocalInput(defense?.date));
  const [room, setRoom] = useState<string>(defense?.room ?? "");
  const [status, setStatus] = useState<Status>(initialStatus ?? defense?.status ?? "scheduled");
  const [duration, setDuration] = useState<number>(defense?.durationMinutes ?? 60);
  // Scheduling from the defences page: the project is chosen here.
  const [project, setProject] = useState<any | null>(null);
  const projectId = groupId ?? project?.id ?? "";
  const supervisor = supervisorId ?? project?.topic?.professorId ?? null;
  const [clashOk, setClashOk] = useState(false);
  const [grade, setGrade] = useState<string>(
    defense?.grade === null || defense?.grade === undefined ? "" : String(defense.grade),
  );
  const [notes, setNotes] = useState<string>(defense?.notes ?? "");
  const [seats, setSeats] = useState<Seat[]>(() =>
    ((defense?.committee ?? []) as any[]).map((c, i) => ({
      key: i,
      professorId: c.professorId ?? c.professor?.id ?? "",
      role: c.role as Role,
    })),
  );
  const [nextKey, setNextKey] = useState<number>(() => (defense?.committee?.length ?? 0) + 1);
  // The moment the form opened — "in the past" is judged against it.
  const [openedAt] = useState(() => Date.now());
  const [submitted, setSubmitted] = useState(false);

  const busy = create.isPending || update.isPending;

  function addSeat(professorId = "", role: Role = "examiner") {
    setSeats((s) => [...s, { key: nextKey, professorId, role }]);
    setNextKey((k) => k + 1);
  }
  const setSeat = (key: number, patch: Partial<Seat>) =>
    setSeats((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  // ── checks, in the words the admin will read ──
  const errors: Record<string, string> = {};
  if (!date) errors.date = t("admin.proj.defenseForm.dateRequired");
  if (!room.trim()) errors.room = t("admin.proj.defenseForm.roomRequired");
  const g = grade.trim() === "" ? null : Number(grade);
  if (g !== null && (Number.isNaN(g) || g < 0 || g > 20)) errors.grade = t("admin.proj.defenseForm.gradeRange");

  const filled = seats.filter((s) => s.professorId);
  const ids = filled.map((s) => s.professorId);
  const dupIds = new Set(ids.filter((id, i) => ids.indexOf(id) !== i));
  if (dupIds.size) errors.committee = t("admin.proj.defenseForm.dupProfessor");
  else if (filled.filter((s) => s.role === "president").length > 1)
    errors.committee = t("admin.proj.defenseForm.onePresident");
  else if (seats.length > 7) errors.committee = t("admin.proj.defenseForm.maxSeats");

  if (!projectId) errors.project = t("admin.defensesPage.form.projectRequired");

  const hasPresident = filled.some((s) => s.role === "president");
  const supervisorSeated = !!supervisor && ids.includes(supervisor);

  // ── clashes: the same room or juror at an overlapping time, asked as you type ──
  const slotKey =
    status === "scheduled" && date
      ? JSON.stringify({ date: new Date(date).toISOString(), duration, room: room.trim(), ids: [...ids].sort() })
      : "";
  const [clashKey, setClashKey] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setClashKey(slotKey), 400);
    return () => clearTimeout(id);
  }, [slotKey]);
  const clashParams = clashKey
    ? (() => {
        const k = JSON.parse(clashKey);
        return {
          date: k.date,
          durationMinutes: k.duration,
          room: k.room || undefined,
          professorIds: k.ids.join(",") || undefined,
          excludeId: defense?.id,
        };
      })()
    : null;
  const clashes = useDefenseConflicts(clashParams);
  const clashList = slotKey ? [...(clashes.data?.room ?? []), ...(clashes.data?.professors ?? [])] : [];
  const clashBlocks = clashList.length > 0 && !clashOk;
  const ends = date ? new Date(new Date(date).getTime() + duration * 60_000) : null;
  const pastScheduled =
    status === "scheduled" && !!date && new Date(date).getTime() < openedAt;

  function submit() {
    setSubmitted(true);
    if (Object.keys(errors).length || clashBlocks) return;

    const committee = filled.map((s) => ({ professorId: s.professorId, role: s.role }));
    const base = {
      date: new Date(date).toISOString(),
      durationMinutes: duration,
      room: room.trim(),
      status,
      notes: notes.trim() || undefined,
      committee,
    };
    const done = {
      onSuccess: () => {
        onSaved?.();
        onClose();
      },
    };

    if (editing) {
      // `null` clears a grade entered by mistake; the server accepts it.
      update.mutate({ id: defense.id, data: { ...base, grade: g } }, done);
    } else {
      create.mutate({ groupId: projectId, ...base, ...(g !== null ? { grade: g } : {}) }, done);
    }
  }

  const show = (k: string) => (submitted ? errors[k] : undefined);

  return (
    <FormDialog
      open
      onClose={busy ? () => {} : onClose}
      title={editing ? t("admin.proj.defenseForm.editTitle") : t("admin.proj.defenseForm.newTitle")}
      subtitle={t("admin.proj.defenseForm.subtitle")}
      icon={Gavel}
      size="2xl"
      footer={
        <>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            data-testid="defense-save"
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {editing ? t("admin.saveChanges") : t("admin.proj.defenseForm.schedule")}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)]">
        {/* ── session ── */}
        <div className="space-y-4">
          {!groupId && (
            <ProjectPicker value={project} onChange={setProject} error={show("project")} />
          )}
          <p className="text-[11px] font-bold tracking-wide text-gold">{t("admin.proj.defenseForm.session")}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("admin.defenseDate")} icon={CalendarClock} error={show("date")}>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                dir="ltr"
                data-testid="defense-date"
                className={inputClass}
              />
            </Field>
            <Field label={t("admin.room")} icon={MapPin} error={show("room")}>
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                maxLength={120}
                placeholder={t("admin.roomPlaceholder")}
                data-testid="defense-room"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label={t("admin.defensesPage.form.duration")} icon={Clock}>
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" data-testid="defense-duration">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={duration === m}
                  onClick={() => setDuration(m)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold tabular-nums transition ${
                    duration === m ? "border-gold bg-gold/15 text-forest" : "border-forest/15 text-clay hover:bg-forest/5"
                  }`}
                >
                  {t("admin.defensesPage.form.minutes", { n: m })}
                </button>
              ))}
              {ends && (
                <span className="ms-auto text-[11.5px] text-clay tabular-nums" dir="ltr">
                  {clock(new Date(date))} → {clock(ends)}
                </span>
              )}
            </div>
          </Field>

          {clashList.length > 0 && (
            <div className="rounded-xl border border-red-300/60 bg-red-500/[0.07] p-3" data-testid="defense-clashes">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-red-700 dark:text-red-300">
                <AlertTriangle size={13} />
                {t("admin.defensesPage.form.clashTitle", { n: clashList.length })}
              </p>
              <ul className="space-y-1 text-[11.5px] text-red-700/90 dark:text-red-300/90">
                {(clashes.data?.room ?? []).map((c) => (
                  <li key={`r-${c.id}`}>
                    {t("admin.defensesPage.form.clashRoom", { room: c.room, title: c.title, time: clock(new Date(c.date)) })}
                  </li>
                ))}
                {(clashes.data?.professors ?? []).map((c) => (
                  <li key={`p-${c.id}-${c.professorId}`}>
                    {t("admin.defensesPage.form.clashProfessor", { name: c.name, title: c.title, time: clock(new Date(c.date)) })}
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11.5px] font-semibold text-forest">
                <input type="checkbox" checked={clashOk} onChange={(e) => setClashOk(e.target.checked)} className="mt-0.5 size-3.5 accent-red-600" data-testid="defense-clash-ok" />
                {t("admin.defensesPage.form.clashAck")}
              </label>
            </div>
          )}

          <Field label={t("admin.proj.defenseForm.status")} icon={Gavel}>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {(["scheduled", "completed", "cancelled"] as Status[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={status === s}
                  onClick={() => setStatus(s)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                    status === s
                      ? s === "cancelled"
                        ? "border-red-300 bg-red-500/10 text-red-600 dark:text-red-400"
                        : s === "completed"
                          ? "border-sage bg-sage/15 text-forest"
                          : "border-gold bg-gold/15 text-forest"
                      : "border-forest/15 text-clay hover:bg-forest/5"
                  }`}
                >
                  {t(`admin.proj.defenseState.${s}`)}
                </button>
              ))}
            </div>
          </Field>

          {pastScheduled && (
            <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {t("admin.proj.defenseForm.pastHint")}
            </p>
          )}

          {(status === "completed" || grade !== "") && (
            <Field
              label={t("admin.grade")}
              icon={Award}
              note={t("admin.optional")}
              hint={t("admin.proj.defenseForm.gradeHint")}
              error={show("grade")}
            >
              <input
                type="number"
                min={0}
                max={20}
                step="0.25"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                dir="ltr"
                placeholder="0 – 20"
                data-testid="defense-grade"
                className={inputClass}
              />
            </Field>
          )}

          <Field label={t("admin.notes")} icon={StickyNote} note={t("admin.optional")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t("admin.proj.defenseForm.notesPlaceholder")}
              className={`${inputClass} resize-y`}
            />
          </Field>
        </div>

        {/* ── jury ── */}
        <div className="rounded-2xl border border-forest/10 bg-cream-2/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold tracking-wide text-gold">
              {t("admin.committee")}
              <span className="ms-1.5 rounded-full bg-forest/10 px-1.5 py-0.5 text-[10px] text-forest tabular-nums">
                {seats.length}
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              {supervisor && !supervisorSeated && (
                <button
                  type="button"
                  onClick={() => addSeat(supervisor, "supervisor")}
                  className="inline-flex items-center gap-1 rounded-lg border border-forest/15 px-2.5 py-1.5 text-[11px] font-semibold text-forest transition hover:bg-forest/5"
                >
                  <UserCheck size={13} />
                  {t("admin.proj.defenseForm.seatSupervisor")}
                </button>
              )}
              <button
                type="button"
                onClick={() => addSeat("", seats.some((x) => x.role === "president") ? "examiner" : "president")}
                disabled={seats.length >= 7}
                data-testid="defense-add-seat"
                className="inline-flex items-center gap-1 rounded-lg bg-forest px-2.5 py-1.5 text-[11px] font-semibold text-cream transition hover:bg-forest-deep disabled:opacity-40"
              >
                <Plus size={13} />
                {t("admin.proj.defenseForm.addSeat")}
              </button>
            </div>
          </div>

          {seats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-forest/15 px-3 py-8 text-center text-[11px] leading-relaxed text-clay">
              {t("admin.proj.defenseForm.noSeats")}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {seats.map((s) => {
                const dup = !!s.professorId && dupIds.has(s.professorId);
                return (
                  <li
                    key={s.key}
                    className={`rounded-xl border bg-cream-card p-2.5 ${dup ? "border-red-300" : "border-forest/10"}`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-2.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                          s.role === "president" ? "bg-gold/20 text-gold" : "bg-forest/10 text-clay"
                        }`}
                      >
                        {s.role === "president" ? <Crown size={14} /> : s.role === "supervisor" ? <UserCheck size={14} /> : <Gavel size={14} />}
                      </span>
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
                        <ProfessorPicker value={s.professorId} onChange={(v) => setSeat(s.key, { professorId: v })} />
                        <Select
                          value={s.role}
                          onChange={(v) => setSeat(s.key, { role: v as Role })}
                          aria-label={t("admin.proj.defenseForm.role")}
                          options={(["president", "supervisor", "examiner"] as Role[]).map((r) => ({
                            value: r,
                            label: t(`committeeRole.${r}`),
                          }))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSeats((list) => list.filter((x) => x.key !== s.key))}
                        aria-label={t("admin.proj.defenseForm.removeSeat")}
                        className="mt-2 grid size-8 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {s.role === "supervisor" && supervisor && s.professorId && s.professorId !== supervisor && (
                      <p className="mt-2 ms-9 text-[10.5px] text-amber-700 dark:text-amber-300">
                        {t("admin.proj.defenseForm.notTheSupervisor")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {errors.committee ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-600 dark:text-red-400" data-testid="defense-committee-error">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {errors.committee}
            </p>
          ) : (
            filled.length > 0 &&
            !hasPresident && (
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                {t("admin.proj.defenseForm.noPresidentHint")}
              </p>
            )
          )}

          <p className="mt-3 border-t border-forest/10 pt-3 text-[10.5px] leading-relaxed text-clay">
            {t("admin.proj.defenseForm.notifyNote")}
          </p>
        </div>
      </div>
    </FormDialog>
  );
}

/**
 * The project a new defence is for — among those that do not have one yet,
 * found by title, student or supervisor.
 */
function ProjectPicker({
  value,
  onChange,
  error,
}: {
  value: any | null;
  onChange: (p: any | null) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(id);
  }, [term]);
  const { data, isFetching } = useAdminProjects({ defense: "none", search: debounced || undefined, limit: 6, sort: "title" });
  const items = (data?.items ?? []) as any[];

  if (value)
    return (
      <div className="rounded-2xl border border-gold/40 bg-gold/[0.07] p-3.5" data-testid="defense-project">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gold">
          <FolderKanban size={13} />
          {t("admin.project")}
        </p>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-snug font-bold text-forest">{value.topic?.title}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-clay">
              {[value.topic?.specialization?.name, personName(value.topic?.professor?.user)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button type="button" onClick={() => onChange(null)} aria-label={t("admin.defensesPage.form.changeProject")} className="grid size-7 shrink-0 place-items-center rounded-lg text-clay hover:bg-forest/10">
            <X size={14} />
          </button>
        </div>
      </div>
    );

  return (
    <div data-testid="defense-project-picker">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gold">
        <FolderKanban size={13} />
        {t("admin.defensesPage.form.pickProject")}
      </p>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-clay" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("admin.defensesPage.form.projectSearch")}
          data-testid="defense-project-search"
          className={`${inputClass} ps-9`}
        />
        {isFetching && <Loader2 size={14} className="absolute top-1/2 end-3 -translate-y-1/2 animate-spin text-clay" />}
      </div>
      <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
        {items.length === 0 && !isFetching ? (
          <li className="rounded-xl border border-dashed border-forest/15 px-3 py-4 text-center text-[12px] text-clay">
            {t("admin.defensesPage.form.noProjects")}
          </li>
        ) : (
          items.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange(p)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-start transition hover:border-gold/30 hover:bg-gold/[0.07]"
              >
                <UserAvatar user={p.topic?.professor?.user} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-forest">{p.topic?.title}</span>
                  <span className="block truncate text-[11px] text-clay">
                    {[p.topic?.specialization?.name, t("admin.defensesPage.form.members", { n: p.members?.length ?? 0 })].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
      {error && <p className="mt-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
