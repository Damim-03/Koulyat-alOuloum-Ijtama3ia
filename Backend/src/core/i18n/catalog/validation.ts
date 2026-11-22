import type { Entry } from "../types";

/** رسائل المخطَّطات (zod) الخاصّة — ما لا تقوله رسائل zod المبنيّة. */
export const validation = {
  "v.latinName": {
    ar: "الاسم باللاتينية: حروفٌ لاتينية فقط.",
    en: "Latin name: Latin letters only.",
    fr: "Nom latin : lettres latines uniquement.",
  },
  "v.employeeNumber13": {
    ar: "الرقم الوظيفي يجب أن يتكوّن من 13 رقماً.",
    en: "The employee number must have 13 digits.",
    fr: "Le matricule doit comporter 13 chiffres.",
  },
  "v.nameRequired": { ar: "الاسم مطلوب.", en: "The name is required.", fr: "Le nom est obligatoire." },
  "v.codeRequired": { ar: "الرمز مطلوب.", en: "The code is required.", fr: "Le code est obligatoire." },
  "v.specNameRequired": {
    ar: "اسم التخصّص مطلوب.",
    en: "The specialization name is required.",
    fr: "Le nom de la spécialité est obligatoire.",
  },
  "v.yearFormat": { ar: "الصيغة: 2026/2027", en: "Format: 2026/2027", fr: "Format : 2026/2027" },
  "v.leaderInStudents": {
    ar: "المرسِل يجب أن يكون ضمن الطلبة.",
    en: "The sender must be one of the students.",
    fr: "L’expéditeur doit faire partie des étudiants.",
  },
  "v.referenceTitleRequired": {
    ar: "عنوان المرجع مطلوب.",
    en: "The reference title is required.",
    fr: "Le titre de la référence est obligatoire.",
  },
  "v.urlInvalid": { ar: "رابط غير صحيح.", en: "Invalid link.", fr: "Lien invalide." },
  "v.urlScheme": {
    ar: "الرابط يبدأ بـ http:// أو https://",
    en: "The link must start with http:// or https://",
    fr: "Le lien doit commencer par http:// ou https://",
  },
  "v.tooManyReferences": {
    ar: "عدد كبير من المراجع.",
    en: "Too many references.",
    fr: "Trop de références.",
  },
  "v.titleRequired": { ar: "العنوان مطلوب.", en: "The title is required.", fr: "Le titre est obligatoire." },
  "v.descriptionRequired": {
    ar: "الوصف مطلوب.",
    en: "The description is required.",
    fr: "La description est obligatoire.",
  },
  "v.specializationRequired": {
    ar: "التخصص مطلوب.",
    en: "The specialization is required.",
    fr: "La spécialité est obligatoire.",
  },
  "v.academicYearRequired": {
    ar: "السنة الجامعية مطلوبة.",
    en: "The academic year is required.",
    fr: "L’année universitaire est obligatoire.",
  },
  "v.addOneStudent": {
    ar: "أضف طالباً واحداً على الأقل.",
    en: "Add at least one student.",
    fr: "Ajoutez au moins un étudiant.",
  },
  "v.chooseSender": { ar: "اختر المرسِل.", en: "Choose the sender.", fr: "Choisissez l’expéditeur." },
  "v.twoChars": {
    ar: "اكتب حرفين على الأقل.",
    en: "Type at least two characters.",
    fr: "Saisissez au moins deux caractères.",
  },
  "v.topicRequired": { ar: "الموضوع مطلوب.", en: "The topic is required.", fr: "Le sujet est obligatoire." },
  "v.tooManyMembers": {
    ar: "عدد كبير جداً من الأعضاء.",
    en: "Too many members.",
    fr: "Trop de membres.",
  },
  "v.passwordRequired": {
    ar: "كلمة المرور مطلوبة.",
    en: "The password is required.",
    fr: "Le mot de passe est obligatoire.",
  },
  "v.invalidLink": { ar: "رابط غير صالح.", en: "Invalid link.", fr: "Lien invalide." },
  "v.invalidDate": { ar: "تاريخ غير صالح.", en: "Invalid date.", fr: "Date invalide." },
  "v.invalidEmail": { ar: "بريد إلكتروني غير صالح.", en: "Invalid email.", fr: "E-mail invalide." },
} satisfies Record<string, Entry>;
