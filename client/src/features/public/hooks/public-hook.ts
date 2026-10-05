import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { publicApi, type PublicTopicsParams } from "../api/public.api";

export function usePublicTopics(params?: PublicTopicsParams) {
  return useQuery({
    queryKey: ["public", "topics", params ?? {}],
    queryFn: () => publicApi.listTopics(params),
    // الفلترة فوريّة: تبقى النتائج السابقة ظاهرةً حتى تصل الجديدة، فلا
    // تومض الشبكة فارغةً مع كلّ حرفٍ أو اختيار.
    placeholderData: keepPreviousData,
  });
}

export function usePublicTopicFilters() {
  return useQuery({
    queryKey: ["public", "topic-filters"],
    queryFn: () => publicApi.getTopicFilters(),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePublicTopic(id: string | null) {
  return useQuery({
    queryKey: ["public", "topic", id],
    queryFn: () => publicApi.getTopic(id as string),
    enabled: !!id,
    // «محجوزٌ لغيرك» و«غير موجود» جوابان لا عطلان: إعادة الطلب لن تغيّرهما،
    // وتؤخّر الشاشة التي تشرحهما.
    retry: (count, err) => {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      return status !== 403 && status !== 404 && count < 1;
    },
  });
}

export function usePublicDepartments() {
  return useQuery({
    queryKey: ["public", "departments"],
    queryFn: () => publicApi.listDepartments(),
  });
}

export function usePublicSpecializations(departmentId?: string) {
  return useQuery({
    queryKey: ["public", "specializations", departmentId ?? "all"],
    queryFn: () => publicApi.listSpecializations(departmentId),
  });
}
