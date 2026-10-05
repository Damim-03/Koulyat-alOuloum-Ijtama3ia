import { z } from "zod";

/**
 * ============================================================
 * IMAGE URL
 * ============================================================
 *
 * Where an uploaded image lives, as a row stores it.
 *
 * The upload endpoint answers with a root-relative path
 * (`/uploads/cards/<file>`) — see `uploadImageController` for why. The
 * schemas kept `z.string().url()`, which demands an absolute URL, so every
 * photo set through the admin forms came back 400: the upload succeeded and
 * the save that followed was refused.
 *
 * Absolute http(s) URLs are still accepted. Rows written before the switch
 * hold one, and re-saving an old profile must not fail on a field nobody
 * touched.
 *
 * Anything else is refused. The value ends up in an <img src>, and "any
 * string" would let a `javascript:` or `data:` URL through, or a relative
 * path that climbs out of `/uploads` with `..`.
 */
const RELATIVE_UPLOAD = /^\/uploads\/[A-Za-z0-9._/-]+$/;

const isAbsoluteHttp = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export const imageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) =>
      (RELATIVE_UPLOAD.test(v) && !v.includes("..")) || isAbsoluteHttp(v),
    "Invalid image URL",
  );
