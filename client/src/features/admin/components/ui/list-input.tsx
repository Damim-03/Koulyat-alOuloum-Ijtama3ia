import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X, GripVertical } from "lucide-react";

/**
 * Entry for a list of short items (requirements, objectives).
 *
 * These were textareas with a "one item per line" placeholder, which is a
 * rule the field cannot enforce: nothing stopped someone typing the whole
 * list on a single line, and it was then stored as one long item with no
 * visible sign anything was wrong.
 *
 * Here every item is its own row the moment it is committed, so the shape of
 * the data is what you see. Three ways to commit, because people reach for
 * different ones: Enter, the add button, or simply moving on — a half-typed
 * item is kept on blur rather than silently discarded.
 */

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Refuses to add beyond this; the API caps these lists at 50. */
  max?: number;
}

export function ListInput({ value, onChange, placeholder, max = 50 }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const atMax = value.length >= max;

  function commit(raw: string) {
    const parts = raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;

    const next = [...value];
    for (const part of parts) {
      if (next.length >= max) break;
      // Adding the same line twice is almost always a slip, not intent.
      if (!next.includes(part)) next.push(part);
    }
    onChange(next);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // The dialogs are not <form>s, but Enter still must not bubble into a
      // step change while the user is mid-item.
      e.preventDefault();
      commit(draft);
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  /** A pasted list arrives as one blob; split it rather than store it whole. */
  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n")) return;
    e.preventDefault();
    commit(draft ? `${draft}\n${text}` : text);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="rounded-xl border border-forest/15 bg-cream p-2">
      {value.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {value.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className="group flex items-start gap-2 rounded-lg bg-cream-card px-2.5 py-2"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-forest/10 text-[10px] font-bold text-forest tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-relaxed break-words text-forest">
                {item}
              </span>
              <span className="flex shrink-0 items-center">
                {value.length > 1 && (
                  <span className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={t("admin.moveUp")}
                      className="text-clay/50 transition hover:text-forest disabled:opacity-25"
                    >
                      <GripVertical size={11} className="rotate-90" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={t("admin.removeCover")}
                  className="grid size-6 place-items-center rounded-md text-clay transition hover:bg-red-500/10 hover:text-red-500"
                >
                  <X size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={draft}
          disabled={atMax}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          // Without this, text typed but never confirmed would disappear when
          // the user simply clicked "Next".
          onBlur={() => commit(draft)}
          placeholder={atMax ? t("admin.listFull", { max }) : placeholder}
          className="w-full rounded-lg border border-forest/10 bg-cream-card px-2.5 py-2 text-sm text-forest outline-none transition focus:border-sage disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => {
            commit(draft);
            inputRef.current?.focus();
          }}
          disabled={!draft.trim() || atMax}
          aria-label={t("admin.addItem")}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-forest/10 text-forest transition hover:bg-forest/20 disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>

      <p className="mt-1.5 px-0.5 text-[10.5px] text-clay/80">
        {value.length > 0
          ? t("admin.itemsAdded", { n: value.length })
          : t("admin.addItemHint")}
      </p>
    </div>
  );
}
