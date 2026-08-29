CREATE TABLE `parties` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `parties_updated_at` ON `parties` (`updated_at`);