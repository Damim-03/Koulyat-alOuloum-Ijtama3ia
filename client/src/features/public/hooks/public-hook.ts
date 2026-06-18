import { useQuery } from "@tanstack/react-query";
import { publicApi, type PublicTopicsParams } from "../api/public.api";

export function usePublicTopics(params?: PublicTopicsParams) {
  return useQuery({
    queryKey: ["public", "topics", params ?? {}],
    queryFn: () => publicApi.listTopics(params),
  });
}

export function usePublicTopic(id: string | null) {
  return useQuery({
    queryKey: ["public", "topic", id],
    queryFn: () => publicApi.getTopic(id as string),
    enabled: !!id,
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
