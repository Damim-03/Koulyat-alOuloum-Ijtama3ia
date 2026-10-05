import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "i18next";
import { adminApi } from "../api/admin.api";
import { serverMessage } from "../../../lib/api/error";
import {
  SITE_ABOUT_KEY,
  SITE_DIRECTOR_KEY,
  SITE_LOGIN_KEY,
  SITE_NEWS_KEY,
} from "../../home/hooks/site-hook";
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
