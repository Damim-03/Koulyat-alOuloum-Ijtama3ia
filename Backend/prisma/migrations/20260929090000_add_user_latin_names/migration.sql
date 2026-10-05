-- The name in Latin script, as it appears on the French side of official
-- documents. It cannot be derived from the Arabic name (حمادي may be Hamadi
-- or Hammadi), so it is entered as written on the person's own documents.
-- Additive and nullable: existing rows keep NULL, and the interface falls back
-- to the Arabic name.
ALTER TABLE `User`
  ADD COLUMN `firstNameLatin` VARCHAR(191) NULL,
  ADD COLUMN `lastNameLatin` VARCHAR(191) NULL;
