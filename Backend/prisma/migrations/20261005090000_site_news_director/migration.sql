-- The home page's news ticker and the head of department's message, both
-- edited by the administration. Until now they were fixed strings in the
-- client's translation files; each table starts with exactly that content, so
-- the home page reads the same the day this ships and changes only when the
-- administration edits it.

-- CreateTable
CREATE TABLE `NewsItem` (
    `id` VARCHAR(191) NOT NULL,
    `text` VARCHAR(300) NOT NULL,
    `textFr` VARCHAR(300) NULL,
    `textEn` VARCHAR(300) NULL,
    `date` DATE NOT NULL,
    `linkUrl` VARCHAR(2048) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NewsItem_isActive_date_idx`(`isActive`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteContent` (
    `slug` VARCHAR(64) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`slug`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The three news items the ticker showed until now.
INSERT INTO `NewsItem` (`id`, `text`, `textFr`, `textEn`, `date`, `linkUrl`, `isActive`, `createdAt`, `updatedAt`) VALUES
  (UUID(), 'إعلان هام: فتح باب التسجيلات للمشاريع — دفعة 2026',
           'Important : les inscriptions aux projets sont ouvertes — promo 2026',
           'Important: project registration is now open — 2026 cohort',
           '2026-03-16', NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'التوقيت الزمني لمناقشات المذكرات لشهر جوان',
           'Le calendrier des soutenances de juin est disponible',
           'Defense schedule for June is now available',
           '2026-03-10', NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), 'تذكير: آخر أجل لإيداع المواضيع المقترحة من الأساتذة',
           'Rappel : date limite de dépôt des sujets proposés par les enseignants',
           'Reminder: deadline for professors to submit proposed topics',
           '2026-03-04', NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- The head of department's message as the translation files had it. No photo:
-- the client keeps showing its placeholder until one is uploaded.
INSERT INTO `SiteContent` (`slug`, `value`, `updatedAt`) VALUES (
  'director-message',
  JSON_OBJECT(
    'isVisible', true,
    'photoUrl', NULL,
    'ar', JSON_OBJECT(
      'sectionTitle', 'كلمة رئيس القسم',
      'title', 'نحو بيئة أكاديمية تجمع الطالب بمشرفه في مسار واضح ومنظّم',
      'paragraphs', JSON_ARRAY(
        'يسعدني أن أرحّب بكم في منصة إدارة مشاريع التخرج، التي جاءت لتسهّل على طلبتنا وأساتذتنا متابعة مشاريع التخرج بكل شفافية وتنظيم.',
        'حرصنا على أن تكون المنصة جسراً يربط الطالب بمشرفه، من اختيار الموضوع إلى المناقشة النهائية، بما يضمن جودة العمل ووضوح المسار.',
        'ندعو جميع الطلبة إلى الاستفادة من هذه الأداة، ونتمنى لهم التوفيق في رحلتهم نحو التخرّج.'
      ),
      'quote', 'نجاح مذكرة التخرج يبدأ بتنظيم جيد وتواصل مستمر بين الطالب ومشرفه.',
      'fullName', 'أ.د. فلان الفلاني',
      'role', 'رئيس قسم العلوم الاجتماعية',
      'initials', 'ر'
    ),
    'fr', JSON_OBJECT(
      'sectionTitle', 'Mot du représentant de département',
      'title', 'Vers un environnement académique qui relie l''étudiant à son encadrant sur un parcours clair et organisé',
      'paragraphs', JSON_ARRAY(
        'J''ai le plaisir de vous accueillir sur la plateforme de gestion des projets de fin d''études, conçue pour aider nos étudiants et enseignants à suivre les projets en toute transparence.',
        'Nous l''avons pensée comme un pont entre l''étudiant et son encadrant — du choix du sujet à la soutenance — afin de garantir la qualité du travail et la clarté du parcours.',
        'Nous invitons tous les étudiants à tirer profit de cet outil et leur souhaitons réussite dans leur parcours vers le diplôme.'
      ),
      'quote', 'La réussite d''un projet de fin d''études commence par une bonne organisation et une communication continue entre l''étudiant et son encadrant.',
      'fullName', 'Pr. Jean Dupont',
      'role', 'Représentant du département des sciences sociales',
      'initials', 'C'
    ),
    'en', JSON_OBJECT(
      'sectionTitle', 'Head of Department''s Message',
      'title', 'Toward an academic environment that connects students and supervisors on a clear, organized path',
      'paragraphs', JSON_ARRAY(
        'It is my pleasure to welcome you to the graduation-projects platform, designed to help our students and professors track projects with full transparency and organization.',
        'We built it as a bridge between students and their supervisors — from topic selection to the final defense — ensuring quality work and a clear path.',
        'We invite all students to make the most of this tool, and we wish them success on their journey to graduation.'
      ),
      'quote', 'A successful graduation project starts with good organization and continuous communication between student and supervisor.',
      'fullName', 'Prof. John Doe',
      'role', 'Head of the Social Sciences Department',
      'initials', 'H'
    )
  ),
  CURRENT_TIMESTAMP(3)
);
