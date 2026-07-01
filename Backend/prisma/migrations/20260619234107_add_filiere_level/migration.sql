-- 1) جدول الشُّعب
CREATE TABLE "Filiere" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Filiere_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Filiere_code_key" ON "Filiere"("code");

ALTER TABLE "Filiere"
  ADD CONSTRAINT "Filiere_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) أنشئ شعبة افتراضية واحدة داخل كل قسم موجود (لإيواء التخصّصات الحالية)
INSERT INTO "Filiere" ("id", "name", "code", "departmentId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'شعبة عامة', 'GEN-' || "id", "id", NOW(), NOW()
FROM "Department";

-- 3) أضِف العمود قابلاً للـ NULL مؤقّتًا
ALTER TABLE "Specialization" ADD COLUMN "filiereId" TEXT;

-- 4) اربط كل تخصّص بالشعبة الافتراضية لقسمه الحالي
UPDATE "Specialization" s
SET "filiereId" = f."id"
FROM "Filiere" f
WHERE f."departmentId" = s."departmentId";

-- 5) افرض الإلزام والمفتاح الأجنبي
ALTER TABLE "Specialization" ALTER COLUMN "filiereId" SET NOT NULL;

ALTER TABLE "Specialization"
  ADD CONSTRAINT "Specialization_filiereId_fkey"
  FOREIGN KEY ("filiereId") REFERENCES "Filiere"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6) أسقِط العلاقة القديمة (تخصّص → قسم)
ALTER TABLE "Specialization" DROP CONSTRAINT IF EXISTS "Specialization_departmentId_fkey";
ALTER TABLE "Specialization" DROP COLUMN "departmentId";