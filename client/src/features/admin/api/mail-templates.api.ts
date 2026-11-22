import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "i18next";
import { client } from "../../../lib/api/client";
import { serverMessage } from "../../../lib/api/error";
import type { SiteLang } from "../../../types/site.types";

/**
 * «واجهة الموقع ← رسائل البريد» (Backend core/mail/mail-templates,
 * modules/site/mail-templates): the words of the emails the platform sends,
 * in each language, and their look — as the administration rewrote them.
 */

export interface MailLook {
  /** The band at the top. */
  header: string;
  /** The line under the band, and the button. */
  accent: string;
  /**
   * The university's logo at the band's start, the faculty's at its end:
   * `null` none, `"platform"` the platform's own, or an uploaded picture
   * (`/uploads/cards/…`).
   */
  universityLogo: LogoChoice;
  facultyLogo: LogoChoice;
}

export type LogoChoice = "platform" | string | null;

/** Only what was rewritten: a text missing is the platform's own. */
export type MailTexts = Record<string, string>;

export interface MailTemplates {
  ar: MailTexts;
  en: MailTexts;
  fr: MailTexts;
  look: MailLook;
}

export type MailGroup = "common" | "reset" | "verify" | "passwordChanged" | "newDevice";
export type MailKind = Exclude<MailGroup, "common">;

export interface MailField {
  /** The values the text may hold: `account` for `{{account}}`. */
  vars: string[];
  oneLine: boolean;
  max: number;
}

export interface MailTemplatesData {
  /** What is saved — or nothing yet. */
  templates: MailTemplates | null;
  /** The platform's own words, by language then key. */
  defaults: Record<SiteLang, MailTexts>;
  /** The look the messages had before anyone changed it. */
  look: MailLook;
  groups: Record<MailGroup, string[]>;
  fields: Record<string, MailField>;
  /** Whether the server can send mail at all. */
  mailEnabled: boolean;
  /** Where a test goes: the administrator's own confirmed address — or nowhere. */
  testTo: string | null;
}

export interface MailDraw {
  templates: MailTemplates;
  kind: MailKind;
  lang: SiteLang;
  /** «Your password was changed», as it reads when the administration changed it. */
  byAdmin?: boolean;
}

export const mailTemplatesApi = {
  get: () => client.get<MailTemplatesData>("/admin/mail-templates").then((r) => r.data),
  save: (data: MailTemplates) =>
    client.put<{ templates: MailTemplates | null }>("/admin/mail-templates", data).then((r) => r.data.templates),
  preview: (d: MailDraw) => client.post<{ subject: string; html: string }>("/admin/mail-templates/preview", d).then((r) => r.data),
  test: (d: MailDraw) => client.post<{ message: string; to: string }>("/admin/mail-templates/test", d).then((r) => r.data),
};

const KEY = ["admin", "mail-templates"] as const;

export const useMailTemplates = () => useQuery({ queryKey: KEY, queryFn: mailTemplatesApi.get });

export function useSaveMailTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mailTemplatesApi.save,
    onSuccess: (templates) => {
      qc.setQueryData<MailTemplatesData>(KEY, (old) => (old ? { ...old, templates } : old));
      toast.success(t("admin.mailTemplates.toastSaved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

/**
 * The message drawn from what is being written: asked again a moment after the
 * typing stops. Keyed apart from "mail-templates": the realtime sync refetches
 * every query whose key names a resource that changed, and a draft's picture
 * does not change when the saved templates do.
 */
export const useMailPreview = (d: MailDraw | null) =>
  useQuery({
    queryKey: ["admin", "mail-preview", d],
    queryFn: () => mailTemplatesApi.preview(d!),
    enabled: !!d,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  });

export function useSendTestMail() {
  return useMutation({
    mutationFn: mailTemplatesApi.test,
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(serverMessage(e, t("admin.mailTemplates.testFailed"))),
  });
}
