import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "i18next";
import { adminApi } from "../api/admin.api";
import { serverMessage } from "../../../lib/api/error";
import { HOME_SLIDES_KEY } from "../../home/hooks/site-hook";
import type { HomeSlide, HomeSlideInput, SlidePlacement } from "../../../types/site.types";

/**
 * لكلّ موضعٍ قائمته: صور الرئيسية وصور «عن المنصة» تُرتَّب وتُبدَّل كلٌّ على
 * حدة، فمفتاح الاستعلام يحمل الموضع.
 */
const keyOf = (placement: SlidePlacement) => ["admin", "home-slides", placement] as const;

/** قائمة الإدارة، وما يقرؤه الزائر منها — تتغيّران معاً، في الموضعين. */
function refresh(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["admin", "home-slides"] });
  qc.invalidateQueries({ queryKey: HOME_SLIDES_KEY });
}

export function useAdminHomeSlides(placement: SlidePlacement = "home") {
  return useQuery({
    queryKey: keyOf(placement),
    queryFn: () => adminApi.listHomeSlides(placement),
  });
}

/** عدّة صورٍ دفعةً واحدة — تُضاف كلّها أو لا شيء. */
export function useCreateHomeSlides(placement: SlidePlacement = "home") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      slides: { imageUrl: string; caption?: string | null }[];
      isActive?: boolean;
    }) => adminApi.createHomeSlides({ ...data, placement }),
    onSuccess: (slides) => {
      refresh(qc);
      toast.success(t("admin.slides.toastAddedMany", { count: slides.length }));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.addFailed"))),
  });
}

/**
 * التعديل، ومنه التفعيل والتعطيل.
 *
 * والمفتاح يتبدّل على الشاشة قبل جواب الخادم: مفتاحٌ ينتظر نصف ثانيةٍ
 * ليتحرّك يُقرأ معطَّلاً، فيُنقر ثانيةً فيرجع إلى ما كان.
 */
export function useUpdateHomeSlide(placement: SlidePlacement = "home") {
  const qc = useQueryClient();
  const KEY = keyOf(placement);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HomeSlideInput> }) =>
      adminApi.updateHomeSlide(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const before = qc.getQueryData<HomeSlide[]>(KEY);
      if (before && data.isActive !== undefined)
        qc.setQueryData<HomeSlide[]>(
          KEY,
          before.map((s) => (s.id === id ? { ...s, isActive: data.isActive! } : s)),
        );
      return { before };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(KEY, ctx.before);
      toast.error(serverMessage(e, t("toast.updateFailed")));
    },
    onSettled: () => refresh(qc),
  });
}

/** الترتيب يُرسم فوراً، ويُستعاد إن ردّه الخادم. */
export function useReorderHomeSlides(placement: SlidePlacement = "home") {
  const qc = useQueryClient();
  const KEY = keyOf(placement);
  return useMutation({
    mutationFn: (ids: string[]) => adminApi.reorderHomeSlides(ids, placement),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: KEY });
      const before = qc.getQueryData<HomeSlide[]>(KEY);
      if (before) {
        const byId = new Map(before.map((s) => [s.id, s]));
        qc.setQueryData<HomeSlide[]>(
          KEY,
          ids.flatMap((id, i) => {
            const s = byId.get(id);
            return s ? [{ ...s, sortOrder: i }] : [];
          }),
        );
      }
      return { before };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(KEY, ctx.before);
      toast.error(serverMessage(e, t("toast.updateFailed")));
    },
    onSettled: () => refresh(qc),
  });
}

export function useDeleteHomeSlide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteHomeSlide(id),
    onSuccess: () => {
      refresh(qc);
      toast.success(t("admin.slides.toastDeleted"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.deleteFailed"))),
  });
}
