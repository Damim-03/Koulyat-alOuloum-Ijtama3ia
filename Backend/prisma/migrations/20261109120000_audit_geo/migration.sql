-- The audit log: where each address is — country, region, city and the
-- network it belongs to — read on this server from DB-IP's databases
-- (core/geo) when the row is written. And the index the country filter reads.
ALTER TABLE `AuditLog` ADD COLUMN `country` VARCHAR(2) NULL,
    ADD COLUMN `region` VARCHAR(100) NULL,
    ADD COLUMN `city` VARCHAR(100) NULL,
    ADD COLUMN `isp` VARCHAR(120) NULL;

CREATE INDEX `AuditLog_country_createdAt_idx` ON `AuditLog`(`country`, `createdAt`);
