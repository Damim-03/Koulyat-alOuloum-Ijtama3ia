import { client } from "./client";
import type { ProfessorOption, TopicTypeOption } from "../../types/topic-extras";

/**
 * What a topic form offers beside its title, for whoever writes topics — the
 * administration and the professors alike (`/common`, Backend
 * modules/common/topic-lookups).
 */
export const topicLookupsApi = {
  /** The types of the specialization's department. */
  topicTypes: (specializationId: string) =>
    client
      .get<{ types: TopicTypeOption[] }>(`/common/topic-types`, { params: { specializationId } })
      .then((r) => r.data.types),
  /** The platform's active professors — the co-supervisor is one of them. */
  professors: () => client.get<{ professors: ProfessorOption[] }>(`/common/professors`).then((r) => r.data.professors),
};
