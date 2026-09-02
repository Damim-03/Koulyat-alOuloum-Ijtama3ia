import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  ChevronDown,
  Sparkles,
  AtSign,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  useUniversityDomains,
  useCreateUniversityDomain,
  useDeleteUniversityDomain,
} from "../../hooks/admin-hook";

/** Fallback while the domain list is loading or if the request fails. */
const FALLBACK_DOMAIN = "univ-eloued.dz";

/** The backend regex for the local part: [a-zA-Z0-9._%+-]+ */
const LOCAL_PART_ALLOWED = /[^a-zA-Z0-9._%+-]/g;

//
// ─── ARABIC → LATIN (approximate, Algerian/French conventions) ───────
//

const AR_LETTERS: Record<string, string> = {
  ء: "", آ: "a", أ: "a", إ: "i", ا: "a", ب: "b", ة: "a", ت: "t", ث: "th",
  ج: "dj", ح: "h", خ: "kh", د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "ch",
  ص: "s", ض: "d", ط: "t", ظ: "dh", ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k",
  ل: "l", م: "m", ن: "n", ه: "h", و: "ou", ؤ: "o", ي: "i", ئ: "i", ى: "a",
};

const VOWELS = "aeiou";

/**
 * Common Algerian given names whose written form carries no short vowels,
 * so the letter-by-letter rules below would mangle them (محمد → "mehemed").
 * Checked first; anything not listed falls through to the general rules.
 */
const KNOWN_NAMES: Record<string, string> = {
  محمد: "mohamed", أحمد: "ahmed", احمد: "ahmed", علي: "ali", عمر: "omar",
  يوسف: "youcef", خالد: "khaled", كريم: "karim", سمير: "samir", سليم: "salim",
  ياسين: "yacine", رشيد: "rachid", سعيد: "said", حسين: "hocine", حسن: "hassan",
  إبراهيم: "brahim", ابراهيم: "brahim", مصطفى: "mustapha", عثمان: "otmane",
  عبدالله: "abdellah", عبدالرحمن: "abderrahmane", عبدالقادر: "abdelkader",
  فاطمة: "fatima", عائشة: "aicha", مريم: "meriem", سارة: "sara", أمينة: "amina",
  امينة: "amina", زينب: "zineb", نادية: "nadia", لطيفة: "latifa", نور: "nour",
  هدى: "houda", سعاد: "souad", ليلى: "leila", خديجة: "khadidja",
  بلقاسم: "belkacem", حمادي: "hammadi", زروقي: "zerrouki", مرابط: "merabet",
  بوعلام: "boualem",
};

/**
 * Arabic script omits short vowels, so a letter-by-letter map yields
 * unpronounceable clusters ("مرابط" → "mrabt"). Inserting an "e" between two
 * adjacent consonants recovers the usual spelling ("merabet"). It stays an
 * approximation — the field remains fully editable.
 */
function transliterate(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  // Already Latin? Just normalise it.
  if (!/[؀-ۿ]/.test(raw)) {
    return raw.toLowerCase().replace(LOCAL_PART_ALLOWED, "");
  }

  // Known name? Use its conventional spelling instead of the rules.
  const known = KNOWN_NAMES[raw.replace(/\s+/g, "")];
  if (known) return known;

  const pieces: string[] = [];
  for (const char of raw) {
    if (char in AR_LETTERS) pieces.push(AR_LETTERS[char]);
  }
  // A leading "ي" reads as "y", not "ou"/"i".
  if (raw[0] === "ي" && pieces[0] === "i") pieces[0] = "y";

  let out = "";
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (!piece) continue;
    const prev = out[out.length - 1];
    const startsConsonant = !VOWELS.includes(piece[0]);
    if (prev && !VOWELS.includes(prev) && startsConsonant) out += "e";
    out += piece;
  }
  return out.replace(LOCAL_PART_ALLOWED, "");
}

/** Local-part shapes offered in the menu, previewed live. */
function buildSuggestions(firstName?: string, lastName?: string): string[] {
  const first = transliterate(firstName ?? "");
  const last = transliterate(lastName ?? "");
  if (!first && !last) return [];
  if (!last) return [first];
  if (!first) return [last];

  return Array.from(
    new Set([
      `${first}.${last}`,
      `${first[0]}.${last}`,
      `${last}.${first}`,
      `${first[0]}${last}`,
    ]),
  );
}

//
// ─── COMPONENT ───────────────────────────────────────────────────────
//

