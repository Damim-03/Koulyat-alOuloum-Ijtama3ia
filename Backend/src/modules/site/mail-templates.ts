import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../core/prisma/client";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { issuesMessage, LANGS, tr, type Lang } from "../../core/i18n";
import { mailEnabled, sendMail } from "../../core/mail/mailer";
import { DEFAULT_LOOK } from "../../core/mail/templates";
import {
  composeMail,
  isOneLine,
  logoProblem,
  MAIL_GROUPS,
  MAIL_KEYS,
  MAIL_KINDS,
  MAIL_SLUG,
  mailTemplatesSchema,
  maxOf,
  sampleVars,
  savedMailTemplates,
  varsOf,
  type MailTemplates,
} from "../../core/mail/mail-templates";
import { trustedAddressOf } from "../auth/email-links";

/**
 * «واجهة الموقع ← رسائل البريد» — what the administration reads, saves,
 * previews and tries (core/mail/mail-templates says what it may change).
 *
 * - `GET  /admin/mail-templates` — what is saved (or nothing), the platform's
 *   own words in each language, and for each text the values it may hold;
 * - `PUT  /admin/mail-templates` — saves, in the audit log field by field, and
 *   answers with what was saved alone (the rest does not change);
 * - `POST /admin/mail-templates/preview` — a message drawn from what is being
 *   written, not saved yet, with made-up values;
 * - `POST /admin/mail-templates/test` — the same, sent to the administrator's
 *   own confirmed address, and to no other.
 */

const bad = (m: string) => new BadRequestException(m, ErrorCodeEnum.VALIDATION_ERROR);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw bad(issuesMessage(parsed.error.issues));
  return parsed.data;
}

/** The platform's words, for the editor's blanks and its «restore». */
const DEFAULTS = () =>
  Object.fromEntries(LANGS.map((lang) => [lang, Object.fromEntries(MAIL_KEYS.map((key) => [key, tr(key, undefined, lang)]))]));

const FIELDS = () =>
  Object.fromEntries(MAIL_KEYS.map((key) => [key, { vars: varsOf(key), oneLine: isOneLine(key), max: maxOf(key) }]));

/** Where a test goes: the administrator's own proven address — or nowhere. */
async function ownAddress(userId: string): Promise<string | null> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true, verifiedEmail: true, professor: { select: { universityEmail: true } } },
  });
  return me ? trustedAddressOf(me) : null;
}

async function answer(userId: string, templates: MailTemplates | null) {
  return {
    templates,
    defaults: DEFAULTS(),
    look: DEFAULT_LOOK,
    groups: MAIL_GROUPS,
    fields: FIELDS(),
    mailEnabled: mailEnabled(),
    testTo: await ownAddress(userId),
  };
}

export const saveMailTemplatesService = async (data: MailTemplates) => {
  const value = data as unknown as object;
  await prisma.siteContent.upsert({ where: { slug: MAIL_SLUG }, create: { slug: MAIL_SLUG, value }, update: { value } });
  return savedMailTemplates();
};

/** A message as it would leave: what is being written, the message, its language. */
const drawSchema = z.object({
  templates: mailTemplatesSchema,
  kind: z.enum(MAIL_KINDS),
  lang: z.enum(LANGS as [Lang, ...Lang[]]),
  byAdmin: z.boolean().optional(),
});

/** Saved or drawn, the logos must be pictures a message can carry. */
function usable<T extends MailTemplates>(templates: T): T {
  const problem = logoProblem(templates);
  if (problem) throw bad(problem);
  return templates;
}

const draw = (body: unknown) => {
  const d = parse(drawSchema, body);
  usable(d.templates);
  return { ...composeMail(d.kind, sampleVars(d.kind, d.lang, d.byAdmin), d.templates, d.lang, true), lang: d.lang, d };
};

// ─── controllers ───────────────────────────────────────────────

export const getMailTemplatesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(HTTPSTATUS.OK).json(await answer(req.user!.userId, await savedMailTemplates()));
  } catch (e) {
    next(e);
  }
};

export const saveMailTemplatesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = usable(parse(mailTemplatesSchema, req.body));
    return res.status(HTTPSTATUS.OK).json({ templates: await saveMailTemplatesService(data) });
  } catch (e) {
    next(e);
  }
};

export const previewMailTemplateController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subject, html } = draw(req.body);
    return res.status(HTTPSTATUS.OK).json({ subject, html });
  } catch (e) {
    next(e);
  }
};

export const testMailTemplateController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!mailEnabled()) throw bad(tr("auth.mailOff"));
    const to = await ownAddress(req.user!.userId);
    if (!to) throw bad(tr("mailTemplates.noTestAddress"));
    const { d } = draw(req.body);
    // Sent as it will be — the seal attached, not drawn in — and marked as a test in the subject.
    const mail = composeMail(d.kind, sampleVars(d.kind, d.lang, d.byAdmin), d.templates, d.lang);
    const subject = `${tr("mailTemplates.testPrefix", undefined, d.lang)} ${mail.subject}`;
    if (!(await sendMail({ to, ...mail, subject }))) throw bad(tr("auth.mailFailed"));
    return res.status(HTTPSTATUS.OK).json({ message: tr("mailTemplates.testSent", { email: to }), to });
  } catch (e) {
    next(e);
  }
};
