-- A fourth place for admin-chosen images: the backdrop behind the heading of
-- the "about the platform" page. Existing rows keep their place.
ALTER TABLE `HomeSlide` MODIFY `placement` ENUM('home', 'about', 'login', 'aboutHero') NOT NULL DEFAULT 'home';
