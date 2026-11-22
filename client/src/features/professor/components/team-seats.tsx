import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, Search, SendHorizontal, Star, X } from "lucide-react";
import { useSearchStudents } from "../hooks/Professor-hook";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { StudentOptions, type StudentOption } from "../../../components/ui/student-options";
import type { StudentSearchHit } from "../../../types/professor.types";
import { personName } from "../../../lib/person-name";

/**
 * فريق الأستاذ المقترَح — مقعدٌ مرقَّمٌ لكلّ طالبٍ يسمح به الموضوع، كمقاعد
 * الإدارة في «إنشاء موضوع وإسناده» (features/admin/components/ui/student-seat).
 *
 * والمقعد الشاغر يُملأ بثلاث طرقٍ في الحقل نفسه: رقمُ التسجيل؛ أو حروفٌ من
 * الاسم واللقب — حرفٌ أو حرفان، بأيّ ترتيب —؛ أو القائمة، تُفتح بالضغط على
 * الحقل أو زرّها، فتعرض طلبة تخصّص الموضوع الأحرار وحدهم ويضيّقها ما يُكتب.
 * والمقعد المملوء يقول من فيه، ونجمتُه تجعله المرسِل، وزرّه يُفرغه.
 *
 * ورقمٌ كُتب كاملاً ولم يجده البحث يُستعمل كما كُتب إن شاء: الخادم يتحقّق من
 * كلّ رقمٍ عند الإرسال ويسمّي ما لا وجود له، فلا تكون القائمة الطريق الوحيد.
 */

export interface PickedStudent {
  registrationNumber: string;
  name: string;
  /** The face, when the search gave it. */
  user?: unknown;
}

const DIGITS = /^[0-9٠-٩۰-۹]{2,}$/;

const nameOf = (hit: StudentSearchHit) => personName(hit.user) || hit.registrationNumber;

export function TeamSeats({
  value,
  onChange,
  max,
  leader,
  onLeader,
  specializationId,
  specializationName,
}: {
  value: PickedStudent[];
  onChange: (next: PickedStudent[]) => void;
  max: number;
  /** The sender's registration number. */
  leader: string;
  onLeader: (reg: string) => void;
  /** The topic's specialization: the list is its students. */
  specializationId?: string;
  specializationName?: string;
}) {
  const chosen = value.map((v) => v.registrationNumber);
  // A team larger than the seats (the number changed after) still shows whom it has.
  const count = Math.max(max, value.length);
  return (
    <ol className="space-y-2.5" data-testid="team-seats">
      {Array.from({ length: count }, (_, i) => {
        const s = value[i];
        return s ? (
          <FilledSeat
            key={s.registrationNumber}
            n={i + 1}
            student={s}
            isLeader={leader === s.registrationNumber}
            onLeader={() => onLeader(s.registrationNumber)}
            onRemove={() => onChange(value.filter((v) => v.registrationNumber !== s.registrationNumber))}
          />
        ) : (
          // Remounted as the team changes: what was typed in an empty seat does not stay behind.
          <EmptySeat
            key={`empty-${i}-${value.length}`}
            n={i + 1}
            chosen={chosen}
            specializationId={specializationId}
            specializationName={specializationName}
            onPick={(p) => onChange([...value, p])}
          />
        );
      })}
    </ol>
  );
}

function SeatNumber({ n, filled }: { n: number; filled: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-9 shrink-0 place-items-center rounded-full font-serif text-sm font-bold tabular-nums ${
        filled ? "bg-gold/20 text-gold" : "bg-forest/8 text-forest/70"
      }`}
    >
      {n}
    </span>
  );
}

function FilledSeat({
  n,
  student,
  isLeader,
  onLeader,
  onRemove,
}: {
  n: number;
  student: PickedStudent;
  isLeader: boolean;
  onLeader: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li
      data-testid={`team-seat-${n}`}
      data-filled="true"
      className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
        isLeader ? "border-gold/50 bg-gold/5" : "border-forest/10 bg-cream-2/40"
      }`}
    >
      <SeatNumber n={n} filled />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar user={student.user ?? {}} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-forest">{student.name}</span>
            {isLeader && (
              <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[9.5px] font-bold text-gold">{t("pro.leader")}</span>
            )}
          </span>
          <span className="block truncate text-[11px] text-clay" dir="ltr">
            {student.registrationNumber}
          </span>
        </span>
        {isLeader ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold/20 text-gold" title={t("pro.leader")}>
            <SendHorizontal size={15} />
          </span>
        ) : (
          <button
            type="button"
            onClick={onLeader}
            aria-label={t("admin.setLeader")}
            title={t("admin.setLeader")}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-gold/10 hover:text-gold"
          >
            <Star size={15} />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("admin.removeCover")}
        title={t("admin.removeCover")}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-brick/10 hover:text-brick"
      >
        <X size={15} />
      </button>
    </li>
  );
}