export function UniversityEmailInput({
  value,
  onChange,
  firstName,
  lastName,
  placeholder = "prof",
}: {
  /** Full address, e.g. "k.merabet@univ-eloued.dz". */
  value: string;
  onChange: (next: string) => void;
  firstName?: string;
  lastName?: string;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftDomain, setDraftDomain] = useState("");
  // A picked domain has nowhere to live in `value` while the local part is
  // still empty (an address needs both halves), so remember it here or the
  // selection would snap back to the default.
  const [pickedDomain, setPickedDomain] = useState<string | null>(null);

  const { data: domains, isLoading } = useUniversityDomains();
  const createDomain = useCreateUniversityDomain();
  const deleteDomain = useDeleteUniversityDomain();

  const options = domains ?? [];
  const defaultDomain =
    options.find((d) => d.isDefault)?.domain ??
    options[0]?.domain ??
    FALLBACK_DOMAIN;

  const atIndex = value.lastIndexOf("@");
  const local = atIndex === -1 ? value : value.slice(0, atIndex);
  const domain =
    atIndex === -1 ? (pickedDomain ?? defaultDomain) : value.slice(atIndex + 1);

  const emit = (nextLocal: string, nextDomain: string) => {
    setPickedDomain(nextDomain);
    onChange(nextLocal ? `${nextLocal}@${nextDomain}` : "");
  };

  const suggestions = buildSuggestions(firstName, lastName);

  /** Adds the drafted domain and selects it for the address being edited. */
  function submitDomain() {
    const next = draftDomain.trim().replace(/^@/, "");
    if (!next) return;
    createDomain.mutate(next, {
      onSuccess: (created) => {
        emit(local, created.domain);
        setDraftDomain("");
        setAdding(false);
      },
    });
  }

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      {/* local-part | @domain | menu trigger — always read left-to-right */}
      <div
        dir="ltr"
        className="flex items-stretch overflow-hidden rounded-xl border border-forest/15 bg-cream-2 transition focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30"
      >
        <input
          value={local}
          onChange={(event) => {
            // Pasting a whole address fills both halves.
            const typed = event.target.value;
            const at = typed.lastIndexOf("@");
            if (at !== -1) {
              const pastedDomain = typed.slice(at + 1);
              emit(
                typed.slice(0, at).replace(LOCAL_PART_ALLOWED, ""),
                pastedDomain || domain,
              );
              return;
            }
            emit(typed.replace(LOCAL_PART_ALLOWED, ""), domain);
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-forest outline-none placeholder:text-clay/50"
        />
        <span className="pointer-events-none flex items-center bg-forest/5 px-2.5 text-sm font-medium text-clay">
          @{domain}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          title={t("admin.emailShapesAndDomains")}
          className="grid w-9 shrink-0 place-items-center border-l border-forest/10 bg-forest/5 text-clay transition hover:bg-gold/15 hover:text-forest"
        >
          <ChevronDown size={16} className={open ? "rotate-180" : ""} />
        </button>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onMouseDown={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-forest/15 bg-cream-card p-1 shadow-xl">
            {/* ── suggested shapes ── */}
            <p className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-[11px] font-bold text-clay">
              <Sparkles size={12} className="text-gold" />{t("admin.suggestedShapes")}</p>
            {suggestions.length === 0 ? (
              <p className="px-2 pb-2 text-[11px] leading-relaxed text-clay/80">{t("admin.suggestedShapesHint")}</p>
            ) : (
              <ul>
                {suggestions.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => {
                        emit(suggestion, domain);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                        suggestion === local ? "bg-gold/10" : "hover:bg-forest/5"
                      }`}
                    >
                      <span dir="ltr" className="flex-1 text-left text-sm text-forest">
                        {suggestion}@{domain}
                      </span>
                      {suggestion === local && (
                        <Check size={14} className="shrink-0 text-gold" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* ── domain ── */}
            <p className="mt-1 flex items-center gap-1.5 border-t border-forest/10 px-2 pt-2 pb-1 text-[11px] font-bold text-clay">
              <AtSign size={12} className="text-gold" />{t("admin.universityDomain")}</p>
            {isLoading ? (
              <p className="flex items-center gap-1.5 px-2 pb-2 text-[11px] text-clay">
                <Loader2 size={12} className="animate-spin" />{t("admin.loadingEllipsis")}</p>
            ) : (
              <ul>
                {options.map((option) => (
                  <li key={option.id} className="group/row flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        emit(local, option.domain);
                        setOpen(false);
                      }}
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                        option.domain === domain
                          ? "bg-gold/10"
                          : "hover:bg-forest/5"
                      }`}
                    >
                      <span
                        dir="ltr"
                        className="min-w-0 flex-1 truncate text-left text-sm text-forest"
                      >
                        @{option.domain}
                      </span>
                      {option.isDefault && (
                        <span className="shrink-0 rounded-full bg-forest/8 px-1.5 py-0.5 text-[10px] text-clay">{t("admin.defaultLabel")}</span>
                      )}
                      {option.domain === domain && (
                        <Check size={14} className="shrink-0 text-gold" />
                      )}
                    </button>
                    {/* الخلفية ترفض حذف نطاق مستعمَل أو آخر نطاق متبقٍّ */}
                    <button
                      type="button"
                      title={t("admin.deleteDomain")}
                      disabled={deleteDomain.isPending}
                      onClick={() => deleteDomain.mutate(option.id)}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-clay/50 opacity-0 transition hover:bg-brick/10 hover:text-brick focus:opacity-100 group-hover/row:opacity-100 disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* ── add a domain ── */}
            {adding ? (
              <div dir="ltr" className="mt-1 flex items-center gap-1 px-1 pb-1">
                <input
                  autoFocus
                  value={draftDomain}
                  onChange={(event) =>
                    setDraftDomain(
                      event.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ""),
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitDomain();
                    }
                  }}
                  placeholder={t("admin.domainPlaceholder")}
                  className="min-w-0 flex-1 rounded-lg border border-forest/15 bg-cream-2 px-2 py-1.5 text-sm text-forest outline-none focus:border-gold"
                />
                <button
                  type="button"
                  onClick={submitDomain}
                  disabled={!draftDomain || createDomain.isPending}
                  className="rounded-lg bg-gold px-2.5 py-1.5 text-xs font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-50"
                >
                  {createDomain.isPending ? "…" : t("admin.add")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setDraftDomain("");
                  }}
                  className="rounded-lg px-2 py-1.5 text-xs text-clay hover:text-forest"
                >{t("admin.cancelShort")}</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-forest transition hover:bg-gold/10"
              >
                <Plus size={14} className="text-gold" />{t("admin.addUniversityDomain")}</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
