import { arN, enN, frN, type Entry, type Params } from "../types";

/** يوم المناقشة بلغة القارئ وبتوقيت الجامعة. */
const when = (iso: string | number, locale: string) =>
  new Date(String(iso)).toLocaleString(locale, { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Algiers" });

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

const topicsN = {
  ar: (n: number) => arN(n, ["موضوعاً", "موضوعين", "مواضيع", "موضوعاً", "موضوع"]),
  en: (n: number) => enN(n, "topic", "topics"),
  fr: (n: number) => frN(n, "sujet", "sujets"),
};
const num = (p: Params, k: string) => Number(p[k]);

/**
 * نصوص الإشعارات — عنوانٌ ورسالة لكلٍّ منها. تُحفظ باللغات الثلاث مع
 * الإشعار (notification.service)، فيقرؤه صاحبه بلغة واجهته ولو كتبه غيره.
 */
export const notifications = {
  // ── الموضوع ──
  "notif.topicCreatedForYou.title": { ar: "أُسنِد إليك موضوع جديد", en: "A new topic was assigned to you", fr: "Un nouveau sujet vous a été attribué" },
  "notif.topicCreatedForYou.message": {
    ar: "أنشأت الإدارة موضوعاً تحت إشرافك: «{{title}}».",
    en: "The administration created a topic under your supervision: «{{title}}».",
    fr: "L’administration a créé un sujet sous votre encadrement : «{{title}}».",
  },
  "notif.assignedToTopic.title": { ar: "تم إسنادكم إلى موضوع", en: "You were assigned a topic", fr: "Un sujet vous a été attribué" },
  "notif.assignedToTopic.message": {
    ar: "أسندت الإدارة لكم موضوع: «{{title}}».",
    en: "The administration assigned you the topic «{{title}}».",
    fr: "L’administration vous a attribué le sujet «{{title}}».",
  },
  "notif.topicApproved.title": { ar: "تمت الموافقة على موضوعك", en: "Your topic was approved", fr: "Votre sujet a été approuvé" },
  "notif.topicApproved.message": {
    ar: "تمت الموافقة على الموضوع: «{{title}}».",
    en: "The topic «{{title}}» was approved.",
    fr: "Le sujet «{{title}}» a été approuvé.",
  },
  "notif.topicRejected.title": { ar: "تم رفض موضوعك", en: "Your topic was rejected", fr: "Votre sujet a été refusé" },
  "notif.topicRejected.message": {
    ar: "تم رفض الموضوع «{{title}}».",
    en: "The topic «{{title}}» was rejected.",
    fr: "Le sujet «{{title}}» a été refusé.",
  },
  "notif.topicRejected.messageReason": {
    ar: "تم رفض الموضوع «{{title}}». السبب: {{reason}}",
    en: "The topic «{{title}}» was rejected. Reason: {{reason}}",
    fr: "Le sujet «{{title}}» a été refusé. Raison : {{reason}}",
  },
  "notif.topicProposed.title": { ar: "موضوعٌ جديد بانتظار القرار", en: "A new topic awaits a decision", fr: "Un nouveau sujet attend une décision" },
  "notif.topicProposed.message": {
    ar: "اقترح أستاذٌ موضوع: «{{title}}».",
    en: "A professor proposed the topic «{{title}}».",
    fr: "Un enseignant a proposé le sujet «{{title}}».",
  },
  "notif.topicProposedWithTeam.title": {
    ar: "موضوعٌ جديد بفريقه بانتظار القرار",
    en: "A new topic with its team awaits a decision",
    fr: "Un nouveau sujet avec son équipe attend une décision",
  },
  "notif.topicProposedWithTeam.message": {
    ar: (p) => `اقترح أستاذٌ موضوع: «${p.title}» مع فريقٍ من ${arN(num(p, "count"), ["طالبٍ واحد", "طالبين", "طلاب", "طالباً", "طالب"])}.`,
    en: (p) => `A professor proposed the topic «${p.title}» with a team of ${enN(num(p, "count"), "student", "students")}.`,
    fr: (p) => `Un enseignant a proposé le sujet «${p.title}» avec une équipe de ${frN(num(p, "count"), "étudiant", "étudiants")}.`,
  },
  "notif.teamProposedForYou.title": { ar: "اقترح أستاذك موضوعاً لكم", en: "Your professor proposed a topic for you", fr: "Votre enseignant vous a proposé un sujet" },
  "notif.teamProposedForYou.message": {
    ar: "اقترح الأستاذ موضوع: «{{title}}» لفريقكم. بانتظار موافقة الإدارة.",
    en: "The professor proposed the topic «{{title}}» for your team. Awaiting the administration's approval.",
    fr: "L’enseignant a proposé le sujet «{{title}}» pour votre équipe. En attente de l’accord de l’administration.",
  },
  "notif.topicsImported.title": {
    ar: (p) => (num(p, "count") === 1 ? "أُضيف موضوعٌ باسمك" : "أُضيفت مواضيع باسمك"),
    en: (p) => (num(p, "count") === 1 ? "A topic was added in your name" : "Topics were added in your name"),
    fr: (p) => (num(p, "count") === 1 ? "Un sujet a été ajouté à votre nom" : "Des sujets ont été ajoutés à votre nom"),
  },
  "notif.topicsImported.message": {
    ar: (p) =>
      num(p, "count") === 1
        ? `أضافت الإدارة موضوعاً تحت إشرافك: «${p.title}».`
        : `أضافت الإدارة ${topicsN.ar(num(p, "count"))} تحت إشرافك، منها: «${p.title}».`,
    en: (p) =>
      num(p, "count") === 1
        ? `The administration added a topic under your supervision: «${p.title}».`
        : `The administration added ${topicsN.en(num(p, "count"))} under your supervision, including «${p.title}».`,
    fr: (p) =>
      num(p, "count") === 1
        ? `L’administration a ajouté un sujet sous votre encadrement : «${p.title}».`
        : `L’administration a ajouté ${topicsN.fr(num(p, "count"))} sous votre encadrement, dont «${p.title}».`,
  },
  "notif.assignedImported.title": {
    ar: (p) => (num(p, "count") === 1 ? "أُسند موضوعٌ تحت إشرافك" : "أُسندت مواضيع تحت إشرافك"),
    en: (p) => (num(p, "count") === 1 ? "An assigned topic was added under your supervision" : "Assigned topics were added under your supervision"),
    fr: (p) => (num(p, "count") === 1 ? "Un sujet attribué a été ajouté sous votre encadrement" : "Des sujets attribués ont été ajoutés sous votre encadrement"),
  },
  "notif.assignedImported.message": {
    ar: (p) =>
      num(p, "count") === 1
        ? `أضافت الإدارة موضوعاً مُسنَداً بطلبته تحت إشرافك: «${p.title}».`
        : `أضافت الإدارة ${topicsN.ar(num(p, "count"))} مُسنَدةً بطلبتها تحت إشرافك، منها: «${p.title}».`,
    en: (p) =>
      num(p, "count") === 1
        ? `The administration added a topic with its students under your supervision: «${p.title}».`
        : `The administration added ${topicsN.en(num(p, "count"))} with their students under your supervision, including «${p.title}».`,
    fr: (p) =>
      num(p, "count") === 1
        ? `L’administration a ajouté un sujet avec ses étudiants sous votre encadrement : «${p.title}».`
        : `L’administration a ajouté ${topicsN.fr(num(p, "count"))} avec leurs étudiants sous votre encadrement, dont «${p.title}».`,
  },

  // ── طلبات المجموعات ──
  "notif.groupRequestNew.title": { ar: "طلبُ مجموعة جديد", en: "New group request", fr: "Nouvelle demande de groupe" },
  "notif.groupRequestNew.message": {
    ar: "وصل طلبُ مجموعة على موضوع: «{{title}}».",
    en: "A group request arrived on the topic «{{title}}».",
    fr: "Une demande de groupe est arrivée sur le sujet «{{title}}».",
  },
  "notif.groupAccepted.title": { ar: "تمت الموافقة على مجموعتكم", en: "Your group was accepted", fr: "Votre groupe a été accepté" },
  "notif.groupAccepted.message": {
    ar: "تمت الموافقة على مجموعتكم لموضوع: «{{title}}».",
    en: "Your group was accepted for the topic «{{title}}».",
    fr: "Votre groupe a été accepté pour le sujet «{{title}}».",
  },
  "notif.newDevice.title": {
    ar: "دخولٌ إلى حسابك من جهازٍ جديد",
    en: "A sign-in to your account from a new device",
    fr: "Une connexion à votre compte depuis un nouvel appareil",
  },
  "notif.newDevice.message": {
    ar: "{{device}} — من العنوان {{ip}}. إن لم تكن أنت، فغيّر كلمة المرور وأخرج الأجهزة الأخرى من قسم «الأمان» في حسابك.",
    en: "{{device}} — from {{ip}}. If this wasn’t you, change your password and sign the other devices out under “Security” in your account.",
    fr: "{{device}} — depuis {{ip}}. Si ce n’était pas vous, changez votre mot de passe et déconnectez les autres appareils dans « Sécurité » de votre compte.",
  },
  // للإدارة: فشل الدخول على حساباتٍ كثيرة مختلفة في دقائق (modules/auth/failure-spike).
  "notif.loginSpike.title": {
    ar: "تنبيه أمني: محاولات دخولٍ فاشلة على حساباتٍ كثيرة",
    en: "Security alert: failed sign-ins on many accounts",
    fr: "Alerte de sécurité : connexions échouées sur de nombreux comptes",
  },
  "notif.loginSpike.message": {
    ar: (p) =>
      `فشل الدخول على ${arN(num(p, "count"), ["حسابٍ واحد", "حسابين", "حسابات", "حساباً", "حساب"])} في آخر ${arN(num(p, "minutes"), ["دقيقة", "دقيقتين", "دقائق", "دقيقة", "دقيقة"])} — قد تكون محاولةً لتخمين كلمات المرور. افتح «المرفوضة» في سجلّ التدقيق لترى الأرقام المجرَّبة وعناوين مصدرها.`,
    en: (p) =>
      `Sign-in failed on ${enN(num(p, "count"), "account", "accounts")} in the last ${enN(num(p, "minutes"), "minute", "minutes")} — possibly an attempt to guess passwords. Open “Refused” in the audit log to see what was tried and from which addresses.`,
    fr: (p) =>
      `La connexion a échoué sur ${frN(num(p, "count"), "compte", "comptes")} au cours des ${frN(num(p, "minutes"), "dernière minute", "dernières minutes")} — peut-être une tentative de deviner des mots de passe. Ouvrez « Refusées » dans le journal d’audit pour voir les identifiants essayés et leurs adresses.`,
  },
  // للإدارة: طالبٌ أرسل صورة بطاقته ليوثَّق حسابه (modules/activation).
  "notif.verificationRequest.title": {
    ar: "طلب توثيق حسابٍ جديد",
    en: "New account verification request",
    fr: "Nouvelle demande de vérification de compte",
  },
  "notif.verificationRequest.message": {
    ar: "{{name}} ({{reg}}) أرسل صورة بطاقته — تحقّق أنّها بطاقته، ثمّ اقبل أو ارفض.",
    en: "{{name}} ({{reg}}) sent a photo of their card — check that it is theirs, then accept or refuse.",
    fr: "{{name}} ({{reg}}) a envoyé une photo de sa carte — vérifiez que c'est la sienne, puis acceptez ou refusez.",
  },
  // للإدارة: طالبٌ بلا بريدٍ مؤكَّد نسي كلمة مروره (modules/password-request).
  "notif.passwordRequest.title": {
    ar: "طلب كلمة مرورٍ جديدة",
    en: "New password request",
    fr: "Nouvelle demande de mot de passe",
  },
  "notif.passwordRequest.message": {
    ar: "{{name}} ({{reg}}) نسي كلمة مروره وأرسل صورة بطاقته — تحقّق أنّها بطاقته، ثمّ اكتب له كلمة مرور أو ارفض.",
    en: "{{name}} ({{reg}}) forgot their password and sent a photo of their card — check that it is theirs, then write them a password or refuse.",
    fr: "{{name}} ({{reg}}) a oublié son mot de passe et envoyé une photo de sa carte — vérifiez que c'est la sienne, puis écrivez-lui un mot de passe ou refusez.",
  },
  "notif.groupSuperseded.title": {
    ar: "اختير فريقٌ آخر للموضوع",
    en: "Another team was chosen for the topic",
    fr: "Une autre équipe a été choisie pour le sujet",
  },
  "notif.groupSuperseded.message": {
    ar: "اختارت الإدارة فريقاً آخر لموضوع «{{title}}»، فأُلغي طلبكم عليه. يمكنكم الآن اختيار موضوعٍ آخر.",
    en: "The administration chose another team for “{{title}}”, so your request on it was cancelled. You can now choose another topic.",
    fr: "L’administration a choisi une autre équipe pour « {{title}} » ; votre demande a donc été annulée. Vous pouvez maintenant choisir un autre sujet.",
  },
  "notif.groupReleased.title": {
    ar: "أُلغي أحد طلباتكم تلقائياً",
    en: "One of your requests was cancelled automatically",
    fr: "Une de vos demandes a été annulée automatiquement",
  },
  "notif.groupReleased.message": {
    ar: "قُبل طلب فريقكم على «{{accepted}}»، فأُلغي طلبكم على «{{title}}» تلقائياً — الطالب لا يكون إلّا في مشروعٍ واحد.",
    en: "Your team’s request on “{{accepted}}” was accepted, so your request on “{{title}}” was cancelled automatically — a student can only be in one project.",
    fr: "La demande de votre équipe sur « {{accepted}} » a été acceptée ; votre demande sur « {{title}} » a donc été annulée automatiquement — un étudiant ne peut être que dans un seul mémoire.",
  },
  "notif.groupMemberPlaced.message": {
    ar: "أحدُ أعضاء فريقكم ({{names}}) صار في مشروع «{{accepted}}»، فأُلغي طلبكم على «{{title}}». يمكنكم إرسال طلبٍ جديد من دونه.",
    en: "A member of your team ({{names}}) is now in the project “{{accepted}}”, so your request on “{{title}}” was cancelled. You can send a new request without them.",
    fr: "Un membre de votre équipe ({{names}}) fait désormais partie du mémoire « {{accepted}} » ; votre demande sur « {{title}} » a donc été annulée. Vous pouvez envoyer une nouvelle demande sans lui.",
  },
  "notif.groupRejected.title": { ar: "تم رفض طلب مجموعتكم", en: "Your group request was rejected", fr: "Votre demande de groupe a été refusée" },
  "notif.groupRejected.message": {
    ar: "تم رفض طلب مجموعتكم على الموضوع.",
    en: "Your group request on the topic was rejected.",
    fr: "Votre demande de groupe sur le sujet a été refusée.",
  },
  "notif.groupRejected.messageReason": {
    ar: "تم رفض طلب مجموعتكم. السبب: {{reason}}",
    en: "Your group request was rejected. Reason: {{reason}}",
    fr: "Votre demande de groupe a été refusée. Raison : {{reason}}",
  },

  // ── المذكرات ──
  "notif.supervisionAssigned.title": { ar: "أُسند إليك الإشراف على مذكرة", en: "You now supervise a project", fr: "Vous encadrez désormais un mémoire" },
  "notif.supervisionAssigned.message": {
    ar: "أسندت إليك الإدارة الإشراف على «{{title}}».",
    en: "The administration made you the supervisor of «{{title}}».",
    fr: "L’administration vous a confié l’encadrement de «{{title}}».",
  },
  "notif.supervisionMoved.title": { ar: "نُقل الإشراف على مذكرة", en: "A project's supervision was moved", fr: "L’encadrement d’un mémoire a été transféré" },
  "notif.supervisionMoved.message": {
    ar: "نقلت الإدارة الإشراف على «{{title}}» إلى أستاذٍ آخر.",
    en: "The administration moved the supervision of «{{title}}» to another professor.",
    fr: "L’administration a transféré l’encadrement de «{{title}}» à un autre enseignant.",
  },
  "notif.addedToProject.title": { ar: "أُضفت إلى مذكرة", en: "You were added to a project", fr: "Vous avez été ajouté à un mémoire" },
  "notif.addedToProject.message": {
    ar: "أضافتك الإدارة إلى فريق «{{title}}».",
    en: "The administration added you to the team of «{{title}}».",
    fr: "L’administration vous a ajouté à l’équipe de «{{title}}».",
  },
  "notif.removedFromProject.title": { ar: "أُخرجت من مذكرة", en: "You were removed from a project", fr: "Vous avez été retiré d’un mémoire" },
  "notif.removedFromProject.message": {
    ar: "أخرجتك الإدارة من فريق «{{title}}».",
    en: "The administration removed you from the team of «{{title}}».",
    fr: "L’administration vous a retiré de l’équipe de «{{title}}».",
  },
  "notif.groupDissolved.title": { ar: "فُسخت مجموعتكم", en: "Your group was dissolved", fr: "Votre groupe a été dissous" },
  "notif.groupDissolved.message": {
    ar: "فسخت الإدارة مجموعتكم على موضوع «{{title}}».",
    en: "The administration dissolved your group on the topic «{{title}}».",
    fr: "L’administration a dissous votre groupe sur le sujet «{{title}}».",
  },
  "notif.groupDissolved.messageReason": {
    ar: "فُسخت مجموعتكم على موضوع «{{title}}». السبب: {{reason}}",
    en: "Your group on the topic «{{title}}» was dissolved. Reason: {{reason}}",
    fr: "Votre groupe sur le sujet «{{title}}» a été dissous. Raison : {{reason}}",
  },

  // ── المراحل ──
  "notif.milestoneAdded.title": { ar: "أضافت الإدارة مرحلة جديدة", en: "The administration added a milestone", fr: "L’administration a ajouté une étape" },
  "notif.milestoneUpdated.title": { ar: "عدّلت الإدارة مرحلة في مذكرتكم", en: "The administration changed a milestone", fr: "L’administration a modifié une étape" },
  "notif.milestoneDeleted.title": { ar: "حذفت الإدارة مرحلة من مذكرتكم", en: "The administration deleted a milestone", fr: "L’administration a supprimé une étape" },
  "notif.milestone.message": {
    ar: "المذكرة: «{{title}}».",
    en: "Project: «{{title}}».",
    fr: "Mémoire : «{{title}}».",
  },

  // ── المناقشات ──
  "notif.defenseScheduled.title": { ar: "بُرمجت مناقشة مذكرة", en: "A defense was scheduled", fr: "Une soutenance a été programmée" },
  "notif.defenseCancelled.title": { ar: "أُلغيت المناقشة", en: "The defense was cancelled", fr: "La soutenance a été annulée" },
  "notif.defenseCompleted.title": { ar: "اختُتمت المناقشة", en: "The defense is complete", fr: "La soutenance est terminée" },
  "notif.defenseMoved.title": { ar: "تغيّر موعد المناقشة", en: "The defense was rescheduled", fr: "La soutenance a été reprogrammée" },
  "notif.defenseCommittee.title": { ar: "تحدّثت لجنة المناقشة", en: "The defense committee was updated", fr: "Le jury de soutenance a été mis à jour" },
  "notif.defenseDeleted.title": { ar: "أُلغي موعد المناقشة", en: "The defense date was cancelled", fr: "La date de soutenance a été annulée" },
  "notif.defense.message": {
    ar: (p) => `«${p.title}» — ${when(p.date, "ar-DZ")}، القاعة ${p.room}.`,
    en: (p) => `«${p.title}» — ${when(p.date, "en-GB")}, room ${p.room}.`,
    fr: (p) => `«${p.title}» — ${when(p.date, "fr-FR")}, salle ${p.room}.`,
  },

  // ── الأرشيف ──
  "notif.yearArchived.title": {
    ar: "أُغلقت سنة جامعية وحُفظت في الأرشيف",
    en: "An academic year was closed and archived",
    fr: "Une année universitaire a été clôturée et archivée",
  },
  "notif.yearArchived.message": {
    ar: (p) =>
      `السنة ${p.year}: ${arN(num(p, "students"), ["طالبٌ واحد", "طالبان", "طلاب", "طالباً", "طالب"])}، ${arN(num(p, "projects"), ["مذكرةٌ واحدة", "مذكرتان", "مذكرات", "مذكرةً", "مذكرة"])}، ${arN(num(p, "defenses"), ["مناقشةٌ منتهية", "مناقشتان منتهيتان", "مناقشات منتهية", "مناقشةً منتهية", "مناقشة منتهية"])}.`,
    en: (p) =>
      `Year ${p.year}: ${enN(num(p, "students"), "student", "students")}, ${enN(num(p, "projects"), "project", "projects")}, ${enN(num(p, "defenses"), "completed defense", "completed defenses")}.`,
    fr: (p) =>
      `Année ${p.year} : ${frN(num(p, "students"), "étudiant", "étudiants")}, ${frN(num(p, "projects"), "mémoire", "mémoires")}, ${frN(num(p, "defenses"), "soutenance terminée", "soutenances terminées")}.`,
  },

  // ── مهلة اختيار المواضيع (الطلبة) ──
  "notif.selectionWindowSet.title": {
    ar: (p) => `مهلة اختيار المواضيع — ${p.year}`,
    en: (p) => `Deadline to choose your topic — ${p.year}`,
    fr: (p) => `Délai de choix des sujets — ${p.year}`,
  },
  "notif.selectionWindowSet.message": {
    ar: (p) => `اختاروا مواضيعكم وأرسلوا طلباتكم من ${moment(p.from, "ar-DZ", "على الساعة")} إلى ${moment(p.to, "ar-DZ", "على الساعة")}.`,
    en: (p) => `Choose your topics and send your requests from ${moment(p.from, "en-GB", "at")} to ${moment(p.to, "en-GB", "at")}.`,
    fr: (p) => `Choisissez vos sujets et envoyez vos demandes du ${moment(p.from, "fr-FR", "à")} au ${moment(p.to, "fr-FR", "à")}.`,
  },
  "notif.selectionWindowMoved.title": {
    ar: (p) => `تغيّرت مهلة اختيار المواضيع — ${p.year}`,
    en: (p) => `The deadline to choose topics changed — ${p.year}`,
    fr: (p) => `Le délai de choix des sujets a changé — ${p.year}`,
  },
  "notif.selectionWindowMoved.message": {
    ar: (p) => `المهلة الآن من ${moment(p.from, "ar-DZ", "على الساعة")} إلى ${moment(p.to, "ar-DZ", "على الساعة")}.`,
    en: (p) => `It now runs from ${moment(p.from, "en-GB", "at")} to ${moment(p.to, "en-GB", "at")}.`,
    fr: (p) => `Il court désormais du ${moment(p.from, "fr-FR", "à")} au ${moment(p.to, "fr-FR", "à")}.`,
  },

  // ── فترة اقتراح المواضيع ──
  "notif.proposalWindowSet.title": {
    ar: (p) => `فترة اقتراح المواضيع — ${p.year}`,
    en: (p) => `Topic proposal period — ${p.year}`,
    fr: (p) => `Période de proposition des sujets — ${p.year}`,
  },
  "notif.proposalWindowSet.message": {
    ar: (p) => `اقترحوا مواضيعكم من ${moment(p.from, "ar-DZ", "على الساعة")} إلى ${moment(p.to, "ar-DZ", "على الساعة")}.`,
    en: (p) => `Propose your topics from ${moment(p.from, "en-GB", "at")} to ${moment(p.to, "en-GB", "at")}.`,
    fr: (p) => `Proposez vos sujets du ${moment(p.from, "fr-FR", "à")} au ${moment(p.to, "fr-FR", "à")}.`,
  },
  "notif.proposalWindowMoved.title": {
    ar: (p) => `تغيّرت فترة اقتراح المواضيع — ${p.year}`,
    en: (p) => `The topic proposal period changed — ${p.year}`,
    fr: (p) => `La période de proposition des sujets a changé — ${p.year}`,
  },
  "notif.proposalWindowMoved.message": {
    ar: (p) => `الفترة الآن من ${moment(p.from, "ar-DZ", "على الساعة")} إلى ${moment(p.to, "ar-DZ", "على الساعة")}.`,
    en: (p) => `The period now runs from ${moment(p.from, "en-GB", "at")} to ${moment(p.to, "en-GB", "at")}.`,
    fr: (p) => `La période court désormais du ${moment(p.from, "fr-FR", "à")} au ${moment(p.to, "fr-FR", "à")}.`,
  },
} satisfies Record<string, Entry>;
