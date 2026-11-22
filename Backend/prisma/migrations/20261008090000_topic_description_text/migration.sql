-- Topic descriptions were VARCHAR(191). The server runs without strict mode,
-- so anything longer was cut at 191 characters, silently: the professor saw
-- their description saved, and students read half of it.
--
-- TEXT holds 65,535 bytes — over 20,000 Arabic characters. The application
-- caps a description well below that.
ALTER TABLE `GraduationTopic` MODIFY `description` TEXT NOT NULL;
