import type { Entry } from "../types";

/** البريد الصادر (core/mail) وصفحاتُ الروابط التي يحملها (modules/auth/email-links). */
export const mail = {
  // ── ما يتكرّر في كلّ رسالة ──
  "mail.brand": {
    ar: "منصة مذكرتي",
    en: "Mudhakkirati",
    fr: "Mudhakkirati",
  },
  "mail.footer": {
    ar: "رسالة آلية من منصة مذكرتي — جامعة الشهيد حمه لخضر بالوادي. لا تردّ عليها.",
    en: "An automatic message from Mudhakkirati — University of El Oued. Please do not reply.",
    fr: "Message automatique de Mudhakkirati — Université d’El Oued. Merci de ne pas y répondre.",
  },
  "mail.ignore": {
    ar: "إن لم تطلب هذا، فتجاهل هذه الرسالة: حسابك لم يتغيّر.",
    en: "If you did not ask for this, ignore this message: your account has not changed.",
    fr: "Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre compte n’a pas changé.",
  },
  "mail.linkFallback": {
    ar: "إن لم يعمل الزر، فانسخ هذا الرابط في المتصفح:",
    en: "If the button does not work, copy this link into your browser:",
    fr: "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
  },

  // ── استعادة كلمة المرور ──
  "mail.reset.subject": {
    ar: "استعادة كلمة المرور — منصة مذكرتي",
    en: "Reset your password — Mudhakkirati",
    fr: "Réinitialiser votre mot de passe — Mudhakkirati",
  },
  "mail.reset.title": { ar: "استعادة كلمة المرور", en: "Reset your password", fr: "Réinitialiser le mot de passe" },
  "mail.reset.intro": {
    ar: "طُلبت كلمة مرور جديدة لحسابك ({{account}}). اضغط الزر لاختيارها:",
    en: "A new password was requested for your account ({{account}}). Press the button to choose it:",
    fr: "Un nouveau mot de passe a été demandé pour votre compte ({{account}}). Appuyez sur le bouton pour le choisir :",
  },
  "mail.reset.action": { ar: "اختيار كلمة مرور جديدة", en: "Choose a new password", fr: "Choisir un nouveau mot de passe" },
  "mail.reset.expires": {
    ar: "الرابط صالح {{minutes}} دقيقة، ولمرّة واحدة.",
    en: "The link works for {{minutes}} minutes, once.",
    fr: "Le lien est valable {{minutes}} minutes, une seule fois.",
  },

  // ── تأكيد البريد ──
  "mail.verify.subject": {
    ar: "تأكيد بريدك — منصة مذكرتي",
    en: "Confirm your email — Mudhakkirati",
    fr: "Confirmez votre e-mail — Mudhakkirati",
  },
  "mail.verify.title": { ar: "تأكيد البريد الإلكتروني", en: "Confirm your email address", fr: "Confirmer votre adresse e-mail" },
  "mail.verify.intro": {
    ar: "اضغط الزر لتأكيد أن هذا البريد لحسابك ({{account}}). بعدها تستطيع استعادة كلمة مرورك به، وتصلك عليه تنبيهات الأمان.",
    en: "Press the button to confirm this address belongs to your account ({{account}}). You can then reset your password with it, and receive security alerts here.",
    fr: "Appuyez sur le bouton pour confirmer que cette adresse appartient à votre compte ({{account}}). Vous pourrez alors réinitialiser votre mot de passe avec elle et y recevoir les alertes de sécurité.",
  },
  "mail.verify.action": { ar: "تأكيد البريد", en: "Confirm my email", fr: "Confirmer mon e-mail" },
  "mail.verify.expires": {
    ar: "الرابط صالح {{hours}} ساعة.",
    en: "The link works for {{hours}} hours.",
    fr: "Le lien est valable {{hours}} heures.",
  },

  // ── تنبيهات الأمان ──
  "mail.passwordChanged.subject": {
    ar: "تغيّرت كلمة مرور حسابك",
    en: "Your password was changed",
    fr: "Votre mot de passe a été modifié",
  },
  "mail.passwordChanged.title": { ar: "تغيّرت كلمة المرور", en: "Password changed", fr: "Mot de passe modifié" },
  "mail.passwordChanged.intro": {
    ar: "تغيّرت كلمة مرور حسابك ({{account}}) في {{when}}، وخرجت كلّ الأجهزة الأخرى منه.",
    en: "The password of your account ({{account}}) was changed on {{when}}, and every other device was signed out.",
    fr: "Le mot de passe de votre compte ({{account}}) a été modifié le {{when}}, et tous les autres appareils ont été déconnectés.",
  },
  "mail.passwordChanged.byAdmin": {
    ar: "أعادت الإدارة تعيين كلمة مرور حسابك ({{account}}) في {{when}}. ستُطلب منك كلمة مرور جديدة عند دخولك.",
    en: "The administration reset the password of your account ({{account}}) on {{when}}. You will be asked for a new one when you sign in.",
    fr: "L’administration a réinitialisé le mot de passe de votre compte ({{account}}) le {{when}}. Un nouveau vous sera demandé à la connexion.",
  },
  "mail.notYou": {
    ar: "إن لم تكن أنت، فاتصل بإدارة المنصة فوراً.",
    en: "If this was not you, contact the platform's administration at once.",
    fr: "Si ce n’était pas vous, contactez immédiatement l’administration de la plateforme.",
  },
  "mail.newDevice.subject": {
    ar: "دخول جديد إلى حسابك",
    en: "A new sign-in to your account",
    fr: "Nouvelle connexion à votre compte",
  },
  "mail.newDevice.title": { ar: "دخول من جهاز جديد", en: "Sign-in from a new device", fr: "Connexion depuis un nouvel appareil" },
  "mail.newDevice.intro": {
    ar: "دخل أحدٌ إلى حسابك ({{account}}) من جهاز لم يُستعمل فيه من قبل:",
    en: "Someone signed in to your account ({{account}}) from a device it had not been used on before:",
    fr: "Quelqu’un s’est connecté à votre compte ({{account}}) depuis un appareil jamais utilisé auparavant :",
  },
  "mail.newDevice.device": { ar: "الجهاز: {{device}}", en: "Device: {{device}}", fr: "Appareil : {{device}}" },
  "mail.newDevice.ip": { ar: "العنوان: {{ip}}", en: "Address: {{ip}}", fr: "Adresse : {{ip}}" },
  "mail.newDevice.when": { ar: "الوقت: {{when}}", en: "Time: {{when}}", fr: "Heure : {{when}}" },
  "mail.newDevice.action": { ar: "مراجعة الأجهزة", en: "Review your devices", fr: "Voir vos appareils" },
  "mail.newDevice.notYou": {
    ar: "إن لم يكن هذا أنت، فغيّر كلمة مرورك، وأخرِج ذلك الجهاز من صفحة حسابك.",
    en: "If this was not you, change your password, and sign that device out from your account page.",
    fr: "Si ce n’était pas vous, changez votre mot de passe et déconnectez cet appareil depuis votre page de compte.",
  },

  // ── رسائل البريد كما تكتبها الإدارة (core/mail/mail-templates) ──
  "mailTemplates.unknownKey": {
    ar: "نصٌّ لا يُعرف في رسائل البريد: {{name}}.",
    en: "Not a text of the emails: {{name}}.",
    fr: "Ce n’est pas un texte des e-mails : {{name}}.",
  },
  "mailTemplates.unknownVar": {
    ar: "«{{name}}» ليست من قيم هذا النص — المتاح: {{list}}.",
    en: "“{{name}}” is not one of this text’s values — available: {{list}}.",
    fr: "« {{name}} » n’est pas une valeur de ce texte — disponibles : {{list}}.",
  },
  "mailTemplates.noVars": {
    ar: "هذا النص لا يأخذ قيماً: احذف «{{name}}».",
    en: "This text takes no values: remove “{{name}}”.",
    fr: "Ce texte ne prend aucune valeur : retirez « {{name}} ».",
  },
  "mailTemplates.oneLine": {
    ar: "هذا النص سطرٌ واحد.",
    en: "This text is a single line.",
    fr: "Ce texte tient sur une seule ligne.",
  },
  "mailTemplates.tooLong": {
    ar: "أطول من {{max}} حرفاً.",
    en: "Longer than {{max}} characters.",
    fr: "Plus de {{max}} caractères.",
  },
  "mailTemplates.colour": {
    ar: "لونٌ غير صالح — اكتبه هكذا: ‎#26423d.",
    en: "Not a valid colour — write it like #26423d.",
    fr: "Couleur invalide — écrivez-la ainsi : #26423d.",
  },
  "mailTemplates.logoFile": {
    ar: "صورة الشعار غير صالحة للبريد: ارفعها من جديد (PNG أو JPEG، أقلّ من 512 كيلوبايت).",
    en: "The logo picture cannot go in an email: upload it again (PNG or JPEG, under 512 KB).",
    fr: "L’image du logo ne peut pas aller dans un e-mail : téléversez-la à nouveau (PNG ou JPEG, moins de 512 Ko).",
  },
  "mailTemplates.testPrefix": {
    ar: "[تجربة]",
    en: "[Test]",
    fr: "[Essai]",
  },
  "mailTemplates.noTestAddress": {
    ar: "ليس لحسابك بريدٌ مؤكَّد تصل إليه الرسالة التجريبية — أكّد بريدك من «حسابي» أولاً.",
    en: "Your account has no confirmed email for the test message — confirm yours in “My account” first.",
    fr: "Votre compte n’a pas d’adresse confirmée pour le message d’essai — confirmez la vôtre dans « Mon compte » d’abord.",
  },
  "mailTemplates.testSent": {
    ar: "أرسلنا نسخةً تجريبية إلى {{email}}.",
    en: "A test copy is on its way to {{email}}.",
    fr: "Une copie d’essai a été envoyée à {{email}}.",
  },

  // ── ما تقوله الواجهة البرمجية ──
  "auth.resetSent": {
    ar: "إن كان لهذا الحساب بريدٌ مؤكَّد، فقد أرسلنا إليه رابطاً لاختيار كلمة مرور جديدة. تفقّد بريدك، والبريد المزعج أيضاً.",
    en: "If this account has a confirmed email address, a link to choose a new password is on its way. Check your inbox, and your spam folder too.",
    fr: "Si ce compte a une adresse e-mail confirmée, un lien pour choisir un nouveau mot de passe vient d’y être envoyé. Vérifiez votre boîte, et les indésirables aussi.",
  },
  "auth.resetInvalid": {
    ar: "الرابط غير صالح أو انتهت مدّته أو استُعمل — اطلب رابطاً جديداً.",
    en: "The link is invalid, expired or already used — ask for a new one.",
    fr: "Le lien est invalide, expiré ou déjà utilisé — demandez-en un nouveau.",
  },
  "auth.resetDone": {
    ar: "تغيّرت كلمة مرورك. سجّل الدخول بها الآن.",
    en: "Your password was changed. Sign in with it now.",
    fr: "Votre mot de passe a été modifié. Connectez-vous avec lui maintenant.",
  },
  "auth.mailOff": {
    ar: "إرسال البريد غير مفعّل على هذا الخادم — اتصل بإدارة المنصة.",
    en: "Sending email is not set up on this server — contact the platform's administration.",
    fr: "L’envoi d’e-mails n’est pas configuré sur ce serveur — contactez l’administration de la plateforme.",
  },
  "auth.mailFailed": {
    ar: "تعذّر إرسال البريد الآن — حاول بعد قليل، وإن تكرّر فأبلغ إدارة المنصة.",
    en: "The email could not be sent right now — try again shortly; if it keeps failing, tell the platform's administration.",
    fr: "L’e-mail n’a pas pu être envoyé pour le moment — réessayez dans un instant ; si cela persiste, prévenez l’administration de la plateforme.",
  },
  "auth.verifyInvalid": {
    ar: "رابط التأكيد غير صالح أو انتهت مدّته — اطلب رابطاً جديداً من صفحة حسابك.",
    en: "The confirmation link is invalid or expired — ask for a new one from your account page.",
    fr: "Le lien de confirmation est invalide ou expiré — demandez-en un nouveau depuis votre page de compte.",
  },
  "auth.verifyDone": {
    ar: "تأكّد بريدك {{email}}.",
    en: "Your email {{email}} is confirmed.",
    fr: "Votre e-mail {{email}} est confirmé.",
  },
  "account.verifySent": {
    ar: "أرسلنا رابط التأكيد إلى {{email}} — صالح {{hours}} ساعة.",
    en: "A confirmation link was sent to {{email}} — it works for {{hours}} hours.",
    fr: "Un lien de confirmation a été envoyé à {{email}} — valable {{hours}} heures.",
  },
  "account.noEmail": {
    ar: "لا بريد في حسابك لتأكيده.",
    en: "Your account has no email address to confirm.",
    fr: "Votre compte n’a pas d’adresse e-mail à confirmer.",
  },
  "account.alreadyVerified": {
    ar: "بريدك مؤكَّد من قبل.",
    en: "Your email is already confirmed.",
    fr: "Votre e-mail est déjà confirmé.",
  },
  "account.tooManyLinks": {
    ar: "طلبت روابط كثيرة في وقت قصير — انتظر قليلاً ثم أعد المحاولة.",
    en: "Too many links asked for in a short time — wait a little and try again.",
    fr: "Trop de liens demandés en peu de temps — patientez un peu puis réessayez.",
  },
} satisfies Record<string, Entry>;
