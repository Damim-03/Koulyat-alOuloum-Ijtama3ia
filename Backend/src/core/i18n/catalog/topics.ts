import { arN, enN, frN, type Entry } from "../types";

/** يومٌ بلغة القارئ وبتوقيت الجامعة: «11 نوفمبر 2026». */
const day = (iso: string | number, locale: string) =>
  new Date(String(iso)).toLocaleDateString(locale, { dateStyle: "long", timeZone: "Africa/Algiers" });

/**
 * لحظةٌ من فترة: يومها، وساعتها إن لم تكن حدّ اليوم (00:00:00 لبدايةٍ،
 * 23:59:59 لنهاية) — «10 نوفمبر 2026 على الساعة 08:00».
 */
const moment = (iso: string | number, locale: string, at: string) => {
  const d = new Date(String(iso));
  const date = d.toLocaleDateString(locale, { dateStyle: "long", timeZone: "Africa/Algiers" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Africa/Algiers", hour12: false });
  if (time === "00:00:00" || time === "23:59:59") return date;
  return `${date} ${at} ${time.endsWith(":00") ? time.slice(0, 5) : time}`;
};

const team = {
  ar: (n: number) => `فريقٌ من ${arN(n, ["طالبٍ واحد", "طالبين", "طلاب", "طالباً", "طالب"])}`,
  en: (n: number) => `a team of ${enN(n, "student", "students")}`,
  fr: (n: number) => `une équipe de ${frN(n, "étudiant", "étudiants")}`,
};

/**
 * من ينتظر القرار: فريقٌ بعدد طلابه، أو عدّة فرق بعددها — فالموضوع يقبل
 * طلباتٍ متزامنة حتى سقفه. `teams` عدد الفرق، و`count` طلابُ الفريق حين
 * يكون واحداً.
 */
const waiters = {
  ar: (p: Record<string, string | number>) =>
    // Without `teams`, Number() is NaN — not above one: the single-team wording.
    Number(p.teams) > 1
      ? `${arN(Number(p.teams), ["فريقٌ واحد", "فريقان", "فرق", "فريقاً", "فريق"])} تنتظر`
      : `${team.ar(Number(p.count))} ينتظر`,
  en: (p: Record<string, string | number>) =>
    Number(p.teams) > 1 ? `${enN(Number(p.teams), "team", "teams")} are waiting` : `${team.en(Number(p.count))} is waiting`,
  fr: (p: Record<string, string | number>) =>
    Number(p.teams) > 1 ? `${frN(Number(p.teams), "équipe", "équipes")} attendent` : `${team.fr(Number(p.count))} attend`,
};

/** يمنعه فريقٌ (أو فرقٌ) ينتظر القرار — بفعلٍ يتغيّر: الرفض، النشر، الأرشفة، الإسناد. */
const waiting = (arAct: string, enAct: string, frAct: string): Entry => ({
  ar: (p) =>
    `لا يمكن ${arAct}: ${waiters.ar(p)} القرار على هذا الموضوع. ابتّ في الطلبات من صفحة «طلبات المجموعات» أوّلاً.`,
  en: (p) =>
    `Can't ${enAct}: ${waiters.en(p)} for a decision on this topic. Decide on the requests from the “Group requests” page first.`,
  fr: (p) =>
    `Impossible de ${frAct} : ${waiters.fr(p)} une décision sur ce sujet. Traitez d’abord les demandes depuis la page « Demandes de groupe ».`,
});

/** الموضوع: قرار الإدارة فيه، والطلبات عليه، والإشراف. */
export const topics = {
  // ── أبواب قرار الإدارة (core/topic/topic-status) ──
  "gate.approve": {
    ar: "لا تتمّ الموافقة إلا على موضوعٍ قيد الانتظار أو مرفوض.",
    en: "Only a pending or rejected topic can be approved.",
    fr: "Seul un sujet en attente ou refusé peut être approuvé.",
  },
  "gate.reject": {
    ar: "لا يُرفض إلا موضوع قيد الانتظار أو تمت الموافقة عليه أو منشور. الموضوع الذي تشكّلت له مجموعة يُؤرشَف بدل رفضه.",
    en: "Only a pending, approved or published topic can be rejected. A topic that has formed a group is archived instead.",
    fr: "Seul un sujet en attente, approuvé ou publié peut être refusé. Un sujet dont le groupe est formé est archivé plutôt que refusé.",
  },
  "gate.rejectWaiting": waiting("رفض الموضوع", "reject the topic", "refuser le sujet"),
  "gate.publishWaiting": waiting("نشر الموضوع", "publish the topic", "publier le sujet"),
  "gate.archiveWaiting": waiting("أرشفة الموضوع", "archive the topic", "archiver le sujet"),
  "gate.assignWaiting": waiting("إسناد مجموعة إلى الموضوع", "assign a group to the topic", "attribuer un groupe au sujet"),
  "gate.publishReserved": {
    ar: "لا يمكن نشر الموضوع: عليه طلب فريق مقبول ما يزال يحجزه. افسخ مذكرته من صفحة «المذكرات» أوّلاً ليعود قابلاً للتداول.",
    en: "Can't publish the topic: an accepted team request still reserves it. Dissolve its project from the “Projects” page first to free it.",
    fr: "Impossible de publier le sujet : une demande d’équipe acceptée le réserve encore. Dissolvez d’abord son mémoire depuis la page « Mémoires ».",
  },
  "gate.publishNotApproved": {
    ar: "يجب أن تتمّ الموافقة على الموضوع قبل نشره.",
    en: "The topic must be approved before it can be published.",
    fr: "Le sujet doit être approuvé avant d’être publié.",
  },
  "gate.unpublish": {
    ar: "لا يمكن إلغاء النشر إلا لموضوع منشور ولم تُشكّل له مجموعة.",
    en: "Only a published topic with no group can be unpublished.",
    fr: "Seul un sujet publié sans groupe peut être dépublié.",
  },
  "gate.archive": {
    ar: "لا يُؤرشَف إلا موضوع تمت الموافقة عليه أو منشور أو مسند. الموضوع قيد الانتظار أو المرفوض يُبَتّ فيه لا يُؤرشَف.",
    en: "Only an approved, published or assigned topic can be archived. A pending or rejected topic needs a decision, not archiving.",
    fr: "Seul un sujet approuvé, publié ou attribué peut être archivé. Un sujet en attente ou refusé se tranche, il ne s’archive pas.",
  },
  "gate.unarchive": {
    ar: "لا يمكن إلغاء الأرشفة إلا لموضوع مؤرشف.",
    en: "Only an archived topic can be unarchived.",
    fr: "Seul un sujet archivé peut être désarchivé.",
  },
  "gate.deleteHasGroup": {
    ar: "لا يمكن حذف موضوع تشكّلت له مجموعة مذكرة؛ أرشفه بدلاً من ذلك.",
    en: "A topic with a project group can't be deleted — archive it instead.",
    fr: "Un sujet doté d’un groupe de mémoire ne peut pas être supprimé — archivez-le plutôt.",
  },
  "gate.deleteReserved": {
    ar: "لا يمكن حذف موضوع عليه طلب فريق مقبول. افسخ مذكرته أوّلاً.",
    en: "A topic with an accepted team request can't be deleted. Dissolve its project first.",
    fr: "Un sujet avec une demande d’équipe acceptée ne peut pas être supprimé. Dissolvez d’abord son mémoire.",
  },
  "gate.deleteWaiting": {
    ar: (p) =>
      `لا يمكن حذف الموضوع: ${waiters.ar(p)} قراره، وحذفه يمحو الطلبات بلا خبر. ابتّ فيها أوّلاً.`,
    en: (p) =>
      `Can't delete the topic: ${waiters.en(p)} for a decision, and deleting it would silently erase their requests. Decide on them first.`,
    fr: (p) =>
      `Impossible de supprimer le sujet : ${waiters.fr(p)} une décision, et la suppression effacerait les demandes sans prévenir. Traitez-les d’abord.`,
  },
  "gate.notAvailable": {
    ar: "هذا الإجراء غير متاح على هذا الموضوع.",
    en: "This action isn't available on this topic.",
    fr: "Cette action n’est pas disponible pour ce sujet.",
  },
  "gate.requestAccepted": {
    ar: "هذا الطلب مقبولٌ بالفعل.",
    en: "This request is already accepted.",
    fr: "Cette demande est déjà acceptée.",
  },
  "gate.topicGone": {
    ar: "هذا الموضوع لم يعد متاحاً (تمّت معالجته بالفعل).",
    en: "This topic is no longer available (it has already been handled).",
    fr: "Ce sujet n’est plus disponible (il a déjà été traité).",
  },
  "gate.topicTaken": {
    ar: "تمّت الموافقة على مجموعة لهذا الموضوع بالفعل — سبقهم فريقٌ آخر.",
    en: "A group has already been accepted for this topic — another team got there first.",
    fr: "Un groupe a déjà été accepté pour ce sujet — une autre équipe est passée avant.",
  },
  "gate.tooManyMembers": {
    ar: "عدد الأعضاء ({{members}}) يتجاوز الحدّ الأقصى للموضوع ({{max}}).",
    en: "The team ({{members}}) exceeds the topic's maximum ({{max}}).",
    fr: "L’équipe ({{members}}) dépasse le maximum du sujet ({{max}}).",
  },
  "gate.memberPlaced": {
    ar: "{{name}} في مشروعٍ بالفعل: «{{topic}}» — الطالب لا يكون إلّا في مشروعٍ واحد.",
    en: "{{name}} is already in a project: “{{topic}}” — a student can only be in one project.",
    fr: "{{name}} fait déjà partie d’un mémoire : « {{topic}} » — un étudiant ne peut être que dans un seul mémoire.",
  },
  "gate.rejectHasProject": {
    ar: "لا يمكن رفض طلب تشكّلت له مذكرة بالفعل. إن أردت التراجع فافسخ المذكرة من صفحة «المذكرات» — عندها يتحرّر الموضوع ويعود قابلاً للتداول.",
    en: "A request that already formed a project can't be rejected. To undo it, dissolve the project from the “Projects” page — the topic is then freed.",
    fr: "Une demande ayant déjà formé un mémoire ne peut pas être refusée. Pour revenir en arrière, dissolvez le mémoire depuis la page « Mémoires » — le sujet est alors libéré.",
  },

  // ── الطالب وطلبات المجموعات ──
  "student.topicUnavailable": {
    ar: "هذا الموضوع غير متاح.",
    en: "This topic isn't available.",
    fr: "Ce sujet n’est pas disponible.",
  },
  "student.topicNotOpen": {
    ar: "هذا الموضوع غير مفتوح للطلبات.",
    en: "This topic isn't open for requests.",
    fr: "Ce sujet n’est pas ouvert aux demandes.",
  },
  "student.registrationRequired": {
    ar: "رقم التسجيل مطلوب.",
    en: "The registration number is required.",
    fr: "Le matricule est obligatoire.",
  },
  "student.ownAccepted": {
    ar: "طلبك على هذا الموضوع قُبل بالفعل — إنه موضوع مذكرتك.",
    en: "Your request on this topic was already accepted — it's your project topic.",
    fr: "Votre demande sur ce sujet est déjà acceptée — c’est le sujet de votre mémoire.",
  },
  "student.teamAccepted": {
    ar: "فريقك مقبولٌ على هذا الموضوع — إنه موضوع مذكرتكم.",
    en: "Your team is accepted on this topic — it's your project topic.",
    fr: "Votre équipe est acceptée sur ce sujet — c’est le sujet de votre mémoire.",
  },
  "student.ownPending": {
    ar: "لك طلبٌ على هذا الموضوع ما يزال بانتظار قرار الإدارة.",
    en: "You already have a request on this topic awaiting the administration's decision.",
    fr: "Vous avez déjà une demande sur ce sujet en attente de la décision de l’administration.",
  },
  "student.teamPending": {
    ar: "أرسل فريقك طلباً على هذا الموضوع، وهو بانتظار قرار الإدارة.",
    en: "Your team sent a request on this topic; it's awaiting the administration's decision.",
    fr: "Votre équipe a envoyé une demande sur ce sujet ; elle attend la décision de l’administration.",
  },
  "student.topicReserved": {
    ar: "هذا الموضوع محجوز بالفعل.",
    en: "This topic is already reserved.",
    fr: "Ce sujet est déjà réservé.",
  },
  "student.requestCap": {
    ar: "اكتمل عدد الطلبات على هذا الموضوع ({{max}}): لا يستقبل طلباً جديداً حتى تبتّ الإدارة. اختر موضوعاً آخر.",
    en: "This topic has all the requests it takes ({{max}}): it accepts no new one until the administration decides. Choose another topic.",
    fr: "Ce sujet a reçu toutes les demandes qu’il accepte ({{max}}) : aucune nouvelle avant la décision de l’administration. Choisissez un autre sujet.",
  },
  "request.supersededReason": {
    ar: "اختارت الإدارة فريقاً آخر لهذا الموضوع — اختر موضوعاً غيره.",
    en: "The administration chose another team for this topic — choose a different topic.",
    fr: "L’administration a choisi une autre équipe pour ce sujet — choisissez-en un autre.",
  },
  "request.teamPlacedReason": {
    ar: "قُبل طلب فريقكم على موضوع «{{title}}»، فأُلغي هذا الطلب تلقائياً — الطالب لا يكون إلّا في مشروعٍ واحد.",
    en: "Your team’s request on “{{title}}” was accepted, so this one was cancelled automatically — a student can only be in one project.",
    fr: "La demande de votre équipe sur « {{title}} » a été acceptée ; celle-ci a donc été annulée automatiquement — un étudiant ne peut être que dans un seul mémoire.",
  },
  "request.memberPlacedReason": {
    ar: "أحدُ أعضاء فريقكم ({{names}}) صار في مشروع «{{title}}»، فأُلغي هذا الطلب تلقائياً — الطالب لا يكون إلّا في مشروعٍ واحد. يمكنكم إرسال طلبٍ جديد من دونه.",
    en: "A member of your team ({{names}}) is now in the project “{{title}}”, so this request was cancelled automatically — a student can only be in one project. You can send a new request without them.",
    fr: "Un membre de votre équipe ({{names}}) fait désormais partie du mémoire « {{title}} » ; cette demande a donc été annulée automatiquement — un étudiant ne peut être que dans un seul mémoire. Vous pouvez envoyer une nouvelle demande sans lui.",
  },
  "student.selfAsMember": {
    ar: "لا يمكنك إدخال رقم تسجيلك ضمن الزملاء — المرسِل يُضاف تلقائيًا.",
    en: "Don't enter your own registration number among teammates — you're added automatically as the sender.",
    fr: "N’indiquez pas votre propre matricule parmi les coéquipiers — vous êtes ajouté automatiquement comme expéditeur.",
  },
  "student.unknownRegistrations": {
    ar: "أرقام تسجيل غير موجودة: {{list}}",
    en: "Unknown registration numbers: {{list}}",
    fr: "Matricules inconnus : {{list}}",
  },
  "student.memberHasProject": {
    ar: "الطالب {{reg}} لديه مذكرة تخرّج بالفعل — لا يمكن إضافته إلى مجموعتك.",
    en: "Student {{reg}} already has a graduation project — they can't join your group.",
    fr: "L’étudiant {{reg}} a déjà un mémoire — il ne peut pas rejoindre votre groupe.",
  },
  "student.memberInOtherTeam": {
    ar: "الطالب {{reg}} منضمٌّ بالفعل إلى مجموعة أخرى — لا يمكن إضافته إلى مجموعتك.",
    en: "Student {{reg}} is already in another group — they can't join yours.",
    fr: "L’étudiant {{reg}} fait déjà partie d’un autre groupe — il ne peut pas rejoindre le vôtre.",
  },
  "student.selfHasProject": {
    ar: "لديك مذكرة تخرّج بالفعل («{{title}}») — لا يمكنك إرسال طلبٍ على موضوعٍ آخر.",
    en: "You already have a graduation project (“{{title}}”) — you can’t send a request on another topic.",
    fr: "Vous avez déjà un mémoire (« {{title}} ») — vous ne pouvez pas envoyer de demande sur un autre sujet.",
  },
  "student.selfInOtherTeam": {
    ar: "أنت عضوٌ في طلبٍ قائم أرسله {{name}} على موضوع «{{title}}» — الطالب لا يكون إلّا في فريقٍ واحد. وإن أردتم موضوعاً آخر، فطلبُ الفريق الثاني يُرسَل من حساب {{name}} بأولويةٍ أخرى.",
    en: "You’re in a live request {{name}} sent on “{{title}}” — a student can only be in one team. If your team wants another topic, the second request is sent from {{name}}’s account with another priority.",
    fr: "Vous faites partie d’une demande en cours envoyée par {{name}} sur « {{title}} » — un étudiant ne peut être que dans une seule équipe. Si votre équipe veut un autre sujet, la seconde demande s’envoie depuis le compte de {{name}}, avec une autre priorité.",
  },
  "student.teamTooBig": {
    ar: (p) => `الحدّ الأقصى لهذا الموضوع ${arN(Number(p.max), ["طالبٌ واحد", "طالبان", "طلاب", "طالباً", "طالب"])}.`,
    en: (p) => `This topic takes at most ${enN(Number(p.max), "student", "students")}.`,
    fr: (p) => `Ce sujet accepte au plus ${frN(Number(p.max), "étudiant", "étudiants")}.`,
  },
  "student.requestReviewed": {
    ar: "لا يمكن إلغاء طلب تمت مراجعته.",
    en: "A request that has been reviewed can't be cancelled.",
    fr: "Une demande déjà examinée ne peut pas être annulée.",
  },

  // ── الأستاذ ومقترحاته ──
  "professor.leaderNotInTeam": {
    ar: "المرسِل يجب أن يكون ضمن الطلبة المُختارين.",
    en: "The sender must be one of the chosen students.",
    fr: "L’expéditeur doit faire partie des étudiants choisis.",
  },
  "professor.teamTooBig": {
    ar: "عدد الطلبة يتجاوز الحدّ الأقصى للموضوع ({{max}}).",
    en: "The number of students exceeds the topic's maximum ({{max}}).",
    fr: "Le nombre d’étudiants dépasse le maximum du sujet ({{max}}).",
  },
  "professor.studentHasProject": {
    ar: "الطالب {{reg}} لديه مذكرة بالفعل.",
    en: "Student {{reg}} already has a project.",
    fr: "L’étudiant {{reg}} a déjà un mémoire.",
  },
  "professor.studentInRequest": {
    ar: "الطالب {{reg}} في طلبٍ قائمٍ على موضوع «{{title}}» — لا يُقترح في فريقٍ ثانٍ حتى يُبَتّ في ذلك الطلب.",
    en: "Student {{reg}} is in a live request on “{{title}}” — they can’t be proposed in a second team until it is decided.",
    fr: "L’étudiant {{reg}} fait partie d’une demande en cours sur « {{title}} » — il ne peut pas être proposé dans une seconde équipe avant qu’elle soit tranchée.",
  },
  "professor.cantEditDecided": {
    ar: "لا يُعدَّل موضوعٌ تمت الموافقة عليه أو نُشر.",
    en: "A topic that is approved or published can't be edited.",
    fr: "Un sujet approuvé ou publié ne peut pas être modifié.",
  },
  "professor.cantDeleteDecided": {
    ar: "لا يُحذف موضوعٌ تمت الموافقة عليه أو نُشر.",
    en: "A topic that is approved or published can't be deleted.",
    fr: "Un sujet approuvé ou publié ne peut pas être supprimé.",
  },

  // ── وثيقة الإشراف ──
  "supervision.notYourTopic": {
    ar: "هذا الموضوع ليس من إشرافك.",
    en: "This topic is not under your supervision.",
    fr: "Ce sujet n’est pas sous votre encadrement.",
  },
  "supervision.notMember": {
    ar: "لست من أعضاء مذكرة هذا الموضوع.",
    en: "You're not a member of this topic's project.",
    fr: "Vous ne faites pas partie du mémoire de ce sujet.",
  },
  "supervision.noGroup": {
    ar: "لا مجموعة مذكرةٍ لهذا الموضوع بعد، فلا وثيقة.",
    en: "This topic has no project group yet, so there's no document.",
    fr: "Ce sujet n’a pas encore de groupe de mémoire, donc pas de document.",
  },
  "supervision.missingRegistrations": {
    ar: (p) => `لا يمكن إصدار الوثيقة: ${arN(Number(p.count), ["طالبٌ واحد", "طالبان", "طلاب", "طالباً", "طالب"])} بلا رقم تسجيل. أكمل بياناتهم أوّلاً.`,
    en: (p) => `Can't issue the document: ${enN(Number(p.count), "student has", "students have")} no registration number. Complete their details first.`,
    fr: (p) => `Impossible d’émettre le document : ${frN(Number(p.count), "étudiant n’a", "étudiants n’ont")} pas de matricule. Complétez d’abord leurs informations.`,
  },
  "supervision.supervisorNameMissing": {
    ar: "اسم الأستاذ المشرف ناقص في النظام.",
    en: "The supervisor's name is missing in the system.",
    fr: "Le nom de l’encadrant manque dans le système.",
  },
  "supervision.numberFailed": {
    ar: "تعذّر إصدار رقم وثيقة — أعد المحاولة.",
    en: "Couldn't issue a document number — try again.",
    fr: "Impossible d’émettre un numéro de document — réessayez.",
  },
  "supervision.printRevoked": {
    ar: "وثيقةٌ ملغاة لا تُطبع.",
    en: "A revoked document can't be printed.",
    fr: "Un document révoqué ne peut pas être imprimé.",
  },
  "supervision.changedBeforePrint": {
    ar: "تغيّرت الورقة منذ فُتحت (بيانات الموضوع أو نصّ الورقة) — راجعها كما صارت ثمّ اطبعها.",
    en: "The sheet changed since it was opened (the topic's data or the sheet's text) — check it as it is now, then print it.",
    fr: "La fiche a changé depuis son ouverture (données du sujet ou texte de la fiche) — vérifiez-la telle qu’elle est, puis imprimez-la.",
  },

  // ── عدد الطلبة في كلّ موضوع ──
  "topic.teamSize.fixed": {
    ar: (p) => `عدد الطلبة في كلّ موضوعِ ${p.level} من مواضيع السنة «${p.year}» هو ${p.count} بالضبط — قرّرته الإدارة.`,
    en: (p) => `Every ${p.level} topic of «${p.year}» has exactly ${p.count} students — set by the administration.`,
    fr: (p) => `Chaque sujet de ${p.level} de «${p.year}» compte exactement ${p.count} étudiants — fixé par l’administration.`,
  },
  "topic.teamSize.max": {
    ar: (p) => `عدد الطلبة في موضوعِ ${p.level} من مواضيع السنة «${p.year}» لا يتجاوز ${p.max} — قرّرته الإدارة.`,
    en: (p) => `A ${p.level} topic of «${p.year}» has at most ${p.max} students — set by the administration.`,
    fr: (p) => `Un sujet de ${p.level} de «${p.year}» compte au plus ${p.max} étudiants — fixé par l’administration.`,
  },

  // ── حدّ المواضيع لكلّ أستاذ ──
  "topic.quota.reached": {
    ar: (p) =>
      `بلغتَ حدّ المواضيع للسنة «${p.year}»: ${p.max} لكلّ أستاذ، ولك منها ${p.count} — قرّرته الإدارة. ولا يُحسب ما رُفض، فيُرسل بدله.`,
    en: (p) =>
      `You have reached the topic limit for «${p.year}»: ${p.max} per professor, and you have ${p.count} — set by the administration. A rejected topic does not count, so one can be sent in its place.`,
    fr: (p) =>
      `Vous avez atteint la limite de sujets pour «${p.year}» : ${p.max} par enseignant, et vous en avez ${p.count} — fixée par l’administration. Un sujet refusé ne compte pas : un autre peut être envoyé à sa place.`,
  },

  // ── مهلة اختيار المواضيع (الطلبة) ──
  "topic.selection.notYet": {
    ar: (p) => `مهلة اختيار المواضيع للسنة «${p.year}» تبدأ في ${moment(p.date, "ar-DZ", "على الساعة")}.`,
    en: (p) => `Choosing topics for «${p.year}» opens on ${moment(p.date, "en-GB", "at")}.`,
    fr: (p) => `Le choix des sujets pour «${p.year}» ouvre le ${moment(p.date, "fr-FR", "à")}.`,
  },
  "topic.selection.closed": {
    ar: (p) =>
      `انتهت مهلة اختيار المواضيع للسنة «${p.year}» في ${moment(p.date, "ar-DZ", "على الساعة")}. لم يعد إرسال طلبٍ جديد ممكناً — راجع الإدارة إن كان لك عذر.`,
    en: (p) =>
      `Choosing topics for «${p.year}» closed on ${moment(p.date, "en-GB", "at")}. A new request can no longer be sent — see the administration if you have a reason.`,
    fr: (p) =>
      `Le choix des sujets pour «${p.year}» s’est terminé le ${moment(p.date, "fr-FR", "à")}. Une nouvelle demande n’est plus possible — voyez l’administration si vous avez un motif.`,
  },
  "topic.selection.locked": {
    ar: (p) => `انتهت مهلة اختيار المواضيع في ${moment(p.date, "ar-DZ", "على الساعة")}: طلبك بيد الإدارة الآن ولا يُسحب.`,
    en: (p) => `Choosing topics closed on ${moment(p.date, "en-GB", "at")}: your request is with the administration now and can't be withdrawn.`,
    fr: (p) => `Le choix des sujets s’est terminé le ${moment(p.date, "fr-FR", "à")} : votre demande est entre les mains de l’administration et ne peut plus être retirée.`,
  },

  // ── فترة اقتراح المواضيع ──
  "topic.proposals.notYet": {
    ar: (p) => `فترة اقتراح المواضيع للسنة «${p.year}» تبدأ في ${moment(p.date, "ar-DZ", "على الساعة")}.`,
    en: (p) => `Topic proposals for «${p.year}» open on ${moment(p.date, "en-GB", "at")}.`,
    fr: (p) => `Les propositions de sujets pour «${p.year}» ouvrent le ${moment(p.date, "fr-FR", "à")}.`,
  },
  "topic.proposals.closed": {
    ar: (p) =>
      `انتهت فترة اقتراح المواضيع للسنة «${p.year}» في ${moment(p.date, "ar-DZ", "على الساعة")}. ما زال بإمكانك تعديل مقترحاتك، أمّا موضوعٌ جديد فعبر الإدارة.`,
    en: (p) =>
      `Topic proposals for «${p.year}» closed on ${moment(p.date, "en-GB", "at")}. You can still edit your proposals; a new topic now goes through the administration.`,
    fr: (p) =>
      `Les propositions de sujets pour «${p.year}» ont pris fin le ${moment(p.date, "fr-FR", "à")}. Vous pouvez encore modifier vos propositions ; un nouveau sujet passe désormais par l’administration.`,
  },

  // ── المشرف المساعد ونوع الموضوع ──
  "topic.coSupervisorSelf": {
    ar: "المشرف المساعد أستاذٌ آخر غير المشرف نفسه.",
    en: "The co-supervisor must be another professor than the supervisor.",
    fr: "Le co-encadrant doit être un autre enseignant que l’encadrant.",
  },
  "topic.coSupervisorNotFound": {
    ar: "المشرف المساعد غير موجود بين أساتذة المنصّة.",
    en: "The co-supervisor isn't among the platform's professors.",
    fr: "Le co-encadrant ne figure pas parmi les enseignants de la plateforme.",
  },
  "topic.typeNotFound": {
    ar: "نوع الموضوع غير موجود — ربّما حذفته الإدارة.",
    en: "This topic type doesn't exist — the administration may have removed it.",
    fr: "Ce type de sujet n’existe pas — l’administration l’a peut-être supprimé.",
  },
  "topic.typeOtherDepartment": {
    ar: "نوع الموضوع من قسمٍ آخر غير قسم تخصّصه — اختر من أنواع قسمه.",
    en: "This topic type belongs to another department than the topic's specialization — pick one of its department's types.",
    fr: "Ce type de sujet relève d’un autre département que la spécialité du sujet — choisissez parmi les types de son département.",
  },
  "topicType.codeTaken": {
    ar: (p) => `الرمز «${p.code}» مستعمَلٌ لنوعٍ آخر في هذا القسم.`,
    en: (p) => `The code «${p.code}» is already used by another type in this department.`,
    fr: (p) => `Le code «${p.code}» est déjà utilisé par un autre type de ce département.`,
  },
  "topicType.inUse": {
    ar: (p) => `لا يُحذف هذا النوع: عليه ${arN(Number(p.count), ["موضوعٌ واحد", "موضوعان", "مواضيع", "موضوعاً", "موضوع"])}. انقلها إلى نوعٍ آخر أوّلاً.`,
    en: (p) => `This type can't be deleted: ${enN(Number(p.count), "topic uses", "topics use")} it. Move them to another type first.`,
    fr: (p) => `Ce type ne peut pas être supprimé : ${frN(Number(p.count), "sujet l’utilise", "sujets l’utilisent")}. Déplacez-les d’abord vers un autre type.`,
  },
} satisfies Record<string, Entry>;
