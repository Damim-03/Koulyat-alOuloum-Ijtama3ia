-- A third place for admin-chosen images: the backdrop of the welcome panel on
-- the sign-in page. Existing rows keep their place.
ALTER TABLE `HomeSlide` MODIFY `placement` ENUM('home', 'about', 'login') NOT NULL DEFAULT 'home';
