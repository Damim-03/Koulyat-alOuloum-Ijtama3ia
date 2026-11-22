import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "i18next";
import { client } from "../../lib/api/client";
import { serverMessage } from "../../lib/api/error";
import { useAuthStore } from "../../store/auth.store";
import type { AccountSession, MyAccount, MyAccountPatch, SecurityAlert, TwoFactorSetup } from "../../types/account";

/**
 * The signed-in person's own account, for every role. What each role may
 * change is decided by the server and echoed in `account.can`.
 */
export const accountApi = {
  get: () => client.get<{ account: MyAccount }>("/account").then((r) => r.data.account),
  /** A link to the account's own address; opening it proves the address theirs. */
  requestEmailVerification: () =>
    client.post<{ message: string }>("/account/email/verify-request").then((r) => r.data),
  update: (data: MyAccountPatch) => client.patch<{ account: MyAccount }>("/account", data).then((r) => r.data.account),
  setAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return client
      .post<{ account: MyAccount }>("/account/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data.account);
  },
  /** The address saved — and whether the link that proves it left (`sent`), or why not. */
  changeEmail: (data: { email: string; currentPassword: string }) =>
    client
      .post<{ account: MyAccount; verification?: "sent" | "verified" | "off" | "failed" }>("/account/email", data)
      .then((r) => ({ account: r.data.account, verification: r.data.verification ?? "off" })),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    // The new refresh token arrives as an httpOnly cookie; only the access token is kept.
    client.post<{ accessToken: string }>("/account/password", data).then((r) => r.data),
  /** Where the request with the photos stands (Backend modules/activation). */
  activationRequest: () => client.get<MyActivationRequest>("/account/activation-request").then((r) => r.data),
  /** The photos of the card and of the student holding it. */
  sendActivationRequest: (form: FormData) =>
    client.post<MyActivationRequest>("/account/activation-request", form).then((r) => r.data),
  sessions: () => client.get<{ sessions: AccountSession[] }>("/account/sessions").then((r) => r.data.sessions),
  endSession: (id: string) => client.delete(`/account/sessions/${encodeURIComponent(id)}`).then(() => undefined),

  twoFactorSetup: () => client.post<TwoFactorSetup>("/account/2fa/setup").then((r) => r.data),
  twoFactorEnable: (code: string) =>
    client.post<{ recoveryCodes: string[] }>("/account/2fa/enable", { code }).then((r) => r.data.recoveryCodes),
  twoFactorDisable: (data: { currentPassword: string; code: string }) =>
    client.post("/account/2fa/disable", data).then(() => undefined),
  recoveryCodes: (currentPassword: string) =>
    client.post<{ recoveryCodes: string[] }>("/account/2fa/recovery-codes", { currentPassword }).then((r) => r.data.recoveryCodes),

  securityAlerts: () => client.get<{ alerts: SecurityAlert[] }>("/account/security-alerts").then((r) => r.data.alerts),
  ackSecurityAlert: (id: string) =>
    client.post(`/account/security-alerts/${encodeURIComponent(id)}/ack`).then(() => undefined),
  ackAllSecurityAlerts: () => client.post("/account/security-alerts/ack-all").then(() => undefined),
};

const KEY = ["account", "me"] as const;

/** A verification request (the photos): none yet, waiting for the administration, or refused — with why. */
export type MyActivationRequest =
  | { status: "none" }
  | { status: "pending"; sentAt: string }
  | { status: "rejected"; reason: string | null; decidedAt: string | null };

const ACTIVATION_REQUEST = ["account", "activation-request"] as const;

/** `enabled`: only where it can matter — a student's account. */
export function useMyActivationRequest(enabled = true) {
  return useQuery({ queryKey: ACTIVATION_REQUEST, queryFn: accountApi.activationRequest, enabled });
}

/**
 * Sends the two photos. The answer — the request,
 * now waiting — replaces what the screen shows.
 */
export function useSendActivationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { card: Blob; qrNumber?: string | null }) => {
      const form = new FormData();
      form.append("card", input.card, "card.jpg");
      if (input.qrNumber) form.append("qrNumber", input.qrNumber);
      return accountApi.sendActivationRequest(form);
    },
    onSuccess: (request) => qc.setQueryData(ACTIVATION_REQUEST, request),
  });
}

export function useMyAccount() {
  return useQuery({ queryKey: KEY, queryFn: accountApi.get });
}

/**
 * The header's name and photo come from the auth store, not from this query,
 * so every change is written there too — the menu shows it at once.
 */
function useSaved() {
  const qc = useQueryClient();
  return (a: MyAccount) => {
    qc.setQueryData(KEY, a);
    const { user, setUser } = useAuthStore.getState();
    if (user)
      setUser({
        ...user,
        firstName: a.firstName ?? undefined,
        lastName: a.lastName ?? undefined,
        firstNameLatin: a.firstNameLatin,
        lastNameLatin: a.lastNameLatin,
        avatarUrl: a.avatarUrl ?? undefined,
        gender: a.gender,
        email: a.email ?? undefined,
      });
    qc.invalidateQueries({ queryKey: ["auth", "me"] });
  };
}

