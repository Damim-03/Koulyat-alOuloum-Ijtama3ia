-- Slides now belong to a place: the home page's backdrop (every existing row)
-- or the gallery on the "about the platform" page. Ordering and the cap are
-- per place, so the index leads with it.
ALTER TABLE `HomeSlide` ADD COLUMN `placement` ENUM('home', 'about') NOT NULL DEFAULT 'home';

DROP INDEX `HomeSlide_isActive_sortOrder_idx` ON `HomeSlide`;
CREATE INDEX `HomeSlide_placement_isActive_sortOrder_idx` ON `HomeSlide`(`placement`, `isActive`, `sortOrder`);
