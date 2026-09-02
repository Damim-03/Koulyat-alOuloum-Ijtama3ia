/** Anything in the hierarchy that carries a unique code. */
interface Coded {
  id: string;
  code?: string | null;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Suggests a code in the shape the platform already uses: one prefix letter
 * plus three capitals (FST, DSOC…), avoiding codes that are already taken.
 *
 * This is a convenience, not a guarantee — the server's `@unique` constraint
 * stays the real arbiter, and the admin can always type their own.
 *
 * @param prefix   letter that marks the level (F faculty, D department, …)
 * @param existing rows to avoid colliding with
 * @param selfId   the row being edited, so its own code is not "taken"
 */
export function generateCode(
  prefix: string,
  existing: Coded[],
  selfId?: string,
): string {
  const taken = new Set(
    existing
      .filter((e) => e.id !== selfId)
      .map((e) => (e.code ?? "").toUpperCase()),
  );

  // Four letters give 17,576 codes per prefix; the loop is bounded anyway so a
  // saturated prefix returns a candidate rather than spinning forever.
  for (let attempt = 0; attempt < 200; attempt++) {
    let rest = "";
    for (let i = 0; i < 3; i++)
      rest += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const code = prefix + rest;
    if (!taken.has(code)) return code;
  }
  return prefix + Date.now().toString(36).slice(-3).toUpperCase();
}
