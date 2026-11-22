import { arN, enN, frN, type Entry } from "../types";

/** ما يشترك فيه الخادم كلّه: الدخول والصلاحيات، و«غير موجود»، والرفع، والتحقّق. */
export const common = {
  // ── الدخول والجلسة ──
  "auth.unauthorized": {
    ar: "يلزم تسجيل الدخول.",
    en: "You need to sign in.",
    fr: "Vous devez vous connecter.",
  },
  "auth.userNotFound": {
    ar: "الحساب لم يعد موجوداً.",
    en: "This account no longer exists.",
    fr: "Ce compte n’existe plus.",
  },
  "auth.suspended": {
    ar: "تم تعليق حسابك. يرجى التواصل مع الإدارة.",
    en: "Your account has been suspended. Please contact the administration.",
    fr: "Votre compte a été suspendu. Veuillez contacter l’administration.",
  },
  "auth.sessionRevoked": {
    ar: "أُنهيت هذه الجلسة — سجّل الدخول من جديد.",
    en: "This session has ended — please sign in again.",
    fr: "Cette session a pris fin — reconnectez-vous.",
  },
  "auth.tokenExpired": {
    ar: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول من جديد.",
    en: "Your session has expired. Please sign in again.",
    fr: "Votre session a expiré. Veuillez vous reconnecter.",
  },
  "auth.invalidToken": {
    ar: "جلسةٌ غير صالحة — سجّل الدخول من جديد.",
    en: "Invalid session — please sign in again.",
    fr: "Session invalide — reconnectez-vous.",
  },
  "auth.failed": {
    ar: "تعذّر التحقّق من هويتك.",
    en: "Authentication failed.",
    fr: "L’authentification a échoué.",
  },
  "auth.invalidRefresh": {
    ar: "انتهت الجلسة — سجّل الدخول من جديد.",
    en: "Your session has ended — please sign in again.",
    fr: "Votre session a pris fin — reconnectez-vous.",
  },
  "auth.refreshRequired": {
    ar: "لا جلسة لتجديدها — سجّل الدخول.",
    en: "There is no session to renew — please sign in.",
    fr: "Aucune session à renouveler — connectez-vous.",
  },
  "auth.badCredentials": {
    ar: "بيانات الدخول غير صحيحة.",
    en: "Incorrect sign-in details.",
    fr: "Identifiants incorrects.",
  },
  "auth.locked": {
    ar: (p) =>
      `محاولاتٌ خاطئة متكرّرة، فأُقفل الدخول إلى هذا الحساب مؤقتاً. حاول مجدداً بعد ${arN(Number(p.minutes), ["دقيقة", "دقيقتين", "دقائق", "دقيقة", "دقيقة"])}.`,
    en: (p) => `Too many failed attempts — this account is locked for now. Try again in ${enN(Number(p.minutes), "minute", "minutes")}.`,
    fr: (p) => `Trop de tentatives échouées — ce compte est verrouillé pour le moment. Réessayez dans ${frN(Number(p.minutes), "minute", "minutes")}.`,
  },
  // التحقّق القصير قبل الدخول (modules/auth/captcha): نصٌّ لا يقول إن الحساب موجود.
  "auth.captchaRequired": {
    ar: "للمتابعة، أكمل التحقّق القصير ثم أعد المحاولة.",
    en: "To continue, complete the short check and try again.",
    fr: "Pour continuer, terminez la courte vérification puis réessayez.",
  },
  "auth.captchaInvalid": {
    ar: "انتهت صلاحية التحقّق أو استُعمل من قبل — أعده ثم حاول مجدداً.",
    en: "The check expired or was already used — run it again and retry.",
    fr: "La vérification a expiré ou a déjà servi — relancez-la puis réessayez.",
  },
  "auth.captchaCodeWrong": {
    ar: "الرمز لا يطابق الصورة — أعد التحقّق برمزٍ جديد.",
    en: "The code doesn't match the picture — run the check again for a new one.",
    fr: "Le code ne correspond pas à l’image — relancez la vérification pour en obtenir un nouveau.",
  },
  // التوثيق بالصور (modules/activation/activation-request).
  "activation.studentsOnly": {
    ar: "التفعيل والتوثيق لحسابات الطلبة.",
    en: "Activation and verification are for student accounts.",
    fr: "L’activation et la vérification concernent les comptes étudiants.",
  },
  "activation.qrUnread": {
    ar: "لم يُقرأ رمز QR في صورة البطاقة — أعد التصوير والرمز ظاهرٌ وواضح؛ لا يُرسل الطلب بدونه.",
    en: "The QR code in the card's photo could not be read — take it again with the code clear and visible; the request is not sent without it.",
    fr: "Le QR code de la photo de la carte n'a pas pu être lu — reprenez-la avec le code net et visible ; la demande ne part pas sans lui.",
  },
  "activation.qrOther": {
    ar: "رمز البطاقة يحمل رقماً غير رقم حسابك: لا يُقبل إلا صورة بطاقتك أنت.",
    en: "The card's code carries a number other than your account's: only a photo of your own card is accepted.",
    fr: "Le code de la carte porte un autre numéro que celui de votre compte : seule une photo de votre propre carte est acceptée.",
  },
  "activation.alreadyVerified": {
    ar: "حسابك موثّقٌ أصلاً.",
    en: "Your account is already verified.",
    fr: "Votre compte est déjà vérifié.",
  },
  "activation.photosRequired": {
    ar: "أرسل صورة بطاقة الطالب.",
    en: "Send a photo of your student card.",
    fr: "Envoyez une photo de votre carte d'étudiant.",
  },
  "activation.noRequest": {
    ar: "لا طلب تفعيلٍ قائم لهذا الطالب.",
    en: "This student has no pending activation request.",
    fr: "Cet étudiant n’a aucune demande d’activation en attente.",
  },
  "activation.changed": {
    ar: "أعاد الطالب إرسال صوره للتوّ — راجِع الصور الجديدة ثمّ قرّر.",
    en: "The student just sent new photos — review them, then decide.",
    fr: "L’étudiant vient d’envoyer de nouvelles photos — examinez-les, puis décidez.",
  },
  "activation.reasonRequired": {
    ar: "اكتب سبب الرفض: يقرؤه الطالب ليعيد الإرسال.",
    en: "Write the reason for refusing: the student reads it to send again.",
    fr: "Indiquez le motif du refus : l’étudiant le lira pour renvoyer sa demande.",
  },
  // «نسيت كلمة المرور» عبر الإدارة (modules/password-request).
  "passwordRequest.unknown": {
    ar: "لا يوجد طالبٌ بهذا الرقم.",
    en: "There is no student with this number.",
    fr: "Aucun étudiant n’a ce numéro.",
  },
  "passwordRequest.suspended": {
    ar: "هذا الحساب موقوف — تواصل مع الإدارة مباشرةً.",
    en: "This account is suspended — contact the administration directly.",
    fr: "Ce compte est suspendu — contactez directement l’administration.",
  },
  "passwordRequest.hasEmail": {
    ar: "لحسابك بريدٌ مؤكَّد: اطلب رابط الاستعادة إليه.",
    en: "Your account has a confirmed email: ask for the reset link there.",
    fr: "Votre compte a une adresse confirmée : demandez-y le lien de réinitialisation.",
  },
  "passwordRequest.noRequest": {
    ar: "لا طلب قائمٌ لهذا الطالب — لعلّه قُضي فيه، أو سحبه صاحبه.",
    en: "This student has no pending request — it may have been decided, or withdrawn.",
    fr: "Cet étudiant n’a aucune demande en attente — elle a peut-être été traitée, ou retirée.",
  },
  "passwordRequest.changed": {
    ar: "أعاد الطالب إرسال طلبه للتوّ — راجِع الصورة الجديدة ثمّ قرّر.",
    en: "The student just sent the request again — review the new photo, then decide.",
    fr: "L’étudiant vient de renvoyer sa demande — examinez la nouvelle photo, puis décidez.",
  },
  "passwordRequest.approved": {
    ar: "كُتبت كلمة المرور — تظهر للطالب على الجهاز الذي أرسل منه الطلب.",
    en: "The password is set — the student sees it on the device the request came from.",
    fr: "Le mot de passe est défini — l’étudiant le voit sur l’appareil d’où vient la demande.",
  },
  "passwordRequest.rejected": {
    ar: "رُفض الطلب، ويقرأ الطالب السبب.",
    en: "Request refused; the student reads the reason.",
    fr: "Demande refusée ; l’étudiant en lit le motif.",
  },
  "auth.tooManyAttempts": {
    ar: "محاولاتٌ خاطئة كثيرة — حاول مجدداً بعد بضع دقائق.",
    en: "Too many failed attempts — please try again in a few minutes.",
    fr: "Trop de tentatives échouées — réessayez dans quelques minutes.",
  },
  "auth.tooManyRequests": {
    ar: "طلباتٌ كثيرة في وقتٍ قصير — انتظر قليلاً ثم أعد المحاولة.",
    en: "Too many requests in a short time — wait a moment and try again.",
    fr: "Trop de requêtes en peu de temps — patientez un instant puis réessayez.",
  },
  "auth.passwordChangeRequired": {
    ar: "كلمة المرور الحالية سلّمتها لك الإدارة — اختر كلمة مرورٍ جديدة قبل المتابعة.",
    en: "Your current password was given to you by the administration — choose a new one before continuing.",
    fr: "Votre mot de passe actuel vous a été remis par l’administration — choisissez-en un nouveau avant de continuer.",
  },
  "auth.twoFactorSetupRequired": {
    ar: "فعّل التحقّق بخطوتين قبل المتابعة — إلزاميٌّ لحسابات الإدارة.",
    en: "Turn on two-step verification before continuing — it is required for administrator accounts.",
    fr: "Activez la vérification en deux étapes avant de continuer — elle est obligatoire pour les comptes administrateurs.",
  },
  "auth.idleTimeout": {
    ar: "انتهت الجلسة بعد مدّةٍ دون نشاط — سجّل الدخول من جديد.",
    en: "Your session ended after a period of inactivity — please sign in again.",
    fr: "Votre session a pris fin après une période d’inactivité — reconnectez-vous.",
  },
  "auth.badCode": {
    ar: "الرمز غير صحيح أو انتهت صلاحيته.",
    en: "The code is incorrect or has expired.",
    fr: "Le code est incorrect ou a expiré.",
  },
  "auth.challengeExpired": {
    ar: "انتهت مهلة إدخال الرمز — سجّل الدخول من جديد.",
    en: "The time to enter the code has run out — please sign in again.",
    fr: "Le délai pour saisir le code est écoulé — reconnectez-vous.",
  },

  // ── الصلاحيات ──
  "access.invalidRole": {
    ar: "دورٌ غير معروف لهذا الحساب.",
    en: "This account has an unknown role.",
    fr: "Ce compte a un rôle inconnu.",
  },
  "access.forbidden": {
    ar: "ليست لديك صلاحية للوصول إلى هذا.",
    en: "You do not have permission to access this.",
    fr: "Vous n’avez pas la permission d’accéder à ceci.",
  },
  "access.adminOnly": {
    ar: "هذا للإدارة وحدها.",
    en: "Only an administrator can access this.",
    fr: "Réservé à l’administration.",
  },
  "access.notOwner.topic": {
    ar: "هذا الموضوع ليس لك.",
    en: "This topic is not yours.",
    fr: "Ce sujet ne vous appartient pas.",
  },
  "access.notOwner.group": {
    ar: "هذه المذكرة ليست تحت إشرافك.",
    en: "This project is not under your supervision.",
    fr: "Ce mémoire n’est pas sous votre encadrement.",
  },
  "access.notOwner.milestone": {
    ar: "هذه المرحلة ليست من مذكراتك.",
    en: "This milestone is not from your projects.",
    fr: "Cette étape ne fait pas partie de vos mémoires.",
  },
  "access.notOwner.request": {
    ar: "هذا الطلب ليس لك.",
    en: "This request is not yours.",
    fr: "Cette demande ne vous appartient pas.",
  },

  // ── غير موجود ──
  "notFound.generic": { ar: "العنصر المطلوب غير موجود.", en: "The requested item was not found.", fr: "L’élément demandé est introuvable." },
  "notFound.route": { ar: "هذا المسار غير موجود.", en: "This path does not exist.", fr: "Ce chemin n’existe pas." },
  "notFound.account": { ar: "الحساب غير موجود.", en: "Account not found.", fr: "Compte introuvable." },
  "notFound.user": { ar: "المستخدم غير موجود.", en: "User not found.", fr: "Utilisateur introuvable." },
  "notFound.session": { ar: "الجلسة غير موجودة أو انتهت.", en: "Session not found or already ended.", fr: "Session introuvable ou déjà terminée." },
  "notFound.notification": { ar: "التنبيه غير موجود.", en: "Notification not found.", fr: "Notification introuvable." },
  "notFound.student": { ar: "الطالب غير موجود.", en: "Student not found.", fr: "Étudiant introuvable." },
  "notFound.professor": { ar: "الأستاذ غير موجود.", en: "Professor not found.", fr: "Enseignant introuvable." },
  "notFound.topic": { ar: "الموضوع غير موجود.", en: "Topic not found.", fr: "Sujet introuvable." },
  "notFound.project": { ar: "المذكرة غير موجودة.", en: "Project not found.", fr: "Mémoire introuvable." },
  "notFound.milestone": { ar: "المرحلة غير موجودة.", en: "Milestone not found.", fr: "Étape introuvable." },
  "notFound.defense": { ar: "المناقشة غير موجودة.", en: "Defense not found.", fr: "Soutenance introuvable." },
  "notFound.groupRequest": { ar: "طلب المجموعة غير موجود.", en: "Group request not found.", fr: "Demande de groupe introuvable." },
  "notFound.faculty": { ar: "الكلية غير موجودة.", en: "Faculty not found.", fr: "Faculté introuvable." },
  "notFound.department": { ar: "القسم غير موجود.", en: "Department not found.", fr: "Département introuvable." },
  "notFound.domain": { ar: "الميدان غير موجود.", en: "Domain not found.", fr: "Domaine introuvable." },
  "notFound.filiere": { ar: "الشعبة غير موجودة.", en: "Filière not found.", fr: "Filière introuvable." },
  "notFound.specialization": { ar: "التخصص غير موجود.", en: "Specialization not found.", fr: "Spécialité introuvable." },
  "notFound.academicYear": { ar: "السنة الجامعية غير موجودة.", en: "Academic year not found.", fr: "Année universitaire introuvable." },
  "notFound.document": { ar: "الوثيقة غير موجودة.", en: "Document not found.", fr: "Document introuvable." },
  "notFound.message": { ar: "الرسالة غير موجودة.", en: "Message not found.", fr: "Message introuvable." },
  "notFound.sender": { ar: "المرسِل غير موجود.", en: "Sender not found.", fr: "Expéditeur introuvable." },
  "notFound.news": { ar: "الخبر غير موجود.", en: "News item not found.", fr: "Actualité introuvable." },
  "notFound.image": { ar: "الصورة غير موجودة.", en: "Image not found.", fr: "Image introuvable." },
  "notFound.emailDomain": { ar: "النطاق غير موجود.", en: "Domain name not found.", fr: "Nom de domaine introuvable." },

  // ── الطلب نفسه ──
  "request.invalidJson": {
    ar: "صيغة البيانات المُرسَلة غير صالحة.",
    en: "The data sent is not valid JSON.",
    fr: "Les données envoyées ne sont pas un JSON valide.",
  },
  "request.tooLarge": {
    ar: "حجم الطلب أكبر من المسموح به.",
    en: "The request is too large.",
    fr: "La requête est trop volumineuse.",
  },
  "request.validation": {
    ar: "تحقّق من صحة البيانات المدخلة.",
    en: "Please check the details you entered.",
    fr: "Veuillez vérifier les informations saisies.",
  },
  "request.validationAt": {
    ar: "بياناتٌ غير صالحة: {{issues}}",
    en: "Invalid data: {{issues}}",
    fr: "Données invalides : {{issues}}",
  },
  "request.originNotAllowed": {
    ar: "مصدر الطلب غير مسموح به.",
    en: "This origin is not allowed.",
    fr: "Cette origine n’est pas autorisée.",
  },
  "request.serverError": {
    ar: "حدث خطأ في الخادم — أعد المحاولة بعد قليل.",
    en: "A server error occurred — try again in a moment.",
    fr: "Une erreur serveur s’est produite — réessayez dans un instant.",
  },
  "request.duplicate": {
    ar: "القيمة مستعمَلة بالفعل.",
    en: "This value is already in use.",
    fr: "Cette valeur est déjà utilisée.",
  },
  "request.duplicateFields": {
    ar: "القيمة مستعمَلة بالفعل: {{fields}}",
    en: "Already in use: {{fields}}",
    fr: "Déjà utilisé : {{fields}}",
  },
  "request.missingRef": {
    ar: "أحد المراجع المُرسَلة غير موجود.",
    en: "One of the referenced items does not exist.",
    fr: "Un des éléments référencés n’existe pas.",
  },
  "request.missingRefFields": {
    ar: "مرجعٌ غير موجود: {{fields}}",
    en: "Missing reference: {{fields}}",
    fr: "Référence introuvable : {{fields}}",
  },
  "request.nothingToUpdate": {
    ar: "لا يوجد ما يُحدَّث.",
    en: "There is nothing to update.",
    fr: "Rien à mettre à jour.",
  },

  // ── الرفع ──
  "upload.tooLarge": {
    ar: "الملف أكبر من الحجم المسموح به.",
    en: "The file is larger than allowed.",
    fr: "Le fichier dépasse la taille autorisée.",
  },
  "upload.invalid": {
    ar: "طلب رفعٍ غير صالح.",
    en: "Invalid upload.",
    fr: "Envoi de fichier invalide.",
  },
  "upload.imageType": {
    ar: "نوع الملفّ غير مدعوم (PNG/JPG/WEBP فقط).",
    en: "Unsupported file type (PNG/JPG/WEBP only).",
    fr: "Type de fichier non pris en charge (PNG/JPG/WEBP uniquement).",
  },
  "upload.xlsxType": {
    ar: "نوع الملفّ غير مدعوم — ارفع ملفّ Excel بصيغة .xlsx",
    en: "Unsupported file type — upload an Excel .xlsx file.",
    fr: "Type de fichier non pris en charge — envoyez un fichier Excel .xlsx.",
  },
  "upload.none": {
    ar: "لم يُرفع أيّ ملفّ.",
    en: "No file was uploaded.",
    fr: "Aucun fichier n’a été envoyé.",
  },
  "upload.noExcel": {
    ar: "لم يُرفع ملفّ — أرفق ملفّ Excel.",
    en: "No file was uploaded — attach an Excel file.",
    fr: "Aucun fichier envoyé — joignez un fichier Excel.",
  },
  "upload.notXlsx": {
    ar: "الملف ليس ملفّ Excel صالحاً (xlsx).",
    en: "The file is not a valid Excel (xlsx) file.",
    fr: "Le fichier n’est pas un fichier Excel (xlsx) valide.",
  },
  "upload.xlsxUnsafe": {
    ar: "تعذّر فتح الملف: إمّا أنّه تالف، وإمّا أنّ محتواه بعد فكّ ضغطه أكبر مما يحتمله الاستيراد. احفظه من جديد في Excel وأعد رفعه.",
    en: "The file could not be opened: it is damaged, or its content once unpacked is larger than an import allows. Save it again from Excel and re-upload it.",
    fr: "Impossible d’ouvrir le fichier : il est endommagé, ou son contenu décompressé dépasse ce qu’un import accepte. Réenregistrez-le depuis Excel et renvoyez-le.",
  },
  "upload.notImage": {
    ar: "الملفّ ليس صورة صالحة.",
    en: "The file is not a valid image.",
    fr: "Le fichier n’est pas une image valide.",
  },

  // ── السنة المؤرشفة ──
  "year.archivedNoWrite": {
    ar: "السنة الجامعية «{{title}}» مغلقةٌ ومحفوظة في الأرشيف — لا تُضاف إليها بيانات جديدة. أعد فتحها من صفحة الأرشيف إن لزم.",
    en: "The academic year «{{title}}» is closed and archived — nothing new can be added to it. Reopen it from the archive page if needed.",
    fr: "L’année universitaire «{{title}}» est clôturée et archivée — rien de nouveau ne peut y être ajouté. Rouvrez-la depuis les archives si nécessaire.",
  },
} satisfies Record<string, Entry>;
