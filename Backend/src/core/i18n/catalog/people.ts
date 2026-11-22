import type { Entry } from "../types";

/** الحساب، والمراسلات، والصفحات العامّة، ومحتوى الموقع. */
export const people = {
  // ── الحساب ──
  "account.photoManaged": {
    ar: "لا يمكنك تغيير الصورة من حسابك — تديرها الإدارة.",
    en: "You can't change your photo from your account — the administration manages it.",
    fr: "Vous ne pouvez pas changer votre photo depuis votre compte — l’administration la gère.",
  },
  "account.wrongPassword": {
    ar: "كلمة المرور الحالية غير صحيحة.",
    en: "Your current password is incorrect.",
    fr: "Votre mot de passe actuel est incorrect.",
  },
  "account.arabicName": {
    ar: "الاسم واللقب بالحروف العربية — حرفان على الأقلّ، بلا أرقامٍ ولا حروفٍ لاتينية.",
    en: "The first and last name in Arabic letters — two at least, with no digits nor Latin letters.",
    fr: "Le prénom et le nom en lettres arabes — deux au moins, sans chiffres ni lettres latines.",
  },
  "account.usernameTaken": {
    ar: "اسم المستخدم «{{username}}» مستعمل في حساب آخر.",
    en: "The username «{{username}}» is used by another account.",
    fr: "Le nom d’utilisateur «{{username}}» est utilisé par un autre compte.",
  },
  "account.emailManaged": {
    ar: "بريدك تديره الإدارة — لا يتغيّر من هنا.",
    en: "Your email is managed by the administration — it can't be changed here.",
    fr: "Votre e-mail est géré par l’administration — il ne se modifie pas ici.",
  },
  "account.sameEmail": {
    ar: "هذا هو بريدك الحالي.",
    en: "This is already your email.",
    fr: "C’est déjà votre adresse e-mail.",
  },
  "account.emailIsUniversity": {
    ar: "هذا بريدك الجامعي، وبه تدخل أصلاً — أضف بريداً آخر تملكه وتفتحه.",
    en: "This is your university address, the one you sign in with — add another address you own and read.",
    fr: "C’est votre adresse universitaire, celle de connexion — ajoutez une autre adresse que vous possédez et consultez.",
  },
  "account.emailTaken": {
    ar: "هذا البريد مستعمل في حساب آخر.",
    en: "This email is used by another account.",
    fr: "Cette adresse e-mail est utilisée par un autre compte.",
  },
  "account.samePassword": {
    ar: "كلمة المرور الجديدة هي نفسها الحالية — اختر غيرها.",
    en: "The new password is the same as the current one — choose another.",
    fr: "Le nouveau mot de passe est identique à l’actuel — choisissez-en un autre.",
  },

  // ── كلمة المرور التي يختارها صاحبها (core/auth/password-policy) ──
  "password.tooShort": {
    ar: "كلمة المرور قصيرة: 8 أحرف على الأقل.",
    en: "The password is too short: at least 8 characters.",
    fr: "Le mot de passe est trop court : au moins 8 caractères.",
  },
  "password.tooLong": {
    ar: "كلمة المرور طويلة جداً — الحرف العربي يُحسب مرّتين، والحدّ 72.",
    en: "The password is too long — the limit is 72 bytes (an Arabic letter counts twice).",
    fr: "Le mot de passe est trop long — la limite est de 72 octets (une lettre arabe compte double).",
  },
  "password.needsMix": {
    ar: "اخلط الحروف بالأرقام أو الرموز — أو اكتب عبارةً من 14 حرفاً فأكثر. والتاريخ وحده لا يصلح.",
    en: "Mix letters with digits or symbols — or use a passphrase of 14 characters or more. A date alone won't do.",
    fr: "Mélangez lettres et chiffres ou symboles — ou utilisez une phrase de 14 caractères ou plus. Une date seule ne suffit pas.",
  },
  "password.common": {
    ar: "هذه من كلمات المرور الشائعة التي تُجرَّب أولاً — اختر غيرها.",
    en: "This is one of the common passwords attackers try first — choose another.",
    fr: "C’est un mot de passe courant, parmi les premiers essayés — choisissez-en un autre.",
  },
  "password.pattern": {
    ar: "كلمة المرور نمطٌ سهل التخمين (تسلسل أو تكرار) — اختر غيرها.",
    en: "The password is an easy pattern (a run or a repetition) — choose another.",
    fr: "Le mot de passe est un motif facile (suite ou répétition) — choisissez-en un autre.",
  },
  "password.personal": {
    ar: "لا تضع رقم تسجيلك أو رقمك الوظيفي في كلمة المرور.",
    en: "Don't put your registration or employee number in your password.",
    fr: "N’utilisez pas votre matricule ni votre numéro d’employé dans votre mot de passe.",
  },

  // ── التحقّق بخطوتين ──
  "twoFactor.adminOnly": {
    ar: "التحقّق بخطوتين متاحٌ لحسابات الإدارة.",
    en: "Two-step verification is available for administrator accounts.",
    fr: "La vérification en deux étapes est disponible pour les comptes administrateurs.",
  },
  "twoFactor.alreadyEnabled": {
    ar: "التحقّق بخطوتين مفعّلٌ من قبل.",
    en: "Two-step verification is already on.",
    fr: "La vérification en deux étapes est déjà activée.",
  },
  "twoFactor.notEnabled": {
    ar: "التحقّق بخطوتين غير مفعّل.",
    en: "Two-step verification is not on.",
    fr: "La vérification en deux étapes n’est pas activée.",
  },
  "twoFactor.noSetup": {
    ar: "ابدأ الإعداد أولاً، ثم أدخل الرمز الذي يظهر في التطبيق.",
    en: "Start the setup first, then enter the code the app shows.",
    fr: "Commencez la configuration, puis saisissez le code affiché par l’application.",
  },
  "twoFactor.badCode": {
    ar: "الرمز غير صحيح — تأكّد أن ساعة هاتفك مضبوطة وأعد المحاولة.",
    en: "Wrong code — check that your phone’s clock is right and try again.",
    fr: "Code incorrect — vérifiez l’heure de votre téléphone et réessayez.",
  },
  "account.phoneInvalid": {
    ar: "رقم الهاتف غير صالح.",
    en: "Invalid phone number.",
    fr: "Numéro de téléphone invalide.",
  },
  "account.usernameShort": {
    ar: "اسم المستخدم: 3 أحرف على الأقل.",
    en: "Username: at least 3 characters.",
    fr: "Nom d’utilisateur : au moins 3 caractères.",
  },
  "account.usernameChars": {
    ar: "اسم المستخدم: حروف لاتينية وأرقام و . _ - فقط.",
    en: "Username: Latin letters, digits and . _ - only.",
    fr: "Nom d’utilisateur : lettres latines, chiffres et . _ - uniquement.",
  },
  "account.emailInvalid": {
    ar: "البريد الإلكتروني غير صالح.",
    en: "Invalid email address.",
    fr: "Adresse e-mail invalide.",
  },

  // ── المراسلات ──
  "messages.studentProfileMissing": {
    ar: "ملف الطالب غير موجود.",
    en: "Student profile not found.",
    fr: "Profil étudiant introuvable.",
  },
  "messages.professorProfileMissing": {
    ar: "ملف الأستاذ غير موجود.",
    en: "Professor profile not found.",
    fr: "Profil enseignant introuvable.",
  },
  "messages.studentScope": {
    ar: "لا يمكنك مراسلة مستخدمين لا تربطك بهم علاقة أكاديمية (أستاذك المشرف أو أعضاء فريقك أو الإدارة).",
    en: "You can only message people you work with (your supervisor, your team or the administration).",
    fr: "Vous ne pouvez écrire qu’aux personnes avec qui vous travaillez (votre encadrant, votre équipe ou l’administration).",
  },
  "messages.professorScope": {
    ar: "يمكنك مراسلة الطلبة المرتبطين بمواضيعك فقط (أعضاء مذكراتك أو أصحاب طلبات المجموعات عليها).",
    en: "You can only message students linked to your topics (your project members or teams requesting them).",
    fr: "Vous ne pouvez écrire qu’aux étudiants liés à vos sujets (membres de vos mémoires ou équipes qui les demandent).",
  },
  "messages.senderSuspended": {
    ar: "الحساب موقوف — لا يمكن إرسال رسائل.",
    en: "This account is suspended — it can't send messages.",
    fr: "Ce compte est suspendu — il ne peut pas envoyer de messages.",
  },
  "messages.noRecipient": {
    ar: "حدّد مستلماً واحداً على الأقل.",
    en: "Choose at least one recipient.",
    fr: "Choisissez au moins un destinataire.",
  },
  "messages.recipientsMissing": {
    ar: "بعض المستلمين غير موجودين.",
    en: "Some recipients don't exist.",
    fr: "Certains destinataires n’existent pas.",
  },
  "messages.recipientsSuspended": {
    ar: "بعض المستلمين حساباتهم موقوفة — أزلهم من القائمة ثمّ أعد الإرسال.",
    en: "Some recipients are suspended — remove them from the list and send again.",
    fr: "Certains destinataires sont suspendus — retirez-les de la liste puis renvoyez.",
  },
  "messages.noReplyToBroadcast": {
    ar: "لا يُردّ على تعميمٍ أرسلتَه — أرسل تعميماً جديداً أو رسالةً مباشرة.",
    en: "You can't reply to a broadcast you sent — send a new broadcast or a direct message.",
    fr: "Vous ne pouvez pas répondre à une diffusion que vous avez envoyée — envoyez une nouvelle diffusion ou un message direct.",
  },
  "messages.nobodyLeft": {
    ar: "لم يعد في المحادثة من يستقبل الرسالة.",
    en: "Nobody is left in this conversation to receive the message.",
    fr: "Plus personne dans cette conversation ne peut recevoir le message.",
  },
  "messages.emptyAudience": {
    ar: "لا يوجد مستلمون مطابقون لهذا الجمهور.",
    en: "No recipients match this audience.",
    fr: "Aucun destinataire ne correspond à ce public.",
  },
  "messages.bodyRequired": {
    ar: "اكتب نصّ الرسالة.",
    en: "Write the message text.",
    fr: "Écrivez le texte du message.",
  },
  "messages.bodyOrFile": {
    ar: "اكتب نصّ الرسالة أو أرفق ملفاً.",
    en: "Write the message text or attach a file.",
    fr: "Écrivez le texte du message ou joignez un fichier.",
  },

  "messages.editWindowPassed": {
    ar: "لا تُعدَّل الرسالة إلا خلال {{minutes}} دقيقة من إرسالها.",
    en: "A message can only be edited within {{minutes}} minutes of sending it.",
    fr: "Un message ne peut être modifié que dans les {{minutes}} minutes suivant son envoi.",
  },

  // ── الملفات المرفقة بالرسائل ──
  "messages.fileType": {
    ar: "نوع الملف غير مدعوم. المسموح: PDF وWord وExcel وPowerPoint ونصّ عادي، وصور PNG وJPG وWebP.",
    en: "Unsupported file type. Allowed: PDF, Word, Excel, PowerPoint, plain text, and PNG, JPG or WebP images.",
    fr: "Type de fichier non pris en charge. Acceptés : PDF, Word, Excel, PowerPoint, texte brut, et images PNG, JPG ou WebP.",
  },
  "messages.fileMismatch": {
    ar: "محتوى الملف لا يطابق امتداده — قد يكون تالفاً، أو غُيّر اسمه.",
    en: "The file's content doesn't match its extension — it may be damaged, or renamed.",
    fr: "Le contenu du fichier ne correspond pas à son extension — il est peut-être endommagé, ou renommé.",
  },
  "messages.fileTooLarge": {
    ar: "حجم الملف أكبر من {{max}} ميغابايت.",
    en: "The file is larger than {{max}} MB.",
    fr: "Le fichier dépasse {{max}} Mo.",
  },
  "messages.tooManyFiles": {
    ar: "يمكن إرفاق {{max}} ملفات على الأكثر في الرسالة الواحدة.",
    en: "A message can carry at most {{max}} files.",
    fr: "Un message peut contenir au plus {{max}} fichiers.",
  },
  "messages.tooManyDrafts": {
    ar: "لديك ملفات كثيرة مرفوعة لم تُرسل بعد — أرسلها أو احذفها أولاً.",
    en: "You have too many uploaded files not sent yet — send or remove them first.",
    fr: "Vous avez trop de fichiers envoyés mais pas encore expédiés — envoyez-les ou retirez-les d’abord.",
  },
  "messages.filesGone": {
    ar: "بعض الملفات المرفقة لم تعد متاحة — أرفقها من جديد.",
    en: "Some attached files are no longer available — attach them again.",
    fr: "Certains fichiers joints ne sont plus disponibles — joignez-les à nouveau.",
  },
  "messages.fileNotFound": {
    ar: "الملف غير موجود، أو لا يحقّ لك فتحه.",
    en: "The file doesn't exist, or you may not open it.",
    fr: "Le fichier n’existe pas, ou vous ne pouvez pas l’ouvrir.",
  },

  // ── الصفحات العامّة ──
  "public.topicPlaced": {
    ar: (p) => `لك مذكرة قائمة «${p.title}»، فلا تُعرض تفاصيل المواضيع الأخرى.`,
    en: (p) => `You already have a thesis, «${p.title}», so other topics' details aren't shown.`,
    fr: (p) => `Vous avez déjà un mémoire, « ${p.title} » : les détails des autres sujets ne sont pas affichés.`,
  },
  "public.topicReserved": {
    ar: "هذا الموضوع محجوز لفريقٍ آخر، فلا تُعرض تفاصيله.",
    en: "This topic is reserved for another team, so its details aren't shown.",
    fr: "Ce sujet est réservé à une autre équipe ; ses détails ne sont pas affichés.",
  },

  // ── محتوى الموقع ──
  "site.newsLimit": {
    ar: "بلغت الحدّ الأقصى ({{max}} خبراً) — احذف خبراً قديماً قبل إضافة آخر.",
    en: "You've reached the limit ({{max}} news items) — delete an old one before adding another.",
    fr: "Limite atteinte ({{max}} actualités) — supprimez-en une ancienne avant d’en ajouter.",
  },
  "site.slidesFull": {
    ar: "بلغت الحدّ الأقصى ({{max}} صورة) — احذف صورةً قبل إضافة أخرى.",
    en: "You've reached the limit ({{max}} images) — delete one before adding another.",
    fr: "Limite atteinte ({{max}} images) — supprimez-en une avant d’en ajouter.",
  },
  "site.slidesRoom": {
    ar: "المساحة المتبقّية {{room}} من {{max}} — اختر عدداً أقلّ من الصور.",
    en: "Only {{room}} of {{max}} places left — choose fewer images.",
    fr: "Il ne reste que {{room}} places sur {{max}} — choisissez moins d’images.",
  },
  "site.slidesChanged": {
    ar: "تغيّرت قائمة الصور منذ فتحها — أعد تحميل الصفحة ثمّ رتّبها.",
    en: "The image list changed since you opened it — reload the page, then reorder.",
    fr: "La liste des images a changé depuis son ouverture — rechargez la page puis réordonnez.",
  },
} satisfies Record<string, Entry>;
