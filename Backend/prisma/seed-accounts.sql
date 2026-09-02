-- ============================================================================
--  إنشاء حسابات تجريبية: مسؤول (admin) + أستاذ (professor) + 3 طلبة (students)
--  قاعدة البيانات: UNIV  (MySQL / MariaDB)
--
--  كلمة المرور لكل الحسابات:  Passw0rd@2026
--  (الـ hash أدناه مولَّد بـ bcryptjs بـ 10 rounds — نفس المكتبة المستعملة في
--   Backend/src/modules/auth/auth.service.ts)
--
--  الملف idempotent: يمكن تشغيله أكثر من مرّة دون أخطاء تكرار.
--
--  طريقة التشغيل:
--    mysql -u root -p UNIV < Backend/prisma/seed-accounts.sql
--  ⚠ المعرفات UUID إلزامًا: مخطّطات التحقّق في الخلفية تشترط z.string().uuid()
--  لـ facultyId / departmentId / specializationId … ومعرّف غير UUID يجعل كل إضافة
--  تحت هذه الصفوف تُرفض بـ 400.
--
-- ============================================================================

SET NAMES utf8mb4;
SET @HASH = '$2b$10$A3DLuk5aTyMamC7Y85sHfe/rFtoe6FC2IXKFP43hyWUD40iHvZcIq';
SET @NOW  = NOW(3);

-- ────────────────────────────────────────────────────────────────────────────
-- 1) الهرم الأكاديمي (مطلوب: الطالب يحتاج تخصّصًا وسنةً، والأستاذ يحتاج قسمًا)
-- ────────────────────────────────────────────────────────────────────────────

-- الكلية
INSERT INTO `Faculty` (`id`, `name`, `code`, `createdAt`, `updatedAt`)
VALUES ('b73c9a27-f9f9-487a-916b-63d14e96310d', 'كلية العلوم الاجتماعية والإنسانية', 'FSSH', @NOW, @NOW)
ON DUPLICATE KEY UPDATE `updatedAt` = @NOW;

-- القسم
INSERT INTO `Department` (`id`, `name`, `code`, `facultyId`, `createdAt`, `updatedAt`)
VALUES ('b9661a42-bd0e-44e7-9ccc-83a502078764', 'قسم العلوم الاجتماعية', 'DEP-SOC',
        'b73c9a27-f9f9-487a-916b-63d14e96310d', @NOW, @NOW)
ON DUPLICATE KEY UPDATE `updatedAt` = @NOW;

-- الميدان
INSERT INTO `Domain` (`id`, `name`, `code`, `departmentId`, `createdAt`, `updatedAt`)
VALUES ('bedeff09-1a2a-4944-8ace-81bd3eb24acc', 'ميدان العلوم الاجتماعية', 'DOM-SOC',
        'b9661a42-bd0e-44e7-9ccc-83a502078764', @NOW, @NOW)
ON DUPLICATE KEY UPDATE `updatedAt` = @NOW;

-- الشعبة
INSERT INTO `Filiere` (`id`, `name`, `code`, `departmentId`, `domainId`, `createdAt`, `updatedAt`)
VALUES ('ec0334d3-5979-4370-88f0-7ecdaadbf003', 'شعبة علم النفس', 'FIL-PSY',
        'b9661a42-bd0e-44e7-9ccc-83a502078764', 'bedeff09-1a2a-4944-8ace-81bd3eb24acc', @NOW, @NOW)
ON DUPLICATE KEY UPDATE `updatedAt` = @NOW;

-- التخصّص  (level: licence | master | doctorate)
INSERT INTO `Specialization` (`id`, `name`, `level`, `filiereId`, `createdAt`, `updatedAt`)
VALUES ('b3c1506a-22bb-4883-8e82-a00036d08886', 'علم النفس العيادي', 'master',
        'ec0334d3-5979-4370-88f0-7ecdaadbf003', @NOW, @NOW)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `updatedAt` = @NOW;

-- السنة الجامعية (مفعّلة)
INSERT INTO `AcademicYear` (`id`, `title`, `isActive`, `createdAt`, `updatedAt`)
VALUES ('38da532e-9ae2-4423-a79d-59a39bf375c1', '2025/2026', 1, @NOW, @NOW)
ON DUPLICATE KEY UPDATE `isActive` = 1, `updatedAt` = @NOW;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) المستخدمون (جدول User هو جذر الهوية لكل الأدوار)
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO `User`
  (`id`, `firstName`, `lastName`, `email`, `username`, `password`, `phone`,
   `role`, `status`, `isVerified`, `createdAt`, `updatedAt`)
