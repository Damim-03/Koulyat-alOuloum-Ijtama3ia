/**
 * Name search, one word at a time.
 *
 * Each word must appear in the first name or the last name, and the caller
 * does not have to know which is which: "خالد مرابط" and "مرابط خالد" both find the same
 * person, and two letters of each ("خا مر") are enough. Matching every word
 * rather than any of them keeps a two-word query from widening the results.
 */
export const nameSearchFilter = (
  search: string,
  /** Places the name fields where the model keeps them: at the top level for
   *  User, under `user` for the records that point at one. */
  wrap: (f: Record<string, unknown>) => Record<string, unknown> = (f) => f,
) => {
  const words = search.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return {
    AND: words.map((word) => ({
      // باللاتينية أيضاً: هي الاسم الذي لا يغيب عن طالب.
      OR: [
        wrap({ firstName: { contains: word } }),
        wrap({ lastName: { contains: word } }),
        wrap({ firstNameLatin: { contains: word } }),
        wrap({ lastNameLatin: { contains: word } }),
      ],
    })),
  };
};
