import { useQuery } from "@tanstack/react-query";
import { topicLookupsApi } from "../lib/api/topic-lookups";

export const TOPIC_LOOKUP_KEYS = {
  all: ["topic-lookups"] as const,
  types: (specializationId: string) => ["topic-lookups", "types", specializationId] as const,
  professors: ["topic-lookups", "professors"] as const,
};

/** The types a topic of this specialization may take — none asked before one is chosen. */
export function useTopicTypeOptions(specializationId?: string) {
  return useQuery({
    queryKey: TOPIC_LOOKUP_KEYS.types(specializationId ?? ""),
    queryFn: () => topicLookupsApi.topicTypes(specializationId!),
    enabled: !!specializationId,
    staleTime: 60_000,
  });
}

/** The professors to pick a co-supervisor from. */
export function useProfessorOptions(enabled = true) {
  return useQuery({
    queryKey: TOPIC_LOOKUP_KEYS.professors,
    queryFn: topicLookupsApi.professors,
    enabled,
    staleTime: 5 * 60_000,
  });
}
