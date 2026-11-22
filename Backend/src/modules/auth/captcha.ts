import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type * as AltchaLib from "altcha-lib" with { "resolution-mode": "import" };
import type * as Pbkdf2 from "altcha-lib/algorithms/pbkdf2" with { "resolution-mode": "import" };
import type * as Shared from "altcha-lib/frameworks/shared" with { "resolution-mode": "import" };

import { config } from "../../core/config/app.config";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HttpException } from "../../core/utils/appErros";
import { standingOf } from "../../core/auth/login-throttle";
import { tr } from "../../core/i18n";
import { spikeActive } from "./failure-spike";
import { codeImage, randomCode } from "./code-image";

// altcha-lib ships a CommonJS build, which `require` loads, but declares its
// types as ES modules only: imported with `import`, this CommonJS server fails
// to type-check. So the types come in as ESM and the code through `require`.
/* eslint-disable @typescript-eslint/no-require-imports */
const { CappedMap, createChallenge, randomInt }: typeof AltchaLib = require("altcha-lib");
const { deriveKey }: typeof Pbkdf2 = require("altcha-lib/algorithms/pbkdf2");
const { verify }: typeof Shared = require("altcha-lib/frameworks/shared");
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * ============================================================
 * THE SHORT CHECK BEFORE A SIGN-IN (ALTCHA)
 * ============================================================
 *
 * A proof of work: the browser searches for a number that only a second of
 * computing finds, and the server checks it at once. A person signing in
 * waits that second; a script trying thousands of passwords pays it thousands
 * of times. No third party — the challenge is made and checked here, and
 * nothing leaves the university's server.
 *
 * It comes in two levels, and only when there is a reason:
 *
 * - **work** — the proof of work alone — once the identifier has failed a few
 *   times lately (`LOGIN_CAPTCHA_AFTER_FAILURES`). A student who types the
 *   password right never sees it.
 * - **image** — the proof of work, then a code to read from a picture
 *   (./code-image) — when something is already wrong: the alarm for failures
 *   across many accounts is up (./failure-spike), or this identifier was
 *   locked within the day. The picture is checked by a second request
 *   (`POST /auth/challenge/verify`), which answers with a pass for one sign-in.
 *
 * Without what its level asks for, a sign-in is answered 428 — with the level,
 * so the page shows the right check — before the account is looked up or the
 * password compared: the answer says nothing about either, and the attempt is
 * not counted against the identifier.
 *
 * Each solution and each pass opens one sign-in. The ids of the ones used are
 * kept for as long as they live, so none can be replayed. They are kept in
 * memory: right for one server process; a deployment of several would share
 * them (Redis), as it would the rate limits.
 */

export type CaptchaLevel = "none" | "work" | "image";

/** Difficulty, chosen by measurement: about a second for a phone's browser, under a millisecond to verify. */
export const CHALLENGE = {
  algorithm: "PBKDF2/SHA-256",
  cost: 1000,
  counterMin: 3000,
  counterMax: 6000,
  expiresMinutes: 10,
};

/** The digits drawn in the picture. Replaceable, so a test can know them. */
export const imageCode = { length: 5, next: () => randomCode(imageCode.length) };

// Keys of their own, derived from the session secret: the check needs no new
// secret to configure, and a key for one purpose is never a key for another.
const subKey = (label: string) =>
  crypto.createHmac("sha256", config.SESSION_SECRET).update(`altcha:${label}`).digest("hex");
const SIGNATURE_SECRET = subKey("challenge");
const KEY_SIGNATURE_SECRET = subKey("key");
const CODE_SECRET = subKey("code");
const PASS_SECRET = subKey("pass");

