import {
  Footprints,
  Home,
  Info,
  LayoutPanelLeft,
  ListChecks,
  PanelTop,
  type LucideIcon,
} from "lucide-react";

/**
 * العبارات التي تغيّرها الإدارة من «واجهة الموقع ← النصوص»، مرتّبةً بمكانها
 * في الموقع: القسم ← المجموعة ← الحقل.
 *
 * كلّ حقلٍ مفتاحُ نصٍّ في ملفّات الترجمة؛ وما تكتبه الإدارة فيه يحلّ محلّه
 * حيثما ظهر (i18n/site-texts). واسم الحقل:
 *   `label` — مفتاحٌ تحت `admin.texts.f` (و`n` رقمه في قائمة: «الميزة 2»)،
 *   أو لا شيء — فاسمه النصّ نفسه (روابط القوائم: «المستخدمون»).
 *
 * و`hide` معرّف العنصر الذي يُخفى في الموقع (i18n/site-visibility): للحقل
 * سطرُه أو زرّه، وللمجموعة قسمها كلّه. وما لا `hide` له لا يُخفى — عنوان
 * الصفحة، وأزرار الدخول، ورابطا «لوحة التحكم» و«واجهة الموقع» في قائمة
 * الإدارة (وإلّا ضلّ المسؤول طريقه إلى هنا).
 *
 * وما له محرّره في تبويبٍ آخر لا يتكرّر هنا: نصوص «عن المنصة» الأساسية،
 * وكلمة رئيس القسم، ولوحة الدخول.
 */

export type TextKind = "text" | "long" | "url" | "email" | "phone";

export interface TextField {
  key: string;
  label?: string;
  n?: number;
  kind?: TextKind;
  /** معرّف ما يُخفى في الموقع بهذا الحقل. */
  hide?: string;
  /** يُخفى مع غيره: وصف البطاقة مع عنوانها، وعنوان الرابط مع اسمه. */
  hiddenWith?: string;
}

export interface TextGroup {
  id: string;
  fields: TextField[];
  /** معرّف القسم كلّه إن كان يُخفى. */
  hide?: string;
}

export type SectionId = "header" | "home" | "topics" | "about" | "footer" | "sidebars";

export interface TextSection {
  id: SectionId;
  icon: LucideIcon;
  /** الصفحة التي تظهر فيها — رابط «افتح الصفحة». */
  page?: string;
  groups: TextGroup[];
}

const f = (key: string, label?: string, kind?: TextKind, hide?: string): TextField => ({ key, label, kind, hide });
/** حقلٌ يُخفى عنصره بالمعرّف `hide`. */
const h = (hide: string, key: string, label?: string, kind?: TextKind) => f(key, label, kind, hide);
/** رابطٌ في قائمةٍ جانبية، يُخفى منها: «sidebar.admin.dash.archive». */
const nav = (role: "admin" | "professor" | "student", key: string) => h(`sidebar.${role}.${key}`, key);

/** حقلان لكلّ عنصرٍ من قائمةٍ ثابتة الطول: «الميزة 1 — العنوان / الوصف». */
const items = (count: number, make: (i: number) => TextField[]) =>
  Array.from({ length: count }, (_, i) => make(i).map((x) => ({ ...x, n: i + 1 }))).flat();

