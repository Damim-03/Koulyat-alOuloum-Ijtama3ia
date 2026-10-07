import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "i18next";
import { client } from "../../lib/api/client";
import { serverMessage } from "../../lib/api/error";
import { useAuthStore } from "../../store/auth.store";
import type { MyAccount, MyAccountPatch } from "../../types/account";

/**
 * The signed-in person's own account, for every role. What each role may
 * change is decided by the server and echoed in `account.can`.
 */
export const accountApi = {
  get: () => client.get<{ account: MyAccount }>("/account").then((r) => r.data.account),
  update: (data: MyAccountPatch) => client.patch<{ account: MyAccount }>("/account", data).then((r) => r.data.account),
  setAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return client
      .post<{ account: MyAccount }>("/account/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data.account);
  },
  changeEmail: (data: { email: string; currentPassword: string }) =>
    client.post<{ account: MyAccount }>("/account/email", data).then((r) => r.data.account),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    // The new refresh token arrives as an httpOnly cookie; only the access token is kept.
    client.post<{ accessToken: string }>("/account/password", data).then((r) => r.data),
};

const KEY = ["account", "me"] as const;

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
    onSuccess: (a) => {
      saved(a);
      toast.success(t("admin.account.email.changed"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

/** Other devices are signed out; this one keeps going on the new pair. */
export function useChangeMyPassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => accountApi.changePassword(data),
    onSuccess: (tokens) => {
      const { user, login } = useAuthStore.getState();
      if (user) login(user, tokens);
      toast.success(t("admin.account.password.changed"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}