const hmac = (secret: string, value: string) => crypto.createHmac("sha256", secret).update(value).digest("hex");
/** Two hex digests, compared in constant time; anything that is not hex is simply unequal. */
const sameHex = (a: string, b: string) => {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Ids of solutions and passes already used; the oldest go first past the cap. */
const used = new CappedMap<string, boolean>({ maxSize: 50_000 });

/** What the challenge carries for the picture: its id, and the code's keyed hash — signed with the rest. */
const codeHashOf = (challengeId: string, code: string) => hmac(CODE_SECRET, `${challengeId}:${code}`);

/** A new challenge for the widget: the proof of work, and at `image` the picture too. */
export async function issueChallenge(level: "work" | "image" = "work") {
  const base = {
    algorithm: CHALLENGE.algorithm,
    cost: CHALLENGE.cost,
    counter: randomInt(CHALLENGE.counterMax, CHALLENGE.counterMin),
    deriveKey,
    hmacSignatureSecret: SIGNATURE_SECRET,
    hmacKeySignatureSecret: KEY_SIGNATURE_SECRET,
    expiresAt: new Date(Date.now() + CHALLENGE.expiresMinutes * 60 * 1000),
  };
  if (level === "work") return createChallenge(base);

  const code = imageCode.next();
  const challengeId = crypto.randomUUID();
  const challenge = await createChallenge({
    ...base,
    data: { kind: "image", challengeId, codeHash: codeHashOf(challengeId, code) },
  });
  return { ...challenge, codeChallenge: { image: codeImage(code), length: code.length } };
}

/** `GET /auth/challenge[?level=image]` — never cached: each one is good for a single sign-in. */
export async function challengeController(req: Request, res: Response, next: NextFunction) {
  try {
    const level = req.query.level === "image" ? "image" : "work";
    res.set("Cache-Control", "no-store").json(await issueChallenge(level));
  } catch (error) {
    next(error);
  }
}

// ─── The pass: what a solved picture earns ───────────────────

const PASS_MINUTES = 10;

/** One sign-in's worth, signed: an id (spent when used) and an expiry. */
function issuePass(): string {
  const body = `${crypto.randomUUID()}.${Date.now() + PASS_MINUTES * 60 * 1000}`;
  return Buffer.from(JSON.stringify({ pass: body, sig: hmac(PASS_SECRET, body) })).toString("base64");
}

/** The pass's id when the payload is a valid, unexpired pass; null for anything else. */
function readPass(payload: string): string | null {
  try {
    const { pass, sig } = JSON.parse(Buffer.from(payload, "base64").toString()) as { pass?: unknown; sig?: unknown };
    if (typeof pass !== "string" || typeof sig !== "string" || !sameHex(sig, hmac(PASS_SECRET, pass))) return null;
    const [id, expires] = pass.split(".");
    return id && Number(expires) > Date.now() ? id : null;
  } catch {
    return null;
  }
}

const verifyCodeSchema = z.object({
  payload: z.string().min(1).max(8192),
  code: z.string().trim().max(32),
});

/**
 * `POST /auth/challenge/verify` — the widget sends the solved proof of work
 * and the code typed from the picture. Both right: a pass for one sign-in.
 *
 * The proof of work is spent first, right or wrong: a wrong code costs the
 * whole check again — a new challenge, a new second of work, a new picture —
 * so the five digits cannot be guessed one request at a time.
 *
 * Answers 200 either way, as the widget expects; `verified: false` carries
 * the reason it shows.
 */
export async function verifyCodeController(req: Request, res: Response, next: NextFunction) {
  const refuse = (reason: "auth.captchaInvalid" | "auth.captchaCodeWrong") =>
    res.json({ verified: false, reason: tr(reason) });
  try {
    const parsed = verifyCodeSchema.safeParse(req.body);
    if (!parsed.success) return refuse("auth.captchaInvalid");
    const { payload, code } = parsed.data;

    let data: { kind?: unknown; challengeId?: unknown; codeHash?: unknown } | undefined;
    try {
      data = JSON.parse(Buffer.from(payload, "base64").toString())?.challenge?.parameters?.data;
    } catch {
      return refuse("auth.captchaInvalid");
    }
    if (data?.kind !== "image" || typeof data.challengeId !== "string" || typeof data.codeHash !== "string")
      return refuse("auth.captchaInvalid");

    // The signature covers `data`: the id and the hash are the server's own.
    const result = await verify(payload, deriveKey, SIGNATURE_SECRET, KEY_SIGNATURE_SECRET, used);
    if (result.error) return refuse("auth.captchaInvalid");

    const typed = code.replace(/\s+/g, "");
    if (!sameHex(codeHashOf(data.challengeId, typed), data.codeHash)) return refuse("auth.captchaCodeWrong");

    return res.json({ verified: true, payload: issuePass() });
  } catch (error) {
    next(error);
  }
}

// ─── At sign-in ──────────────────────────────────────────────

/** What this sign-in must carry. */
export async function captchaLevel(key: string): Promise<CaptchaLevel> {
  if (!config.LOGIN_CAPTCHA) return "none";
  const [standing, spike] = await Promise.all([standingOf(key), spikeActive()]);
  if (spike || standing.locked) return "image";
  return standing.failures >= config.LOGIN_CAPTCHA_AFTER_FAILURES ? "work" : "none";
}

const refuse = (message: "auth.captchaRequired" | "auth.captchaInvalid", level: CaptchaLevel) => {
  const error = new HttpException(tr(message), HTTPSTATUS.PRECONDITION_REQUIRED, ErrorCodeEnum.AUTH_CAPTCHA_REQUIRED);
  // Which check to show: the page asks for the picture only when told to.
  error.extra = { captcha: level };
  return error;
};

/**
 * Throws 428 when this sign-in lacks what its level asks for, or carries one
 * that fails: expired, tampered with, signed by someone else, or used already.
 *
 * A pass (a solved picture) satisfies either level. At `image` a proof of work
 * alone does not, and is left unspent for the picture that follows it. A
 * solution sent when none is needed is left unused.
 */
export async function assertCaptcha(key: string, payload: string | undefined) {
  const level = await captchaLevel(key);
  if (level === "none") return;
  if (!payload) throw refuse("auth.captchaRequired", level);

  const pass = readPass(payload);
  if (pass) {
    if (!used.setIfAbsent(`pass:${pass}`, true)) throw refuse("auth.captchaInvalid", level);
    return;
  }
  if (level === "image") throw refuse("auth.captchaRequired", level);

  const result = await verify(payload, deriveKey, SIGNATURE_SECRET, KEY_SIGNATURE_SECRET, used);
  if (result.error) throw refuse("auth.captchaInvalid", level);
}
