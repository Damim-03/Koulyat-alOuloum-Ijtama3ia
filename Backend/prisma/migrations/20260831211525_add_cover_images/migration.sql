-- أسماء الجداول بحالة أحرفها الصحيحة كما أنشأتها الهجرة الأولى.
--
-- كُتبت هذه الهجرة بأحرفٍ صغيرة (`department` بدل `Department`)، فمرّت على
-- ويندوز ومَنعت لينكس. والسبب أن MySQL/MariaDB على ويندوز تُخزّن أسماء
-- الجداول بحروفٍ صغيرة وتُطابقها بلا حساسية (`lower_case_table_names=1`)،
-- بينما على لينكس الاسم حسّاسٌ لحالة أحرفه افتراضياً.
--
-- فكانت النتيجة أن `prisma migrate deploy` لم ينجح على قاعدةٍ فارغة على
-- لينكس قطّ:
--
--     Database error code: 1146
--     Table 'kouliate_ouloum_test.department' doesn't exist
--
-- وهذا لا يمسّ التشغيل الآلي وحده — بل كل نشرٍ على خادم لينكس.
--
-- وتعديل هجرةٍ طُبِّقت مخالفٌ للقاعدة العامّة، لكن لا بديل هنا: هجرةٌ تفشل
-- في موضعها لا تُصلحها هجرةٌ بعدها، إذ لا يصل التنفيذ إليها أصلاً. والقواعد
-- التي طُبِّقت عليها فعلاً تحمل الأعمدة نفسها، فالتعديل لا يغيّر شيئاً في
-- نتيجتها — يغيّر بصمتها فقط، وتلك تُصالَح مرّةً واحدة.

-- AlterTable
ALTER TABLE `Department` ADD COLUMN `coverUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Domain` ADD COLUMN `coverUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Faculty` ADD COLUMN `coverUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Filiere` ADD COLUMN `coverUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Specialization` ADD COLUMN `coverUrl` VARCHAR(191) NULL;