export function useUpdateMyAccount() {
  const saved = useSaved();
  return useMutation({
    mutationFn: (data: MyAccountPatch) => accountApi.update(data),
    onSuccess: (a) => {
      saved(a);
      toast.success(t("admin.account.saved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

export function useSetMyAvatar() {
  const saved = useSaved();
  return useMutation({
    mutationFn: (file: File) => accountApi.setAvatar(file),
    onSuccess: (a) => {
      saved(a);
      toast.success(t("admin.account.saved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.imageUploadFailed"))),
  });
}

export function useChangeMyEmail() {
  const saved = useSaved();
  return useMutation({
    mutationFn: (data: { email: string; currentPassword: string }) => accountApi.changeEmail(data),
    onSuccess: ({ account: a, verification }) => {
      saved(a);
      // A student signs in by the registration number: the email is for mail, not for signing in.
      const title = t(a.role === "student" ? "account.student.emailSaved" : "admin.account.email.changed");
      // And the link that proves the new address: sent to it — or why not.
      const description = t(`account.emailLink.${verification}`, { email: a.email ?? "" });
      if (verification === "failed") toast.warning(title, { description, duration: 9000 });
      else toast.success(title, { description, duration: verification === "sent" ? 8000 : 4000 });
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

/**
 * Other devices are signed out; this one keeps going on the new pair. A
 * password the administration handed out is no longer the account's, so the
 * screen that asked for this one steps aside.
 */
export function useChangeMyPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => accountApi.changePassword(data),
    onSuccess: (tokens) => {
      const { user, login } = useAuthStore.getState();
      // With activation on, this was its first stage: the photos come next, on the same screen.
      if (user) login({ ...user, mustChangePassword: false, activationRequired: false }, tokens);
      qc.invalidateQueries({ queryKey: KEY });
      toast.success(t("admin.account.password.changed"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

//
// ─── Two-step verification ──────────────────────────────────
//

/** Draws a secret for the app to scan. Nothing is on until its first code is given. */
export function useStartTwoFactor() {
  return useMutation({
    mutationFn: accountApi.twoFactorSetup,
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

/**
 * The app's first code turns it on and returns the recovery codes, once. The
 * account (and the gate in front of the dashboard) learn it only when the
 * codes have been put away — `onDone` in TwoFactorCard.
 */
export function useEnableTwoFactor() {
  return useMutation({
    mutationFn: (code: string) => accountApi.twoFactorEnable(code),
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

export function useDisableTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountApi.twoFactorDisable,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success(t("account.twoFactor.disabled"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

/**
 * No refresh of the account here. Writing the new codes changes the account's
 * `updatedAt`, and the page is keyed on it: refreshing now would redraw it and
 * take the codes off the screen before they are put away — while the old ones
 * no longer work. The card refreshes the account once they are (`done`).
 */
export function useRenewRecoveryCodes() {
  return useMutation({
    mutationFn: (currentPassword: string) => accountApi.recoveryCodes(currentPassword),
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

//
// ─── Security alerts ────────────────────────────────────────
//

// "notifications" in the key: a pushed notice refreshes it at once (use-realtime-sync).
const ALERTS_KEY = ["account", "notifications", "security-alerts"] as const;

export function useSecurityAlerts(enabled = true) {
  return useQuery({ queryKey: ALERTS_KEY, queryFn: accountApi.securityAlerts, enabled, staleTime: 60_000 });
}

/** "It was me": the notice goes away, here and on every other device. `"all"` answers every one. */
export function useAckSecurityAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (id === "all" ? accountApi.ackAllSecurityAlerts() : accountApi.ackSecurityAlert(id)),
    onMutate: (id) => {
      qc.setQueryData<SecurityAlert[]>(ALERTS_KEY, (list) => (id === "all" ? [] : list?.filter((a) => a.id !== id)));
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ALERTS_KEY });
      toast.error(serverMessage(e, t("toast.updateFailed")));
    },
  });
}

// "sessions" is also the realtime resource the server announces, so the list
// refreshes by itself when a device signs in or out (see use-realtime-sync).
const SESSIONS_KEY = ["account", "sessions"] as const;

/** The devices signed in to this account. */
export function useMySessions() {
  return useQuery({ queryKey: SESSIONS_KEY, queryFn: accountApi.sessions, refetchInterval: 60_000 });
}

/** Signs one other device out. It is told at once and leaves the list here. */
export function useEndMySession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountApi.endSession(id),
    onSuccess: (_, id) => {
      qc.setQueryData<AccountSession[]>(SESSIONS_KEY, (list) => list?.filter((s) => s.id !== id));
      toast.success(t("admin.account.security.signedOut"));
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      toast.error(serverMessage(e, t("toast.updateFailed")));
    },
  });
}

/** "Send me the confirmation link" — the server says where it went, or why not. */
export function useRequestEmailVerification() {
  return useMutation({
    mutationFn: accountApi.requestEmailVerification,
    onSuccess: (r) => toast.success(r.message),
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}
