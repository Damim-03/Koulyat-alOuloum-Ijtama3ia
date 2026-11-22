import type { ImageChallenge } from "../api/auth.api";

/**
 * Solves the proof of work of a sign-in check in this browser, and returns it
 * as the server reads it: base64 of `{ challenge, solution }`, the shape the
 * ALTCHA widget sends.
 *
 * Used for the picture level, whose window is ours rather than the widget's.
 * The solver is loaded on first use, not with the sign-in page; its key
 * derivation runs on WebCrypto, which only a secure page (HTTPS or localhost)
 * offers — the server asks for the check there only (LOGIN_CAPTCHA=auto).
 */
export async function solveWork(challenge: ImageChallenge, signal?: AbortSignal): Promise<string> {
  const { solveChallenge, pbkdf2 } = await import("altcha/lib");
  const controller = new AbortController();
  signal?.addEventListener("abort", () => controller.abort());
  const plain = { parameters: challenge.parameters, signature: challenge.signature };
  const solution = await solveChallenge({
    challenge: plain as never,
    deriveKey: pbkdf2.deriveKey,
    controller,
  });
  if (!solution) throw new Error("unsolved");
  return btoa(JSON.stringify({ challenge: plain, solution }));
}
