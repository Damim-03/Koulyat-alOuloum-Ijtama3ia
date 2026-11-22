import type { Entry } from "../types";

/**
 * تقارير الاستيراد — ما يخصّ كلّ استيراد: رقم التسجيل للطلبة، والبريد الجامعي
 * والقسم للأساتذة، وخانات الموضوع، والطلبة المُسنَدون. وأسماء الأعمدة بين
 * «» عربيةٌ في كلّ اللغات: هي ما في الملف.
 */
export const imports = {
  "imp.or": { ar: " أو ", en: " or ", fr: " ou " },
  "imp.noLimit": { ar: "بلا سقف", en: "No limit", fr: "Sans limite" },
  "imp.teamSize.auto": {
    ar: "{{count}} — عدد الطلبة الذي قرّرته الإدارة لمواضيع {{level}} في السنة «{{year}}»",
    en: "{{count}} — the number of students the administration set for {{level}} topics of «{{year}}»",
    fr: "{{count}} — le nombre d’étudiants fixé par l’administration pour les sujets de {{level}} de «{{year}}»",
  },
  "imp.teamSize.mismatch": {
    ar: "عدد الطلبة في مواضيع {{level}} للسنة «{{year}}» هو {{count}} بالضبط — قرّرته الإدارة، لا {{value}}. اكتب {{count}} أو اترك الخانة فارغة.",
    en: "{{level}} topics of «{{year}}» have exactly {{count}} students — set by the administration, not {{value}}. Write {{count}} or leave the cell empty.",
    fr: "Les sujets de {{level}} de «{{year}}» comptent exactement {{count}} étudiants — fixé par l’administration, pas {{value}}. Écrivez {{count}} ou laissez la case vide.",
  },
  "imp.teamSize.max": {
    ar: "عدد الطلبة في مواضيع {{level}} للسنة «{{year}}» لا يتجاوز {{max}} — قرّرته الإدارة، لا {{value}}.",
    en: "{{level}} topics of «{{year}}» have at most {{max}} students — set by the administration, not {{value}}.",
    fr: "Les sujets de {{level}} de «{{year}}» comptent au plus {{max}} étudiants — fixé par l’administration, pas {{value}}.",
  },

  // ── الطلبة ──
  "imp.reg.length": {
    ar: "فيه {{length}} أرقام، والمقبول من 6 إلى 20.",
    en: "It has {{length}} digits; 6 to 20 are accepted.",
    fr: "Il compte {{length}} chiffres ; de 6 à 20 sont acceptés.",
  },
  "imp.reg.taken": {
    ar: (p) => `مسجَّلٌ في المنصّة مسبقاً: ${p.name || "طالب"} — ${p.spec}.`,
    en: (p) => `Already registered on the platform: ${p.name || "a student"} — ${p.spec}.`,
    fr: (p) => `Déjà inscrit sur la plateforme : ${p.name || "un étudiant"} — ${p.spec}.`,
  },
  "imp.reg.unusualLength": {
    ar: "فيه {{length}} أرقام، وأغلب أرقام الملف {{usual}} — تأكّد منه.",
    en: "It has {{length}} digits, while most numbers in the file have {{usual}} — check it.",
    fr: "Il compte {{length}} chiffres, alors que la plupart des numéros du fichier en ont {{usual}} — vérifiez-le.",
  },

  // ── الأساتذة ──
  "imp.uni.noDomains": {
    ar: "لا نطاقات جامعية مسجَّلة في المنصّة — أضِفها من الإعدادات أوّلاً.",
    en: "No university domains are registered on the platform — add them in the settings first.",
    fr: "Aucun domaine universitaire n’est enregistré sur la plateforme — ajoutez-les d’abord dans les paramètres.",
  },
  "imp.uni.badDomain": {
    ar: "«@{{domain}}» ليس نطاقاً جامعياً مسجَّلاً.{{hint}} النطاقات: {{list}}.",
    en: "«@{{domain}}» isn't a registered university domain.{{hint}} Domains: {{list}}.",
    fr: "«@{{domain}}» n’est pas un domaine universitaire enregistré.{{hint}} Domaines : {{list}}.",
  },
  "imp.prof.taken": {
    ar: "مسجَّلٌ لأستاذٍ في المنصّة مسبقاً: {{name}}.",
    en: "Already registered to a professor on the platform: {{name}}.",
    fr: "Déjà attribué à un enseignant sur la plateforme : {{name}}.",
  },
  "imp.emp.length": {
    ar: "13 رقماً بالضبط — فيه {{length}}. أو اتركه يُولَّد تلقائياً.",
    en: "Exactly 13 digits — it has {{length}}. Or leave it empty to have one generated.",
    fr: "Exactement 13 chiffres — il en compte {{length}}. Ou laissez vide pour qu’il soit généré.",
  },
  "imp.emp.generateFailed": {
    ar: "تعذّر توليد أرقامٍ وظيفية فريدة — أعد المحاولة.",
    en: "Couldn't generate unique employee numbers — try again.",
    fr: "Impossible de générer des matricules uniques — réessayez.",
  },
  "imp.dep.narrowed": {
    ar: "الاسم لأكثر من قسم، وحدّدته «الكلية».",
    en: "The name fits more than one department; «الكلية» settled it.",
    fr: "Le nom correspond à plusieurs départements ; «الكلية» a tranché.",
  },
  "imp.dep.ambiguous": {
    ar: "«{{value}}» اسمٌ لـ{{count}} أقسام: {{list}}. اختره من القائمة، أو املأ «الكلية».",
    en: "«{{value}}» names {{count}} departments: {{list}}. Pick it from the list, or fill in «الكلية».",
    fr: "«{{value}}» désigne {{count}} départements : {{list}}. Choisissez-le dans la liste, ou renseignez «الكلية».",
  },
  "imp.dep.ofFaculty": {
    ar: " أقسام «{{faculty}}»: {{list}}.",
    en: " Departments of «{{faculty}}»: {{list}}.",
    fr: " Départements de «{{faculty}}» : {{list}}.",
  },
  "imp.fac.depMismatch": {
    ar: "لا يوافق القسم «{{department}}» — كليته في المنصّة «{{platform}}».",
    en: "Doesn't match the department «{{department}}» — its faculty on the platform is «{{platform}}».",
    fr: "Ne correspond pas au département «{{department}}» — sa faculté sur la plateforme est «{{platform}}».",
  },
  "imp.fac.ofDepartment": {
    ar: " وكلية القسم «{{department}}»: «{{platform}}».",
    en: " The department «{{department}}» belongs to «{{platform}}».",
    fr: " Le département «{{department}}» relève de «{{platform}}».",
  },
  "imp.grade.tooMany": {
    ar: "{{count}} رتبة، والحدّ 20.",
    en: "{{count}} ranks; the limit is 20.",
    fr: "{{count}} grades ; la limite est 20.",
  },
  "imp.grade.tooLong": {
    ar: "رتبةٌ أطول من 100 حرف — لعلّها ليست رتبة؟",
    en: "A rank longer than 100 characters — is it really a rank?",
    fr: "Un grade de plus de 100 caractères — est-ce vraiment un grade ?",
  },
  "imp.grade.unofficial": {
    ar: "{{list}} ليست من السلّم الرسميّ ({{ranks}}) — تُحفظ كما كُتبت.",
    en: "{{list}}: not on the official scale ({{ranks}}) — kept as written.",
    fr: "{{list}} : hors de l’échelle officielle ({{ranks}}) — conservé tel quel.",
  },
  "imp.tags.tooMany": {
    ar: "{{count}} صفة، والحدّ 20.",
    en: "{{count}} roles; the limit is 20.",
    fr: "{{count}} qualités ; la limite est 20.",
  },
  "imp.tags.tooLong": {
    ar: "صفةٌ أطول من 60 حرفاً — افصل الصفات بفاصلة.",
    en: "A role longer than 60 characters — separate roles with a comma.",
    fr: "Une qualité de plus de 60 caractères — séparez-les par une virgule.",
  },

  // ── المواضيع: الأستاذ ──
  "imp.prof.noEmail": {
    ar: "لا أستاذ ببريدٍ جامعيّ «{{value}}».{{hint}}",
    en: "No professor has the university email «{{value}}».{{hint}}",
    fr: "Aucun enseignant n’a l’e-mail universitaire «{{value}}».{{hint}}",
  },
  "imp.prof.noNumber": {
    ar: "لا أستاذ برقمٍ وظيفيّ «{{value}}».",
    en: "No professor has the employee number «{{value}}».",
    fr: "Aucun enseignant n’a le matricule «{{value}}».",
  },
  "imp.prof.ambiguous": {
    ar: "«{{value}}» اسمٌ لـ{{count}} أساتذة: {{list}}. اختره من القائمة، أو اكتب بريده الجامعي.",
    en: "«{{value}}» names {{count}} professors: {{list}}. Pick them from the list, or write their university email.",
    fr: "«{{value}}» désigne {{count}} enseignants : {{list}}. Choisissez-le dans la liste, ou saisissez son e-mail universitaire.",
  },
  "imp.prof.unknown": {
    ar: "«{{value}}» ليس أستاذاً في المنصّة.{{hint}} اختره من القائمة، أو اكتب بريده الجامعي أو رقمه الوظيفي.",
    en: "«{{value}}» isn't a professor on the platform.{{hint}} Pick them from the list, or write their university email or employee number.",
    fr: "«{{value}}» n’est pas un enseignant de la plateforme.{{hint}} Choisissez-le dans la liste, ou saisissez son e-mail universitaire ou son matricule.",
  },
  "imp.prof.byEmail": {
    ar: "عُرف ببريده الجامعي.",
    en: "Identified by their university email.",
    fr: "Identifié par son e-mail universitaire.",
  },
  "imp.prof.byNumber": {
    ar: "عُرف برقمه الوظيفي.",
    en: "Identified by their employee number.",
    fr: "Identifié par son matricule.",
  },
  "imp.prof.suspended": {
    ar: "حسابه موقوف — يُنشأ الموضوع باسمه، ولا يراه حتى يُفعَّل حسابه.",
    en: "Their account is suspended — the topic is created under their name, but they won't see it until the account is reactivated.",
    fr: "Son compte est suspendu — le sujet est créé à son nom, mais il ne le verra qu’après réactivation du compte.",
  },

  // ── المواضيع: العنوان والوصف والبنود والمراجع ──
  "imp.title.tooLong": {
    ar: "أطول من {{max}} حرفاً (فيه {{length}}) — اختصره، والتفصيل في «الوصف».",
    en: "Longer than {{max}} characters ({{length}}) — shorten it and put the details in «الوصف».",
    fr: "Plus de {{max}} caractères ({{length}}) — raccourcissez-le, les détails vont dans «الوصف».",
  },
  "imp.title.joinedLines": {
    ar: "جُمعت أسطره في سطرٍ واحد.",
    en: "Its lines were joined into one.",
    fr: "Ses lignes ont été réunies en une seule.",
  },
  "imp.title.dupSameProf": {
    ar: "مكرّرٌ للأستاذ نفسه في الملف — في الصفّ {{rows}} أيضاً.",
    en: "Repeated for the same professor in the file — also in row {{rows}}.",
    fr: "Répété pour le même enseignant dans le fichier — aussi à la ligne {{rows}}.",
  },
  "imp.title.otherProfInFile": {
    ar: "العنوان نفسه لأستاذٍ آخر في الملف — في الصفّ {{rows}}.",
    en: "The same title for another professor in the file — in row {{rows}}.",
    fr: "Le même titre pour un autre enseignant dans le fichier — à la ligne {{rows}}.",
  },
  "imp.title.exists": {
    ar: "موجودٌ في المنصّة مسبقاً للأستاذ نفسه في هذه السنة ({{status}}) — احذف الصفّ، أو غيّر العنوان إن كان موضوعاً آخر.",
    en: "Already on the platform for the same professor this year ({{status}}) — delete the row, or change the title if it's a different topic.",
    fr: "Déjà sur la plateforme pour le même enseignant cette année ({{status}}) — supprimez la ligne, ou changez le titre s’il s’agit d’un autre sujet.",
  },
  "imp.title.rejectedBefore": {
    ar: "رُفض موضوعٌ بهذا العنوان للأستاذ نفسه في هذه السنة — سيُنشأ موضوعٌ جديد.",
    en: "A topic with this title was rejected for the same professor this year — a new topic will be created.",
    fr: "Un sujet de ce titre a été rejeté pour le même enseignant cette année — un nouveau sujet sera créé.",
  },
  "imp.title.othersHave": {
    ar: "العنوان نفسه في المنصّة لـ{{list}} في هذه السنة.",
    en: "The same title is on the platform for {{list}} this year.",
    fr: "Le même titre figure sur la plateforme pour {{list}} cette année.",
  },
  "imp.title.proposedBefore": {
    ar: "اقترحه الأستاذ نفسه في {{list}}.",
    en: "The same professor proposed it in {{list}}.",
    fr: "Le même enseignant l’a proposé en {{list}}.",
  },
  "imp.desc.tooLong": {
    ar: "أطول من {{max}} حرف (فيه {{length}}) — اختصره.",
    en: "Longer than {{max}} characters ({{length}}) — shorten it.",
    fr: "Plus de {{max}} caractères ({{length}}) — raccourcissez-le.",
  },
  "imp.desc.short": {
    ar: "وصفٌ قصيرٌ جداً — يقرؤه الطلبة ليختاروا الموضوع.",
    en: "A very short description — students read it to choose the topic.",
    fr: "Une description très courte — les étudiants la lisent pour choisir le sujet.",
  },
  "imp.items.tooMany": {
    ar: "{{count}} بنداً، والحدّ {{max}}.",
    en: "{{count}} items; the limit is {{max}}.",
    fr: "{{count}} éléments ; la limite est {{max}}.",
  },
  "imp.items.tooLong": {
    ar: "بندٌ أطول من {{max}} حرف — اجعل كلّ بندٍ في سطر (Alt+Enter) أو افصل بفاصلةٍ منقوطة «؛».",
    en: "An item longer than {{max}} characters — put each item on its own line (Alt+Enter) or separate them with a semicolon «;».",
    fr: "Un élément de plus de {{max}} caractères — mettez chaque élément sur sa ligne (Alt+Entrée) ou séparez-les par un point-virgule «;».",
  },
  "imp.items.oneLong": {
    ar: "بندٌ واحدٌ طويل — إن كانت فيه بنودٌ فاجعل كلّاً منها في سطر (Alt+Enter) أو افصلها بـ«؛».",
    en: "One long item — if it holds several, put each on its own line (Alt+Enter) or separate them with «;».",
    fr: "Un seul long élément — s’il en contient plusieurs, mettez chacun sur sa ligne (Alt+Entrée) ou séparez-les par «;».",
  },
  "imp.ref.www": {
    ar: "«{{text}}» — الرابط يبدأ بـ https:// (أو http://).",
    en: "«{{text}}» — the link must start with https:// (or http://).",
    fr: "«{{text}}» — le lien doit commencer par https:// (ou http://).",
  },
  "imp.ref.noLink": {
    ar: "«{{text}}» — لا رابط فيه. المرجع رابطٌ يبدأ بـ https://، وعنوانه قبله إن شئت.",
    en: "«{{text}}» — no link in it. A reference is a link starting with https://, optionally preceded by its title.",
    fr: "«{{text}}» — aucun lien. Une référence est un lien commençant par https://, précédé de son titre si vous voulez.",
  },
  "imp.ref.badUrl": {
    ar: "«{{url}}» — رابطٌ غير صحيح.",
    en: "«{{url}}» — an invalid link.",
    fr: "«{{url}}» — lien invalide.",
  },
  "imp.ref.urlTooLong": {
    ar: "رابطٌ أطول من {{max}} حرف.",
    en: "A link longer than {{max}} characters.",
    fr: "Un lien de plus de {{max}} caractères.",
  },
  "imp.refs.more": { ar: " (و{{count}} غيرها)", en: " (and {{count}} more)", fr: " (et {{count}} autres)" },
  "imp.refs.tooMany": {
    ar: "{{count}} مرجعاً، والحدّ {{max}}.",
    en: "{{count}} references; the limit is {{max}}.",
    fr: "{{count}} références ; la limite est {{max}}.",
  },
  "imp.num.whole": {
    ar: "عددٌ صحيح من {{min}} إلى {{max}} — فيه «{{value}}».",
    en: "A whole number from {{min}} to {{max}} — it says «{{value}}».",
    fr: "Un nombre entier de {{min}} à {{max}} — la cellule contient «{{value}}».",
  },
  "imp.num.range": {
    ar: "من {{min}} إلى {{max}} — فيه {{value}}.",
    en: "From {{min}} to {{max}} — it says {{value}}.",
    fr: "De {{min}} à {{max}} — la cellule contient {{value}}.",
  },
  "imp.spec.otherDepartment": {
    ar: "التخصص من «{{spec}}»، والأستاذ من «{{professor}}».",
    en: "The specialization is in «{{spec}}», the professor in «{{professor}}».",
    fr: "La spécialité relève de «{{spec}}», l’enseignant de «{{professor}}».",
  },

  // ── المواضيع: الحالة ──
  "imp.status.required": {
    ar: "إلزامية — الخانة فارغة. {{options}}.",
    en: "Required — the cell is empty. {{options}}.",
    fr: "Obligatoire — la cellule est vide. {{options}}.",
  },
  "imp.status.unknown": {
    ar: "«{{value}}» ليست حالة — {{options}}.{{hint}}",
    en: "«{{value}}» isn't a status — {{options}}.{{hint}}",
    fr: "«{{value}}» n’est pas un statut — {{options}}.{{hint}}",
  },
  "imp.status.pending": { ar: "قيد الانتظار", en: "Pending", fr: "En attente" },
  "imp.status.approved": { ar: "تمت الموافقة", en: "Approved", fr: "Approuvé" },
  "imp.status.open": { ar: "منشور", en: "Published", fr: "Publié" },
  "imp.status.full": { ar: "مسند", en: "Assigned", fr: "Attribué" },
  "imp.status.rejected": { ar: "مرفوض", en: "Rejected", fr: "Rejeté" },
  "imp.status.archived": { ar: "مؤرشف", en: "Archived", fr: "Archivé" },

  // ── المواضيع المُسنَدة: الطلبة ──
  "imp.as.student1Required": {
    ar: "إلزامي — الطالب الأوّل هو المرسِل باسم الفريق، ولا موضوع مُسنَدٌ بلا طالب.",
    en: "Required — the first student sends on the team's behalf, and there is no assigned topic without a student.",
    fr: "Obligatoire — le premier étudiant envoie au nom de l’équipe, et pas de sujet attribué sans étudiant.",
  },
  "imp.as.regDigits": {
    ar: "رقم التسجيل أرقامٌ فقط — فيه «{{odd}}». الاسم لا يُقبل هنا: اكتب رقمه.",
    en: "The registration number is digits only — it contains «{{odd}}». A name isn't accepted here: write the number.",
    fr: "Le matricule ne contient que des chiffres — ici «{{odd}}». Un nom n’est pas accepté : saisissez le matricule.",
  },
  "imp.as.regLength": {
    ar: "رقم التسجيل من 6 إلى 20 رقماً — فيه {{length}}.",
    en: "A registration number has 6 to 20 digits — this one has {{length}}.",
    fr: "Un matricule compte de 6 à 20 chiffres — celui-ci en a {{length}}.",
  },
  "imp.as.noStudent": {
    ar: "لا طالب برقم التسجيل {{reg}} في المنصّة.",
    en: "No student with the registration number {{reg}} on the platform.",
    fr: "Aucun étudiant avec le matricule {{reg}} sur la plateforme.",
  },
  "imp.as.dupInRow": {
    ar: "مكرّرٌ في الصفّ نفسه — في «{{seat}}» أيضاً.",
    en: "Repeated in the same row — also in «{{seat}}».",
    fr: "Répété dans la même ligne — aussi dans «{{seat}}».",
  },
  "imp.as.elsewhere": {
    ar: "مُسنَدٌ في الملف إلى موضوعٍ آخر — في الصفّ {{rows}}. الطالب في مذكرةٍ واحدة.",
    en: "Assigned to another topic in the file — in row {{rows}}. A student belongs to one project only.",
    fr: "Attribué à un autre sujet dans le fichier — à la ligne {{rows}}. Un étudiant n’appartient qu’à un seul projet.",
  },
  "imp.as.hasProject": {
    ar: "{{name}} له مذكرة: «{{project}}».",
    en: "{{name}} already has a project: «{{project}}».",
    fr: "{{name}} a déjà un projet : «{{project}}».",
  },
  "imp.as.hasRequest": {
    ar: "{{name}} له طلب فريقٍ قائم على «{{request}}» — يُبتّ فيه أوّلاً، أو يُسحب.",
    en: "{{name}} has an open team request on «{{request}}» — it must be decided or withdrawn first.",
    fr: "{{name}} a une demande d’équipe en cours sur «{{request}}» — elle doit d’abord être tranchée ou retirée.",
  },
  "imp.as.otherSpec": {
    ar: "من تخصّص «{{spec}}»، والموضوع في «{{topicSpec}}».",
    en: "From the specialization «{{spec}}», while the topic is in «{{topicSpec}}».",
    fr: "De la spécialité «{{spec}}», alors que le sujet relève de «{{topicSpec}}».",
  },
  "imp.as.otherYear": {
    ar: "مسجَّلٌ في السنة {{year}}، والموضوع في سنةٍ أخرى.",
    en: "Enrolled in {{year}}, while the topic is in another year.",
    fr: "Inscrit en {{year}}, alors que le sujet relève d’une autre année.",
  },
  "imp.as.suspended": {
    ar: "حسابه موقوف — يُسنَد، ولا يرى مذكرته حتى يُفعَّل حسابه.",
    en: "Their account is suspended — they're assigned, but won't see the project until the account is reactivated.",
    fr: "Son compte est suspendu — il est attribué, mais ne verra le projet qu’après réactivation du compte.",
  },
  "imp.as.maxBelow": {
    ar: "أقلّ من عدد الطلبة المُسنَدين في الصفّ ({{count}}) — ارفعه، أو أنقص الطلبة.",
    en: "Fewer than the students assigned in the row ({{count}}) — raise it, or remove students.",
    fr: "Inférieur au nombre d’étudiants attribués dans la ligne ({{count}}) — augmentez-le, ou retirez des étudiants.",
  },
} satisfies Record<string, Entry>;
