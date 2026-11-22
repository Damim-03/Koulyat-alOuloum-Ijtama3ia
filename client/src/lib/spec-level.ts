import type { TFunction } from "i18next";

/**
 * The level of a specialization — licence, master or doctorate — as the
 * topic forms show it.
 *
 * A topic has no level of its own: its specialization's is its level
 * (Backend: Specialization.level). So the forms never ask for it, nor send
 * it: they show it in a field of its own, read only, once a specialization
 * is chosen.
 */
export type SpecLevel = "licence" | "master" | "doctorate";

export const SPEC_LEVEL_ORDER: SpecLevel[] = ["licence", "master", "doctorate"];

/** Each level's name, from the administration's words (shared by every form). */
export const SPEC_LEVEL_LABEL: Record<SpecLevel, string> = {
  licence: "admin.levelLicence",
  master: "admin.levelMaster",
  doctorate: "admin.levelDoctorate",
};

const isLevel = (v: unknown): v is SpecLevel => typeof v === "string" && (SPEC_LEVEL_ORDER as string[]).includes(v);

/** A level's name, or nothing for a value that is none. */
export const levelName = (level: unknown, t: TFunction): string => (isLevel(level) ? t(SPEC_LEVEL_LABEL[level]) : "");