VALUES
  -- ─── المسؤول ───
  ('usr-admin-0001', 'أحمد', 'بن علي',
   'admin@univ-eloued.dz', 'admin', @HASH, '0550000001',
   'admin', 'active', 1, @NOW, @NOW),

  -- ─── الأستاذ ───
  ('usr-prof-0001', 'خالد', 'مرابط',
   'k.merabet@univ-eloued.dz', 'k.merabet', @HASH, '0550000002',
   'professor', 'active', 1, @NOW, @NOW),

  -- ─── الطلبة الثلاثة ───
  ('usr-stud-0001', 'سارة', 'بوعلام',
   'sara.boualam@univ-eloued.dz', 'sara.boualam', @HASH, '0550000003',
   'student', 'active', 1, @NOW, @NOW),

  ('usr-stud-0002', 'يوسف', 'حمادي',
   'youcef.hamadi@univ-eloued.dz', 'youcef.hamadi', @HASH, '0550000004',
   'student', 'active', 1, @NOW, @NOW),

  ('usr-stud-0003', 'أمينة', 'زروقي',
   'amina.zerrouki@univ-eloued.dz', 'amina.zerrouki', @HASH, '0550000005',
   'student', 'active', 1, @NOW, @NOW)
ON DUPLICATE KEY UPDATE
  `password`  = VALUES(`password`),
  `status`    = 'active',
  `updatedAt` = @NOW;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) ملف الأستاذ  (البريد الجامعي يجب أن ينتهي بـ @univ-eloued.dz — يفرضه
--    professorLoginSchema في auth.validation.ts)
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO `Professor`
  (`id`, `employeeNumber`, `universityEmail`, `userId`, `departmentId`,
   `grade`, `tags`, `createdAt`, `updatedAt`)
VALUES
  ('prf-0001', 'EMP-1001', 'k.merabet@univ-eloued.dz',
   'usr-prof-0001', 'b9661a42-bd0e-44e7-9ccc-83a502078764',
   JSON_ARRAY('أستاذ محاضر أ'),
   JSON_ARRAY('علم النفس العيادي', 'الصحة النفسية'),
   @NOW, @NOW)
ON DUPLICATE KEY UPDATE `updatedAt` = @NOW;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) ملفات الطلبة  (تسجيل الدخول يتم برقم التسجيل registrationNumber)
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO `Student`
  (`id`, `registrationNumber`, `userId`, `specializationId`, `academicYearId`,
   `createdAt`, `updatedAt`)
VALUES
  ('std-0001', '202039012345', 'usr-stud-0001',
   'b3c1506a-22bb-4883-8e82-a00036d08886', '38da532e-9ae2-4423-a79d-59a39bf375c1', @NOW, @NOW),

  ('std-0002', '202039012346', 'usr-stud-0002',
   'b3c1506a-22bb-4883-8e82-a00036d08886', '38da532e-9ae2-4423-a79d-59a39bf375c1', @NOW, @NOW),

  ('std-0003', '202039012347', 'usr-stud-0003',
   'b3c1506a-22bb-4883-8e82-a00036d08886', '38da532e-9ae2-4423-a79d-59a39bf375c1', @NOW, @NOW)
ON DUPLICATE KEY UPDATE `updatedAt` = @NOW;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) التحقّق
-- ────────────────────────────────────────────────────────────────────────────

SELECT u.`role`, u.`firstName`, u.`lastName`, u.`email`,
       COALESCE(s.`registrationNumber`, p.`universityEmail`) AS `credential`,
       u.`status`
FROM `User` u
LEFT JOIN `Student`   s ON s.`userId` = u.`id`
LEFT JOIN `Professor` p ON p.`userId` = u.`id`
WHERE u.`id` IN ('usr-admin-0001', 'usr-prof-0001',
                 'usr-stud-0001', 'usr-stud-0002', 'usr-stud-0003')
ORDER BY FIELD(u.`role`, 'admin', 'professor', 'student'), u.`lastName`;
