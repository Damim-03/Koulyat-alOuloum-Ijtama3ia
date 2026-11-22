import { arN, enN, frN, type Entry } from "../types";

/** عددٌ ومعدوده باللغات الثلاث — لما يُعدّ في رسائل المنع. */
const counted = (ar: [string, string, string, string, string], en: [string, string], fr: [string, string]): Entry => ({
  ar: (p) => arN(Number(p.count), ar),
  en: (p) => enN(Number(p.count), en[0], en[1]),
  fr: (p) => frN(Number(p.count), fr[0], fr[1]),
});

/** الإدارة: الحسابات، والهيكل، والسنوات، والمذكرات، والمراحل، والمناقشات، والطلبات. */
export const admin = {
  // ── أعدادٌ تُذكر في رسائل المنع ──
  "count.students": counted(["طالبٌ واحد", "طالبان", "طلاب", "طالباً", "طالب"], ["student", "students"], ["étudiant", "étudiants"]),
  "count.topics": counted(["موضوعٌ واحد", "موضوعان", "مواضيع", "موضوعاً", "موضوع"], ["topic", "topics"], ["sujet", "sujets"]),
  "count.departments": counted(["قسمٌ واحد", "قسمان", "أقسام", "قسماً", "قسم"], ["department", "departments"], ["département", "départements"]),
  "count.domains": counted(["ميدانٌ واحد", "ميدانان", "ميادين", "ميداناً", "ميدان"], ["domain", "domains"], ["domaine", "domaines"]),
  "count.filieres": counted(["شعبةٌ واحدة", "شعبتان", "شعب", "شعبةً", "شعبة"], ["filière", "filières"], ["filière", "filières"]),
  "count.specializations": counted(["تخصّصٌ واحد", "تخصّصان", "تخصّصات", "تخصّصاً", "تخصّص"], ["specialization", "specializations"], ["spécialité", "spécialités"]),
  "count.professors": counted(["أستاذٌ واحد", "أستاذان", "أساتذة", "أستاذاً", "أستاذ"], ["professor", "professors"], ["enseignant", "enseignants"]),
  "count.submissions": counted(["تسليمٌ واحد", "تسليمان", "تسليمات", "تسليماً", "تسليم"], ["submission", "submissions"], ["dépôt", "dépôts"]),

  // ── الحسابات ──
  "user.emailOrUsername": {
    ar: "البريد أو اسم المستخدم مطلوب.",
    en: "An email or a username is required.",
    fr: "Un e-mail ou un nom d’utilisateur est obligatoire.",
  },
  "user.isStudent": {
    ar: "هذا الحساب طالب؛ احذفه من إدارة الطلبة لتُنظَّف بياناته المرتبطة.",
    en: "This account is a student — delete it from student management so its linked data is cleaned up.",
    fr: "Ce compte est un étudiant — supprimez-le depuis la gestion des étudiants pour nettoyer ses données liées.",
  },
  "user.isProfessor": {
    ar: "هذا الحساب أستاذ؛ احذفه من إدارة الأساتذة.",
    en: "This account is a professor — delete it from professor management.",
    fr: "Ce compte est un enseignant — supprimez-le depuis la gestion des enseignants.",
  },
  "user.notYourself": {
    ar: "لا يمكنك تعطيل حسابك أو حذفه بنفسك — اطلب ذلك من مسؤولٍ آخر.",
    en: "You cannot suspend or delete your own account — ask another administrator.",
    fr: "Vous ne pouvez pas suspendre ni supprimer votre propre compte — demandez-le à un autre administrateur.",
  },
  "user.lastAdmin": {
    ar: "هذا آخر مسؤولٍ نشط في المنصّة — أنشئ مسؤولاً آخر أو فعّله قبل ذلك.",
    en: "This is the platform’s last active administrator — create or activate another one first.",
    fr: "C’est le dernier administrateur actif de la plateforme — créez-en ou activez-en un autre d’abord.",
  },
  "student.registrationTaken": {
    ar: "رقم التسجيل مستعمل بالفعل.",
    en: "This registration number is already in use.",
    fr: "Ce matricule est déjà utilisé.",
  },
  "professor.idsTaken": {
    ar: "الرقم الوظيفي أو البريد الجامعي مستعمل بالفعل.",
    en: "The employee number or university email is already in use.",
    fr: "Le matricule ou l’e-mail universitaire est déjà utilisé.",
  },
  "professor.employeeNumberFailed": {
    ar: "تعذّر توليد رقم وظيفي فريد — أعد المحاولة.",
    en: "Couldn't generate a unique employee number — try again.",
    fr: "Impossible de générer un matricule unique — réessayez.",
  },
  "professor.deleteBlocked": {
    ar: "لا يمكن حذف الأستاذ لارتباطه بـ {{what}}. أعِد إسناد المواضيع أو أرشفتها أوّلاً.",
    en: "This professor can't be deleted: {{what}} linked to them. Reassign or archive the topics first.",
    fr: "Cet enseignant ne peut pas être supprimé — éléments rattachés : {{what}}. Réattribuez ou archivez d’abord les sujets.",
  },

  // ── النطاقات الجامعية ──
  "emailDomain.exists": {
    ar: "هذا النطاق مضاف بالفعل.",
    en: "This domain name has already been added.",
    fr: "Ce nom de domaine est déjà ajouté.",
  },
  "emailDomain.lastOne": {
    ar: "لا يمكن حذف النطاق الوحيد المتبقّي.",
    en: "The last remaining domain name can't be deleted.",
    fr: "Le dernier nom de domaine restant ne peut pas être supprimé.",
  },
  "emailDomain.inUse": {
    ar: "لا يمكن حذف النطاق: يستعمله {{what}}.",
    en: "This domain name can't be deleted — it is used by {{what}}.",
    fr: "Ce nom de domaine ne peut pas être supprimé — utilisé par : {{what}}.",
  },
  "emailDomain.notAllowed": {
    ar: "نطاق البريد غير مسموح به. النطاقات المسموح بها: {{list}}",
    en: "This email domain isn't allowed. Allowed domains: {{list}}",
    fr: "Ce domaine d’e-mail n’est pas autorisé. Domaines autorisés : {{list}}",
  },
  "emailDomain.none": {
    ar: "لا توجد نطاقات جامعية مسجّلة — أضِف نطاقاً أوّلاً.",
    en: "No university domains are registered — add one first.",
    fr: "Aucun domaine universitaire n’est enregistré — ajoutez-en un d’abord.",
  },

  // ── الهيكل الجامعي ──
  "structure.codeTaken.faculty": { ar: "رمز الكلية مستعمل بالفعل.", en: "This faculty code is already in use.", fr: "Ce code de faculté est déjà utilisé." },
  "structure.codeTaken.domain": { ar: "رمز الميدان مستعمل بالفعل.", en: "This domain code is already in use.", fr: "Ce code de domaine est déjà utilisé." },
  "structure.codeTaken.department": { ar: "رمز القسم مستعمل بالفعل.", en: "This department code is already in use.", fr: "Ce code de département est déjà utilisé." },
  "structure.codeTaken.filiere": { ar: "رمز الشعبة مستعمل بالفعل.", en: "This filière code is already in use.", fr: "Ce code de filière est déjà utilisé." },
  "structure.parentRequired": {
    ar: "حدّد القسم أو الميدان.",
    en: "Choose the department or the domain.",
    fr: "Choisissez le département ou le domaine.",
  },
  "structure.label.faculty": { ar: "الكلية", en: "the faculty", fr: "la faculté" },
  "structure.label.department": { ar: "القسم «{{name}}»", en: "department «{{name}}»", fr: "le département «{{name}}»" },
  "structure.label.domain": { ar: "الميدان «{{name}}»", en: "domain «{{name}}»", fr: "le domaine «{{name}}»" },
  "structure.label.filiere": { ar: "الشعبة «{{name}}»", en: "filière «{{name}}»", fr: "la filière «{{name}}»" },
  "structure.codeRepeated": {
    ar: "الرمز «{{code}}» مكرّر أكثر من مرّة في النموذج ({{label}}).",
    en: "The code «{{code}}» appears more than once in the form ({{label}}).",
    fr: "Le code «{{code}}» apparaît plusieurs fois dans le formulaire ({{label}}).",
  },
  "structure.codesTaken": {
    ar: "رموز مستعملة بالفعل: {{list}}",
    en: "Codes already in use: {{list}}",
    fr: "Codes déjà utilisés : {{list}}",
  },
  "structure.danglingRef": {
    ar: "{{what}} يشير إلى عنصر غير موجود في النموذج.",
    en: "{{what}} refers to an item that isn't in the form.",
    fr: "{{what}} fait référence à un élément absent du formulaire.",
  },
  "structure.deleteBlocked.faculty": {
    ar: "لا يمكن حذف الكلية لارتباطها بـ {{what}}. احذف الأقسام أو انقلها أوّلاً.",
    en: "The faculty can't be deleted: {{what}} linked to it. Delete or move the departments first.",
    fr: "La faculté ne peut pas être supprimée — éléments rattachés : {{what}}. Supprimez ou déplacez d’abord les départements.",
  },
  "structure.deleteBlocked.domain": {
    ar: "لا يمكن حذف الميدان لارتباطه بـ {{what}}. احذف الشعب أو انقلها أوّلاً.",
    en: "The domain can't be deleted: {{what}} linked to it. Delete or move the filières first.",
    fr: "Le domaine ne peut pas être supprimé — éléments rattachés : {{what}}. Supprimez ou déplacez d’abord les filières.",
  },
  "structure.deleteBlocked.department": {
    ar: "لا يمكن حذف القسم لارتباطه بـ {{what}}.",
    en: "The department can't be deleted: {{what}} linked to it.",
    fr: "Le département ne peut pas être supprimé — éléments rattachés : {{what}}.",
  },
  "structure.deleteBlocked.filiere": {
    ar: "لا يمكن حذف الشعبة لارتباطها بـ {{what}}.",
    en: "The filière can't be deleted: {{what}} linked to it.",
    fr: "La filière ne peut pas être supprimée — éléments rattachés : {{what}}.",
  },
  "structure.deleteBlocked.specialization": {
    ar: "لا يمكن حذف التخصص لارتباطه بـ {{what}}.",
    en: "The specialization can't be deleted: {{what}} linked to it.",
    fr: "La spécialité ne peut pas être supprimée — éléments rattachés : {{what}}.",
  },

  // ── السنوات الجامعية والأرشيف ──
  "year.exists": {
    ar: "السنة الجامعية موجودة بالفعل.",
    en: "This academic year already exists.",
    fr: "Cette année universitaire existe déjà.",
  },
  "year.archivedCantActivate": {
    ar: "السنة «{{title}}» مؤرشفة — أعد فتحها من صفحة الأرشيف قبل تفعيلها.",
    en: "The year «{{title}}» is archived — reopen it from the archive page before activating it.",
    fr: "L’année «{{title}}» est archivée — rouvrez-la depuis les archives avant de l’activer.",
  },
  "year.activeCantDelete": {
    ar: "لا يمكن حذف السنة الجامعية النشطة. فعِّل سنة أخرى أوّلاً.",
    en: "The active academic year can't be deleted. Activate another year first.",
    fr: "L’année universitaire active ne peut pas être supprimée. Activez d’abord une autre année.",
  },
  "year.archivedCantDelete": {
    ar: "هذه السنة محفوظة في الأرشيف — حذفها يمحو سجلّها. أعد فتحها أوّلاً إن كنت متأكّداً.",
    en: "This year is archived — deleting it erases its record. Reopen it first if you are sure.",
    fr: "Cette année est archivée — la supprimer efface son historique. Rouvrez-la d’abord si vous êtes sûr.",
  },
  "year.deleteBlocked": {
    ar: "لا يمكن حذف السنة الجامعية لارتباطها بـ {{what}}.",
    en: "The academic year can't be deleted: {{what}} linked to it.",
    fr: "L’année universitaire ne peut pas être supprimée — éléments rattachés : {{what}}.",
  },
  "year.proposalWindow.order": {
    ar: "تاريخ نهاية الفترة قبل تاريخ بدايتها.",
    en: "The period ends before it starts.",
    fr: "La période se termine avant de commencer.",
  },
  "year.proposalWindow.date": {
    ar: "تاريخٌ غير صالح.",
    en: "Invalid date.",
    fr: "Date invalide.",
  },
  "archive.alreadyArchived": {
    ar: "هذه السنة مؤرشفة بالفعل.",
    en: "This year is already archived.",
    fr: "Cette année est déjà archivée.",
  },
  "archive.confirmTitle": {
    ar: "اكتب «{{title}}» كما هو لتأكيد إغلاق السنة.",
    en: "Type «{{title}}» exactly to confirm closing the year.",
    fr: "Saisissez «{{title}}» exactement pour confirmer la clôture de l’année.",
  },
  "archive.badNextYear": {
    ar: "السنة التالية غير صالحة.",
    en: "The next year is invalid.",
    fr: "L’année suivante n’est pas valide.",
  },
  "archive.nextArchived": {
    ar: "لا يمكن جعل سنةٍ مؤرشفة سنةً جارية.",
    en: "An archived year can't become the current year.",
    fr: "Une année archivée ne peut pas devenir l’année en cours.",
  },
  "archive.nextExists": {
    ar: "السنة «{{title}}» موجودة بالفعل — اخترها من القائمة.",
    en: "The year «{{title}}» already exists — pick it from the list.",
    fr: "L’année «{{title}}» existe déjà — choisissez-la dans la liste.",
  },
  "archive.notArchived": {
    ar: "هذه السنة غير مؤرشفة.",
    en: "This year isn't archived.",
    fr: "Cette année n’est pas archivée.",
  },
  "archive.pickOrType": {
    ar: "اختر سنةً موجودة أو اكتب عنوان سنةٍ جديدة — لا الاثنين.",
    en: "Pick an existing year or type a new year's title — not both.",
    fr: "Choisissez une année existante ou saisissez le titre d’une nouvelle — pas les deux.",
  },

  // ── المواضيع المُسنَدة ──
  "assigned.studentsMissing": {
    ar: "بعض الطلبة غير موجودين.",
    en: "Some students don't exist.",
    fr: "Certains étudiants n’existent pas.",
  },
  "assigned.studentHasProject": {
    ar: "أحد الطلبة المُسنَدين لديه مذكرة بالفعل.",
    en: "One of the assigned students already has a project.",
    fr: "Un des étudiants attribués a déjà un mémoire.",
  },
  "assigned.newStudentHasProject": {
    ar: "أحد الطلبة الجدد لديه مذكرة بالفعل.",
    en: "One of the new students already has a project.",
    fr: "Un des nouveaux étudiants a déjà un mémoire.",
  },
  "assigned.maxBelowMembers": {
    ar: "الحدّ الأقصى أقلّ من عدد الطلبة المُسنَدين حالياً.",
    en: "The maximum is lower than the number of students currently assigned.",
    fr: "Le maximum est inférieur au nombre d’étudiants actuellement attribués.",
  },
  "assigned.keepOne": {
    ar: "يجب أن تبقى المجموعة تضمّ طالباً واحداً على الأقل.",
    en: "The group must keep at least one student.",
    fr: "Le groupe doit garder au moins un étudiant.",
  },
  "assigned.leaderInGroup": {
    ar: "المرسِل يجب أن يكون ضمن الطلبة المُسنَدين.",
    en: "The sender must be one of the assigned students.",
    fr: "L’expéditeur doit faire partie des étudiants attribués.",
  },
  "assigned.duplicateStudent": {
    ar: "يوجد طالب مكرّر في القائمة.",
    en: "A student appears twice in the list.",
    fr: "Un étudiant apparaît deux fois dans la liste.",
  },
  "assigned.tooMany": {
    ar: "عدد الطلبة يتجاوز الحدّ الأقصى.",
    en: "There are more students than the maximum.",
    fr: "Il y a plus d’étudiants que le maximum.",
  },
  "assigned.leaderInMembers": {
    ar: "المرسِل يجب أن يكون ضمن أعضاء المجموعة.",
    en: "The sender must be a member of the group.",
    fr: "L’expéditeur doit être membre du groupe.",
  },
  "assigned.leaderRequired": {
    ar: "حدّد المرسِل عند تعديل الطلبة.",
    en: "Choose the sender when changing the students.",
    fr: "Choisissez l’expéditeur lors de la modification des étudiants.",
  },
  "assigned.importRaced": {
    ar: "الطالب {{reg}} أُسند أو قدّم طلباً منذ المعاينة — أعد المعاينة. لم يُستورد شيء.",
    en: "Student {{reg}} was assigned or sent a request since the preview — preview again. Nothing was imported.",
    fr: "L’étudiant {{reg}} a été attribué ou a envoyé une demande depuis l’aperçu — relancez l’aperçu. Rien n’a été importé.",
  },

  // ── المذكرات ──
  "project.sameSupervisor": {
    ar: "هذا الأستاذ هو المشرف الحالي على المذكرة.",
    en: "This professor is already the project's supervisor.",
    fr: "Cet enseignant encadre déjà ce mémoire.",
  },
  "project.studentAlreadyIn": {
    ar: "الطالب عضوٌ في هذه المذكرة بالفعل.",
    en: "This student is already in this project.",
    fr: "Cet étudiant fait déjà partie de ce mémoire.",
  },
  "project.studentInOther": {
    ar: "هذا الطالب عضو في مذكرة أخرى بالفعل.",
    en: "This student is already in another project.",
    fr: "Cet étudiant fait déjà partie d’un autre mémoire.",
  },
  "project.full": {
    ar: (p) => `المذكرة مكتملة: الحدّ الأقصى لهذا الموضوع ${arN(Number(p.max), ["طالبٌ واحد", "طالبان", "طلاب", "طالباً", "طالب"])}.`,
    en: (p) => `The project is full: this topic takes at most ${enN(Number(p.max), "student", "students")}.`,
    fr: (p) => `Le mémoire est complet : ce sujet accepte au plus ${frN(Number(p.max), "étudiant", "étudiants")}.`,
  },
  "project.leaderMustBeMember": {
    ar: "القائد يجب أن يكون أحد أعضاء المذكرة.",
    en: "The leader must be a member of the project.",
    fr: "Le responsable doit être membre du mémoire.",
  },
  "project.notMember": {
    ar: "الطالب ليس عضواً في هذه المذكرة.",
    en: "This student isn't a member of this project.",
    fr: "Cet étudiant n’est pas membre de ce mémoire.",
  },
  "project.lastMember": {
    ar: "هذا آخر عضو في المذكرة، وإزالته تعني فسخ المذكرة كلّها. استعمل «فسخ المذكرة» — فهو يسجّل السبب ويُعلم الطلبة ويُعيد الموضوع للتداول.",
    en: "This is the project's last member — removing them means dissolving the whole project. Use “Dissolve project”: it records the reason, notifies the students and frees the topic.",
    fr: "C’est le dernier membre du mémoire — le retirer revient à dissoudre tout le mémoire. Utilisez « Dissoudre le mémoire » : il enregistre la raison, prévient les étudiants et libère le sujet.",
  },
  "project.scheduledDefense": {
    ar: "مناقشة مبرمجة",
    en: "a scheduled defense",
    fr: "une soutenance programmée",
  },
  "project.dissolveBlocked": {
    ar: "لا يمكن فسخ هذه المذكرة: عليها {{what}}. احذف ذلك أوّلاً من شاشته إن كنت متأكّداً — لا تُفسَخ مذكرة تحمل عملاً قائماً في خطوة واحدة.",
    en: "This project can't be dissolved: it has {{what}}. Delete that first from its own screen if you are sure — a project carrying work isn't dissolved in one step.",
    fr: "Ce mémoire ne peut pas être dissous : il comporte {{what}}. Supprimez d’abord cela depuis son écran si vous êtes sûr — un mémoire avec du travail en cours ne se dissout pas en une étape.",
  },
  "milestone.hasSubmissions": {
    ar: "لا يمكن حذف مرحلة تحتوي على تسليمات؛ احذف التسليمات أوّلاً.",
    en: "A milestone with submissions can't be deleted — delete the submissions first.",
    fr: "Une étape contenant des dépôts ne peut pas être supprimée — supprimez d’abord les dépôts.",
  },
  "defense.alreadyScheduled": {
    ar: "للمذكرة مناقشةٌ مبرمجة بالفعل.",
    en: "A defense is already scheduled for this project.",
    fr: "Une soutenance est déjà programmée pour ce mémoire.",
  },
  "defense.maxMembers": {
    ar: "لا تتّسع اللجنة لأكثر من سبعة أعضاء.",
    en: "The committee can't have more than seven members.",
    fr: "Le jury ne peut pas compter plus de sept membres.",
  },
  "defense.duplicateMember": {
    ar: "الأستاذ نفسه مكرّر في اللجنة — لكلّ أستاذٍ مقعدٌ واحد.",
    en: "The same professor appears twice on the committee — one seat per professor.",
    fr: "Le même enseignant figure deux fois dans le jury — une place par enseignant.",
  },
  "defense.onePresident": {
    ar: "للّجنة رئيسٌ واحد فقط.",
    en: "The committee has only one president.",
    fr: "Le jury n’a qu’un seul président.",
  },
  "defense.dateFormat": {
    ar: "التاريخ بصيغةٍ غير صالحة.",
    en: "The date is in an invalid format.",
    fr: "La date est dans un format invalide.",
  },

  // ── طلبات المجموعات ──
  "request.membersLocked": {
    ar: "لا يمكن تعديل الأعضاء بعد الموافقة.",
    en: "Members can't be changed after approval.",
    fr: "Les membres ne peuvent plus être modifiés après l’acceptation.",
  },
  "request.cantRemoveLeader": {
    ar: "لا يمكن إزالة المرسِل؛ غيّر المرسِل أوّلاً.",
    en: "The sender can't be removed — change the sender first.",
    fr: "L’expéditeur ne peut pas être retiré — changez d’abord l’expéditeur.",
  },
  "request.notMember": {
    ar: "الطالب ليس عضواً في هذا الطلب.",
    en: "This student isn't a member of this request.",
    fr: "Cet étudiant n’est pas membre de cette demande.",
  },
  "request.keepOne": {
    ar: "لا يمكن ترك الطلب بلا أعضاء.",
    en: "A request can't be left without members.",
    fr: "Une demande ne peut pas rester sans membres.",
  },
  "request.leaderLocked": {
    ar: "لا يمكن تغيير المرسِل بعد الموافقة.",
    en: "The sender can't be changed after approval.",
    fr: "L’expéditeur ne peut plus être changé après l’acceptation.",
  },
  "request.leaderMustBeMember": {
    ar: "المرسِل يجب أن يكون أحد الأعضاء.",
    en: "The sender must be one of the members.",
    fr: "L’expéditeur doit être l’un des membres.",
  },
  "request.topicGone": {
    ar: "هذا الموضوع لم يعد متاحاً.",
    en: "This topic is no longer available.",
    fr: "Ce sujet n’est plus disponible.",
  },
  "request.otherAccepted": {
    ar: "تمّت الموافقة على مجموعة أخرى لهذا الموضوع بالفعل.",
    en: "Another group has already been accepted for this topic.",
    fr: "Un autre groupe a déjà été accepté pour ce sujet.",
  },
  "request.deleteAccepted": {
    ar: "لا يُحذف طلبٌ قامت عليه مذكرة. افسخ المذكرة أوّلاً من صفحة «المذكرات».",
    en: "A request that formed a project can't be deleted. Dissolve the project first from the “Projects” page.",
    fr: "Une demande ayant formé un mémoire ne peut pas être supprimée. Dissolvez d’abord le mémoire depuis la page « Mémoires ».",
  },
  "request.deletePending": {
    ar: "لا يُحذف طلبٌ ما يزال بانتظار القرار. ابتّ فيه — قبولاً أو رفضاً — فالفريق ينتظر جواباً.",
    en: "A request still awaiting a decision can't be deleted. Decide on it — accept or reject — the team is waiting for an answer.",
    fr: "Une demande en attente de décision ne peut pas être supprimée. Tranchez — accepter ou refuser — l’équipe attend une réponse.",
  },

  // ── التصدير ──
  "export.tooMany": {
    ar: "أكثر من {{max}} طالب — ضيّق الفلاتر (السنة أو الكلية أو التخصص).",
    en: "More than {{max}} students — narrow the filters (year, faculty or specialization).",
    fr: "Plus de {{max}} étudiants — affinez les filtres (année, faculté ou spécialité).",
  },
  "export.tooManyTopics": {
    ar: "أكثر من {{max}} موضوع — ضيّق الفلاتر (السنة أو الكلية أو التخصص).",
    en: "More than {{max}} topics — narrow the filters (year, faculty or specialization).",
    fr: "Plus de {{max}} sujets — affinez les filtres (année, faculté ou spécialité).",
  },
} satisfies Record<string, Entry>;
