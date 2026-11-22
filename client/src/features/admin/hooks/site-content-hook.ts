import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "i18next";
import { adminApi } from "../api/admin.api";
import type { SupervisionTemplate } from "../../supervision/lib/sheet-template";
import { serverMessage } from "../../../lib/api/error";
import {
  SITE_ABOUT_KEY,
  SITE_DIRECTOR_KEY,
  SITE_LOGIN_KEY,
  SITE_NEWS_KEY,
  SITE_TEXTS_KEY,
} from "../../home/hooks/site-hook";
import { applySiteTexts } from "../../../i18n/i18n";
import type { SiteTexts } from "../../../i18n/site-texts";
import type {
  AboutPage,
  DirectorMessage,
  LoginContent,
  NewsInput,
  NewsItem,
} from "../../../types/site.types";

const NEWS_KEY = ["admin", "news"] as const;
const DIRECTOR_KEY = ["admin", "director-message"] as const;
const ABOUT_KEY = ["admin", "about-page"] as const;
const LOGIN_KEY = ["admin", "login-page"] as const;
const TEXTS_KEY = ["admin", "site-texts"] as const;
const SUPERVISION_SHEET_KEY = ["admin", "supervision-sheet"] as const;

/** قائمة الإدارة وما يقرؤه الزائر منها يتغيّران معاً. */
function refreshNews(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: NEWS_KEY });
  qc.invalidateQueries({ queryKey: SITE_NEWS_KEY });
}

// ─── آخر الأخبار ───

export function useAdminNews() {
  return useQuery({ queryKey: NEWS_KEY, queryFn: adminApi.listNews });
}

export function useCreateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NewsInput) => adminApi.createNews(data),
    onSuccess: () => {
      refreshNews(qc);
      toast.success(t("admin.news.toastAdded"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.addFailed"))),
  });
}

/** التعديل، ومنه النشر والإخفاء — والمفتاح يتبدّل قبل جواب الخادم. */
export function useUpdateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NewsInput> }) =>
      adminApi.updateNews(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: NEWS_KEY });
      const before = qc.getQueryData<NewsItem[]>(NEWS_KEY);
      if (before && data.isActive !== undefined)
        qc.setQueryData<NewsItem[]>(
          NEWS_KEY,
          before.map((n) => (n.id === id ? { ...n, isActive: data.isActive! } : n)),
        );
      return { before };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(NEWS_KEY, ctx.before);
      toast.error(serverMessage(e, t("toast.updateFailed")));
    },
    onSettled: () => refreshNews(qc),
  });
}

export function useDeleteNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteNews(id),
    onSuccess: () => {
      refreshNews(qc);
      toast.success(t("admin.news.toastDeleted"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.deleteFailed"))),
  });
}

// ─── كلمة رئيس القسم ───

export function useAdminDirectorMessage() {
  return useQuery({ queryKey: DIRECTOR_KEY, queryFn: adminApi.getDirectorMessage });
}

export function useSaveDirectorMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DirectorMessage) => adminApi.saveDirectorMessage(data),
    onSuccess: (saved) => {
      qc.setQueryData(DIRECTOR_KEY, saved);
      qc.invalidateQueries({ queryKey: SITE_DIRECTOR_KEY });
      toast.success(t("admin.director.toastSaved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

// ─── صفحة «عن المنصة» ───

export function useAdminAboutPage() {
  return useQuery({ queryKey: ABOUT_KEY, queryFn: adminApi.getAboutPage });
}

export function useSaveAboutPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AboutPage) => adminApi.saveAboutPage(data),
    onSuccess: (saved) => {
      qc.setQueryData(ABOUT_KEY, saved);
      qc.invalidateQueries({ queryKey: SITE_ABOUT_KEY });
      toast.success(t("admin.about.toastSaved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

// ─── لوحة الترحيب في صفحة الدخول ───

export function useAdminLoginContent() {
  return useQuery({ queryKey: LOGIN_KEY, queryFn: adminApi.getLoginPage });
}

export function useSaveLoginContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginContent) => adminApi.saveLoginPage(data),
    onSuccess: (saved) => {
      qc.setQueryData(LOGIN_KEY, saved);
      qc.invalidateQueries({ queryKey: SITE_LOGIN_KEY });
      toast.success(t("admin.loginPage.toastSaved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

// ─── ورقة «طلب الموافقة على الإشراف» ───

export function useAdminSupervisionSheet() {
  return useQuery({ queryKey: SUPERVISION_SHEET_KEY, queryFn: adminApi.getSupervisionSheet });
}

/**
 * Saving or restoring the sheet: what is issued from now on reads it. The
 * drafts the issue dialog already fetched are dropped, so they show it too —
 * documents already issued keep their own text, in their snapshot.
 */
function onSheetSaved(qc: QueryClient, saved: Awaited<ReturnType<typeof adminApi.getSupervisionSheet>>) {
  qc.setQueryData(SUPERVISION_SHEET_KEY, saved);
  qc.invalidateQueries({ queryKey: ["supervision-documents", "preview"] });
}

export function useSaveSupervisionSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SupervisionTemplate) => adminApi.saveSupervisionSheet(data),
    onSuccess: (saved) => {
      onSheetSaved(qc, saved);
      toast.success(t("admin.supSheet.toastSaved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

export function useResetSupervisionSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminApi.resetSupervisionSheet(),
    onSuccess: (saved) => {
      onSheetSaved(qc, saved);
      toast.success(t("admin.supSheet.toastReset"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}

// ─── نصوص الموقع ───

export function useAdminSiteTexts() {
  return useQuery({ queryKey: TEXTS_KEY, queryFn: adminApi.getSiteTexts });
}

export function useSaveSiteTexts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SiteTexts) => adminApi.saveSiteTexts(data),
    onSuccess: (saved) => {
      qc.setQueryData(TEXTS_KEY, saved);
      qc.setQueryData(SITE_TEXTS_KEY, saved);
      // المسؤول يرى عباراته في الحال — في القائمة الجانبية نفسها إن غيّرها.
      applySiteTexts(saved);
      toast.success(t("admin.texts.toastSaved"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.updateFailed"))),
  });
}
