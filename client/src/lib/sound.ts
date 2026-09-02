/**
 * The sound cues of the platform.
 *
 * Call sites name an *intent* (`playCue("dialogYes")`), never a file. The file
 * and its level live here, so re-recording a cue or rebalancing the mix is a
 * one-line change and no component has to be touched.
 *
 * Playback is best-effort by design: a missing file, an unsupported codec, or
 * the autoplay policy blocking sound before the first user gesture must never
 * surface as an error — the interaction still happens, just silently. In
 * development a broken cue is reported once, so "there is no sound" stays
 * diagnosable instead of a silent mystery.
 */

import { useUIStore } from "../store/ui.store";

interface Cue {
  /** Path under client/public. */
  src: string;
  /** Resting level, 0–1. Chosen so no cue is louder than the others in use. */
  volume: number;
}

/**
 * Every cue in the system. Levels are deliberately uneven: cues that fire on
 * every keystroke or click sit low, cues that report something the user must
 * notice sit high.
 */
export const SOUNDS = {
  /** "إلغاء" in any modal or dialog. */
  cancel: { src: "/sounds/cancel.mp3", volume: 0.4 },
  /** Moving between pages from the sidebar. */
  navigate: { src: "/sounds/change-pane.mp3", volume: 0.35 },
  /** A dialog closing — the X, the backdrop, or Escape. */
  dialogClose: { src: "/sounds/close-dialog.mp3", volume: 0.4 },
  /** Collapsing or expanding the sidebar. */
  sidebarToggle: { src: "/sounds/close-option.mp3", volume: 0.35 },
  /** Signing in successfully, as the dashboard opens. */
  loginSuccess: { src: "/sounds/enter-home.mp3", volume: 0.5 },
  /** Drilling into a detail view: a professor, a faculty, a department… */
  enterDetails: { src: "/sounds/enter-to.mp3", volume: 0.4 },
  /** An error dialog appearing: bad input, wrong password, missing field. */
  errorDialog: { src: "/sounds/error-dialog.mp3", volume: 0.5 },
  /** The connection dropped. */
  networkError: { src: "/sounds/error.mp3", volume: 0.55 },
  /** The connection came back. */
  networkRestored: { src: "/sounds/success.m4a", volume: 0.45 },
  /** An incoming message or notification. */
  messageArrived: { src: "/sounds/message-arrive.mp3", volume: 0.5 },
  /** "لا" in a confirmation dialog. */
  dialogNo: { src: "/sounds/no-in-dialog.mp3", volume: 0.4 },
  /** "نعم" / "موافق" / "تم" in a confirmation dialog. */
  dialogYes: { src: "/sounds/yes-in-dialog.mp3", volume: 0.4 },
  /** A state turning on: inactive → active. */
  switchOn: { src: "/sounds/switch-on.mp3", volume: 0.35 },
  /** A state turning off: active → inactive. */
  switchOff: { src: "/sounds/switch-off.mp3", volume: 0.35 },
  /** Focusing a field to type in it. */
  inputFocus: { src: "/sounds/text-input.mp3", volume: 0.25 },
} as const satisfies Record<string, Cue>;

export type SoundCue = keyof typeof SOUNDS;

/**
 * Cues that follow a click or a keypress. Warmed on the first user gesture so
 * the first one is not late by a network round-trip; the rest load on demand.
 */
const WARM_ON_FIRST_GESTURE: SoundCue[] = [
  "navigate",
  "enterDetails",
  "dialogClose",
  "cancel",
  "dialogYes",
  "inputFocus",
];

/** Two plays of the same cue closer than this are one event, not two. */
const REPEAT_GAP_MS = 70;

const elements = new Map<SoundCue, HTMLAudioElement>();
const lastPlayed = new Map<SoundCue, number>();
const warned = new Set<SoundCue>();

function warnOnce(cue: SoundCue, reason: string) {
  if (!import.meta.env.DEV || warned.has(cue)) return;
  warned.add(cue);
  console.warn(
    `[sound] cue "${cue}" (${SOUNDS[cue].src}) ${reason}. ` +
      `Expected the file at client/public${SOUNDS[cue].src}.`,
  );
}

function element(cue: SoundCue) {
  let audio = elements.get(cue);
  if (!audio) {
    audio = new Audio(SOUNDS[cue].src);
    audio.preload = "auto";
    audio.addEventListener("error", () => warnOnce(cue, "could not be loaded"), {
      once: true,
    });
    elements.set(cue, audio);
  }
  return audio;
}

/** Whether cues are audible. Off silences the whole system at once. */
export function isSoundEnabled() {
  return useUIStore.getState().sound;
}

export function setSoundEnabled(enabled: boolean) {
  useUIStore.getState().setSound(enabled);
}

/**
 * Plays a cue.
 *
 * @param volume overrides the cue's resting level for this one play.
 */
export function playCue(cue: SoundCue, volume?: number) {
  if (typeof window === "undefined" || !isSoundEnabled()) return;

  const now = performance.now();
  if (now - (lastPlayed.get(cue) ?? -Infinity) < REPEAT_GAP_MS) return;
  lastPlayed.set(cue, now);

  try {
    const audio = element(cue);
    audio.volume = Math.min(1, Math.max(0, volume ?? SOUNDS[cue].volume));
    audio.currentTime = 0;
    void audio.play().catch((err: unknown) => {
      const name = (err as { name?: string })?.name;
      // NotAllowedError = no user gesture yet; anything else is worth a note.
      if (name !== "NotAllowedError") warnOnce(cue, `failed to play (${name})`);
    });
  } catch {
    /* no sound is not a failure */
  }
}

/** Fetches cues ahead of time so their first play is instant. */
export function preloadCues(...cues: SoundCue[]) {
  if (typeof window === "undefined") return;
  for (const cue of cues) {
    try {
      element(cue).load();
    } catch {
      /* nothing to warm up */
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => preloadCues(...WARM_ON_FIRST_GESTURE), {
    once: true,
    passive: true,
  });
}
