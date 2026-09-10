import type { TFunction } from "i18next";
import type { AdminTopic, TopicActionKey, TopicActions } from "../../../types/admin";

/**
 * قراءة حكم الخادم على موضوع — بدل استنتاجه من `status`.
 *
 * الشاشات كانت تُقلّد قواعد الخادم: `deletable = status !== "full"` بينما
 * الحارس الحقيقي «هل له مجموعة؟ هل عليه طلب حيّ؟». فيُعرض حذفٌ مستحيل على
 * موضوع مؤرشف له مجموعة، ويُخفى حذفٌ جائز عن غيره. الخادم يرسل الحكم وسببه
 * مع كل موضوع الآن، وهذه الوحدة تقرؤه لا غير.
 */

/** احتياط لموضوع جاء من نقطة نهاية لم تُرسل `actions` بعد. */
const UNKNOWN: TopicActions = {
  canApprove: false,
  canReject: false,
  canPublish: false,
  canUnpublish: false,
  canArchive: false,
  canUnarchive: false,
  canDelete: false,
  canAssignGroup: false,
  blockedReasons: {},
  blockedCodes: {},
};

export const actionsOf = (topic?: Pick<AdminTopic, "actions"> | null) =>
  topic?.actions ?? UNKNOWN;

export const can = (
  topic: Pick<AdminTopic, "actions"> | null | undefined,
  action: TopicActionKey,
): boolean => {
  const a = actionsOf(topic);
  return {
    approve: a.canApprove,
    reject: a.canReject,
    publish: a.canPublish,
    unpublish: a.canUnpublish,
    archive: a.canArchive,
    unarchive: a.canUnarchive,
    delete: a.canDelete,
    assignGroup: a.canAssignGroup,
  }[action];
};

/**
 * سبب المنع بلغة المستخدم.
 *
 * يُترجَم الرمز أوّلاً — فالإدارة قد تعمل بالفرنسية، وتلميحٌ عربيّ في واجهة
 * فرنسية لا يشرح شيئاً. وإن لم تكن للرمز ترجمة بعد، يُعرض نصّ الخادم العربيّ
 * كما هو: سببٌ مفهوم خيرٌ من زرّ مطفأ بلا تفسير.
 */
export const blockReason = (
  topic: Pick<AdminTopic, "actions"> | null | undefined,
  action: TopicActionKey,
  t: TFunction,
): string | undefined => {
  const a = actionsOf(topic);
  const fallback = a.blockedReasons[action];
  const block = a.blockedCodes[action];
  if (!block) return fallback;
  return t(`topicBlocked.${block.code}`, {
    ...(block.params ?? {}),
    defaultValue: fallback ?? "",
  });
};

/** يصفّي مجموعة مواضيع على ما يجوز عليها فعلاً — للعمليات الجماعية. */
export const filterByAction = <T extends Pick<AdminTopic, "actions">>(
  topics: T[],
  action: TopicActionKey,
): T[] => topics.filter((t) => can(t, action));