export const TEXT_SECTIONS: TextSection[] = [
  {
    id: "header",
    icon: PanelTop,
    page: "/",
    groups: [
      {
        id: "brand",
        fields: [
          f("brand.nameLatin", "uniLatin"),
          h("header.system", "brand.system", "system"),
          h("header.caption", "brand.nameAr", "caption"),
          f("brand.name", "platform"),
          f("brand.short", "short"),
        ],
      },
      {
        id: "nav",
        fields: [
          f("common.home", "navHome"),
          h("nav.topics", "common.topics", "navTopics"),
          h("nav.about", "common.about", "navAbout"),
          f("common.login", "navLogin"),
          f("common.dashboard", "navDashboard"),
          f("common.logout", "navLogout"),
        ],
      },
    ],
  },
  {
    id: "home",
    icon: Home,
    page: "/",
    groups: [
      {
        id: "hero",
        fields: [
          h("home.badge", "hero.badge", "badge"),
          f("hero.title", "heroTitle"),
          h("home.subtitle", "hero.subtitle", "heroSubtitle"),
          h("home.desc", "hero.desc", "heroDesc", "long"),
          h("home.ctaPrimary", "hero.ctaPrimary", "ctaPrimary"),
          h("home.ctaSecondary", "hero.ctaSecondary", "ctaSecondary"),
        ],
      },
      {
        id: "news",
        hide: "home.news",
        fields: [
          f("news.label", "newsLabel"),
          h("home.newsAll", "news.viewAll", "newsAll"),
          f("news.allTitle", "newsAllTitle"),
        ],
      },
      {
        id: "features",
        hide: "home.features",
        fields: [
          f("features.title", "secTitle"),
          h("home.featuresDesc", "features.desc", "secDesc", "long"),
          // البطاقة تُخفى من عنوانها، ووصفها معها.
          ...items(3, (i) => [
            h(`home.feature.${i + 1}`, `features.items.${i}.title`, "featureTitle"),
            { ...f(`features.items.${i}.desc`, "featureDesc", "long"), hiddenWith: `home.feature.${i + 1}` },
          ]),
        ],
      },
    ],
  },
  {
    id: "topics",
    icon: ListChecks,
    page: "/topics",
    groups: [
      {
        id: "topicsHead",
        fields: [
          h("topics.kicker", "public.browse.kicker", "kicker"),
          f("public.topicsTitle", "pageTitle"),
          h("topics.subtitle", "public.topicsSubtitle", "pageDesc", "long"),
          f("public.browse.statAll", "statAll"),
          f("public.browse.statAvailable", "statAvailable"),
          f("public.browse.statReserved", "statReserved"),
          f("public.browse.searchPlaceholder", "searchPlaceholder"),
        ],
      },
      {
        id: "topicsEmpty",
        fields: [f("public.browse.noneYet", "emptyTitle"), f("public.browse.noneYetHint", "emptyHint", "long")],
      },
    ],
  },
  {
    id: "about",
    icon: Info,
    page: "/about",
    groups: [
      {
        id: "aboutExtra",
        fields: [
          h("about.discover", "aboutPage.discover", "aboutDiscover"),
          h("about.eyebrow", "aboutPage.eyebrow", "aboutEyebrow"),
          h("about.featuresEyebrow", "aboutPage.featuresEyebrow", "aboutFeaturesEyebrow"),
        ],
      },
      {
        id: "aboutCta",
        hide: "about.cta",
        fields: [
          f("aboutPage.ctaTitle", "ctaTitle"),
          f("aboutPage.ctaDesc", "ctaDesc", "long"),
          f("aboutPage.ctaLogin", "ctaLogin"),
          f("aboutPage.ctaDashboard", "ctaDashboard"),
        ],
      },
    ],
  },
  {
    id: "footer",
    icon: Footprints,
    page: "/",
    groups: [
      {
        id: "footerAbout",
        hide: "footer.about",
        fields: [f("footer.about", "fAbout"), h("footer.aboutDesc", "footer.aboutDesc", "fAboutDesc", "long")],
      },
      {
        id: "footerQuick",
        hide: "footer.quick",
        fields: [f("footer.quickLinks", "fQuick")],
      },
      {
        id: "footerOfficial",
        hide: "footer.official",
        fields: [
          f("footer.official", "secTitle"),
          // الرابط يُخفى من اسمه، وعنوانه معه.
          ...items(3, (i) => [
            h(`footer.link.${i + 1}`, `officialLinks.${i}.label`, "linkLabel"),
            { ...f(`officialLinks.${i}.url`, "linkUrl", "url"), hiddenWith: `footer.link.${i + 1}` },
          ]),
        ],
      },
      {
        id: "footerContact",
        hide: "footer.contact",
        fields: [
          f("footer.contact", "secTitle"),
          h("footer.address", "footer.address", "address"),
          h("footer.phone", "footer.phoneNumber", "phone", "phone"),
          h("footer.email", "footer.email", "email", "email"),
        ],
      },
      {
        id: "footerBottom",
        fields: [
          f("footer.rights", "rights"),
          h("footer.madeWith", "footer.madeWith", "madeWith"),
          h("footer.backToTop", "common.backToTop", "backToTop"),
        ],
      },
    ],
  },
  {
    id: "sidebars",
    icon: LayoutPanelLeft,
    groups: [
      {
        id: "sbShared",
        fields: [
          f("dash.dashboard"),
          f("messages.title", "sbMessages"),
          f("dash.collapse", "sbCollapse"),
          f("dash.expand", "sbExpand"),
        ],
      },
      {
        id: "sbAdmin",
        fields: [
          f("dash.adminPanel", "sbPanel"),
          nav("admin", "dash.users"),
          nav("admin", "dash.students"),
          nav("admin", "dash.professors"),
          nav("admin", "admin.academicHierarchy"),
          nav("admin", "dash.specializations"),
          nav("admin", "dash.archive"),
          nav("admin", "dash.professorProposals"),
          nav("admin", "admin.groupRequestsTitle"),
          nav("admin", "admin.projects"),
          nav("admin", "admin.messagesTitle"),
          nav("admin", "dash.defense"),
          f("admin.site.nav"),
        ],
      },
      {
        id: "sbProfessor",
        fields: [
          f("dash.professorPanel", "sbPanel"),
          nav("professor", "dash.topics"),
          nav("professor", "dash.myProjects"),
          nav("professor", "dash.milestones"),
        ],
      },
      {
        id: "sbStudent",
        fields: [f("dash.studentPanel", "sbPanel"), nav("student", "dash.myRequests"), nav("student", "dash.myProject")],
      },
    ],
  },
];

export const ALL_TEXT_FIELDS: TextField[] = TEXT_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.fields));

/** كلّ ما يُخفى من الموقع، بمعرّفه — من المجموعات والحقول. */
export const HIDEABLE_IDS: string[] = TEXT_SECTIONS.flatMap((s) =>
  s.groups.flatMap((g) => [...(g.hide ? [g.hide] : []), ...g.fields.flatMap((x) => (x.hide ? [x.hide] : []))]),
);
