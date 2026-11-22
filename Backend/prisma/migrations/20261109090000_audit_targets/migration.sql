-- The audit log: what each change was made to, by name (kept after the item
-- is gone), and the indexes its filters read — an item's history, a role,
-- an address.
ALTER TABLE `AuditLog` ADD COLUMN `targetLabel` VARCHAR(191) NULL;

CREATE INDEX `AuditLog_targetType_targetId_createdAt_idx` ON `AuditLog`(`targetType`, `targetId`, `createdAt`);
CREATE INDEX `AuditLog_actorRole_createdAt_idx` ON `AuditLog`(`actorRole`, `createdAt`);
CREATE INDEX `AuditLog_ip_createdAt_idx` ON `AuditLog`(`ip`, `createdAt`);
