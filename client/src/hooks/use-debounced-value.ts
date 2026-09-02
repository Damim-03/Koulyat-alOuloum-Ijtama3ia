import { useEffect, useState } from "react";

/**
 * Returns `value` only after it has stayed unchanged for `delay` ms.
 *
 * Pair it with a query hook to keep the query key stable while the user is
 * still typing: the request fires once the input settles, and TanStack Query
 * keys the result by that value — so a slow earlier response can never
 * overwrite a newer one, and repeats are served from cache.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}