/**
 * An empty seat: the field, and under it the list — the specialization's free
 * students, narrowed by what is typed. Arrows and Enter pick; Escape closes;
 * a press outside closes.
 */
function EmptySeat({
  n,
  chosen,
  specializationId,
  specializationName,
  onPick,
}: {
  n: number;
  chosen: string[];
  specializationId?: string;
  specializationName?: string;
  onPick: (s: PickedStudent) => void;
}) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLLIElement | null>(null);
  const listId = useId();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(id);
  }, [term]);

  // A press anywhere outside the seat closes its list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const { data, isFetching } = useSearchStudents(debounced, specializationId, open);
  const hits = data?.students ?? [];
  const options: StudentOption[] = hits
    .filter((h) => !chosen.includes(h.registrationNumber))
    .map((h) => ({ id: h.id, reg: h.registrationNumber, name: nameOf(h), user: h.user, specialization: h.specialization?.name }));
  const total = Math.max(options.length, (data?.total ?? 0) - (hits.length - options.length));
  const showList = open && (debounced.length > 0 || !!specializationId);

  const typed = term.trim();
  // A number typed in full that the search does not offer: used as typed, if he wants — checked on submit.
  const typedIsNew =
    DIGITS.test(typed) && debounced === typed && !isFetching && !chosen.includes(typed) && !hits.some((h) => h.registrationNumber === typed);

  const pick = (o: StudentOption) => onPick({ registrationNumber: o.reg, name: o.name, user: o.user });

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && showList && options[active]) {
      e.preventDefault();
      pick(options[active]);
    }
  }

  return (
    <li ref={box} data-testid={`team-seat-${n}`} className="flex items-start gap-3 rounded-2xl border border-forest/10 bg-cream-2/40 p-3">
      <SeatNumber n={n} filled={false} />
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-[1.3rem] -translate-y-1/2 text-clay ltr:left-3 rtl:right-3" size={16} />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={t("admin.seatLabel", { n })}
          placeholder={t("pro.searchStudentToPropose")}
          dir="auto"
          className="h-[2.6rem] w-full rounded-xl border border-forest/15 bg-cream py-2 text-sm text-forest outline-none transition placeholder:text-clay/50 focus:border-gold focus:ring-2 focus:ring-gold/30 ltr:pr-10 ltr:pl-9 rtl:pr-9 rtl:pl-10"
        />
        {/* The list without typing: the specialization's free students. */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
          aria-label={t("pro.browseStudents")}
          title={t("pro.browseStudents")}
          data-testid={`team-seat-${n}-browse`}
          className="absolute top-[1.3rem] grid size-7 -translate-y-1/2 place-items-center rounded-lg text-clay transition hover:bg-forest/6 hover:text-forest ltr:right-1.5 rtl:left-1.5"
        >
          <ChevronDown size={16} className={`transition-transform ${showList ? "rotate-180" : ""}`} />
        </button>

        {showList && (
          <StudentOptions
            id={listId}
            options={options}
            loading={isFetching}
            total={total}
            title={specializationName ? t("pro.studentsOfSpec", { spec: specializationName }) : t("pro.studentsAvailable")}
            active={active}
            onActive={setActive}
            onPick={pick}
          />
        )}

        {typedIsNew && (
          <button
            type="button"
            onClick={() => onPick({ registrationNumber: typed, name: typed })}
            className="mt-1.5 flex w-full items-center gap-2 rounded-xl border border-dashed border-gold/40 px-3 py-2 text-start text-[11px] font-medium text-gold transition hover:bg-gold/5"
          >
            <Plus size={12} />
            {t("pro.useTypedNumber", { number: typed })}
          </button>
        )}
      </div>
    </li>
  );
}
